// ── Chat Area Component ───────────────────────────────────────────────────

import { store } from '../state.js';

export class ChatAreaComponent {
  constructor(container) {
    this.container = container;
    this.render();
    this.bindEvents();
  }

  render() {
    this.el = document.createElement('div');
    this.el.className = 'chat-area';
    this.el.id = 'chatAreaSection';
    this.el.innerHTML = `
      <div class="welcome-screen" id="chatWelcomeScreen">
        <div class="welcome-orb">
          <div class="pulse-ring"></div>
          <div class="pulse-ring delay-1"></div>
          <div class="pulse-ring delay-2"></div>
          <span class="welcome-icon">🎙️</span>
        </div>
        <h1>Real-time Voice AI</h1>
        <p>Tap the microphone and start speaking. Seamless voice-to-voice calling powered by Gemini & Gnani.ai.</p>
        <div class="feature-pills">
          <span class="pill">⚡ Real-time STT</span>
          <span class="pill">🤖 Gemini Flash</span>
          <span class="pill">🔊 Human-like TTS</span>
          <span class="pill">💾 Saved Locally</span>
        </div>
      </div>
      <div class="messages-container" id="chatMessagesContainer"></div>
    `;
    this.container.appendChild(this.el);

    this.welcomeScreen = this.el.querySelector('#chatWelcomeScreen');
    this.messagesContainer = this.el.querySelector('#chatMessagesContainer');
  }

  bindEvents() {
    store.on('change', (state, updates) => {
      if (updates.messages !== undefined) {
        this.renderMessages(state.messages);
      }
    });
  }

  renderMessages(messages) {
    if (!messages || messages.length === 0) {
      this.welcomeScreen.classList.remove('hidden');
      this.messagesContainer.innerHTML = '';
      return;
    }

    this.welcomeScreen.classList.add('hidden');
    this.messagesContainer.innerHTML = messages.map(m => {
      const isUser = m.role === 'user';
      return `
        <div class="message ${isUser ? 'user' : 'assistant'}">
          <div class="avatar">${isUser ? '👤' : '🤖'}</div>
          <div>
            <div class="bubble">${this.escape(m.text)}</div>
            <div class="bubble-time">${this.formatTime(m.timestamp)}</div>
          </div>
        </div>
      `;
    }).join('');

    this.scrollToBottom();
  }

  showTyping() {
    this.removeTyping();
    const div = document.createElement('div');
    div.className = 'message assistant typing-bubble';
    div.id = 'chatTypingBubble';
    div.innerHTML = `
      <div class="avatar">🤖</div>
      <div class="bubble">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;
    this.messagesContainer.appendChild(div);
    this.scrollToBottom();
  }

  removeTyping() {
    const el = this.messagesContainer.querySelector('#chatTypingBubble');
    if (el) el.remove();
  }

  scrollToBottom() {
    this.el.scrollTop = this.el.scrollHeight;
  }

  escape(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '<br>');
  }

  formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
}
