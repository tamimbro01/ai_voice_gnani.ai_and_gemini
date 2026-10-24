import { StorageService } from '../services/storageService.js';

export const ConversationController = {
  getAll(req, res) {
    const list = StorageService.getAll();
    res.json(list);
  },

  getById(req, res) {
    const conv = StorageService.getById(req.params.id);
    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(conv);
  },

  deleteById(req, res) {
    StorageService.deleteById(req.params.id);
    res.json({ success: true });
  },

  deleteAll(req, res) {
    StorageService.deleteAll();
    res.json({ success: true });
  }
};
