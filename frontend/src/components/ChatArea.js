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
    this.el.className = 'chat-area cyber-chat-area';
    this.el.id = 'chatAreaSection';
    this.el.innerHTML = `
      <div class="cyber-hud-frame welcome-screen" id="chatWelcomeScreen">
        <!-- HUD Corner Brackets and Tech Accents -->
        <div class="hud-corner top-left"></div>
        <div class="hud-corner top-right"></div>
        <div class="hud-corner bottom-left"></div>
        <div class="hud-corner bottom-right"></div>

        <!-- Top HUD Header Banner -->
        <div class="hud-top-header">
          <span class="hud-bracket-label">[ YOUR PERSONAL VOICE ASSISTANT ]</span>
        </div>

        <div class="hud-body-grid">
          <!-- Left Telemetry & Code Stream -->
          <div class="hud-col-left">
            <div class="hud-code-terminal">
              <p class="code-line">> voice.init();</p>
              <p class="code-line">> mic.ready = true;</p>
              <p class="code-line">> ai.core = online;</p>
              <p class="code-line">> listening...</p>
              <p class="code-line cursor-blink">></p>
            </div>
            <div class="hud-meta-text">
              <span class="meta-title">Human + AI</span>
              <span class="meta-sub">Better Together</span>
              <span class="meta-dash">—</span>
            </div>
          </div>

          <!-- Center Acoustic Radar & Hero Title -->
          <div class="hud-col-center">
            <div class="cyber-radar-wrapper">
              <div class="radar-outer-ring"></div>
              <div class="radar-wave-ring r-1"></div>
              <div class="radar-wave-ring r-2"></div>
              <div class="radar-wave-ring r-3"></div>
              <div class="radar-center-core">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#00f3ff" stroke-width="2">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                  <path d="M19 10v2a7 7 0 01-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              </div>
            </div>

            <h1 class="hud-headline">
              Just say <span class="script-glow">hello.</span>
            </h1>

            <p class="hud-subheadline">
              Ask anything, think out loud, or switch languages. I'm here to listen and respond naturally.
            </p>

            <div class="hud-features-row">
              <span class="feat-item"><span class="feat-icon">⚡</span> Natural conversation</span>
              <span class="feat-sep">|</span>
              <span class="feat-item"><span class="feat-icon">🌐</span> বাংলা + English</span>
              <span class="feat-sep">|</span>
              <span class="feat-item"><span class="feat-icon">🔊</span> Spoken replies</span>
            </div>

            <!-- Try Asking Section -->
            <div class="try-asking-box">
              <div class="try-asking-title">TRY ASKING</div>
              <div class="try-asking-pills" id="chatSuggestions">
                <button class="cyber-pill suggestion-pill" data-text="Say hello">
                  <span>👋</span> Say hello
                </button>
                <button class="cyber-pill suggestion-pill" data-text="আমাকে সুন্দর একটি ছোট গল্প শোনাও">
                  <span>💬</span> বাংলায় প্রশ্ন করুন
                </button>
                <button class="cyber-pill suggestion-pill" data-text="Tell me an interesting science fact">
                  <span>🔮</span> A science fact
                </button>
                <button class="cyber-pill suggestion-pill" data-text="Tell me a joke">
                  <span>😊</span> Tell me a joke
                </button>
              </div>
            </div>
          </div>

          <!-- Right Hacker Visual & Cyber Badge -->
          <div class="hud-col-right">
            <div class="hacker-visual-container">
              <img src="./assets/hacker-hero.jpg" alt="VoiceAI Cyber Hacker" class="hacker-image" />
              <div class="hacker-image-overlay"></div>
              <div class="cyber-tag-column">
                <span>CODE</span>
                <span>THINK</span>
                <span>BUILD</span>
                <span>DREAM</span>
                <span class="dash">—</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Messages Stream (Shown when call/conversation is active) -->
      <div class="messages-container cyber-scrollbar hidden" id="chatMessagesContainer"></div>
    `;
    this.container.appendChild(this.el);

    this.welcomeScreen = this.el.querySelector('#chatWelcomeScreen');
    this.messagesContainer = this.el.querySelector('#chatMessagesContainer');
  }

  bindEvents() {
    // Clickable suggestion pills
    this.el.querySelectorAll('.suggestion-pill').forEach(pill => {
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
      this.messagesContainer.classList.add('hidden');
      this.messagesContainer.innerHTML = '';
      return;
    }

    this.welcomeScreen.classList.add('hidden');
    this.messagesContainer.classList.remove('hidden');
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
