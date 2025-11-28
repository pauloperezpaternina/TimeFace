import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { dbService } from '../services/dbService';
import { Collaborator, Shift, Schedule, ShiftPattern } from '../types';
import Spinner from '../components/Spinner';

const Scheduling: React.FC = () => {
    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showGenerator, setShowGenerator] = useState(false);

    const getWeekDays = (date: Date) => {
        const start = new Date(date);
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        start.setDate(diff);
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            return d;
        });
    };
    
    const [weekDays, setWeekDays] = useState(getWeekDays(currentDate));

    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        const startDate = weekDays[0].toISOString().split('T')[0];
        const endDate = weekDays[6].toISOString().split('T')[0];
        try {
            const [collabs, sfts, scheds, pats] = await Promise.all([
                dbService.getCollaborators(),
                dbService.getShifts(),
                dbService.getSchedules(startDate, endDate),
                dbService.getShiftPatterns(),
            ]);
            setCollaborators(collabs);
            setShifts(sfts);
            setSchedules(scheds);
            setPatterns(pats);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            console.error("Failed to load scheduling data:", err);
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, [weekDays]);

    useEffect(() => {
        loadData();
    }, [loadData]);
    
    const handlePrevWeek = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(currentDate.getDate() - 7);
        setCurrentDate(newDate);
        setWeekDays(getWeekDays(newDate));
    };

    const handleNextWeek = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(currentDate.getDate() + 7);
        setCurrentDate(newDate);
        setWeekDays(getWeekDays(newDate));
    };

    const handleCellClick = async (collaboratorId: string, date: string, shiftId: string) => {
        const existingSchedule = schedules.find(s => s.collaborator_id === collaboratorId && s.date === date);
        try {
            if (existingSchedule) {
                if (existingSchedule.shift_id === shiftId) {
                     // Clicking the same shift again could mean un-assigning, but for now we do nothing.
                } else {
                    await dbService.updateSchedule({ ...existingSchedule, shift_id: shiftId });
                }
            } else {
                await dbService.addSchedule({ collaborator_id: collaboratorId, date, shift_id: shiftId });
            }
            loadData();
        } catch (error) {
            console.error("Error updating schedule", error);
        }
    };
    
    const scheduleMap = useMemo(() => {
        const map = new Map<string, string>();
        schedules.forEach(s => {
            const key = `${s.collaborator_id}-${s.date}`;
            map.set(key, s.shift_id);
        });
        return map;
    }, [schedules]);

    const shiftMap = useMemo(() => {
        const map = new Map<string, Shift>();
        shifts.forEach(s => map.set(s.id, s));
        return map;
    }, [shifts]);

    const ScheduleGenerator: React.FC<{onClose: () => void, onGenerate: () => void}> = ({onClose, onGenerate}) => {
        const [selectedPattern, setSelectedPattern] = useState('');
        const [startDate, setStartDate] = useState('');
        const [endDate, setEndDate] = useState('');
        const [selectedCollabs, setSelectedCollabs] = useState<string[]>([]);
        const [isGenerating, setIsGenerating] = useState(false);

        const handleGenerate = async () => {
            if (!selectedPattern || !startDate || !endDate || selectedCollabs.length === 0) {
                alert('Por favor complete todos los campos.');
                return;
            }
            setIsGenerating(true);
            try {
                await dbService.generateSchedules(selectedPattern, startDate, endDate, selectedCollabs);
                onGenerate();
            } catch (error) {
                console.error("Failed to generate schedule", error);
                alert("Error al generar el horario.");
            } finally {
                setIsGenerating(false);
            }
        };

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full m-4 p-6 space-y-4">
                    <h3 className="text-lg font-bold dark:text-white">Generador Automático de Horarios</h3>
                    {/* Form fields for generator */}
                    <div>
                        <label className="block text-sm font-medium dark:text-gray-200">Patrón de Turno</label>
                        <select value={selectedPattern} onChange={e => setSelectedPattern(e.target.value)} className="mt-1 block w-full p-2 border rounded-md bg-white border-gray-300 text-gray-900">
                           <option value="">Seleccione un patrón</option>
                           {patterns.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium dark:text-gray-200">Fecha de Inicio</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 block w-full p-2 border rounded-md bg-white border-gray-300 text-gray-900"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium dark:text-gray-200">Fecha de Fin</label>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 block w-full p-2 border rounded-md bg-white border-gray-300 text-gray-900"/>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium dark:text-gray-200">Colaboradores</label>
                        <div className="max-h-40 overflow-y-auto border rounded-md p-2 mt-1 dark:border-gray-600">
                            {collaborators.map(c => (
                                <div key={c.id}>
                                    <label className="dark:text-gray-200"><input type="checkbox" value={c.id} checked={selectedCollabs.includes(c.id)} onChange={e => {
                                        if (e.target.checked) setSelectedCollabs([...selectedCollabs, c.id]);
                                        else setSelectedCollabs(selectedCollabs.filter(id => id !== c.id));
                                    }}/> {c.name}</label>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                        <button onClick={onClose} disabled={isGenerating} className="px-4 py-2 border rounded-md dark:bg-gray-600 dark:text-gray-200 dark:border-gray-500 hover:dark:bg-gray-500">Cancelar</button>
                        <button onClick={handleGenerate} disabled={isGenerating} className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center">
                            {isGenerating && <Spinner size="4" />}
                            {isGenerating ? "Generando..." : "Generar Horario"}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-full pt-10"><Spinner size="12"/></div>
    }
    
    if (error) {
        return (
            <div className="container mx-auto p-8 text-center bg-white dark:bg-gray-800 rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-red-500 mb-4">Error al Cargar la Planificación</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
                <button 
                    onClick={loadData} 
                    className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
                >
                    Intentar de Nuevo
                </button>
            </div>
        );
    }

    return (
        <div className="container mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Planificación de Turnos</h1>
                <button onClick={() => setShowGenerator(true)} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700">Generar Automático</button>
            </div>
            
            <div className="flex items-center justify-between mb-4">
                <button onClick={handlePrevWeek} className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-md">{'<'} Anterior</button>
                <h2 className="text-xl font-semibold">{weekDays[0].toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })} - {weekDays[6].toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}</h2>
                <button onClick={handleNextWeek} className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-md">Siguiente {'>'}</button>
            </div>
            
            <div className="bg-white bg-gray-800 shadow-lg rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Colaborador</th>
                                {weekDays.map(day => <th key={day.toISOString()} className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">{day.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric'})}</th>)}
                            </tr>
                        </thead>
                        <tbody className="bg-white bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {collaborators.map(collaborator => (
                                <tr key={collaborator.id}>
                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">{collaborator.name}</td>
                                    {weekDays.map(day => {
                                        const dateStr = day.toISOString().split('T')[0];
                                        const shiftId = scheduleMap.get(`${collaborator.id}-${dateStr}`);
                                        const shift = shiftId ? shiftMap.get(shiftId) : null;
                                        return (
                                            <td key={dateStr} className="px-2 py-4 whitespace-nowrap text-center relative group">
                                                {shift ? (
                                                    <span style={{backgroundColor: shift.color}} className="px-2 py-1 text-sm text-white font-bold rounded-md cursor-pointer">{shift.name}</span>
                                                ) : <span className="text-gray-400">-</span>}
                                                <div className="absolute z-10 hidden group-hover:block bg-white dark:bg-gray-900 shadow-lg rounded-md p-1 space-y-1">
                                                    {shifts.map(s => <button key={s.id} onClick={() => handleCellClick(collaborator.id, dateStr, s.id)} style={{backgroundColor: s.color}} className="block w-full text-left text-xs text-white px-2 py-1 rounded">{s.name}</button>)}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {showGenerator && <ScheduleGenerator onClose={() => setShowGenerator(false)} onGenerate={() => {setShowGenerator(false); loadData();}} />}
        </div>
    );
};

export default Scheduling;