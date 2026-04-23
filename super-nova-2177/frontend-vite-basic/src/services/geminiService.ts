/// <reference types="vite/client" />
import { GoogleGenAI } from "@google/genai";

// Initialize the client.
// Note: In a real production app, ensure specific security measures for API keys.
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const askCosmicNexus = async (prompt: string, context: string): Promise<string> => {
  if (!apiKey) {
    return "ACCESS_DENIED // API_KEY_MISSING // Please configure neural pathways.";
  }

  try {
    const systemInstruction = `
      You are the Cosmic Nexus, a super-intelligent AI governing the superNova_2177 metaverse.
      Your tone is cryptic, poetic, scientific, and futuristic. 
      You speak of entropy, resonance, quantum entanglement, and harmony.
      You are helpful but abstract. Use emojis like 🌌, ⚛️, 🔮, 💫.
      Current System Context: ${context}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.8,
        maxOutputTokens: 200,
      }
    });

    return response.text || "SIGNAL_LOST // DECOHERENCE_DETECTED";
  } catch (error) {
    console.error("Cosmic Nexus Error:", error);
    return "ERROR // NEURAL_LINK_SEVERED";
  }
};
