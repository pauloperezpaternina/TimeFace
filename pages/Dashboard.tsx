import React, { useState, useEffect, useCallback } from 'react';
import { dbService } from '../services/dbService';
import { compareFaces } from '../services/geminiService';
import CameraCapture from '../components/CameraCapture';
import Spinner from '../components/Spinner';
import { AttendanceRecord, Collaborator } from '../types';

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
            name = data.address?.road || data.address?.suburb || data.address?.city || data.address?.town || data.address?.village || data.display_name?.split(',')[0];
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
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

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

  const handleActionSelect = (action: ActionType) => {
    setResult({ status: 'none', message: '' });
    setSelectedAction(action);
    setCameraActive(action);
    setCameraKey(k => k + 1);
    setCollaboratorHistory(null);
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

      let matchFound: Collaborator | null = null;
      for (const collaborator of collaborators) {
        if (collaborator.photo) {
          const storedImageBase64 = await imageUrlToBase64(collaborator.photo);
          const isMatch = await compareFaces(imageBase64, storedImageBase64);
          if (isMatch) {
            matchFound = collaborator;
            break;
          }
        }
      }

      if (!matchFound) {
        setResult({ status: 'error', message: 'No estás registrado como colaborador.' });
        setIsLoading(false);
        return;
      }

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

      if (selectedAction !== expectedAction) {
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
        type: selectedAction,
        latitude: finalLocation?.latitude,
        longitude: finalLocation?.longitude,
        location_name: finalLocation?.name,
      }, imageBase64);

      const newStatus = selectedAction === 'entry' ? 'present' : schedule.status;
      await dbService.updateSchedule({ ...schedule, status: newStatus });

      setResult({
        status: 'success',
        message: `Registro de ${selectedAction === 'entry' ? 'entrada' : 'salida'} exitoso para ${matchFound.name}.`
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

  const resetCamera = () => {
    setCameraActive(null);
    setResult({ status: 'none', message: '' });
    setCollaboratorHistory(null);
  };

  return (
    <div className="container mx-auto space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Control de Asistencia</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{currentTime.toLocaleString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col min-h-[400px]">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <Spinner size="12" />
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">{result.message}</p>
            </div>
          ) : cameraActive ? (
            <div className="flex flex-col">
              <div className="relative">
                <div className="absolute top-4 left-0 right-0 flex justify-center z-10 pointer-events-none">
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold shadow-lg ${cameraActive === 'entry' ? 'bg-green-600 text-white' : 'bg-orange-600 text-white'}`}>
                    {cameraActive === 'entry' ? 'Registrando Entrada' : 'Registrando Salida'}
                  </div>
                </div>
                <CameraCapture key={cameraKey} onCapture={handleCapture} width={640} height={480} />
              </div>
              <div className="flex justify-center px-4 pb-4 pt-2">
                <button onClick={resetCamera} className="px-8 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-[0.98] transition-all">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6">
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
                    </div>
                  </div>
                </div>
              )}

              {result.status === 'none' && (
                <>
                  <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    <svg className="w-10 h-10 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div className="text-center space-y-2 mb-2">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Selecciona una acción</h3>
                    <p className="text-gray-500 dark:text-gray-400">La cámara se activará para identificar tu rostro</p>
                  </div>
                  
                  <div className="w-full max-w-xs flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-xl border border-blue-100 dark:border-blue-800/30 text-sm mb-4">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span className="truncate font-medium">
                      {isLoadingLocation ? 'Obteniendo ubicación...' : currentLocation?.name ? currentLocation.name : currentLocation ? 'Ubicación obtenida' : 'Ubicación no disponible'}
                    </span>
                  </div>
                </>
              )}

              <div className="w-full max-w-xs space-y-3">
                <button onClick={() => handleActionSelect('entry')} className="w-full flex items-center justify-center gap-4 px-6 py-5 rounded-xl font-semibold text-lg border-2 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50 active:scale-[0.98] transition-all duration-200">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Marcar Entrada
                </button>
                <button onClick={() => handleActionSelect('exit')} className="w-full flex items-center justify-center gap-4 px-6 py-5 rounded-xl font-semibold text-lg border-2 border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/50 active:scale-[0.98] transition-all duration-200">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  Marcar Salida
                </button>
              </div>
            </div>
          )}
        </div>

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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const d = new Date(selectedDate);
                    d.setDate(d.getDate() - 1);
                    setSelectedDate(d.toISOString().split('T')[0]);
                  }}
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
                  aria-label="Día anterior"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <input
                  id="date-picker"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="min-w-[140px] px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer appearance-none"
                  style={{ fontSize: '16px' }}
                />
                <button
                  onClick={() => {
                    const d = new Date(selectedDate);
                    d.setDate(d.getDate() + 1);
                    setSelectedDate(d.toISOString().split('T')[0]);
                  }}
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
                  aria-label="Día siguiente"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto max-h-[500px] p-4 space-y-2">
            {(collaboratorHistory ? collaboratorHistory.records : dailyRecords).length > 0 ? (
              (collaboratorHistory ? collaboratorHistory.records : dailyRecords).map(record => (
                <div key={record.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-4">
                    {record.captured_photo_url && (
                      <img src={record.captured_photo_url} alt="" className="h-12 w-12 rounded-full object-cover border border-gray-200 dark:border-gray-600" />
                    )}
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{record.collaborator_name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {collaboratorHistory 
                          ? new Date(record.timestamp).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) 
                          : new Date(record.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {record.latitude && record.longitude && (
                      <div className="flex items-center gap-2">
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${record.latitude},${record.longitude}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-2 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800/40 transition-colors"
                          title="Ver ubicación"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </a>
                        {record.location_name && (
                          <span className="text-xs text-gray-500 max-w-[120px] truncate" title={record.location_name}>
                            {record.location_name}
                          </span>
                        )}
                      </div>
                    )}
                    <span className={`px-3 py-1.5 text-xs font-semibold rounded-full ${record.type === 'entry' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'}`}>
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
      </div>
    </div>
  );
};

export default Dashboard;