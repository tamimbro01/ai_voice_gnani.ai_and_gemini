import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'data', 'conversations.json');

// Ensure directory and file exist
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ conversations: [] }, null, 2));
}

export const StorageService = {
  getAll() {
    try {
      const content = fs.readFileSync(DATA_FILE, 'utf8');
      const data = JSON.parse(content);
      return data.conversations || [];
    } catch {
      return [];
    }
  },

  getById(id) {
    const list = this.getAll();
    return list.find(c => c.id === id) || null;
  },

  saveConversation({ id, message, aiResponse, lang = 'en-IN' }) {
    const conversations = this.getAll();
    let conv = conversations.find(c => c.id === id);
    const now = new Date().toISOString();

    if (!conv) {
      conv = {
        id: id || `conv_${Date.now()}`,
        title: message.trim().slice(0, 45),
        createdAt: now,
        updatedAt: now,
        lang,
        messages: [],
      };
      conversations.unshift(conv);
    }

    conv.messages.push(
      { role: 'user', text: message.trim(), timestamp: now },
      { role: 'assistant', text: aiResponse.trim(), timestamp: new Date().toISOString() }
    );
    conv.updatedAt = new Date().toISOString();

    fs.writeFileSync(DATA_FILE, JSON.stringify({ conversations }, null, 2));
    return conv;
  },

  deleteById(id) {
    const conversations = this.getAll().filter(c => c.id !== id);
    fs.writeFileSync(DATA_FILE, JSON.stringify({ conversations }, null, 2));
    return true;
  },

  deleteAll() {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ conversations: [] }, null, 2));
    return true;
  }
};
