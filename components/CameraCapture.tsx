
import React, { useRef, useEffect, useState, useCallback } from 'react';

interface CameraCaptureProps {
  onCapture: (imageBase64: string) => void;
  width?: number;
  height?: number;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, width = 640, height = 480 }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Use a ref to track the stream for reliable cleanup in useEffect
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        video: { width, height, facingMode: 'user' } 
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
  }, [width, height, stopCamera]);

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
        onCapture(dataUrl);
      }
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative w-full max-w-md bg-gray-900 rounded-lg overflow-hidden shadow-lg min-h-[240px] flex items-center justify-center">
        <video ref={videoRef} autoPlay playsInline muted className={`w-full h-auto ${error ? 'hidden' : 'block'}`} />
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
        disabled={!!error}
        className="w-full max-w-md px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        Capturar Foto
      </button>
    </div>
  );
};

export default CameraCapture;
