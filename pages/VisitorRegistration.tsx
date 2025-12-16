import React, { useState, useRef, useEffect } from 'react';
import { dbService } from '../services/dbService';
import SignaturePad, { SignaturePadRef } from '../components/SignaturePad';
import Spinner from '../components/Spinner';
import { Visit } from '../types';
import { useNavigate } from 'react-router-dom';

const VisitorRegistration: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [govId, setGovId] = useState('');
  const [company, setCompany] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [consentGiven, setConsentGiven] = useState(false); // This state is not currently used, but kept for potential future use.
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [pendingSignatureData, setPendingSignatureData] = useState<string | null>(null); // New state to hold signature data

  const signaturePadRef = useRef<SignaturePadRef>(null);
  
  // List of today's visits
  const [todaysVisits, setTodaysVisits] = useState<Visit[]>([]);
  
  // Autocomplete state
  const [suggestions, setSuggestions] = useState<Visit[]>([]);
  const [activeField, setActiveField] = useState<'fullName' | 'govId' | null>(null);
  
  // Image modal state
  const [selectedSignature, setSelectedSignature] = useState<string | null>(null);
  
  // Use number for browser timeout ID
  const searchTimeout = useRef<number | null>(null);
  
  const navigate = useNavigate();

  const loadTodaysVisits = async () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    
    try {
      const visits = await dbService.getVisitsByDate(dateString);
      setTodaysVisits(visits);
    } catch (e) {
      console.error("Failed to load today's visits", e);
    }
  };

  // Cleanup timeout on unmount and load visits
  useEffect(() => {
    loadTodaysVisits();
    return () => {
      if (searchTimeout.current) {
        window.clearTimeout(searchTimeout.current);
      }
    };
  }, []);

  const handleClearSignature = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
    }
  };

  const handleInputChange = (field: 'fullName' | 'govId', value: string) => {
    if (field === 'fullName') setFullName(value);
    else setGovId(value);
    
    if (searchTimeout.current) {
      window.clearTimeout(searchTimeout.current);
    }
    
    // Only search if input has some length
    if (value.length < 2) {
      setSuggestions([]);
      setActiveField(null);
      return;
    }
    
    searchTimeout.current = window.setTimeout(async () => {
      try {
        const results = await dbService.searchVisitors(value);
        setSuggestions(results);
        setActiveField(results.length > 0 ? field : null);
      } catch (err) {
        console.error("Error searching visitors:", err);
      }
    }, 300); // 300ms debounce
  };

  const selectSuggestion = (visit: Visit) => {
    setFullName(visit.full_name);
    setGovId(visit.gov_id);
    setCompany(visit.company);
    setSuggestions([]);
    setActiveField(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("handleSubmit called");
    
    if (!fullName || !govId || !company) {
      alert("Por favor, complete todos los campos.");
      console.log("Validation failed: Missing fields");
      return;
    }
    
    if (signaturePadRef.current && signaturePadRef.current.isEmpty()) {
      alert("Por favor, firme el registro.");
      console.log("Validation failed: Signature is empty");
      return;
    }
    
    const signatureData = signaturePadRef.current?.getSignature();
    if (!signatureData) {
      alert("Error al obtener la firma.");
      console.log("Validation failed: Could not get signature data");
      return;
    }
    
    setPendingSignatureData(signatureData); // Store signature data
    setShowConsentModal(true); // Show consent modal before submitting
    console.log("Consent modal shown.");
  };

  const handleConsentSubmit = async () => {
    setIsSubmitting(true);
    setShowConsentModal(false);
    
    try {
      if (!pendingSignatureData) {
        throw new Error("No signature data available for submission.");
      }

      await dbService.registerVisit({
        full_name: fullName,
        gov_id: govId,
        company: company,
      }, pendingSignatureData); // Use the stored signature data
      
      setSuccessMessage("Visita registrada exitosamente.");
      loadTodaysVisits(); // Reload list
      
      // Reset form
      setFullName('');
      setGovId('');
      setCompany('');
      handleClearSignature();
      setSuggestions([]);
      setActiveField(null);
      setConsentGiven(false); // Reset consent state
      setPendingSignatureData(null); // Clear pending signature data
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error("Error al registrar visita:", error);
      alert("Hubo un error al registrar la visita.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeclineConsent = () => {
    setShowConsentModal(false);
    setPendingSignatureData(null); // Clear pending signature data if consent is declined
    // Redirect to attendance page
    navigate('/dashboard');
  };

  // Hide suggestions on blur with a small delay to allow click to register
  const handleBlur = () => {
    setTimeout(() => setActiveField(null), 200);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Registration Form */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 shadow-xl rounded-2xl overflow-hidden">
            <div className="bg-blue-600 px-6 py-4">
              <h1 className="text-2xl font-bold text-white text-center">Registro de Visitantes</h1>
              <p className="text-blue-100 text-center text-sm mt-1">Complete el formulario para registrar su ingreso</p>
            </div>
            <div className="p-6 sm:p-8">
              {successMessage ? (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-6 text-center" role="alert">
                  <strong className="font-bold block mb-1">¡Registro Exitoso!</strong>
                  <span className="block sm:inline">{successMessage}</span>
                </div>
              ) : null}
              
              <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
                <div className="relative">
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    id="fullName"
                    value={fullName}
                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                    onFocus={() => fullName.length >= 2 && handleInputChange('fullName', fullName)}
                    onBlur={handleBlur}
                    className="block w-full px-4 py-3 rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                    placeholder="Ej. Juan Pérez"
                    required
                    autoComplete="off"
                  />
                  {activeField === 'fullName' && suggestions.length > 0 && (
                    <ul className="absolute z-10 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
                      {suggestions.map((visit, idx) => (
                        <li
                          key={`${visit.gov_id}-${idx}`}
                          onMouseDown={() => selectSuggestion(visit)}
                          className="px-4 py-2 cursor-pointer hover:bg-blue-100 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-200"
                        >
                          <div className="font-medium">{visit.full_name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">CC: {visit.gov_id} - {visit.company}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="relative">
                    <label htmlFor="govId" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Cédula de Ciudadanía
                    </label>
                    <input
                      type="text"
                      id="govId"
                      value={govId}
                      onChange={(e) => handleInputChange('govId', e.target.value)}
                      onFocus={() => govId.length >= 2 && handleInputChange('govId', govId)}
                      onBlur={handleBlur}
                      className="block w-full px-4 py-3 rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                      placeholder="Ej. 123456789"
                      required
                      autoComplete="off"
                    />
                    {activeField === 'govId' && suggestions.length > 0 && (
                      <ul className="absolute z-10 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
                        {suggestions.map((visit, idx) => (
                          <li
                            key={`${visit.gov_id}-${idx}`}
                            onMouseDown={() => selectSuggestion(visit)}
                            className="px-4 py-2 cursor-pointer hover:bg-blue-100 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-200"
                          >
                            <div className="font-medium">{visit.gov_id}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{visit.full_name} - {visit.company}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  
                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Empresa
                    </label>
                    <input
                      type="text"
                      id="company"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="block w-full px-4 py-3 rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                      placeholder="Ej. Logiservices S.A.S"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                      Firma Digital
                    </label>
                    <button
                      type="button"
                      onClick={handleClearSignature}
                      className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-medium"
                    >
                      Borrar Firma
                    </button>
                  </div>
                  <SignaturePad
                    ref={signaturePadRef}
                    width={600}
                    height={200}
                    className="w-full h-48 shadow-inner"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Firme dentro del recuadro usando su dedo o mouse.</p>
                </div>
                
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    {isSubmitting ? (
                      <>
                        <Spinner size="5" />
                        <span className="ml-2">Registrando...</span>
                      </>
                    ) : (
                      'Registrar Visita'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        
        {/* Right Column (Desktop) / Bottom (Mobile): Daily Visits List */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 shadow-xl rounded-2xl overflow-hidden sticky top-6">
            <div className="bg-gray-700 px-6 py-4 border-b border-gray-600">
              <h2 className="text-xl font-bold text-white">Visitas de Hoy</h2>
              <p className="text-gray-300 text-xs mt-1">{new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <div className="p-0 max-h-[600px] overflow-y-auto">
              {todaysVisits.length > 0 ? (
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {todaysVisits.map((visit) => (
                    <li key={visit.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition duration-150">
                      <div className="flex items-center justify-between space-x-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {visit.full_name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {visit.company}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            ID: {visit.gov_id}
                          </p>
                        </div>
                        {visit.signature_url && (
                          <div
                            className="flex-shrink-0 cursor-pointer group"
                            onClick={() => setSelectedSignature(visit.signature_url)}
                            title="Ver firma"
                          >
                            <img
                              src={visit.signature_url}
                              alt="Firma"
                              className="h-8 w-12 object-contain bg-white border border-gray-200 rounded group-hover:border-blue-400 transition-colors"
                            />
                          </div>
                        )}
                        <div className="flex-shrink-0 flex flex-col items-end">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {new Date(visit.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-8 text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No hay visitas registradas hoy.</p>
                </div>
              )}
            </div>
            {todaysVisits.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-700 px-6 py-3 border-t border-gray-200 dark:border-gray-600">
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  Total: {todaysVisits.length} registros
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Consent Modal */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Consentimiento de Datos</h3>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
              Al firmar este registro, usted acepta que sus datos personales sean tratados conforme a nuestra política de privacidad para fines de control de acceso y seguridad.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleDeclineConsent}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                No acepto
              </button>
              <button
                onClick={handleConsentSubmit}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
              >
                Acepto y firmo
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Signature Lightbox Modal */}
      {selectedSignature && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm transition-opacity p-4"
          onClick={() => setSelectedSignature(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-white rounded-lg p-2 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-2 border-b mb-2">
              <h3 className="text-lg font-bold text-gray-800">Firma Registrada</h3>
              <button
                onClick={() => setSelectedSignature(null)}
                className="text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex justify-center items-center bg-white rounded p-4 border-2 border-dashed border-gray-200">
              <img
                src={selectedSignature}
                alt="Firma ampliada"
                className="max-w-full max-h-[60vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisitorRegistration;