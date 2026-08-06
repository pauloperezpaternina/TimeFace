import React, { useState, useEffect, useRef } from 'react';
import { dbService } from '../../services/dbService';
import { chatWithHRAssistant } from '../../services/geminiService';
import Spinner from '../../components/Spinner';
import Modal from '../../components/Modal';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const HRVirtualAssistant: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '¡Hola! Soy NominAI, tu asistente virtual de Recursos Humanos. He analizado la base de datos de asistencia reciente. ¿En qué te puedo ayudar hoy?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [contextData, setContextData] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prepareContext = async () => {
      try {
        // Traemos los últimos 50 registros para tener un buen contexto de los últimos días
        const records = await dbService.getRecentAttendanceRecords(50);
        
        // Compact the data to save tokens
        const compactData = records.map(r => ({
          n: r.collaborator_name,
          t: r.type,
          time: new Date(r.timestamp).toLocaleString('es-ES', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          w: r.wellness_status !== 'UNCHECKED' ? r.wellness_status : undefined,
          s: r.spoof_status !== 'UNCHECKED' ? r.spoof_status : undefined
        }));

        setContextData(JSON.stringify(compactData));
      } catch (error) {
        console.error('Error fetching context for AI:', error);
      } finally {
        setIsInitializing(false);
      }
    };
    prepareContext();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const historyForApi = messages.map(m => ({ role: m.role, content: m.content }));
      historyForApi.push({ role: 'user', content: userMsg });

      // We only send the last 6 messages to save context window
      const recentHistory = historyForApi.slice(-6);

      const response = await chatWithHRAssistant(recentHistory, contextData);
      
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Lo siento, ocurrió un error de conexión.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl h-[calc(100vh-8rem)] flex flex-col">
      <div className="mb-4 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            NominAI - Asistente RRHH
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Pregunta sobre asistencia, reportes o anomalías en lenguaje natural.</p>
        </div>
        <button
          onClick={() => setShowHelp(true)}
          className="flex items-center gap-2 px-3 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 text-sm font-medium rounded-lg transition-colors border border-purple-300"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          ¿Cómo funciona la IA?
        </button>
      </div>

      <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        
        {isInitializing ? (
          <div className="flex-1 flex items-center justify-center">
            <Spinner size="8" />
            <span className="ml-3 text-gray-500">Analizando base de datos...</span>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-br-none' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none'
                  }`}>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
              <form onSubmit={handleSend} className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ej: ¿Cuántas personas llegaron tarde hoy?"
                  className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5 transform rotate-90" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path></svg>
                </button>
              </form>
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        title="🤖 ¿Cómo funciona la Inteligencia Artificial en TimeFace?"
      >
        <div className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>
            El sistema de Inteligencia Artificial (IA) trabaja en <strong>tres niveles principales</strong> para asegurar la fiabilidad, salud y agilidad del control de asistencia:
          </p>
          
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
            <h3 className="font-bold text-purple-700 dark:text-purple-400 flex items-center gap-2">
              <span className="text-xl">1</span> Reconocimiento Facial y Anti-Spoofing
            </h3>
            <p className="mt-1 text-sm">
              Al momento del marcaje, el sistema compara el rostro del colaborador con su foto de perfil usando biometría estricta. Además, en segundo plano, la IA analiza la imagen para <strong>detectar fraudes (Anti-Spoofing)</strong>, como intentos de usar una fotografía impresa o una pantalla de celular para engañar al sistema.
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
            <h3 className="font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2">
              <span className="text-xl">2</span> Análisis de Bienestar (Wellness)
            </h3>
            <p className="mt-1 text-sm">
              De forma totalmente pasiva y durante el mismo marcaje, la IA de visión analiza los microgestos faciales para determinar si el empleado muestra signos de <strong>fatiga extrema, enfermedad o alteraciones del ánimo</strong>. Esto permite a RRHH intervenir a tiempo (desde la pestaña de Bienestar) si un colaborador requiere descanso.
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
            <h3 className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
              <span className="text-xl">3</span> Asistente Virtual RRHH (NominAI)
            </h3>
            <p className="mt-1 text-sm">
              Es el chat interactivo en el que te encuentras. NominAI lee la base de datos de asistencia más reciente y <strong>responde a tus preguntas en lenguaje natural</strong>. Puedes preguntarle cosas como <em>"¿Quién llegó tarde hoy?"</em> o <em>"Resume la asistencia de esta semana"</em>, y cruzará los datos instantáneamente.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default HRVirtualAssistant;
