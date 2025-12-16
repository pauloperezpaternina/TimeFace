import React, { useState, useEffect } from 'react';
import { dbService } from '../../services/dbService';
import Spinner from '../../components/Spinner';

const Configuration: React.FC = () => {
    const [settings, setSettings] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Form states
    const [weeklyHours, setWeeklyHours] = useState('44');
    const [lawReference, setLawReference] = useState('');

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setIsLoading(true);
        try {
            const data = await dbService.getAppSettings();
            setSettings(data);
            if (data['weekly_hours_limit']) setWeeklyHours(data['weekly_hours_limit']);
            if (data['law_reference']) setLawReference(data['law_reference']);
        } catch (error) {
            console.error("Error loading settings:", error);
            setMessage({ type: 'error', text: 'Error al cargar la configuración.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setMessage(null);
        try {
            await dbService.updateAppSetting('weekly_hours_limit', weeklyHours);
            // Law reference might be editable or just info, user asked to "define" hours, implies editing.
            // Let's allow editing law reference too just in case.
            await dbService.updateAppSetting('law_reference', lawReference);

            setMessage({ type: 'success', text: 'Configuración guardada exitosamente.' });
            loadSettings(); // Reload to confirm
        } catch (error) {
            console.error("Error saving settings:", error);
            setMessage({ type: 'error', text: 'Error al guardar. Inténtelo de nuevo.' });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="flex justify-center p-8"><Spinner /></div>;

    return (
        <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-200">Configuración General</h2>

            {message && (
                <div className={`p-4 mb-6 rounded-md ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {message.text}
                </div>
            )}

            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
                <form onSubmit={handleSave}>
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold mb-4 border-b pb-2 dark:border-gray-700">Normativa Laboral (Jornada)</h3>
                        <p className="text-sm text-gray-500 mb-4 dark:text-gray-400">
                            Defina el límite de horas semanales para el cálculo de horas extras, de acuerdo con la normativa vigente.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="weeklyHours" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Horas Semanales Máximas
                                </label>
                                <input
                                    type="number"
                                    id="weeklyHours"
                                    value={weeklyHours}
                                    onChange={(e) => setWeeklyHours(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                                    required
                                    min="1"
                                    max="168"
                                />
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    Base para cálculo de horas extras.
                                </p>
                            </div>

                            <div>
                                <label htmlFor="lawRef" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Referencia Normativa
                                </label>
                                <input
                                    type="text"
                                    id="lawRef"
                                    value={lawReference}
                                    onChange={(e) => setLawReference(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                                />
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    Ej: Ley 2101 de 2021
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t dark:border-gray-700">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded focus:outline-none focus:shadow-outline flex items-center disabled:opacity-50"
                        >
                            {isSaving && <Spinner size="4" />}
                            <span className={isSaving ? 'ml-2' : ''}>Guardar Cambios</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Configuration;
