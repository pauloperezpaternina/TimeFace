import React, { useState, useEffect, useCallback } from 'react';
import { dbService } from '../../services/dbService';
import { AttendanceRecord, Collaborator } from '../../types';
import Spinner from '../../components/Spinner';

interface OpenShiftUser {
  collaborator: Collaborator;
  lastRecord: AttendanceRecord;
}

const AttendanceCorrections: React.FC = () => {
  const [openShiftUsers, setOpenShiftUsers] = useState<OpenShiftUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [selectedUser, setSelectedUser] = useState<OpenShiftUser | null>(null);
  const [exitDate, setExitDate] = useState('');
  const [exitTime, setExitTime] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadOpenShifts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const collaborators = await dbService.getCollaborators();
      const openShifts: OpenShiftUser[] = [];
      
      // This could be optimized with a better DB query in the future,
      // but for now we iterate to reuse existing service methods as requested.
      for (const collab of collaborators) {
        const lastRecord = await dbService.getLastRecordForCollaborator(collab.id);
        if (lastRecord && lastRecord.type === 'entry') {
          // Check if it's from a previous day
          const recordDate = new Date(lastRecord.timestamp);
          const today = new Date();
          
          // Reset times to compare dates only
          recordDate.setHours(0, 0, 0, 0);
          today.setHours(0, 0, 0, 0);
          
          if (recordDate.getTime() < today.getTime()) {
            openShifts.push({
              collaborator: collab,
              lastRecord: lastRecord
            });
          }
        }
      }
      
      setOpenShiftUsers(openShifts);
    } catch (err) {
      console.error("Error loading open shifts:", err);
      setError("Error al cargar turnos abiertos.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOpenShifts();
  }, [loadOpenShifts]);

  const handleOpenModal = (user: OpenShiftUser) => {
    setSelectedUser(user);
    
    // Default to the same date as entry, end of shift (e.g. +9 hours) or current time?
    // Let's default to the entry date and current time for simplicity, user validates.
    const entryDate = new Date(user.lastRecord.timestamp);
    const year = entryDate.getFullYear();
    const month = String(entryDate.getMonth() + 1).padStart(2, '0');
    const day = String(entryDate.getDate()).padStart(2, '0');
    
    setExitDate(`${year}-${month}-${day}`);
    setExitTime('18:00'); // Default end of day
  };

  const handleCloseModal = () => {
    setSelectedUser(null);
    setExitDate('');
    setExitTime('');
  };

  const handleSaveExit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUser || !exitDate || !exitTime) return;
    
    setIsSaving(true);
    try {
      const timestamp = new Date(`${exitDate}T${exitTime}:00`).toISOString();
      
      // Validate that exit is AFTER entry
      if (new Date(timestamp) <= new Date(selectedUser.lastRecord.timestamp)) {
        alert("La hora de salida debe ser posterior a la entrada.");
        setIsSaving(false);
        return;
      }
      
      // Create a 1x1 transparent pixel base64 for admin manual records
      const transparentPixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
      
      await dbService.addAttendanceRecord({
        collaborator_id: selectedUser.collaborator.id,
        collaborator_name: selectedUser.collaborator.name,
        timestamp: timestamp,
        type: 'exit'
      }, transparentPixel);
      
      handleCloseModal();
      loadOpenShifts(); // Refresh list
    } catch (error) {
      console.error("Error saving manual exit:", error);
      alert("Error al guardar el registro.");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredUsers = openShiftUsers.filter(u => 
    u.collaborator.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.collaborator.document && u.collaborator.document.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl overflow-hidden p-6">
      <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">Corrección de Turnos Abiertos</h2>
      <p className="mb-4 text-gray-600 dark:text-gray-400">
        Lista de colaboradores que tienen un registro de entrada sin salida del día anterior o anteriores.
      </p>
      
      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar colaborador..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:w-1/3 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      
      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner size="8" /></div>
      ) : error ? (
        <div className="p-4 text-red-500 bg-red-50 rounded-lg dark:bg-red-900/20">{error}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Colaborador</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Fecha Entrada</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Hora Entrada</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acción</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => {
                  const dateObj = new Date(user.lastRecord.timestamp);
                  return (
                    <tr key={user.collaborator.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {user.collaborator.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {dateObj.toLocaleDateString('es-CO')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {dateObj.toLocaleTimeString('es-CO')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenModal(user)}
                          className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm font-medium"
                        >
                          Cerrar Turno
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    No se encontraron turnos abiertos pendientes de corrección.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      
      {/* MODAL */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Registrar Salida Manual</h3>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
              Registrando salida para <strong>{selectedUser.collaborator.name}</strong>.<br />
              Entrada original: {new Date(selectedUser.lastRecord.timestamp).toLocaleString('es-CO')}
            </p>
            
            <form onSubmit={handleSaveExit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fecha de Salida</label>
                <input
                  type="date"
                  required
                  value={exitDate}
                  onChange={e => setExitDate(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Hora de Salida</label>
                <input
                  type="time"
                  required
                  value={exitTime}
                  onChange={e => setExitTime(e.target.value)}
                  // Use 'style' to force light scheme for time picker icon visibility if needed, or rely on dark mode CSS
                  className="mt-1 block w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-white"
                />
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
                >
                  {isSaving && <Spinner size="4" />}
                  <span className={isSaving ? "ml-2" : ""}>Guardar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceCorrections;