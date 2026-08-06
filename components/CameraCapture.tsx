
import React, { useRef, useEffect, useState, useCallback } from 'react';

interface CameraCaptureProps {
  onCapture: (imageBase64: string) => void;
  width?: number;
  height?: number;
  customOverlay?: React.ReactNode;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, width = 640, height = 480, customOverlay }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Use a ref to track the stream for reliable cleanup in useEffect
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    // Ensure any existing stream is stopped before starting a new one
    stopCamera();
    
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("El navegador no soporta acceso a la cámara o el contexto no es seguro (HTTPS).");
      }

      const newStream = await navigator.mediaDevices.getUserMedia({ 
        video: { width, height, facingMode } 
      });
      
      streamRef.current = newStream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setError(null);
    } catch (err) {
      console.error("Error accessing camera:", err);
      let msg = "No se pudo acceder a la cámara.";
      if (err instanceof DOMException) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
              msg = "Permiso denegado. Por favor permita el acceso a la cámara en su navegador.";
          } else if (err.name === 'NotFoundError') {
              msg = "No se encontró ninguna cámara.";
          } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
              msg = "La cámara está siendo usada por otra aplicación o pestaña. Por favor ciérrela e intente de nuevo.";
          } else if (err.name === 'OverconstrainedError') {
              msg = "La cámara no soporta la resolución solicitada.";
          }
      }
      setError(msg);
    }
  }, [width, height, facingMode, stopCamera]);

  const toggleCamera = useCallback(() => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }, []);

  useEffect(() => {
    startCamera();

    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = width;
        canvasRef.current.height = height;
        context.drawImage(videoRef.current, 0, 0, width, height);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        // Esperamos 1.5 segundos para que el usuario vea su foto congelada y el mensaje
        setTimeout(() => {
          onCapture(dataUrl);
        }, 1500);
      }
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className={`text-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${capturedImage ? 'bg-green-100 text-green-800' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300'}`}>
        {capturedImage ? '¡Captura terminada! Iniciando procesamiento...' : 'Ubica tu rostro frente a la cámara y mantenlo quieto. Presiona "Capturar" cuando estés listo.'}
      </div>
      <div className="relative w-full max-w-md bg-gray-900 rounded-lg overflow-hidden shadow-lg min-h-[240px] flex items-center justify-center">
        
        {customOverlay && (
          <div className="absolute top-3 left-3 z-30 pointer-events-none">
            {customOverlay}
          </div>
        )}

        {/* Guía facial (óvalo) */}
        {!error && !capturedImage && (
          <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full opacity-60">
              <defs>
                <mask id="face-hole">
                  <rect width="100" height="100" fill="white" />
                  <ellipse cx="50" cy="50" rx="25" ry="35" fill="black" />
                </mask>
              </defs>
              <rect width="100" height="100" fill="black" mask="url(#face-hole)" />
              <ellipse cx="50" cy="50" rx="25" ry="35" fill="none" stroke="white" strokeWidth="0.5" strokeDasharray="2,2" className="animate-pulse" />
            </svg>
          </div>
        )}

        {capturedImage ? (
          <div className="relative w-full h-full">
            <img src={capturedImage} alt="Captura temporal" className={`w-full h-auto ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} />
            <div className="absolute inset-0 bg-white/20 animate-pulse flex items-center justify-center">
              {/* Efecto visual de flash / procesamiento */}
            </div>
          </div>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className={`w-full h-auto ${error ? 'hidden' : 'block'} ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} />
        )}
        
        {!error && !capturedImage && (
          <button 
            onClick={toggleCamera}
            className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors backdrop-blur-sm"
            title="Cambiar Cámara"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-90 p-4">
            <p className="text-white text-center mb-4">{error}</p>
            <button 
                onClick={startCamera} 
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
                Reintentar
            </button>
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <button
        onClick={handleCapture}
        disabled={!!error || !!capturedImage}
        className={`w-full max-w-md px-4 py-3 text-white font-bold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg transition-colors ${capturedImage ? 'bg-green-600 disabled:opacity-100' : 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400'}`}
      >
        {capturedImage ? (
          <>
            <svg className="w-6 h-6 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Procesando...
          </>
        ) : (
          <>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Capturar
          </>
        )}
      </button>
    </div>
  );
};

export default CameraCapture;
