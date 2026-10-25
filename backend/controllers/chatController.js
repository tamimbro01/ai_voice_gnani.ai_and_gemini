import { StorageService } from '../services/storageService.js';

export function createChatController(geminiService) {
  return async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { message, conversationId, history = [], lang = 'en-IN' } = body;

    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }
    if (message.length > 8000) return res.status(413).json({ error: 'Message is too long.' });

    const supportedLanguages = new Set(['en-IN', 'bn-IN', 'hi-IN', 'te-IN', 'ta-IN']);
    const safeHistory = Array.isArray(history)
      ? history.slice(-12).filter(item => item && ['user', 'assistant'].includes(item.role) && typeof item.text === 'string')
        .map(item => ({ role: item.role, text: item.text.slice(0, 8000) }))
      : [];
    const safeLang = supportedLanguages.has(lang) ? lang : 'en-IN';
    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });

    try {
      const aiResponse = await geminiService.generateResponse(message.trim(), safeHistory, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const savedConv = StorageService.saveConversation({
        id: typeof conversationId === 'string' ? conversationId.slice(0, 100) : undefined,
        message: message.trim(),
        aiResponse,
        lang: safeLang,
      });

      return res.json({
        text: aiResponse,
        conversationId: savedConv.id,
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error('[ChatController Error]:', err.message);
      return res.status(err.statusCode || 500).json({ error: err.message || 'Internal server error' });
    }
  };
}
