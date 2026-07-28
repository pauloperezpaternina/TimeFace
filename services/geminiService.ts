const NVIDIA_API_KEY = import.meta.env.VITE_NVIDIA_API_KEY || process.env.NVIDIA_API_KEY;
const NVIDIA_MODEL = import.meta.env.VITE_NVIDIA_MODEL || 'meta/llama-3.2-90b-vision-instruct';
// Vite proxy: /api/nvidia -> https://integrate.api.nvidia.com
const NVIDIA_API_URL = '/api/nvidia/v1/chat/completions';

const mergeImages = async (base64_1: string, base64_2: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img1 = new Image();
    const img2 = new Image();
    let loaded = 0;

    const onLoad = () => {
      loaded++;
      if (loaded === 2) {
        const canvas = document.createElement('canvas');
        canvas.width = img1.width + img2.width;
        canvas.height = Math.max(img1.height, img2.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context not available'));
        ctx.drawImage(img1, 0, 0);
        ctx.drawImage(img2, img1.width, 0);
        resolve(canvas.toDataURL('image/jpeg').split(',')[1]);
      }
    };

    img1.onload = onLoad;
    img2.onload = onLoad;
    img1.onerror = reject;
    img2.onerror = reject;

    img1.src = `data:image/jpeg;base64,${base64_1}`;
    img2.src = `data:image/jpeg;base64,${base64_2}`;
  });
};

export const compareFaces = async (liveImageBase64: string, storedImageBase64: string): Promise<boolean> => {
  try {
    const liveBase64 = liveImageBase64.split(',')[1];
    const storedBase64 = storedImageBase64.split(',')[1];

    console.log('🔄 Comparing faces with NVIDIA:', NVIDIA_MODEL);

    const mergedBase64 = await mergeImages(liveBase64, storedBase64);

    const response = await fetch(NVIDIA_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        model: NVIDIA_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'You are an advanced biometric facial recognition system. This image shows two faces side by side: left is a live capture, right is a reference photo. Your task is to determine if both faces belong to EXACTLY the SAME person.\n\nCRITICAL INSTRUCTIONS:\n1. IGNORE LIGHTING DIFFERENCES: The lighting, shadows, exposure, and perceived skin tone may differ significantly between the two photos. Do not let lighting differences cause a false negative.\n2. IGNORE HEADWEAR & ACCESSORIES: The person might be wearing a helmet or hat. Ignore anything outside the core facial structure.\n3. FOCUS ONLY ON STRUCTURAL FEATURES: Compare the geometry and shape of the eyes, nose, mouth, chin, and forehead.\n4. OBSCURED FACES: If the core facial structure (eyes, nose, mouth) is significantly blocked by dark glasses, masks, or other objects making it impossible to identify, answer OBSCURED.\n5. If the structural facial features match, answer YES. If they are structurally different people, answer NO. Answer with ONLY YES, NO, or OBSCURED.',
              },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${mergedBase64}` },
              },
            ],
          },
        ],
        max_tokens: 10,
        temperature: 0.0,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ NVIDIA API error:', response.status, errorText);
      throw new Error(`NVIDIA API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ NVIDIA API response:', data);
    const text = (data.choices?.[0]?.message?.content || '').trim().toUpperCase();
    console.log('🗣️ Respuesta del modelo extraída:', text);
    
    if (/\bOBSCURED\b/.test(text)) {
      throw new Error('OBSCURED_FACE');
    }

    const isMatch = /\bYES\b/.test(text);
    console.log('¿Es coincidencia (isMatch)?:', isMatch);
    return isMatch;

  } catch (error) {
    console.error('Error al comparar rostros con NVIDIA:', error);
    if (error instanceof Error) {
      if (error.message === 'OBSCURED_FACE') throw error;
      throw new Error(`Error en el reconocimiento facial: ${error.message}`);
    }
    throw new Error('Ocurrió un error desconocido durante el reconocimiento facial.');
  }
};