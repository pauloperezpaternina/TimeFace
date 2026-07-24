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
                text: 'This image shows two faces side by side. The left face is a live camera capture and the right face is a reference photo. Determine if both faces belong to the SAME person. Ignore differences in lighting, angle, image quality, background, or facial expression. Focus only on whether the core facial features (eyes, nose, mouth shape, face structure) indicate the same person. Answer with only YES or NO.',
              },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${mergedBase64}` },
              },
            ],
          },
        ],
        max_tokens: 10,
        temperature: 0.5,
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
    const isMatch = /\bYES\b/.test(text);
    console.log('¿Es coincidencia (isMatch)?:', isMatch);
    return isMatch;

  } catch (error) {
    console.error('Error al comparar rostros con NVIDIA:', error);
    if (error instanceof Error) {
      throw new Error(`Error en el reconocimiento facial: ${error.message}`);
    }
    throw new Error('Ocurrió un error desconocido durante el reconocimiento facial.');
  }
};