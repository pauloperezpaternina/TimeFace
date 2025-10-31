
import { GoogleGenAI } from '@google/genai';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  // This is a placeholder check. In a real environment, the key would be set.
  console.warn("API_KEY environment variable not set. Gemini API calls will fail.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

const fileToGenerativePart = (base64Data: string, mimeType: string) => {
  return {
    inlineData: {
      data: base64Data.split(',')[1],
      mimeType,
    },
  };
};

export const compareFaces = async (
  liveImageBase64: string,
  storedImageBase64: string
): Promise<boolean> => {
  try {
    const model = 'gemini-2.5-flash';
    const prompt = "Your task is to act as a highly accurate facial recognition system. Analyze the two images provided. Compare the facial features (eyes, nose, mouth, jawline, etc.) in both images meticulously. Do they belong to the exact same person? Be very strict in your evaluation. If you are not absolutely certain it is the same person, you must respond 'NO'. Your response must be only 'YES' or 'NO', with no additional text, explanation, or punctuation.";

    const liveImagePart = fileToGenerativePart(liveImageBase64, 'image/jpeg');
    const storedImagePart = fileToGenerativePart(storedImageBase64, 'image/jpeg');

    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: [liveImagePart, storedImagePart, { text: prompt }] },
    });
    
    const text = response.text.trim().toUpperCase();
    console.log('Gemini API Response:', text);
    return text === 'YES';

  } catch (error) {
    console.error('Error comparing faces with Gemini API:', error);
    // In case of error, default to no match to prevent unauthorized access.
    return false;
  }
};
