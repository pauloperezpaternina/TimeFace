import React, { useState, useEffect, useCallback } from 'react';
import { dbService } from '../../services/dbService';
import { Shift } from '../../types';
import Modal from '../../components/Modal';
import Spinner from '../../components/Spinner';

const ShiftForm: React.FC<{
  shiftToEdit: Shift | null;
  onSave: () => void;
  onCancel: () => void;
}> = ({ shiftToEdit, onSave, onCancel }) => {
  const [name, setName] = useState('');
  const [start_time, setStartTime] = useState(''); // Changed to start_time
  const [end_time, setEndTime] = useState('');     // Changed to end_time
  const [color, setColor] = useState('#3B82F6');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (shiftToEdit) {
      setName(shiftToEdit.name);
      setStartTime(shiftToEdit.start_time); // Use start_time
      setEndTime(shiftToEdit.end_time);     // Use end_time
      setColor(shiftToEdit.color);
    } else {
      setName('');
      setStartTime('');
      setEndTime('');
      setColor('#3B82F6');
    }
    setFormError(null);
  }, [shiftToEdit]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFormError(null);
    try {
      const shiftData = { name, start_time, end_time, color }; // Use start_time, end_time
      if (shiftToEdit) {
        await dbService.updateShift({ ...shiftToEdit, ...shiftData });
      } else {
        await dbService.addShift(shiftData);
      }
      onSave();
    } catch (error) {
      console.error("Failed to save shift:", error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al guardar el turno.';
      setFormError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
        <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Nombre del Turno</label>
            <input type="text" id="name" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"/>
        </div>
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Hora de Inicio</label>
                <input type="time" value={start_time} onChange={e => setStartTime(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" style={{colorScheme: 'light'}}/>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Hora de Fin</label>
                <input type="time" value={end_time} onChange={e => setEndTime(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" style={{colorScheme: 'light'}}/>
            </div>
        </div>
         <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Color</label>
            <input type="color" value={color} onChange={e => setColor(e.target.value)} required className="mt-1 block w-full h-10 p-1 border rounded-md dark:bg-gray-800 dark:border-gray-600"/>
        </div>
        {formError && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert">
                <p className="font-bold">Error:</p>
                <p>{formError}</p>
            </div>
        )}
        <div className="flex justify-end space-x-2">
            <button type="button" onClick={onCancel} disabled={isSaving} className="px-4 py-2 border rounded-md disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center disabled:opacity-50">
              {isSaving && <Spinner size="4" />}
              {isSaving ? 'Guardando...' : 'Guardar Turno'}
            </button>
        </div>
    </form>
  );
};


const ManageShifts: React.FC = () => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [shiftToEdit, setShiftToEdit] = useState<Shift | null>(null);
  const [shiftToDelete, setShiftToDelete] = useState<Shift | null>(null);

  const loadShifts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setShifts(await dbService.getShifts());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Ocurrió un error desconocido.";
      console.error("Failed to load shifts:", err);
      setError(`No se pudieron cargar los turnos. ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadShifts(); }, [loadShifts]);

  const handleSave = () => {
    setShowForm(false);
    setShiftToEdit(null);
    loadShifts();
  };

  const handleDelete = async () => {
    if(shiftToDelete) {
      try {
        await dbService.deleteShift(shiftToDelete.id);
        loadShifts();
      } catch (error) {
        alert('Error al eliminar el turno.');
      }
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Turnos</h2>
        <button onClick={() => { setShiftToEdit(null); setShowForm(true); }} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700">
          Agregar Turno
        </button>
      </div>

      {showForm && <div className="mb-6"><ShiftForm shiftToEdit={shiftToEdit} onSave={handleSave} onCancel={() => {setShowForm(false); setShiftToEdit(null);}}/></div>}
      
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex justify-center"><Spinner size="10"/></div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-red-500 font-medium">{error}</p>
            <button onClick={loadShifts} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Reintentar
            </button>
          </div>
        ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {shifts.map(shift => (
                <li key={shift.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center">
                        <div style={{backgroundColor: shift.color}} className="w-4 h-4 rounded-full mr-4"></div>
                        <div>
                            <p className="font-bold">{shift.name}</p>
                            <p className="text-sm text-gray-500">{shift.start_time} - {shift.end_time}</p>
                        </div>
                    </div>
                    <div className="space-x-2">
                        <button onClick={() => {setShiftToEdit(shift); setShowForm(true);}} className="text-indigo-600 hover:text-indigo-900">Editar</button>
                        <button onClick={() => setShiftToDelete(shift)} className="text-red-600 hover:text-red-900">Eliminar</button>
                    </div>
                </li>
            ))}
        </ul>
        )}
      </div>
       <Modal 
        isOpen={!!shiftToDelete} 
        onClose={() => setShiftToDelete(null)} 
        onConfirm={handleDelete}
        title="Eliminar Turno"
      >
        ¿Está seguro de que desea eliminar el turno "{shiftToDelete?.name}"?
      </Modal>
    </div>
  );
};

export default ManageShifts;