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

export const extractFaceFromImage = async (imageBase64: string): Promise<string> => {
  if (!modelsLoaded) {
    await loadModels();
  }

  try {
    const img = await createImageFromBase64(imageBase64);
    
    // Bajar la confianza mínima ayuda en malas condiciones de iluminación
    const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 });
    const detection = await faceapi.detectSingleFace(img, options);

    if (!detection) {
      throw new Error('NO_FACE_DETECTED');
    }

    const { box } = detection;
    
    // Add 10% padding around the face so it doesn't look too tight
    const paddingX = box.width * 0.1;
    const paddingY = box.height * 0.1;

    const x = Math.max(0, box.x - paddingX);
    const y = Math.max(0, box.y - paddingY);
    const width = Math.min(img.width - x, box.width + paddingX * 2);
    const height = Math.min(img.height - y, box.height + paddingY * 2);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('CANVAS_ERROR');
    }

    ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
    
    return canvas.toDataURL('image/jpeg');
  } catch (error) {
    console.error('Error al extraer el rostro:', error);
    throw error;
  }
};

const descriptorCache = new Map<string, Float32Array>();

export const getFaceDescriptor = async (imageBase64: string): Promise<Float32Array> => {
  if (!modelsLoaded) {
    await loadModels();
  }

  const img = await createImageFromBase64(imageBase64);
  const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 });
  const detection = await faceapi.detectSingleFace(img, options)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) {
    throw new Error('OBSCURED_FACE');
  }

  return detection.descriptor;
};

export const getStoredFaceDescriptor = async (imageUrl: string): Promise<Float32Array> => {
  if (descriptorCache.has(imageUrl)) {
    return descriptorCache.get(imageUrl)!;
  }

  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const descriptor = await getFaceDescriptor(base64);
    descriptorCache.set(imageUrl, descriptor);
    return descriptor;
  } catch (error) {
    console.error('Error procesando imagen almacenada:', error);
    throw new Error('OBSCURED_FACE'); // Mismo error para ignorarlo en el loop
  }
};

export const compareDescriptors = (desc1: Float32Array, desc2: Float32Array): boolean => {
  const distance = faceapi.euclideanDistance(desc1, desc2);
  // Reducido a 0.45 para evitar falsos positivos (mayor seguridad)
  const THRESHOLD = 0.45;
  return distance <= THRESHOLD;
};

export const compareFaces = async (liveImageBase64: string, storedImageBase64: string): Promise<boolean> => {
  if (!modelsLoaded) {
    await loadModels();
  }

  try {
    console.log('🔄 Comparando rostros con face-api.js...');
    const liveImg = await createImageFromBase64(liveImageBase64);
    const storedImg = await createImageFromBase64(storedImageBase64);

    const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 });

    // Detectar rostro en foto en vivo
    const liveDetection = await faceapi.detectSingleFace(liveImg, options)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!liveDetection) {
      console.warn('❌ No se pudo detectar un rostro claro en la imagen capturada en vivo.');
      throw new Error('OBSCURED_FACE');
    }

    // Detectar rostro en foto de referencia
    const storedDetection = await faceapi.detectSingleFace(storedImg, options)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!storedDetection) {
      console.warn('❌ No se detectó rostro en la foto almacenada.');
      return false; 
    }

    // Comparar los descriptores (distancia euclidiana)
    const distance = faceapi.euclideanDistance(liveDetection.descriptor, storedDetection.descriptor);
    console.log(`📏 Distancia euclidiana entre rostros: ${distance.toFixed(4)}`);
    
    // Reducir el umbral a 0.45 para hacer la coincidencia más estricta 
    // y evitar falsos positivos al registrar colaboradores
    const THRESHOLD = 0.45;
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
