import React, { useState, useEffect, useCallback } from 'react';
import { dbService } from '../services/dbService';
import { compareFaces } from '../services/faceRecognitionService';
import CameraCapture from '../components/CameraCapture';
import { speak } from '../src/utils/speech';
import Spinner from '../components/Spinner';
import { AttendanceRecord, Collaborator } from '../types';
import DatePicker from '../components/DatePicker';

interface RecognitionResult {
  status: 'success' | 'error' | 'none' | 'info' | 'warning';
  message: string;
}

type ActionType = 'entry' | 'exit';

async function imageUrlToBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Fórmula Haversine para calcular distancia en metros
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; 
  const p1 = lat1 * Math.PI/180;
  const p2 = lat2 * Math.PI/180;
  const dp = (lat2-lat1) * Math.PI/180;
  const dl = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(dp/2) * Math.sin(dp/2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(dl/2) * Math.sin(dl/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

const getLocation = async (): Promise<{ latitude: number, longitude: number, name?: string } | null> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        let name = undefined;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
          if (res.ok) {
            const data = await res.json();
            
            // 1. Revisar si estamos en una empresa registrada manualmente en la base de datos
            let knownCompany = null;
            try {
               const knownLocations = await dbService.getKnownLocations();
               for (const loc of knownLocations) {
                  const dist = getDistance(lat, lon, loc.lat, loc.lon);
                  if (dist <= loc.radius) {
                     knownCompany = loc.name;
                     break;
                  }
               }
            } catch (e) {
               console.warn('Error fetching known locations', e);
            }

            let poiName = knownCompany || data.name || data.address?.amenity || data.address?.office || data.address?.shop || data.address?.building;
            const roadName = data.address?.road || data.address?.suburb || data.address?.city || '';
            const houseNumber = data.address?.house_number || '';
            const fullRoad = houseNumber && roadName ? `${roadName} ${houseNumber}` : roadName;

            // Si no obtuvimos un POI o el POI es igual a la calle, buscamos en el perímetro (40m)
            if (!poiName || poiName === roadName || poiName === fullRoad) {
              try {
                const overpassQuery = `[out:json];nwr(around:40,${lat},${lon})["name"]["highway"!~"."];out center;`;
                const opRes = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`);
                if (opRes.ok) {
                  const opData = await opRes.json();
                  if (opData.elements && opData.elements.length > 0) {
                    let closest = opData.elements[0];
                    let minD = Infinity;
                    for (const el of opData.elements) {
                      const elLat = el.lat || el.center?.lat;
                      const elLon = el.lon || el.center?.lon;
                      if (elLat && elLon) {
                        const d = Math.pow(elLat - lat, 2) + Math.pow(elLon - lon, 2);
                        if (d < minD) {
                          minD = d;
                          closest = el;
                        }
                      }
                    }
                    if (closest && closest.tags && closest.tags.name) {
                      poiName = closest.tags.name;
                    }
                  }
                }
              } catch (e) {
                console.warn('Overpass API failed', e);
              }
            }
            
            let baseAddress = fullRoad;
            if (data.display_name) {
              baseAddress = data.display_name.split(',').slice(0, 3).map((s: string) => s.trim()).join(', ');
            }
            if (poiName && baseAddress && !baseAddress.includes(poiName)) {
              name = `${poiName} - ${baseAddress}`;
            } else {
              name = baseAddress || poiName || 'Ubicación obtenida';
            }
          }
        } catch (e) {
          console.warn('Reverse geocoding failed', e);
        }
        resolve({ latitude: lat, longitude: lon, name });
      },
      (error) => {
        console.warn('Geolocation error:', error);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
};

const Dashboard: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<RecognitionResult>({ status: 'none', message: '' });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dailyRecords, setDailyRecords] = useState<AttendanceRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());
  const [selectedAction, setSelectedAction] = useState<ActionType>('entry');
  const [cameraActive, setCameraActive] = useState<ActionType | null>(null);
  const [cameraKey, setCameraKey] = useState(0);
  const [collaboratorHistory, setCollaboratorHistory] = useState<{name: string, records: AttendanceRecord[]} | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number, longitude: number, name?: string } | null>(null);
  
  // PIN Fallback state
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState('');
  const [allCollaborators, setAllCollaborators] = useState<Collaborator[]>([]);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [progressInfo, setProgressInfo] = useState({ current: 0, total: 0 });
  const [showRecords, setShowRecords] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchLocation = async () => {
      setIsLoadingLocation(true);
      const loc = await getLocation();
      if (mounted) {
        setCurrentLocation(loc);
        setIsLoadingLocation(false);
      }
    };
    fetchLocation();
    return () => { mounted = false; };
  }, []);

  const fetchDailyRecords = useCallback(async (date: string) => {
    try {
      const records = await dbService.getAttendanceRecordsByDate(date);
      setDailyRecords(records);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error desconocido.';
      console.error("Error al cargar registros del día:", error);
      setResult({ status: 'error', message: `No se pudieron cargar los registros. ${errorMessage}` });
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    fetchDailyRecords(selectedDate);
    return () => clearInterval(timer);
  }, [fetchDailyRecords, selectedDate]);

  // Auto-cerrar mensaje de resultado después de 5 segundos
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (result.status !== 'none' && !isLoading) {
      timeoutId = setTimeout(() => {
        setResult({ status: 'none', message: '' });
      }, 5000);
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [result, isLoading]);

  // Voice feedback para cualquier cambio en result
  useEffect(() => {
    if (result.status !== 'none' && result.message) {
      speak(result.message);
    }
  }, [result]);

  const handleActionSelect = (action: ActionType) => {
    setResult({ status: 'none', message: '' });
    setSelectedAction(action);
    setCameraActive(action);
    setCameraKey(k => k + 1);
    setCollaboratorHistory(null);
    setProgressInfo({ current: 0, total: 0 });
    speak(`Por favor, mire a la cámara para registrar su ${action === 'entry' ? 'entrada' : 'salida'}.`);
  };

  const handleCapture = async (imageBase64: string) => {
    setIsLoading(true);
    setResult({ status: 'info', message: 'Identificando colaborador...' });

    try {
      const collaborators = await dbService.getCollaborators();
      if (collaborators.length === 0) {
        setResult({ status: 'error', message: 'No hay colaboradores registrados para comparar.' });
        setIsLoading(false);
        return;
      }

      // Algoritmo de optimización de búsqueda (Smart Sorting)
      // Prioriza a los colaboradores que tienen más probabilidad de ser el objetivo
      const todayEntries = new Set(
        dailyRecords.filter(r => r.type === 'entry').map(r => r.collaborator_id)
      );
      const todayExits = new Set(
        dailyRecords.filter(r => r.type === 'exit').map(r => r.collaborator_id)
      );

      const sortedCollaborators = [...collaborators].sort((a, b) => {
        const aHasEntered = todayEntries.has(a.id);
        const aHasExited = todayExits.has(a.id);
        const bHasEntered = todayEntries.has(b.id);
        const bHasExited = todayExits.has(b.id);

        const aNeedsExit = aHasEntered && !aHasExited;
        const bNeedsExit = bHasEntered && !bHasExited;
        
        const aNeedsEntry = !aHasEntered;
        const bNeedsEntry = !bHasEntered;

        if (selectedAction === 'exit') {
          if (aNeedsExit && !bNeedsExit) return -1;
          if (!aNeedsExit && bNeedsExit) return 1;
        } else {
          if (aNeedsEntry && !bNeedsEntry) return -1;
          if (!aNeedsEntry && bNeedsEntry) return 1;
        }
        return 0;
      });

      let matchFound: Collaborator | null = null;
      const BATCH_SIZE = 3; // Lotes de consultas concurrentes
      const validCollaborators = sortedCollaborators.filter(c => c.photo);
      setProgressInfo({ current: 0, total: validCollaborators.length });

      for (let i = 0; i < validCollaborators.length; i += BATCH_SIZE) {
        const batch = validCollaborators.slice(i, i + BATCH_SIZE);
        
        if (batch.length === 0) continue;

        const results = await Promise.all(
          batch.map(async (collaborator) => {
            try {
              const storedImageBase64 = await imageUrlToBase64(collaborator.photo!);
              const isMatch = await compareFaces(imageBase64, storedImageBase64);
              return { collaborator, isMatch };
            } catch (error) {
              console.error(`Error comparando rostro para ${collaborator.name}:`, error);
              if (error instanceof Error && error.message === 'OBSCURED_FACE') {
                throw error;
              }
              return { collaborator, isMatch: false };
            }
          })
        );

        setProgressInfo(prev => ({ ...prev, current: Math.min(prev.current + batch.length, validCollaborators.length) }));

        const match = results.find(r => r.isMatch);
        if (match) {
          matchFound = match.collaborator;
          break;
        }
      }

      if (!matchFound) {
        setResult({ status: 'error', message: 'No estás registrado o la cámara no te reconoció.' });
        setAllCollaborators(collaborators); // Save list for PIN fallback
        setIsLoading(false);
        return;
      }

      await processAttendance(matchFound, selectedAction, imageBase64);
    } catch (error) {
      console.error("Error al registrar:", error);
      if (error instanceof Error && error.message === 'OBSCURED_FACE') {
        setResult({ status: 'warning', message: 'No se pudo identificar el rostro. Por favor, retírese gafas oscuras, mascarillas o elementos que lo oculten e intente de nuevo.' });
      } else {
        setResult({ status: 'error', message: `Error: ${error instanceof Error ? error.message : 'desconocido'}` });
        setCameraActive(null);
      }
      setIsLoading(false);
    }
  };

  const processAttendance = async (matchFound: Collaborator, action: ActionType, imageBase64?: string) => {
    setIsLoading(true);
    try {

      const history = await dbService.getAttendanceRecordsByCollaboratorId(matchFound.id);
      setCollaboratorHistory({ name: matchFound.name, records: history });

      const today = getLocalDateString();
      const schedule = await dbService.getScheduleForCollaboratorOnDate(matchFound.id, today);

      if (!schedule) {
        setResult({ status: 'warning', message: `${matchFound.name}, no tienes un turno programado para hoy.` });
        setIsLoading(false);
        return;
      }

      const lastRecord = await dbService.getLastRecordForCollaborator(matchFound.id);
      const expectedAction = lastRecord?.type === 'entry' ? 'exit' : 'entry';

      if (action !== expectedAction) {
        setResult({
          status: 'error',
          message: `Acción inválida. Tu próxima acción debe ser ${expectedAction === 'entry' ? 'entrada' : 'salida'}.`
        });
        setIsLoading(false);
        return;
      }

      if (lastRecord && lastRecord.type === 'entry') {
        const lastRecordDate = getLocalDateString(new Date(lastRecord.timestamp));
        const todayDate = getLocalDateString(new Date());
        if (lastRecordDate !== todayDate) {
          setResult({
            status: 'error',
            message: `Acceso bloqueado. Tienes un turno abierto del día ${lastRecordDate}. Contacta a RRHH.`
          });
          setIsLoading(false);
          return;
        }
      }

      // Use pre-fetched location if available
      let finalLocation = currentLocation;
      if (!finalLocation) {
        try {
          finalLocation = await getLocation();
        } catch (e) {
          console.warn('Could not get location', e);
        }
      }

      const newRecord = await dbService.addAttendanceRecord({
        collaborator_id: matchFound.id,
        collaborator_name: matchFound.name,
        timestamp: new Date().toISOString(),
        type: action,
        latitude: finalLocation?.latitude,
        longitude: finalLocation?.longitude,
        location_name: finalLocation?.name,
      }, imageBase64 || ''); // Si es por PIN, enviamos empty string

      const newStatus = action === 'entry' ? 'present' : schedule.status;
      await dbService.updateSchedule({ ...schedule, status: newStatus });

      setResult({
        status: 'success',
        message: `Registro de ${action === 'entry' ? 'entrada' : 'salida'} exitoso para ${matchFound.name}.`
      });
      setCameraActive(null);

      const todayString = getLocalDateString();
      if (selectedDate !== todayString) {
        setSelectedDate(todayString);
      }
      
      // Re-fetch history and manually insert if Turso replica is delayed
      const updatedHistory = await dbService.getAttendanceRecordsByCollaboratorId(matchFound.id);
      if (!updatedHistory.find(r => r.id === newRecord.id)) {
        updatedHistory.unshift(newRecord);
      }
      setCollaboratorHistory({ name: matchFound.name, records: updatedHistory });

      const updatedDaily = await dbService.getAttendanceRecordsByDate(todayString);
      if (!updatedDaily.find(r => r.id === newRecord.id)) {
        updatedDaily.unshift(newRecord);
      }
      setDailyRecords(updatedDaily);

    } catch (error) {
      console.error("Error al registrar:", error);
      setResult({ status: 'error', message: `Error: ${error instanceof Error ? error.message : 'desconocido'}` });
    } finally {
      setIsLoading(false);
      setCameraActive(null);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCollaboratorId || !pinInput) {
      alert("Por favor selecciona tu nombre e ingresa tu PIN.");
      return;
    }
    const collaborator = allCollaborators.find(c => c.id === selectedCollaboratorId);
    if (!collaborator) return;
    
    if (collaborator.pin !== pinInput) {
      alert("El PIN ingresado es incorrecto.");
      return;
    }
    
    setShowPinModal(false);
    setPinInput('');
    await processAttendance(collaborator, selectedAction);
  };

  const resetCamera = () => {
    setCameraActive(null);
    setResult({ status: 'none', message: '' });
    setCollaboratorHistory(null);
    setProgressInfo({ current: 0, total: 0 });
  };

  return (
    <div className="container mx-auto space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center mb-2 md:mb-4 gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Control de Asistencia</h1>
          <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1">{currentTime.toLocaleString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Ver registros</span>
          <button 
            type="button" 
            onClick={() => setShowRecords(!showRecords)}
            className={`${showRecords ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2`}
            role="switch"
            aria-checked={showRecords}
          >
            <span aria-hidden="true" className={`${showRecords ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`} />
          </button>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${showRecords ? 'lg:grid-cols-2' : 'max-w-xl mx-auto'} gap-4 md:gap-6`}>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col min-h-[250px] md:min-h-[320px]">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              {progressInfo.total > 0 ? (
                <div className="relative w-24 h-24 mb-6">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle className="text-gray-200 dark:text-gray-700 stroke-current" strokeWidth="8" cx="50" cy="50" r="40" fill="transparent"></circle>
                    <circle 
                      className="text-blue-500 stroke-current transition-all duration-300 ease-out" 
                      strokeWidth="8" 
                      strokeLinecap="round" 
                      cx="50" 
                      cy="50" 
                      r="40" 
                      fill="transparent" 
                      strokeDasharray="251.2" 
                      strokeDashoffset={251.2 - (251.2 * progressInfo.current) / progressInfo.total}
                    ></circle>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-gray-700 dark:text-gray-200">
                      {Math.round((progressInfo.current / progressInfo.total) * 100)}%
                    </span>
                  </div>
                </div>
              ) : (
                <Spinner size="12" />
              )}
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-300 text-center">{result.message}</p>
              {progressInfo.total > 0 && (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Analizando perfiles ({progressInfo.current} de {progressInfo.total})
                </p>
              )}
            </div>
          ) : cameraActive ? (
            <div className="flex flex-col">
              <div className="relative">
                <div className="absolute top-4 left-0 right-0 flex justify-center z-10 pointer-events-none">
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold shadow-lg ${cameraActive === 'entry' ? 'bg-green-600 text-white' : 'bg-orange-600 text-white'}`}>
                    {cameraActive === 'entry' ? 'Registrando Entrada' : 'Registrando Salida'}
                  </div>
                </div>
                <div className="flex justify-center w-full">
                  <CameraCapture key={cameraKey} onCapture={handleCapture} width={480} height={360} />
                </div>
              </div>
              <div className="flex justify-center px-4 pb-4 pt-2">
                <button onClick={resetCamera} className="px-6 py-2.5 md:px-8 md:py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-[0.98] transition-all">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 space-y-4 relative z-0 overflow-hidden">
              <svg className="absolute top-1/2 -left-10 md:-left-16 -translate-y-1/2 w-48 h-48 md:w-64 md:h-64 text-gray-300 dark:text-gray-700 opacity-60 pointer-events-none -z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={0.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              {result.status !== 'none' && (
                <div className={`w-full max-w-md p-4 rounded-xl border-l-4 ${result.status === 'success' ? 'bg-green-50 border-green-500 text-green-800 dark:bg-green-900/20 dark:border-green-500 dark:text-green-300' : result.status === 'error' ? 'bg-red-50 border-red-500 text-red-800 dark:bg-red-900/20 dark:border-red-500 dark:text-red-300' : result.status === 'warning' ? 'bg-yellow-50 border-yellow-500 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-500 dark:text-yellow-300' : 'bg-blue-50 border-blue-500 text-blue-800 dark:bg-blue-900/20 dark:border-blue-500 dark:text-blue-300'}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        {result.status === 'success' && <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />}
                        {result.status === 'error' && <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />}
                        {result.status === 'warning' && <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01" />}
                        {result.status === 'info' && <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold">{result.status === 'success' ? 'Éxito' : result.status === 'error' ? 'Error' : result.status === 'warning' ? 'Advertencia' : 'Info'}</p>
                      <p className="text-sm mt-0.5 opacity-90">{result.message}</p>
                      {result.status === 'error' && allCollaborators.length > 0 && (
                        <button 
                          onClick={() => setShowPinModal(true)}
                          className="mt-3 px-4 py-1.5 bg-white text-red-700 hover:bg-red-50 text-sm font-semibold rounded-lg shadow-sm border border-red-200"
                        >
                          ¿No te reconoce? Usar PIN de Respaldo
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {result.status === 'none' && (
                <>
                  <div className="text-center space-y-1 mb-1">
                    <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">Selecciona una acción</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">La cámara se activará para identificar tu rostro</p>
                  </div>
                  
                  {currentLocation && !isLoadingLocation ? (
                    <div className="w-full max-w-sm mb-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                      <div className="relative h-24 cursor-pointer group" onClick={() => setIsMapModalOpen(true)}>
                        <iframe 
                          width="100%" 
                          height="100%" 
                          style={{ border: 0, pointerEvents: 'none' }} 
                          loading="lazy" 
                          allowFullScreen 
                          src={`https://maps.google.com/maps?q=${currentLocation.latitude},${currentLocation.longitude}&hl=es&z=15&output=embed`}
                        ></iframe>
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 flex items-center justify-center transition-colors">
                          <div className="bg-white/90 text-gray-800 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                            Ampliar mapa
                          </div>
                        </div>
                      </div>
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 flex items-center gap-2">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <span className="truncate font-medium flex-1 text-left text-sm">
                          {currentLocation.name || 'Ubicación obtenida'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full max-w-xs flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-xl border border-blue-100 dark:border-blue-800/30 text-sm mb-4">
                      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      <span className="truncate font-medium">
                        {isLoadingLocation ? 'Obteniendo ubicación...' : 'Ubicación no disponible'}
                      </span>
                    </div>
                  )}
                </>
              )}

              <div className="w-full max-w-xs space-y-2">
                <button onClick={() => handleActionSelect('entry')} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 md:py-3 rounded-xl font-semibold text-sm md:text-base border-2 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50 active:scale-[0.98] transition-all duration-200">
                  <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Marcar Entrada
                </button>
                <button onClick={() => handleActionSelect('exit')} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 md:py-3 rounded-xl font-semibold text-sm md:text-base border-2 border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/50 active:scale-[0.98] transition-all duration-200">
                  <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  Marcar Salida
                </button>
              </div>
            </div>
          )}
        </div>

        {showRecords && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {collaboratorHistory ? `Historial de ${collaboratorHistory.name}` : 'Registros del Día'}
            </h2>
            {collaboratorHistory ? (
              <button 
                onClick={() => setCollaboratorHistory(null)}
                className="text-sm px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 font-medium transition-colors"
              >
                Ver todos
              </button>
            ) : (
              <div className="flex items-center gap-1 bg-gray-100/60 dark:bg-gray-800/60 p-1 rounded-full border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-md shadow-sm">
                <button
                  onClick={() => {
                    const d = new Date(selectedDate);
                    d.setDate(d.getDate() - 1);
                    setSelectedDate(d.toISOString().split('T')[0]);
                  }}
                  className="p-2 rounded-full hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-all duration-200 shadow-none hover:shadow-sm focus:outline-none"
                  aria-label="Día anterior"
                >
                  <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                </button>
                
                <DatePicker selectedDate={selectedDate} onChange={setSelectedDate} />

                <button
                  onClick={() => {
                    const d = new Date(selectedDate);
                    d.setDate(d.getDate() + 1);
                    setSelectedDate(d.toISOString().split('T')[0]);
                  }}
                  className="p-2 rounded-full hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-all duration-200 shadow-none hover:shadow-sm focus:outline-none"
                  aria-label="Día siguiente"
                >
                  <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto max-h-[350px] md:max-h-[450px] p-3 md:p-4 space-y-2">
            {(collaboratorHistory ? collaboratorHistory.records : dailyRecords).length > 0 ? (
              (collaboratorHistory ? collaboratorHistory.records : dailyRecords).map(record => (
                <div key={record.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 md:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-3 md:gap-4 min-w-0">
                    {record.captured_photo_url && (
                      <img 
                        src={record.captured_photo_url} 
                        alt="" 
                        onClick={() => setSelectedPhoto(record.captured_photo_url!)}
                        className="h-10 w-10 md:h-12 md:w-12 flex-shrink-0 rounded-full object-cover border border-gray-200 dark:border-gray-600 cursor-pointer hover:opacity-80 transition-opacity" 
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm md:text-base text-gray-900 dark:text-white truncate">{record.collaborator_name}</p>
                      <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 truncate">
                        {collaboratorHistory 
                          ? new Date(record.timestamp).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) 
                          : new Date(record.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                    {record.latitude && record.longitude && (
                      <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-initial">
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${record.latitude},${record.longitude}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-2 rounded-full flex-shrink-0 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800/40 transition-colors"
                          title="Ver ubicación"
                        >
                          <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </a>
                        {record.location_name && (
                          <span className="text-xs text-gray-500 sm:max-w-[120px] truncate" title={record.location_name}>
                            {record.location_name}
                          </span>
                        )}
                      </div>
                    )}
                    <span className={`px-3 py-1.5 text-xs font-semibold rounded-full flex-shrink-0 ${record.type === 'entry' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'}`}>
                      {record.type === 'entry' ? 'Entrada' : 'Salida'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500 dark:text-gray-400">
                <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <p className="font-medium">No hay registros</p>
                <p className="text-sm mt-1">Para la fecha seleccionada</p>
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {/* Modal de foto */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setSelectedPhoto(null)}>
          <div className="relative max-w-xl w-full" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setSelectedPhoto(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 p-2 transition-colors"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <img src={selectedPhoto} alt="Captura" className="w-full h-auto max-h-[80vh] object-contain rounded-xl shadow-2xl" />
          </div>
        </div>
      )}

      {/* Modal de Mapa */}
      {isMapModalOpen && currentLocation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setIsMapModalOpen(false)}>
          <div className="relative max-w-4xl w-full h-[70vh] bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                {currentLocation.name || 'Ubicación exacta'}
              </h3>
              <button onClick={() => setIsMapModalOpen(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 w-full h-full">
              <iframe 
                width="100%" 
                height="100%" 
                style={{ border: 0 }} 
                loading="lazy" 
                allowFullScreen 
                src={`https://maps.google.com/maps?q=${currentLocation.latitude},${currentLocation.longitude}&hl=es&z=17&output=embed`}
              ></iframe>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 flex justify-end">
               <a 
                 href={`https://www.google.com/maps/search/?api=1&query=${currentLocation.latitude},${currentLocation.longitude}`}
                 target="_blank"
                 rel="noopener noreferrer"
                 className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
               >
                 Abrir en Google Maps <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
               </a>
            </div>
          </div>
        </div>
      )}

      {/* PIN Fallback Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShowPinModal(false)}>
          <div className="relative max-w-sm w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="mb-5 text-center">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">PIN de Respaldo</h3>
              <p className="text-sm text-gray-500 mt-1">Usa tu PIN si la cámara falla.</p>
            </div>
            
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Selecciona tu nombre</label>
                <select 
                  required
                  value={selectedCollaboratorId}
                  onChange={e => setSelectedCollaboratorId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">-- Elige un colaborador --</option>
                  {allCollaborators.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tu PIN</label>
                <input 
                  type="password" 
                  required
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value)}
                  placeholder="****"
                  maxLength={6}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-center tracking-widest text-lg font-bold"
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setShowPinModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-medium rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? 'Verificando...' : 'Entrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;