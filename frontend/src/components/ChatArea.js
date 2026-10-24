// ── Chat Area Component (Interactive Suggestions & Message Feed) ─────────

import { store } from '../state.js';

export class ChatAreaComponent {
  constructor(container, { onSendMessage } = {}) {
    this.container = container;
    this.onSendMessage = onSendMessage;
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
        <p>Tap the microphone and start speaking. Instant voice responses powered by Gemini & Gnani.ai.</p>
        <div class="feature-pills" id="chatSuggestions">
          <span class="pill suggestion-pill" data-text="Hello, how can you help me today?">👋 Say Hello</span>
          <span class="pill suggestion-pill" data-text="আমাকে সুন্দর একটি ছোট গল্প শোনাও">🇧🇩 বাংলায় গল্প বলো</span>
          <span class="pill suggestion-pill" data-text="Tell me an interesting science fact">🔬 Science Fact</span>
          <span class="pill suggestion-pill" data-text="Make me laugh with a joke">😄 Tell a Joke</span>
        </div>
      </div>
      <div class="messages-container" id="chatMessagesContainer"></div>
    `;
    this.container.appendChild(this.el);

    this.welcomeScreen = this.el.querySelector('#chatWelcomeScreen');
    this.messagesContainer = this.el.querySelector('#chatMessagesContainer');
  }

  bindEvents() {
    // Clickable suggestion pills
    this.el.querySelectorAll('.suggestion-pill').forEach(pill => {
      pill.style.cursor = 'pointer';
      pill.addEventListener('click', () => {
        const text = pill.dataset.text;
        if (this.onSendMessage && text) {
          this.onSendMessage(text);
        }
      });
    });

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
