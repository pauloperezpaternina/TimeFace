import React, { useState, useEffect, useCallback } from 'react';
import { dbService } from '../../services/dbService';
import { Shift, ShiftPattern } from '../../types';
import Modal from '../../components/Modal';
import Spinner from '../../components/Spinner';

const PatternForm: React.FC<{
  patternToEdit: ShiftPattern | null;
  shifts: Shift[];
  onSave: () => void;
  onCancel: () => void;
}> = ({ patternToEdit, shifts, onSave, onCancel }) => {
  const [name, setName] = useState('');
  const [sequence, setSequence] = useState<(string|null)[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (patternToEdit) {
      setName(patternToEdit.name);
      setSequence(patternToEdit.sequence);
    } else {
      setName('');
      setSequence([]);
    }
  }, [patternToEdit]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const patternData = { name, sequence };
      if (patternToEdit) {
        await dbService.updateShiftPattern({ ...patternToEdit, ...patternData });
      } else {
        await dbService.addShiftPattern(patternData);
      }
      onSave();
    } catch (error) {
      console.error("Failed to save pattern:", error);
      alert('Error al guardar el patrón.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddToSequence = (shiftId: string | null) => {
    setSequence([...sequence, shiftId]);
  }
  
  const handleRemoveFromSequence = (index: number) => {
      setSequence(sequence.filter((_, i) => i !== index));
  }

  const shiftMap = new Map<string, Shift>();
  shifts.forEach(s => shiftMap.set(s.id, s));

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Nombre del Patrón</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"/>
        </div>
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Secuencia</label>
            <div className="mt-1 p-2 border rounded-md min-h-[50px] flex flex-wrap gap-2 dark:border-gray-600">
                {sequence.map((shiftId, index) => (
                    <span key={index} onClick={() => handleRemoveFromSequence(index)} className="px-2 py-1 text-xs text-white font-bold rounded-md cursor-pointer" style={{backgroundColor: shiftId ? shiftMap.get(shiftId)?.color : '#6B7280'}}>
                        {shiftId ? shiftMap.get(shiftId)?.name : 'DESCANSO'} &times;
                    </span>
                ))}
            </div>
        </div>
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Agregar a la secuencia</label>
            <div className="mt-1 flex flex-wrap gap-2">
                {shifts.map(shift => <button type="button" key={shift.id} onClick={() => handleAddToSequence(shift.id)} className="px-2 py-1 text-xs text-white font-bold rounded-md" style={{backgroundColor: shift.color}}>{shift.name}</button>)}
                <button type="button" onClick={() => handleAddToSequence(null)} className="px-2 py-1 text-xs text-white font-bold rounded-md bg-gray-500">Descanso</button>
            </div>
        </div>
        <div className="flex justify-end space-x-2">
            <button type="button" onClick={onCancel} disabled={isSaving} className="px-4 py-2 border rounded-md disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center disabled:opacity-50">
              {isSaving && <Spinner size="4" />}
              {isSaving ? 'Guardando...' : 'Guardar Patrón'}
            </button>
        </div>
    </form>
  );
};


const ManageShiftPatterns: React.FC = () => {
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [patternToEdit, setPatternToEdit] = useState<ShiftPattern | null>(null);
  const [patternToDelete, setPatternToDelete] = useState<ShiftPattern | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [pats, sfts] = await Promise.all([dbService.getShiftPatterns(), dbService.getShifts()]);
      setPatterns(pats);
      setShifts(sfts);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Ocurrió un error desconocido.";
      console.error("Failed to load data:", err);
      setError(`No se pudieron cargar los patrones. ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = () => {
    setShowForm(false);
    setPatternToEdit(null);
    loadData();
  };

  const handleDelete = async () => {
    if(patternToDelete) {
      try {
        await dbService.deleteShiftPattern(patternToDelete.id);
        loadData();
      } catch (error) {
        alert('Error al eliminar el patrón.');
      }
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Patrones de Turnos</h2>
        <button onClick={() => { setPatternToEdit(null); setShowForm(true); }} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700">
          Crear Patrón
        </button>
      </div>

      {showForm && <div className="mb-6"><PatternForm patternToEdit={patternToEdit} shifts={shifts} onSave={handleSave} onCancel={() => {setShowForm(false); setPatternToEdit(null);}}/></div>}
      
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex justify-center"><Spinner size="10"/></div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-red-500 font-medium">{error}</p>
            <button onClick={loadData} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Reintentar
            </button>
          </div>
        ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {patterns.map(pattern => (
                <li key={pattern.id} className="p-4">
                    <div className="flex items-center justify-between">
                        <p className="font-bold">{pattern.name}</p>
                        <div className="space-x-2">
                            <button onClick={() => {setPatternToEdit(pattern); setShowForm(true);}} className="text-indigo-600 hover:text-indigo-900">Editar</button>
                            <button onClick={() => setPatternToDelete(pattern)} className="text-red-600 hover:text-red-900">Eliminar</button>
                        </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                        {pattern.sequence.map((shiftId, index) => {
                            const shift = shifts.find(s => s.id === shiftId);
                            return <span key={index} className="px-1.5 py-0.5 text-xs text-white rounded" style={{backgroundColor: shift ? shift.color : '#6B7280'}}>{shift ? shift.name.charAt(0) : 'D'}</span>
                        })}
                    </div>
                </li>
            ))}
        </ul>
        )}
      </div>
       <Modal 
        isOpen={!!patternToDelete} 
        onClose={() => setPatternToDelete(null)} 
        onConfirm={handleDelete}
        title="Eliminar Patrón"
      >
        ¿Está seguro de que desea eliminar el patrón "{patternToDelete?.name}"?
      </Modal>
    </div>
  );
};

export default ManageShiftPatterns;