import React, { useState, useEffect } from 'react';
import { dbService } from '../../services/dbService';
import { SecurityLog } from '../../types';

const SecurityLogs: React.FC = () => {
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const data = await dbService.getSecurityLogs();
      setLogs(data);
    } catch (error) {
      console.error('Error fetching security logs', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
        <h2 className="text-xl font-bold text-gray-800">Registro de Actividad y Seguridad</h2>
        <button 
          onClick={loadLogs}
          className="text-sm px-4 py-2 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 flex items-center space-x-2 text-gray-700 font-medium transition-colors"
        >
          <span>↻ Actualizar</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha / Hora</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Colaborador</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo de Evento</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Descripción</th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Evidencia</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                  <div className="flex justify-center mb-2">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                  </div>
                  Cargando registros...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-gray-500 bg-gray-50 rounded-lg m-4">
                  No hay registros de anomalías de seguridad.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{log.collaborator_name}</div>
                    <div className="text-xs text-gray-500 text-ellipsis overflow-hidden max-w-[120px]">{log.collaborator_id}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      log.event_type === 'SPOOFING_ATTEMPT' 
                        ? 'bg-red-100 text-red-800 border border-red-200' 
                        : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                    }`}>
                      {log.event_type === 'SPOOFING_ATTEMPT' ? 'FRAUDE DETECTADO' : 'ERROR SECUENCIA'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700 max-w-md">
                    {log.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {log.photo_url ? (
                      <button 
                        onClick={() => setSelectedPhoto(log.photo_url!)}
                        className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-md text-xs font-medium transition-colors"
                      >
                        Ver Foto
                      </button>
                    ) : (
                      <span className="text-gray-400 text-xs italic">N/A</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedPhoto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">Evidencia Fotográfica</h3>
              <button onClick={() => setSelectedPhoto(null)} className="text-gray-400 hover:text-gray-700 p-1 hover:bg-gray-200 rounded-full transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-4 flex justify-center bg-gray-900">
              <img src={selectedPhoto} alt="Evidencia" className="max-h-[70vh] max-w-full rounded-md shadow-lg" />
            </div>
            <div className="p-4 border-t bg-gray-50 text-right">
              <button 
                onClick={() => setSelectedPhoto(null)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecurityLogs;
