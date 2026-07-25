import React, { useState, useEffect } from 'react';
import { dbService } from '../../services/dbService';
import Spinner from '../../components/Spinner';

const DEFAULT_AUTH_TEXT = `En cumplimiento de la Ley 1581 de 2012 y el Decreto 1377 de 2013, autorizo de manera voluntaria, previa, explícita, informada e inequívoca a Logiservices ZF S.A.S. para recolectar, almacenar, usar, circular, suprimir, procesar, compilar, intercambiar, actualizar y disponer de los datos que he suministrado, los cuales serán incorporados en una base de datos de la que es responsable Logiservices ZF S.A.S.

La información obtenida será utilizada para las siguientes finalidades:

• Gestionar el control de acceso y seguridad de las instalaciones.
• Mantener un registro de visitantes para fines de auditoría y cumplimiento.
• Contactarme en caso de emergencia o para seguimiento de mi visita.
• Realizar análisis estadísticos internos para mejorar nuestros servicios.

Declaro que se me ha informado sobre mis derechos como titular de datos, especialmente el derecho a conocer, actualizar, rectificar y suprimir mis datos personales, así como a revocar la autorización otorgada. Estos derechos podrán ser ejercidos a través de los canales de atención dispuestos por Logiservices ZF S.A.S. en su pagina web logiserviceszf.com.co

Al hacer clic en "Acepto", usted manifiesta su consentimiento expreso para el tratamiento de sus datos personales bajo las condiciones aquí descritas.`;

const ManageSettings: React.FC = () => {
  const [authText, setAuthText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      try {
        const text = await dbService.getSetting('authorization_text', DEFAULT_AUTH_TEXT);
        setAuthText(text);
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await dbService.setSetting('authorization_text', authText);
      alert('Configuración guardada exitosamente.');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error al guardar la configuración.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Spinner size="10"/></div>;
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl overflow-hidden p-6">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-6">Configuraciones Generales</h2>
      
      <div className="space-y-6">
        <div>
          <label htmlFor="authText" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
            Texto de Autorización para Tratamiento de Datos (Registro de Visitas)
          </label>
          <textarea
            id="authText"
            value={authText}
            onChange={(e) => setAuthText(e.target.value)}
            rows={10}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100"
            placeholder="Introduce el texto de autorización de la ley 1581 de 2012..."
          />
          <p className="text-sm text-gray-500 mt-2">
            Este texto se mostrará a los visitantes al momento de registrarse y deberán aceptarlo para continuar.
          </p>
        </div>

        <div className="flex justify-end border-t border-gray-200 dark:border-gray-700 pt-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
          >
            {isSaving && <Spinner size="4" />}
            <span className={isSaving ? "ml-2" : ""}>Guardar Cambios</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManageSettings;
