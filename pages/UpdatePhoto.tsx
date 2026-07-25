import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { generateTimeBasedPIN } from '../services/security';
import CameraCapture from '../components/CameraCapture';
import Spinner from '../components/Spinner';
import { Collaborator } from '../types';

const UpdatePhoto: React.FC = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const collaboratorId = urlParams.get('id');

  const [collaborator, setCollaborator] = useState<Collaborator | null>(null);
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchCollaborator = async () => {
      if (!collaboratorId) {
        setError('No se proporcionó un ID válido.');
        setIsLoading(false);
        return;
      }
      try {
        const collabs = await dbService.getCollaborators();
        const found = collabs.find(c => c.id === collaboratorId);
        if (found) {
          setCollaborator(found);
        } else {
          setError('Colaborador no encontrado.');
        }
      } catch (err) {
        setError('Error al cargar datos del colaborador.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchCollaborator();
  }, [collaboratorId]);

  const handleVerifyPin = () => {
    if (!collaboratorId) return;
    const expectedPin = generateTimeBasedPIN(collaboratorId);
    if (pin === expectedPin) {
      setIsAuthenticated(true);
      setError(null);
    } else {
      setError('PIN incorrecto o expirado.');
    }
  };

  const handleCapture = async (imageBase64: string) => {
    if (!collaborator) return;
    setIsSaving(true);
    try {
      const updated = { ...collaborator, photo: imageBase64 };
      await dbService.updateCollaborator(updated);
      setSuccess(true);
    } catch (err) {
      console.error(err);
      setError('Error al guardar la foto.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Spinner size="12" /></div>;
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-8 max-w-md w-full text-center">
          <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">¡Foto Actualizada!</h2>
          <p className="text-gray-600 dark:text-gray-400">La foto del colaborador se ha guardado correctamente. Ya puedes cerrar esta ventana.</p>
        </div>
      </div>
    );
  }

  if (!collaborator) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-8 max-w-md w-full text-center text-red-500">
          <p className="font-bold text-xl">{error}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Actualizar Foto</h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Colaborador: <strong>{collaborator.name}</strong></p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                PIN de Seguridad (4 dígitos)
              </label>
              <input
                type="text"
                maxLength={4}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                className="w-full text-center text-2xl tracking-[0.5em] px-4 py-3 rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                placeholder="0000"
              />
            </div>
            
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            
            <button
              onClick={handleVerifyPin}
              disabled={pin.length !== 4}
              className="w-full px-4 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Verificar PIN
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--apple-bg)] dark:bg-gray-950">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-lg">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4 text-center">Capturar Nueva Foto</h2>
        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-6">Enfoque el rostro de <strong>{collaborator.name}</strong> y presione registrar.</p>
        
        {isSaving ? (
          <div className="flex flex-col items-center py-12">
            <Spinner size="12" />
            <p className="mt-4 text-gray-600 dark:text-gray-300">Guardando foto...</p>
          </div>
        ) : (
          <CameraCapture onCapture={handleCapture} />
        )}
      </div>
    </div>
  );
};

export default UpdatePhoto;
