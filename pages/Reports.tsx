
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { dbService } from '../services/dbService';
import { AttendanceRecord, Collaborator, Visit } from '../types';
import Spinner from '../components/Spinner';

const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'visits'>('attendance');
  
  // Attendance State
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [selectedCollaborator, setSelectedCollaborator] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Visits State
  // Initialize with today's date by default
  const getToday = () => new Date().toISOString().split('T')[0];
  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitStartDate, setVisitStartDate] = useState<string>(getToday());
  const [visitEndDate, setVisitEndDate] = useState<string>(getToday());
  const [visitSearch, setVisitSearch] = useState<string>('');
  const [isVisitsLoading, setIsVisitsLoading] = useState(false);
  const [visitsError, setVisitsError] = useState<string | null>(null);

  // Shared State (Lightbox)
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Load initial data for Attendance
  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [recordsData, collaboratorsData] = await Promise.all([
        dbService.getAttendanceRecords(),
        dbService.getCollaborators(),
      ]);
      setRecords(recordsData);
      setCollaborators(collaboratorsData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Ocurrió un error desconocido.";
      console.error("Failed to load report data:", err);
      setError(`No se pudieron cargar los datos para los reportes. ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Load data for Visits
  const loadVisits = useCallback(async () => {
    if (!visitStartDate || !visitEndDate) {
        return; 
    }
    setIsVisitsLoading(true);
    setVisitsError(null);
    try {
        const data = await dbService.getVisitHistory(visitStartDate, visitEndDate, visitSearch);
        setVisits(data);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Ocurrió un error desconocido.";
        console.error("Failed to load visits:", err);
        setVisitsError(`Error al cargar historial de visitas. ${errorMessage}`);
    } finally {
        setIsVisitsLoading(false);
    }
  }, [visitStartDate, visitEndDate, visitSearch]);

  // Auto-load visits when tab changes to 'visits'
  useEffect(() => {
    if (activeTab === 'visits') {
        loadVisits();
    }
  }, [activeTab, loadVisits]);

  const filteredRecords = useMemo(() => {
    const sorted = [...records].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return sorted.filter(record => {
      const recordDate = new Date(record.timestamp);
      recordDate.setHours(0,0,0,0);
      
      const start = startDate ? new Date(startDate) : null;
      if(start) start.setMinutes(start.getMinutes() + start.getTimezoneOffset()) 
      if(start) start.setHours(0,0,0,0);

      const end = endDate ? new Date(endDate) : null;
      if(end) end.setMinutes(end.getMinutes() + end.getTimezoneOffset()) 
      if(end) end.setHours(23,59,59,999);

      const collaboratorMatch = selectedCollaborator === 'all' || record.collaborator_id === selectedCollaborator;
      const startDateMatch = !start || recordDate.getTime() >= start.getTime();
      const endDateMatch = !end || recordDate.getTime() <= end.getTime();
      
      return collaboratorMatch && startDateMatch && endDateMatch;
    });
  }, [records, selectedCollaborator, startDate, endDate]);

  const reportData = useMemo(() => {
    const groupedByCollaborator = filteredRecords.reduce<Record<string, {name: string, records: AttendanceRecord[]}>>((acc, record) => {
      if (!acc[record.collaborator_id]) {
        acc[record.collaborator_id] = { name: record.collaborator_name, records: [] };
      }
      acc[record.collaborator_id].records.push(record);
      return acc;
    }, {});
    
    // Sort records within each group chronologically for accurate calculation
    for(const key in groupedByCollaborator){
        groupedByCollaborator[key].records.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }

    return Object.keys(groupedByCollaborator).map(collaboratorId => {
      const data = groupedByCollaborator[collaboratorId];
      let totalHours = 0;
      let entryTime: number | null = null;
      for (const record of data.records) {
        const recordTime = new Date(record.timestamp).getTime();
        if (record.type === 'entry' && entryTime === null) {
          entryTime = recordTime;
        } else if (record.type === 'exit' && entryTime !== null) {
          totalHours += (recordTime - entryTime) / (1000 * 60 * 60);
          entryTime = null;
        }
      }
      const scheduledHours = Math.ceil(data.records.length / 2) * 8;
      const overtime = Math.max(0, totalHours - scheduledHours);

      return {
        collaboratorName: data.name,
        totalHours: totalHours.toFixed(2),
        scheduledHours: scheduledHours,
        overtime: overtime.toFixed(2),
      }
    });
  }, [filteredRecords]);

  const TabButton: React.FC<{ tab: 'attendance' | 'visits'; label: string }> = ({ tab, label }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
        activeTab === tab
          ? 'bg-blue-600 text-white'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="container mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-200">Reportes</h1>
      
      <div className="flex space-x-2 border-b border-gray-200 dark:border-gray-700 mb-6">
        <TabButton tab="attendance" label="Asistencia" />
        <TabButton tab="visits" label="Historial de Visitas" />
      </div>
      
      {activeTab === 'attendance' ? (
        <>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg mb-6">
            <h2 className="text-xl font-bold mb-4">Filtros de Asistencia</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="collaborator" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Colaborador</label>
                <select id="collaborator" value={selectedCollaborator} onChange={e => setSelectedCollaborator(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                  <option value="all">Todos</option>
                  {collaborators.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </div>
              <div>
                <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Fecha de Inicio</label>
                <input type="date" id="start-date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
              </div>
              <div>
                <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Fecha de Fin</label>
                <input type="date" id="end-date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl overflow-hidden mb-8">
             <h2 className="text-xl font-bold p-6">Resumen de Horas Trabajadas</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Colaborador</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Horas Programadas</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Horas Trabajadas</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Horas Extra</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {isLoading ? (
                    <tr><td colSpan={4} className="text-center py-8"><Spinner /></td></tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8">
                        <p className="text-red-500 font-medium">{error}</p>
                        <button onClick={loadData} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                          Reintentar
                        </button>
                      </td>
                    </tr>
                  ) : reportData.length > 0 ? (
                    reportData.map(data => (
                      <tr key={data.collaboratorName}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{data.collaboratorName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{data.scheduledHours}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{data.totalHours}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{data.overtime}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={4} className="text-center py-8 text-gray-500 dark:text-gray-400">No hay registros que coincidan con los filtros seleccionados.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl overflow-hidden">
            <h2 className="text-xl font-bold p-6">Detalle de Asistencia</h2>
             <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Foto</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Colaborador</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Fecha</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Hora</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Tipo</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {isLoading ? (
                    <tr><td colSpan={5} className="text-center py-8"><Spinner /></td></tr>
                  ) : filteredRecords.length > 0 ? (
                    filteredRecords.map(record => (
                      <tr key={record.id}>
                         <td className="px-6 py-4 whitespace-nowrap">
                           {record.captured_photo_url && (
                            <img 
                              src={record.captured_photo_url} 
                              alt={`Registro de ${record.collaborator_name}`} 
                              className="h-12 w-12 rounded-full object-cover cursor-pointer transition-transform duration-200 hover:scale-110"
                              onClick={() => setSelectedImage(record.captured_photo_url)}
                            />
                           )}
                         </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{record.collaborator_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{new Date(record.timestamp).toLocaleDateString('es-CO')}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{new Date(record.timestamp).toLocaleTimeString('es-CO')}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                           <span className={`px-3 py-1 text-xs font-medium rounded-full ${record.type === 'entry' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>
                             {record.type === 'entry' ? 'Entrada' : 'Salida'}
                           </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={5} className="text-center py-8 text-gray-500 dark:text-gray-400">No hay registros que coincidan con los filtros seleccionados.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* VISITS REPORT TAB */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg mb-6">
            <h2 className="text-xl font-bold mb-4">Filtros de Visitas</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label htmlFor="visit-start-date" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Fecha de Inicio</label>
                <input type="date" id="visit-start-date" value={visitStartDate} onChange={e => setVisitStartDate(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
              </div>
              <div>
                <label htmlFor="visit-end-date" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Fecha de Fin</label>
                <input type="date" id="visit-end-date" value={visitEndDate} onChange={e => setVisitEndDate(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
              </div>
              <div>
                <label htmlFor="visit-search" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Buscar</label>
                <input type="text" id="visit-search" placeholder="Nombre, Cédula o Empresa" value={visitSearch} onChange={e => setVisitSearch(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
              </div>
              <button 
                onClick={loadVisits}
                disabled={isVisitsLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
              >
                {isVisitsLoading ? <Spinner size="5" /> : 'Filtrar Visitas'}
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl overflow-hidden">
            <h2 className="text-xl font-bold p-6">Historial de Visitas</h2>
             <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Fecha y Hora</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Visitante</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Empresa</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Firma</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {isVisitsLoading ? (
                    <tr><td colSpan={4} className="text-center py-8"><Spinner /></td></tr>
                  ) : visitsError ? (
                    <tr><td colSpan={4} className="text-center py-8 text-red-500">{visitsError}</td></tr>
                  ) : visits.length > 0 ? (
                    visits.map(visit => (
                      <tr key={visit.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {new Date(visit.timestamp).toLocaleDateString('es-CO')} <br/>
                            <span className="text-xs">{new Date(visit.timestamp).toLocaleTimeString('es-CO')}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {visit.full_name} <br/>
                            <span className="text-xs font-normal text-gray-500 dark:text-gray-400">CC: {visit.gov_id}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{visit.company}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                             {visit.signature_url && (
                                <div className="cursor-pointer hover:opacity-80 inline-block border border-gray-200 rounded bg-white p-1" onClick={() => setSelectedImage(visit.signature_url)}>
                                    <img src={visit.signature_url} alt="Firma" className="h-8 w-auto" />
                                </div>
                             )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={4} className="text-center py-8 text-gray-500 dark:text-gray-400">
                        {visitStartDate ? 'No se encontraron visitas en el rango seleccionado.' : 'Seleccione un rango de fechas para buscar.'}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 transition-opacity"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative p-4" onClick={e => e.stopPropagation()}>
            <div className="bg-white rounded-lg p-2">
                <img 
                src={selectedImage} 
                alt="Imagen ampliada" 
                className="max-w-[90vw] max-h-[90vh] object-contain rounded"
                />
            </div>
            <button 
              onClick={() => setSelectedImage(null)} 
              className="absolute top-0 right-0 m-2 p-1 bg-gray-800 bg-opacity-50 rounded-full text-white hover:bg-opacity-75 transition-colors"
              aria-label="Cerrar imagen"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
