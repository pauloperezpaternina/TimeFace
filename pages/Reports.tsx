
import React, { useState, useMemo, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { AttendanceRecord, Collaborator } from '../types';

const Reports: React.FC = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [selectedCollaborator, setSelectedCollaborator] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    setRecords(dbService.getAttendanceRecords());
    setCollaborators(dbService.getCollaborators());
  }, []);

  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      const recordDate = new Date(record.timestamp);
      recordDate.setHours(0,0,0,0);
      
      const start = startDate ? new Date(startDate) : null;
      if(start) start.setHours(0,0,0,0);

      const end = endDate ? new Date(endDate) : null;
      if(end) end.setHours(23,59,59,999);

      const collaboratorMatch = selectedCollaborator === 'all' || record.collaboratorId === selectedCollaborator;
      const startDateMatch = !start || recordDate.getTime() >= start.getTime();
      const endDateMatch = !end || recordDate.getTime() <= end.getTime();
      
      return collaboratorMatch && startDateMatch && endDateMatch;
    });
  }, [records, selectedCollaborator, startDate, endDate]);

  return (
    <div className="container mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-200">Reportes de Asistencia</h1>
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="collaborator" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Colaborador</label>
            <select
              id="collaborator"
              value={selectedCollaborator}
              onChange={e => setSelectedCollaborator(e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="all">Todos</option>
              {collaborators.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Fecha de Inicio</label>
            <input
              type="date"
              id="start-date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Fecha de Fin</label>
            <input
              type="date"
              id="end-date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Colaborador</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Fecha</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Hora</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Tipo</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredRecords.map(record => (
                <tr key={record.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{record.collaboratorName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{new Date(record.timestamp).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{new Date(record.timestamp).toLocaleTimeString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                     <span className={`px-3 py-1 text-xs font-medium rounded-full ${record.type === 'entry' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>
                      {record.type === 'entry' ? 'Entrada' : 'Salida'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRecords.length === 0 && (
            <p className="text-center py-8 text-gray-500 dark:text-gray-400">No hay registros que coincidan con los filtros seleccionados.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
