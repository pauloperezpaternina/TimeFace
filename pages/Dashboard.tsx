
import React, { useState, useEffect, useCallback } from 'react';
import { dbService } from '../services/dbService';
import { compareFaces } from '../services/geminiService';
import CameraCapture from '../components/CameraCapture';
import Spinner from '../components/Spinner';
import { AttendanceRecord, Collaborator, AttendanceType } from '../types';

interface RecognitionResult {
  status: 'success' | 'error' | 'none';
  message: string;
}

const Dashboard: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<RecognitionResult>({ status: 'none', message: '' });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [recentRecords, setRecentRecords] = useState<AttendanceRecord[]>([]);

  const fetchRecentRecords = useCallback(() => {
    const allRecords = dbService.getAttendanceRecords();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayRecords = allRecords.filter(r => r.timestamp >= today.getTime());
    setRecentRecords(todayRecords.slice(0, 10)); // Show latest 10 for today
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    fetchRecentRecords();
    return () => clearInterval(timer);
  }, [fetchRecentRecords]);
  
  const handleCapture = async (imageBase64: string) => {
    setIsLoading(true);
    setResult({ status: 'none', message: '' });

    const collaborators = dbService.getCollaborators();
    if (collaborators.length === 0) {
        setResult({ status: 'error', message: 'No hay colaboradores registrados en el sistema.' });
        setIsLoading(false);
        return;
    }

    let matchFound: Collaborator | null = null;

    for (const collaborator of collaborators) {
      if (collaborator.photo) {
        setResult({ status: 'none', message: `Verificando ${collaborator.name}...` });
        const isMatch = await compareFaces(imageBase64, collaborator.photo);
        if (isMatch) {
          matchFound = collaborator;
          break;
        }
      }
    }

    if (matchFound) {
      const lastRecord = dbService.getLastRecordForCollaborator(matchFound.id);
      const newRecordType: AttendanceType = lastRecord?.type === 'entry' ? 'exit' : 'entry';
      
      dbService.addAttendanceRecord({
        collaboratorId: matchFound.id,
        collaboratorName: matchFound.name,
        timestamp: Date.now(),
        type: newRecordType,
      });

      const message = `¡Bienvenido ${matchFound.name}! Registro de ${newRecordType === 'entry' ? 'entrada' : 'salida'} exitoso.`;
      setResult({ status: 'success', message });
      fetchRecentRecords(); // Refresh recent records list
    } else {
      setResult({ status: 'error', message: 'Reconocimiento fallido. Colaborador no encontrado.' });
    }

    setIsLoading(false);
  };

  const getResultClasses = (status: RecognitionResult['status']) => {
    switch (status) {
      case 'success': return 'bg-green-100 border-green-500 text-green-700';
      case 'error': return 'bg-red-100 border-red-500 text-red-700';
      default: return 'bg-blue-100 border-blue-500 text-blue-700';
    }
  };

  return (
    <div className="container mx-auto">
      <h1 className="text-3xl font-bold mb-2 text-center text-gray-800 dark:text-gray-200">Control de Asistencia</h1>
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
              <p className="font-bold">{result.status === 'success' ? 'Éxito' : 'Error'}</p>
              <p>{result.message}</p>
            </div>
          )}
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Registros Recientes del Día</h2>
          <div className="overflow-y-auto max-h-96">
            {recentRecords.length > 0 ? (
              <ul className="space-y-3">
                {recentRecords.map(record => (
                  <li key={record.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <p className="font-semibold text-gray-800 dark:text-gray-200">{record.collaboratorName}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{new Date(record.timestamp).toLocaleTimeString()}</p>
                    </div>
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${record.type === 'entry' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>
                      {record.type === 'entry' ? 'Entrada' : 'Salida'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 mt-8">No hay registros para hoy.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
