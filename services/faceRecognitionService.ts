import * as faceapi from 'face-api.js';

let modelsLoaded = false;

export const loadModels = async () => {
  if (modelsLoaded) return;
  const MODEL_URL = '/models'; // Servido desde la carpeta public

  try {
    console.log('Cargando modelos de face-api.js...');
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    modelsLoaded = true;
    console.log('✅ Modelos de face-api.js cargados correctamente.');
  } catch (error) {
    console.error('Error cargando modelos de face-api.js:', error);
    throw new Error('Error al cargar modelos de reconocimiento facial.');
  }
};

const createImageFromBase64 = (base64: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;
  });
};

export const compareFaces = async (liveImageBase64: string, storedImageBase64: string): Promise<boolean> => {
  if (!modelsLoaded) {
    await loadModels();
  }

  try {
    console.log('🔄 Comparando rostros con face-api.js...');
    const liveImg = await createImageFromBase64(liveImageBase64);
    const storedImg = await createImageFromBase64(storedImageBase64);

    // Detectar rostro en foto en vivo
    const liveDetection = await faceapi.detectSingleFace(liveImg)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!liveDetection) {
      console.warn('❌ No se pudo detectar un rostro claro en la imagen capturada en vivo.');
      throw new Error('OBSCURED_FACE');
    }

    // Detectar rostro en foto de referencia
    const storedDetection = await faceapi.detectSingleFace(storedImg)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!storedDetection) {
      console.warn('❌ No se detectó rostro en la foto almacenada.');
      return false; 
    }

    // Comparar los descriptores (distancia euclidiana)
    const distance = faceapi.euclideanDistance(liveDetection.descriptor, storedDetection.descriptor);
    console.log(`📏 Distancia euclidiana entre rostros: ${distance.toFixed(4)}`);
    
    // Umbral estricto para evitar falsos positivos. 
    // Por defecto es 0.6, pero 0.5 o 0.45 es mucho más estricto.
    const THRESHOLD = 0.5;
    const isMatch = distance <= THRESHOLD;
    
    console.log(`¿Es coincidencia (isMatch)?: ${isMatch} (Umbral: ${THRESHOLD})`);
    return isMatch;

  } catch (error) {
    console.error('Error al comparar rostros con face-api:', error);
    if (error instanceof Error) {
      if (error.message === 'OBSCURED_FACE') throw error;
    }
    throw error;
  }
};
