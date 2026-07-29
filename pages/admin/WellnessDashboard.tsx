import React, { useState, useEffect } from 'react';
import { dbService } from '../../services/dbService';
import { AttendanceRecord } from '../../types';
import Spinner from '../../components/Spinner';

const WellnessDashboard: React.FC = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        // For demonstration, we just fetch all records of the day. In a real scenario, we might want a specific query.
        const dailyRecords = await dbService.getAttendanceRecordsByDate(today);
        setRecords(dailyRecords);
      } catch (error) {
        console.error('Error fetching records for wellness dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRecords();
    
    // Auto refresh every 30 seconds
    const interval = setInterval(fetchRecords, 30000);
    return () => clearInterval(interval);
  }, []);

  const getWellnessBadge = (status?: string) => {
    switch (status) {
      case 'HAPPY':
        return <span className="bg-green-100 text-green-800 text-xs px-2.5 py-0.5 rounded-full font-medium">Feliz / Enérgico</span>;
      case 'NORMAL':
        return <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-0.5 rounded-full font-medium">Normal</span>;
      case 'FATIGUED':
        return <span className="bg-orange-100 text-orange-800 text-xs px-2.5 py-0.5 rounded-full font-medium">Fatiga</span>;
      case 'STRESSED':
        return <span className="bg-red-100 text-red-800 text-xs px-2.5 py-0.5 rounded-full font-medium">Estrés</span>;
      case 'UNCHECKED':
      default:
        return <span className="bg-gray-100 text-gray-800 text-xs px-2.5 py-0.5 rounded-full font-medium">Pendiente</span>;
    }
  };

  const getSpoofBadge = (status?: string) => {
    if (status === 'SPOOF') {
      return <span className="bg-red-100 text-red-800 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> Posible Fraude</span>;
    }
    if (status === 'OK') {
      return <span className="bg-green-100 text-green-800 text-xs px-2.5 py-0.5 rounded-full font-medium">Genuino</span>;
    }
    return <span className="bg-gray-100 text-gray-800 text-xs px-2.5 py-0.5 rounded-full font-medium">Pendiente</span>;
  };

  // Filter records that have some interesting AI status
  const interestingRecords = records.filter(r => 
    r.spoof_status === 'SPOOF' || 
    r.wellness_status === 'FATIGUED' || 
    r.wellness_status === 'STRESSED'
  );

  return (
    <div className="container mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
          Dashboard de Bienestar y Seguridad
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Análisis IA en tiempo real (Anti-Spoofing y Estado Emocional)</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Spinner size="10" /></div>
      ) : (
        <div className="space-y-6">
          
          {interestingRecords.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">⚠️ Alertas Prioritarias de Hoy</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {interestingRecords.map(record => (
                  <div key={record.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border-l-4 border-orange-500 overflow-hidden">
                    <div className="p-4 flex gap-4">
                      {record.captured_photo_url ? (
                        <img src={record.captured_photo_url} alt={record.collaborator_name} className="w-16 h-16 rounded-lg object-cover" />
                      ) : (
                        <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">N/A</div>
                      )}
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{record.collaborator_name}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{new Date(record.timestamp).toLocaleTimeString()}</p>
                        <div className="flex flex-wrap gap-1">
                          {getWellnessBadge(record.wellness_status)}
                          {getSpoofBadge(record.spoof_status)}
                        </div>
                      </div>
                    </div>
                    {record.ai_analysis_reason && (
                      <div className="bg-orange-50 dark:bg-orange-900/10 px-4 py-2 text-sm text-orange-800 dark:text-orange-300 italic border-t border-orange-100 dark:border-orange-800">
                        "{record.ai_analysis_reason}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Todos los análisis de hoy</h2>
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Empleado</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Hora</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Bienestar</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Autenticidad (Spoof)</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {records.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {record.collaborator_name}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {new Date(record.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getWellnessBadge(record.wellness_status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getSpoofBadge(record.spoof_status)}
                        </td>
                      </tr>
                    ))}
                    {records.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                          No hay registros analizados hoy.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WellnessDashboard;
