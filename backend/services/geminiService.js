import { GoogleGenerativeAI } from '@google/generative-ai';

// Models in order of fastest response and lowest latency
// Lead with the stable Flash model that responded quickest with this project key.
// Gemini 3.8 remains a current fallback; the former 3.5/3.1 names were stale.
const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-flash-latest'];

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
    this.genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
  }

  async generateResponse(message, history = [], { signal } = {}) {
    if (!this.genAI) {
      throw new Error('GEMINI_API_KEY is missing. Add it to backend/.env and restart the server.');
    }
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
        
        const controller = new AbortController();
        const abortFromCaller = () => controller.abort();
        if (signal?.aborted) throw new Error('Gemini request was cancelled.');
        signal?.addEventListener('abort', abortFromCaller, { once: true });
        const timeout = setTimeout(() => controller.abort(), 15000);
        let result;
        try {
          result = await chat.sendMessage(message, { signal: controller.signal });
        } catch (err) {
          if (controller.signal.aborted) throw new Error(`Gemini timed out after 15s on ${modelName}`);
          throw err;
        } finally {
          clearTimeout(timeout);
          signal?.removeEventListener('abort', abortFromCaller);
        }
        const text = result.response.text();
        if (text && text.trim()) {
          return text.trim();
        }
      } catch (err) {
        if (signal?.aborted) throw err;
        console.warn(`[GeminiService] Model ${modelName} error:`, err.message);
        const status = err.status || err.statusCode;
        if (status === 429) {
          const quotaError = new Error('Gemini API quota has been reached. Wait for the quota reset or enable/increase Gemini API billing and limits.');
          quotaError.statusCode = 429;
          throw quotaError;
        }
        if (status === 401 || status === 403) {
          const keyError = new Error('Gemini API rejected the configured key or project access. Check GEMINI_API_KEY and the Google AI project settings.');
          keyError.statusCode = status;
          throw keyError;
        }
        if (status === 400 && /api.?key|invalid.*key/i.test(err.message)) {
          const keyError = new Error('Gemini API rejected the configured key. Check GEMINI_API_KEY and the Google AI project settings.');
          keyError.statusCode = 401;
          throw keyError;
        }
        lastError = err;
      }
    }

    throw lastError || new Error('All Gemini candidate models failed to respond');
  }
}
