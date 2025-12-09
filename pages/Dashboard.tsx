import React, { useState, useEffect, useCallback } from 'react';
import { dbService } from '../services/dbService';
import { compareFaces } from '../services/geminiService';
import CameraCapture from '../components/CameraCapture';
import Spinner from '../components/Spinner';
import { AttendanceRecord, Collaborator, Schedule } from '../types';

interface RecognitionResult {
  status: 'success' | 'error' | 'none' | 'info' | 'warning';
  message: string;
}

// Helper para convertir una URL de imagen a formato Base64
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

// Helper para obtener la fecha como YYYY-MM-DD en la zona horaria local, evitando problemas de conversión a UTC.
const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};


const Dashboard: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<RecognitionResult>({ status: 'none', message: '' });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dailyRecords, setDailyRecords] = useState<AttendanceRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());

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

      if (matchFound) {
        setResult({ status: 'info', message: `Hola ${matchFound.name}. Verificando tu turno...` });
        const today = getLocalDateString(); // YYYY-MM-DD
        const schedule = await dbService.getScheduleForCollaboratorOnDate(matchFound.id, today);

        if (!schedule) {
          setResult({ status: 'warning', message: `${matchFound.name}, no tienes un turno programado para hoy.` });
          setIsLoading(false);
          return;
        }

        const lastRecord = await dbService.getLastRecordForCollaborator(matchFound.id);
        const recordType = lastRecord?.type === 'entry' ? 'exit' : 'entry';

        // --- NEW VALIDATION: Block if open shift is from a previous day ---
        if (lastRecord && lastRecord.type === 'entry') {
          const lastRecordDate = getLocalDateString(new Date(lastRecord.timestamp));
          const todayDate = getLocalDateString(new Date());

          if (lastRecordDate !== todayDate) {
            setResult({
              status: 'error',
              message: `Acceso bloqueado. Tienes un turno abierto del día ${lastRecordDate}. Por favor contacta a RRHH para registrar tu salida manual.`
            });
            setIsLoading(false);
            return;
          }
        }
        // ------------------------------------------------------------------

        await dbService.addAttendanceRecord({
          collaborator_id: matchFound.id,
          collaborator_name: matchFound.name,
          timestamp: new Date().toISOString(),
          type: recordType,
        }, imageBase64);

        const newStatus = recordType === 'entry' ? 'present' : schedule.status;
        await dbService.updateSchedule({ ...schedule, status: newStatus });

        const message = `Registro de ${recordType === 'entry' ? 'entrada' : 'salida'} exitoso para ${matchFound.name}.`;
        setResult({ status: 'success', message });

        // Vuelve a la fecha de hoy para mostrar el nuevo registro.
        const todayString = getLocalDateString();
        if (selectedDate !== todayString) {
          setSelectedDate(todayString);
        } else {
          fetchDailyRecords(todayString);
        }

      } else {
        setResult({ status: 'error', message: 'Reconocimiento fallido. No se encontró ninguna coincidencia.' });
      }

    } catch (error) {
      console.error("Error durante el proceso de reconocimiento:", error);
      const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error desconocido.';
      setResult({ status: 'error', message: `Error durante el proceso de reconocimiento: ${errorMessage}` });
    } finally {
      setIsLoading(false);
    }
  };

  const getResultClasses = (status: RecognitionResult['status']) => {
    switch (status) {
      case 'success': return 'bg-green-100 border-green-500 text-green-700';
      case 'error': return 'bg-red-100 border-red-500 text-red-700';
      case 'warning': return 'bg-yellow-100 border-yellow-500 text-yellow-700';
      case 'info':
      default: return 'bg-blue-100 border-blue-500 text-blue-700';
    }
  };

  return (
    <div className="container mx-auto">
      <h1 className="text-3xl font-bold mb-2 text-center text-gray-800 dark:text-gray-200">Control de Asistencia por Turno</h1>
      <p className="text-center text-gray-600 dark:text-gray-400 mb-6">{currentTime.toLocaleString('es-CO')}</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-center">Registro Facial</h2>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-96">
              <Spinner size="12" />
              <p className="mt-4 text-lg">{result.message || 'Procesando imagen...'}</p>
            </div>
          ) : (
            <CameraCapture onCapture={handleCapture} />
          )}
          {result.status !== 'none' && !isLoading && (
            <div className={`mt-4 p-4 border-l-4 rounded ${getResultClasses(result.status)}`} role="alert">
              <p className="font-bold">{result.status.charAt(0).toUpperCase() + result.status.slice(1)}</p>
              <p>{result.message}</p>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Registros del Día</h2>
            <div className="relative">
              <label htmlFor="date-picker" className="cursor-pointer relative flex items-center">
                <input
                  id="date-picker"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pr-10 p-2.5"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M20 4a2 2 0 0 0-2-2h-2V1a1 1 0 0 0-2 0v1h-3V1a1 1 0 0 0-2 0v1H6V1a1 1 0 0 0-2 0v1H2a2 2 0 0 0-2 2v2h20V4ZM0 18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8H0v10Zm5-8h10a1 1 0 0 1 0 2H5a1 1 0 0 1 0-2Z" />
                  </svg>
                </div>
              </label>
            </div>
          </div>
          <div className="overflow-y-auto max-h-96">
            {dailyRecords.length > 0 ? (
              <ul className="space-y-3">
                {dailyRecords.map(record => (
                  <li key={record.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center space-x-4">
                      {record.captured_photo_url && (
                        <img src={record.captured_photo_url} alt={`Foto de ${record.collaborator_name}`} className="h-12 w-12 rounded-full object-cover" />
                      )}
                      <div>
                        <p className="font-semibold text-gray-800 dark:text-gray-200">{record.collaborator_name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{new Date(record.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${record.type === 'entry' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>
                      {record.type === 'entry' ? 'Entrada' : 'Salida'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 mt-8">No hay registros para la fecha seleccionada.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;