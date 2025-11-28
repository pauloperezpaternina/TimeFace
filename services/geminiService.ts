import { GoogleGenAI } from "@google/genai";

// Inicialización diferida para evitar que la aplicación se bloquee al cargar si falta la clave de API.
let ai: GoogleGenAI | null = null;

const getAiInstance = () => {
    if (ai) {
        return ai;
    }
    const API_KEY = process.env.API_KEY;
    if (!API_KEY) {
        // Este error será capturado en el Dashboard y mostrado al usuario.
        throw new Error("Falta la variable de entorno API_KEY. La funcionalidad de reconocimiento facial no está disponible.");
    }
    ai = new GoogleGenAI({ apiKey: API_KEY });
    return ai;
}

const fileToGenerativePart = (base64Data: string, mimeType: string) => {
    return {
        inlineData: {
            data: base64Data.split(',')[1],
            mimeType
        },
    };
};

export const compareFaces = async (liveImageBase64: string, storedImageBase64: string): Promise<boolean> => {
    try {
        const gemini = getAiInstance(); // Se inicializa aquí, solo cuando se usa.
        const model = 'gemini-2.5-flash';
        const prompt = "Analyze the two images. Do they belong to the exact same person? Respond only with 'YES' or 'NO'.";

        const liveImagePart = fileToGenerativePart(liveImageBase64, 'image/jpeg');
        const storedImagePart = fileToGenerativePart(storedImageBase64, 'image/jpeg');
        
        const response = await gemini.models.generateContent({
            model,
            contents: { parts: [liveImagePart, storedImagePart, {text: prompt}] },
        });

        const text = response.text.trim().toUpperCase();
        return text === 'YES';

    } catch (error) {
        console.error('Error al comparar rostros con Gemini:', error);
        // Propaga el error para que la UI pueda mostrar un mensaje claro.
        if (error instanceof Error) {
            throw new Error(`Error en el reconocimiento facial: ${error.message}`);
        }
        throw new Error("Ocurrió un error desconocido durante el reconocimiento facial.");
    }
};