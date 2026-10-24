// ── Sidebar Component (Mobile Optimized with Overlay) ─────────────────────

import { store } from '../state.js';

export class SidebarComponent {
  constructor(container, { onNewChat, onSelectConversation, onDeleteConversation, onClearAll, onLanguageChange }) {
    this.container = container;
    this.onNewChat = onNewChat;
    this.onSelectConversation = onSelectConversation;
    this.onDeleteConversation = onDeleteConversation;
    this.onClearAll = onClearAll;
    this.onLanguageChange = onLanguageChange;

    this.render();
    this.bindEvents();
  }

  render() {
    // Backdrop for mobile
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'sidebar-backdrop';
    this.container.appendChild(this.backdrop);

    // Sidebar element
    this.el = document.createElement('aside');
    this.el.className = 'sidebar' + (store.get().sidebarCollapsed ? ' collapsed' : '');
    this.el.innerHTML = `
      <div class="sidebar-header">
        <div class="logo">
          <span class="logo-icon">🎙️</span>
          <span class="logo-text">VoiceAI</span>
        </div>
        <button class="new-chat-btn" id="sidebarNewChatBtn" title="Start New Call">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>

      <div class="sidebar-section-label">Language</div>
      <div class="lang-selector" id="langSelectorGroup">
        <button class="lang-btn active" data-lang="en-IN">🇮🇳 English</button>
        <button class="lang-btn" data-lang="bn-IN">🇧🇩 বাংলা</button>
        <button class="lang-btn" data-lang="hi-IN">🇮🇳 हिंदी</button>
        <button class="lang-btn" data-lang="te-IN">Telugu</button>
        <button class="lang-btn" data-lang="ta-IN">Tamil</button>
      </div>

      <div class="sidebar-section-label" style="margin-top:16px;">
        <span>Call History</span>
        <button class="clear-all-btn" id="sidebarClearAllBtn" title="Clear all history">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6l-1 14H6L5 6"></path>
            <path d="M10 11v6M14 11v6"></path>
          </svg>
        </button>
      </div>

      <div class="conversations-list" id="sidebarConvList">
        <div class="empty-history">No voice calls recorded</div>
      </div>
    `;
    this.container.appendChild(this.el);

    this.convList = this.el.querySelector('#sidebarConvList');
  }

  closeOnMobile() {
    if (window.innerWidth <= 768) {
      store.set({ sidebarCollapsed: true });
    }
  }

  bindEvents() {
    this.backdrop.addEventListener('click', () => {
      store.set({ sidebarCollapsed: true });
    });

    this.el.querySelector('#sidebarNewChatBtn').addEventListener('click', () => {
      if (this.onNewChat) this.onNewChat();
      this.closeOnMobile();
    });

    this.el.querySelector('#sidebarClearAllBtn').addEventListener('click', () => {
      if (this.onClearAll) this.onClearAll();
    });

    this.el.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.el.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const lang = btn.dataset.lang;
        store.set({ currentLang: lang });
        if (this.onLanguageChange) this.onLanguageChange(lang, btn.textContent.trim());
        this.closeOnMobile();
      });
    });

    store.on('change', (state, updates) => {
      if (updates.sidebarCollapsed !== undefined) {
        this.el.classList.toggle('collapsed', state.sidebarCollapsed);
        this.backdrop.classList.toggle('active', !state.sidebarCollapsed && window.innerWidth <= 768);
      }
      if (updates.conversations !== undefined || updates.currentConvId !== undefined) {
        this.renderConversations(state.conversations, state.currentConvId);
      }
    });
  }

  renderConversations(conversations, currentId) {
    if (!conversations || conversations.length === 0) {
      this.convList.innerHTML = '<div class="empty-history">No voice calls recorded</div>';
      return;
    }

    this.convList.innerHTML = conversations.map(c => `
      <div class="conv-item ${c.id === currentId ? 'active' : ''}" data-id="${c.id}">
        <div style="overflow:hidden; flex:1;">
          <div class="conv-title">${this.escape(c.title || 'Voice Call')}</div>
          <div class="conv-date">${this.formatDate(c.updatedAt)} • ${c.messages?.length || 0} msgs</div>
        </div>
        <button class="conv-delete" data-id="${c.id}" title="Delete">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `).join('');

    this.convList.querySelectorAll('.conv-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.conv-delete')) return;
        if (this.onSelectConversation) this.onSelectConversation(item.dataset.id);
        this.closeOnMobile();
      });
    });

    this.convList.querySelectorAll('.conv-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onDeleteConversation) this.onDeleteConversation(btn.dataset.id);
      });
    });
  }

  escape(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
}
