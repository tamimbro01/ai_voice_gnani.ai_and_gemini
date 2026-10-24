// ── Backend API Client ───────────────────────────────────────────────────────

export const API = {
  async sendMessage({ message, conversationId, history = [], lang = 'en-IN' }) {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, conversationId, history, lang }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Server request failed');
    return data;
  },

  async synthesizeSpeech({ text, lang = 'en-IN' }) {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang }),
    });
    if (!res.ok) throw new Error(`TTS synthesis failed with status ${res.status}`);
    return await res.arrayBuffer();
  },

  async getConversations() {
    const res = await fetch('/api/conversations');
    if (!res.ok) throw new Error('Failed to fetch conversations');
    return await res.json();
  },

  async getConversation(id) {
    const res = await fetch(`/api/conversations/${id}`);
    if (!res.ok) throw new Error('Conversation not found');
    return await res.json();
  },

  async deleteConversation(id) {
    const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    return await res.json();
  },

  async clearAllConversations() {
    const res = await fetch('/api/conversations', { method: 'DELETE' });
    return await res.json();
  }
};
