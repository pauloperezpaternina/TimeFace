import React, { useState, useEffect, useCallback } from 'react';
import { dbService } from '../services/dbService';
import { generateTimeBasedPIN } from '../services/security';
import { Collaborator } from '../types';
import QRCode from 'react-qr-code';
import Modal from '../components/Modal';
import CameraCapture from '../components/CameraCapture';
import Spinner from '../components/Spinner';

const CollaboratorForm: React.FC<{
  collaboratorToEdit: Collaborator | null;
  onSave: () => void;
  onCancel: () => void;
}> = ({ collaboratorToEdit, onSave, onCancel }) => {
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [shiftId, setShiftId] = useState<string>('');
  const [shifts, setShifts] = useState<any[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    dbService.getShifts().then(setShifts).catch(console.error);
    if (collaboratorToEdit) {
      setName(collaboratorToEdit.name);
      setPosition(collaboratorToEdit.position);
      setPhoto(collaboratorToEdit.photo);
      setShiftId(''); // We reset it so they can choose to assign a new shift
    } else {
      setName('');
      setPosition('');
      setPhoto(null);
      setShiftId('');
    }
  }, [collaboratorToEdit]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhoto(event.target?.result as string);
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleCapture = (imageBase64: string) => {
    setPhoto(imageBase64);
    setShowCamera(false);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !position || !photo) {
      alert('Todos los campos son obligatorios, incluida la foto.');
      return;
    }
    
    setIsSaving(true);
    try {
      let savedCollaborator;
      if (collaboratorToEdit) {
        savedCollaborator = await dbService.updateCollaborator({ ...collaboratorToEdit, name, position, photo });
      } else {
        savedCollaborator = await dbService.addCollaborator({ name, position, photo });
      }

      if (shiftId) {
        const today = new Date();
        const newSchedules = [];
        for (let i = 0; i < 30; i++) {
          const d = new Date(today);
          d.setDate(d.getDate() + i);
          newSchedules.push({
            collaborator_id: savedCollaborator.id,
            shift_id: shiftId,
            date: d.toISOString().split('T')[0],
            status: 'scheduled' as const,
          });
        }
        await dbService.bulkCreateSchedules(newSchedules);
      }

      onSave();
    } catch (error) {
      console.error("Failed to save collaborator:", error);
      alert('Error al guardar el colaborador.');
    } finally {
      setIsSaving(false);
    }
  };

  if (showCamera) {
    return (
        <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <h3 className="text-lg font-bold mb-4">{collaboratorToEdit ? 'Actualizar Foto' : 'Capturar Foto'}</h3>
            <CameraCapture onCapture={handleCapture} />
            <button onClick={() => setShowCamera(false)} className="mt-4 w-full px-4 py-2 bg-gray-500 text-white font-semibold rounded-lg shadow-md hover:bg-gray-600">Cancelar</button>
        </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Nombre Completo</label>
        <input type="text" id="name" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
      </div>
      <div>
        <label htmlFor="position" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Cargo</label>
        <input type="text" id="position" value={position} onChange={e => setPosition(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
      </div>
      <div>
        <label htmlFor="shift" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Asignar Turno Fijo (Próximos 30 días)</label>
        <select id="shift" value={shiftId} onChange={e => setShiftId(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
          <option value="">-- No asignar turno ahora --</option>
          {shifts.map(shift => (
            <option key={shift.id} value={shift.id}>{shift.name} ({shift.start_time} - {shift.end_time})</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500">Al seleccionar un turno, se programará automáticamente la asistencia para este colaborador durante los próximos 30 días.</p>
      </div>
      <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Foto de Referencia</label>
          <div className="mt-2 flex items-center space-x-4">
            {photo && <img src={photo} alt="Preview" className="h-20 w-20 rounded-full object-cover" />}
            <div className="flex flex-col space-y-2">
                <button type="button" onClick={() => setShowCamera(true)} className="px-3 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-indigo-700">Usar Cámara</button>
                <label htmlFor="photo-upload" className="cursor-pointer px-3 py-2 bg-white dark:bg-gray-600 text-sm font-semibold rounded-lg border border-gray-300 dark:border-gray-500 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-500">
                    Subir Archivo
                    <input id="photo-upload" name="photo-upload" type="file" className="sr-only" accept="image/*" onChange={handleFileChange} />
                </label>
            </div>
          </div>
      </div>
      <div className="flex justify-end space-x-2">
        <button type="button" onClick={onCancel} disabled={isSaving} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50">Cancelar</button>
        <button type="submit" disabled={isSaving} className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 flex items-center disabled:opacity-50">
          {isSaving && <Spinner size="4" />}
          {isSaving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  );
};

const Collaborators: React.FC = () => {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [collaboratorToEdit, setCollaboratorToEdit] = useState<Collaborator | null>(null);
  const [collaboratorToDelete, setCollaboratorToDelete] = useState<Collaborator | null>(null);
  const [collaboratorForQR, setCollaboratorForQR] = useState<Collaborator | null>(null);
  const [qrPin, setQrPin] = useState<string>('');
  const [qrPinTimeLeft, setQrPinTimeLeft] = useState<number>(0);

  // Update PIN and countdown periodically if QR modal is open
  useEffect(() => {
    let interval: number;
    
    const updatePinAndTime = () => {
      if (!collaboratorForQR) return;
      setQrPin(generateTimeBasedPIN(collaboratorForQR.id));
      const window20Min = Math.floor(Date.now() / (1000 * 60 * 20));
      const nextWindowStart = (window20Min + 1) * (1000 * 60 * 20);
      setQrPinTimeLeft(Math.max(0, nextWindowStart - Date.now()));
    };

    if (collaboratorForQR) {
      updatePinAndTime();
      interval = window.setInterval(updatePinAndTime, 1000); // Check every second
    }
    return () => clearInterval(interval);
  }, [collaboratorForQR]);

  const loadCollaborators = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await dbService.getCollaborators();
      setCollaborators(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Ocurrió un error desconocido.";
      console.error("Failed to load collaborators:", err);
      setError(`No se pudieron cargar los colaboradores. ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCollaborators();
  }, [loadCollaborators]);
  
  const handleSave = () => {
    setShowForm(false);
    setCollaboratorToEdit(null);
    loadCollaborators();
  };
  
  const handleEdit = (collaborator: Collaborator) => {
    setCollaboratorToEdit(collaborator);
    setShowForm(true);
  };
  
  const handleDelete = async () => {
    if (collaboratorToDelete) {
      try {
        await dbService.deleteCollaborator(collaboratorToDelete.id);
        loadCollaborators();
      } catch (error) {
        console.error("Failed to delete collaborator:", error);
        alert("Error al eliminar el colaborador.");
      }
    }
  };

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Gestionar Colaboradores</h1>
        <button onClick={() => { setCollaboratorToEdit(null); setShowForm(true); }} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700">
          Agregar Colaborador
        </button>
      </div>
      
      {showForm && <div className="mb-6"><CollaboratorForm collaboratorToEdit={collaboratorToEdit} onSave={handleSave} onCancel={() => {setShowForm(false); setCollaboratorToEdit(null);}} /></div>}
      
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
            {isLoading ? (
                <div className="flex justify-center items-center p-8">
                    <Spinner size="10" />
                </div>
            ) : error ? (
                <div className="p-8 text-center">
                    <p className="text-red-500 font-medium">{error}</p>
                    <button onClick={loadCollaborators} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                        Reintentar
                    </button>
                </div>
            ) : (
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Foto</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nombre</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cargo</th>
                    <th scope="col" className="relative px-6 py-3"><span className="sr-only">Acciones</span></th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {collaborators.map(collaborator => (
                    <tr key={collaborator.id}>
                        <td className="px-6 py-4 whitespace-nowrap"><img className="h-12 w-12 rounded-full object-cover" src={collaborator.photo} alt={collaborator.name} /></td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{collaborator.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{collaborator.position}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                        <button onClick={() => setCollaboratorForQR(collaborator)} className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300">Generar QR</button>
                        <button onClick={() => handleEdit(collaborator)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300">Editar</button>
                        <button onClick={() => setCollaboratorToDelete(collaborator)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">Eliminar</button>
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            )}
        </div>
      </div>
      <Modal 
        isOpen={!!collaboratorToDelete} 
        onClose={() => setCollaboratorToDelete(null)} 
        onConfirm={handleDelete}
        title="Confirmar Eliminación"
      >
        ¿Estás seguro de que deseas eliminar al colaborador {collaboratorToDelete?.name}? Esta acción no se puede deshacer.
      </Modal>

      {/* QR Modal */}
      {collaboratorForQR && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full p-6 text-center">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">Código QR para Foto</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Escanea el código con tu celular para tomar la foto de <strong>{collaboratorForQR.name}</strong>.
            </p>
            
            <div className="bg-white p-4 rounded-lg inline-block shadow-sm mb-6 hover:opacity-80 transition-opacity cursor-pointer">
              <a 
                href={`${window.location.origin}${window.location.pathname}?page=update-photo&id=${collaboratorForQR.id}`} 
                target="_blank" 
                rel="noopener noreferrer"
                title="Hacer clic para abrir en una nueva pestaña"
              >
                <QRCode 
                  value={`${window.location.origin}${window.location.pathname}?page=update-photo&id=${collaboratorForQR.id}`}
                  size={200}
                />
              </a>
            </div>
            
            <div className="mb-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                PIN de Seguridad (cambia en {Math.floor(qrPinTimeLeft / 60000)}:{(Math.floor((qrPinTimeLeft % 60000) / 1000)).toString().padStart(2, '0')}):
              </p>
              <p className="text-4xl font-bold tracking-widest text-blue-600 dark:text-blue-400">{qrPin}</p>
            </div>
            
            <button
              onClick={() => setCollaboratorForQR(null)}
              className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Collaborators;