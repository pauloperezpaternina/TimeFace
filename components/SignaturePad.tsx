
import React, { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react';

export interface SignaturePadRef {
  clear: () => void;
  getSignature: () => string | null;
  isEmpty: () => boolean;
}

interface SignaturePadProps {
  width?: number;
  height?: number;
  className?: string;
}

const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(({ width = 500, height = 200, className = "" }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  useImperativeHandle(ref, () => ({
    clear: () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          setIsEmpty(true);
        }
      }
    },
    getSignature: () => {
      const canvas = canvasRef.current;
      if (canvas && !isEmpty) {
        return canvas.toDataURL('image/png');
      }
      return null;
    },
    isEmpty: () => isEmpty
  }));

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setIsEmpty(false);
    
    const { offsetX, offsetY } = getCoordinates(e, canvas);
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { offsetX, offsetY } = getCoordinates(e, canvas);
    ctx.lineTo(offsetX, offsetY);
    ctx.stroke();
  };

  const stopDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.closePath();
    }
    setIsDrawing(false);
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    let clientX, clientY;
    if ('touches' in e) {
      const touch = e.touches[0];
      if (touch) {
          clientX = touch.clientX;
          clientY = touch.clientY;
      } else {
          // Fallback if touch is missing (rare in touchstart/move)
          clientX = 0;
          clientY = 0;
      }
    } else {
      const mouse = e as React.MouseEvent;
      clientX = mouse.clientX;
      clientY = mouse.clientY;
    }

    const rect = canvas.getBoundingClientRect();
    
    // Avoid division by zero if the element is hidden or has 0 size
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;

    return {
      offsetX: (clientX - rect.left) * scaleX,
      offsetY: (clientY - rect.top) * scaleY
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000';
      }
    }
  }, []);

  return (
    <div className={`border-2 border-gray-300 border-dashed rounded-lg bg-white touch-none ${className}`}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full h-full cursor-crosshair rounded-lg"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
    </div>
  );
});

export default SignaturePad;
