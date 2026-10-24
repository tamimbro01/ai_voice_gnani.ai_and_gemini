import { StorageService } from '../services/storageService.js';

export function createChatController(geminiService) {
  return async (req, res) => {
    const { message, conversationId, history = [], lang = 'en-IN' } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    try {
      const aiResponse = await geminiService.generateResponse(message, history);
      const savedConv = StorageService.saveConversation({
        id: conversationId,
        message,
        aiResponse,
        lang,
      });

      return res.json({
        text: aiResponse,
        conversationId: savedConv.id,
      });
    } catch (err) {
      console.error('[ChatController Error]:', err.message);
      return res.status(500).json({ error: err.message || 'Internal server error' });
    }
  };
}
