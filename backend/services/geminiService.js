import { GoogleGenerativeAI } from '@google/generative-ai';

// Models in order of fastest response and lowest latency
const GEMINI_MODELS = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];

const SYSTEM_INSTRUCTION = `You are an ultra-fast, natural AI voice call assistant.
You speak directly with the user over a real-time voice call.
Rules:
1. Speak naturally, warmly, and concisely (1 to 3 short sentences max).
2. Avoid bullet points, numbered lists, asterisks, emojis, code blocks, or markdown formatting.
3. Be direct, helpful, and fast so the conversation flows seamlessly.
4. If the user speaks in Bengali, reply naturally in Bengali.
5. If the user speaks in Hindi, reply in Hindi.
6. If the user speaks in English, reply in English.`;

export class GeminiService {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not defined in environment variables');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async generateResponse(message, history = []) {
    let lastError = null;

    for (const modelName of GEMINI_MODELS) {
      try {
        const model = this.genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: SYSTEM_INSTRUCTION,
        });

        const formattedHistory = history.slice(-6).map(h => ({
          role: h.role === 'assistant' ? 'model' : h.role,
          parts: [{ text: h.text }]
        }));

        const chat = model.startChat({ history: formattedHistory });
        
        // Timeout after 12s per model to prevent hanging
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Timeout after 12s on ${modelName}`)), 12000)
        );

        const result = await Promise.race([chat.sendMessage(message), timeoutPromise]);
        const text = result.response.text();
        if (text && text.trim()) {
          return text.trim();
        }
      } catch (err) {
        console.warn(`[GeminiService] Model ${modelName} error, trying next fallback:`, err.message);
        lastError = err;
      }
    }

    throw lastError || new Error('All Gemini candidate models failed to respond');
  }
}
