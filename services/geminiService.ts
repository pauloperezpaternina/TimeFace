const NVIDIA_API_KEY = import.meta.env.VITE_NVIDIA_API_KEY || process.env.NVIDIA_API_KEY;
const NVIDIA_MODEL = import.meta.env.VITE_NVIDIA_MODEL || 'meta/llama-3.2-90b-vision-instruct';
// Vite proxy: /api/nvidia -> https://integrate.api.nvidia.com
const NVIDIA_API_URL = '/api/nvidia/v1/chat/completions';

export const analyzeAttendanceImage = async (imageBase64: string): Promise<{ spoof: 'OK' | 'SPOOF' | 'UNCHECKED', wellness: 'NORMAL' | 'FATIGUED' | 'STRESSED' | 'HAPPY' | 'UNCHECKED', reason: string }> => {
  try {
    const base64 = imageBase64.split(',')[1] || imageBase64;
    console.log('🔄 Analizando imagen con IA (NVIDIA LLaMA Vision)...');

    const prompt = `You are an advanced HR and Security AI assistant.
Analyze this photo taken by an employee during attendance check-in.
1. Anti-Spoofing: Determine if this is a live person in front of a camera, or a spoof attempt (e.g. a photo on a phone screen, a printed paper, or reflections indicating a screen).
2. Wellness: Estimate the emotional or physical state of the employee based on facial expressions, eye bags, or posture.

You MUST respond strictly with a valid JSON object matching this schema:
{
  "spoof": "OK" | "SPOOF",
  "wellness": "NORMAL" | "FATIGUED" | "STRESSED" | "HAPPY",
  "reason": "Brief explanation in Spanish justifying both decisions."
}
No markdown, no extra text, just the raw JSON object.`;

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
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } }
            ],
          },
        ],
        max_tokens: 150,
        temperature: 0.1,
      }),
    });

    if (!response.ok) throw new Error(`API error ${response.status}`);
    const data = await response.json();
    const textContent = data.choices?.[0]?.message?.content || '{}';
    
    // Clean up potential markdown blocks from LLM
    const cleanJson = textContent.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanJson);
    
    return {
      spoof: result.spoof || 'UNCHECKED',
      wellness: result.wellness || 'UNCHECKED',
      reason: result.reason || 'Sin justificación.'
    };
  } catch (error) {
    console.error('Error in analyzeAttendanceImage:', error);
    return { spoof: 'UNCHECKED', wellness: 'UNCHECKED', reason: 'Error de conexión con IA.' };
  }
};

export const chatWithHRAssistant = async (messages: {role: string, content: string}[], contextData: string): Promise<string> => {
  try {
    const systemPrompt = `Eres "NominAI", el asistente virtual de Recursos Humanos avanzado.
Tienes acceso a la siguiente base de datos reciente de asistencia en formato JSON:
${contextData}

Responde de forma concisa, útil y profesional a las preguntas del administrador basándote ÚNICAMENTE en estos datos. Si preguntan algo fuera de este contexto, indica que no tienes esa información.`;

    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    const response = await fetch(NVIDIA_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        model: NVIDIA_MODEL, // We use the same model, it handles text well too
        messages: apiMessages,
        max_tokens: 500,
        temperature: 0.5,
      }),
    });

    if (!response.ok) throw new Error(`API error ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'Sin respuesta.';
  } catch (error) {
    console.error('Error in chatWithHRAssistant:', error);
    return 'Lo siento, ha ocurrido un error al conectar con el cerebro de IA.';
  }
};