// ── Sidebar Component (Mobile Optimized with Close Button & Backdrop) ────────

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
    // Backdrop overlay for mobile
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'sidebar-backdrop';
    this.container.appendChild(this.backdrop);

    // Sidebar element
    this.el = document.createElement('aside');
    this.el.className = 'sidebar cyber-sidebar' + (store.get().sidebarCollapsed ? ' collapsed' : '');
    this.el.innerHTML = `
      <div class="sidebar-header">
        <div class="logo cyber-logo">
          <div class="hacker-logo-frame">
            <svg class="hacker-logo-svg" width="34" height="34" viewBox="0 0 48 48" fill="none">
              <path d="M24 4L8 14V34L24 44L40 34V14L24 4Z" stroke="#00f3ff" stroke-width="2" fill="rgba(0, 243, 255, 0.08)"/>
              <path d="M14 18L24 10L34 18V28L24 38L14 28V18Z" stroke="#00e5ff" stroke-width="1.8" fill="#020814"/>
              <path d="M18 22L22 24M30 22L26 24" stroke="#00ffc8" stroke-width="2.5" stroke-linecap="round"/>
              <path d="M21 30H27" stroke="#00e5ff" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="logo-text-group">
            <span class="logo-text">VoiceAI</span>
            <span class="logo-subtext">SPEAK • THINK • CREATE</span>
          </div>
        </div>
        <div class="sidebar-header-actions">
          <button class="new-chat-btn cyber-bracket-btn" id="sidebarNewChatBtn" title="Start New Call">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          <button class="sidebar-close-btn" id="sidebarCloseBtn" title="Close Sidebar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <div class="sidebar-section-label">LANGUAGE</div>
      <div class="lang-selector-cyber" id="langSelectorGroup">
        <button class="lang-btn-active-pill" id="activeLangPill">
          <span class="lang-flag-label">🇬🇧 English</span>
          <svg class="chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <div class="lang-cyber-list" id="langListContainer">
          <button class="lang-item active" data-lang="en-IN">🇬🇧 English</button>
          <button class="lang-item" data-lang="bn-IN">🇧🇩 বাংলা</button>
          <button class="lang-item" data-lang="hi-IN">🇮🇳 हिन्दी</button>
          <button class="lang-item" data-lang="te-IN">🇮🇳 Telugu</button>
          <button class="lang-item" data-lang="ta-IN">🇮🇳 Tamil</button>
        </div>
      </div>

      <div class="sidebar-section-label history-header" style="margin-top:18px;">
        <div class="history-label-left">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>CALL HISTORY</span>
        </div>
        <button class="clear-all-btn cyber-clear-btn" id="sidebarClearAllBtn" title="Clear all history">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6l-1 14H6L5 6"></path>
            <path d="M10 11v6M14 11v6"></path>
          </svg>
        </button>
      </div>

      <div class="conversations-list cyber-scrollbar" id="sidebarConvList">
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
    // Backdrop click closes sidebar
    this.backdrop.addEventListener('click', () => {
      store.set({ sidebarCollapsed: true });
    });

    // Close button (visible on mobile)
    const closeBtn = this.el.querySelector('#sidebarCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        store.set({ sidebarCollapsed: true });
      });
    }

    // New chat button
    this.el.querySelector('#sidebarNewChatBtn').addEventListener('click', () => {
      if (this.onNewChat) this.onNewChat();
      this.closeOnMobile();
    });

    // Clear all button
    this.el.querySelector('#sidebarClearAllBtn').addEventListener('click', () => {
      if (this.onClearAll) this.onClearAll();
    });

    // Language selector handling
    const activePill = this.el.querySelector('#activeLangPill');
    const langList = this.el.querySelector('#langListContainer');

    this.el.querySelectorAll('.lang-item').forEach(btn => {
      btn.addEventListener('click', () => {
        this.el.querySelectorAll('.lang-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const lang = btn.dataset.lang;
        const labelText = btn.textContent.trim();
        const flagText = activePill.querySelector('.lang-flag-label');
        if (flagText) flagText.textContent = labelText;
        store.set({ currentLang: lang });
        if (this.onLanguageChange) this.onLanguageChange(lang, labelText);
        this.closeOnMobile();
      });
    });

    // Store state listener
    store.on('change', (state, updates) => {
      if (updates.sidebarCollapsed !== undefined) {
        this.el.classList.toggle('collapsed', state.sidebarCollapsed);
        const isMobile = window.innerWidth <= 768;
        this.backdrop.classList.toggle('active', !state.sidebarCollapsed && isMobile);
      }
      if (updates.conversations !== undefined || updates.currentConvId !== undefined) {
        this.renderConversations(state.conversations, state.currentConvId);
      }
    });

    // Responsive collapse/expand on window resize
    window.addEventListener('resize', () => {
      if (window.innerWidth <= 768) {
        if (!store.get().sidebarCollapsed) {
          store.set({ sidebarCollapsed: true });
        }
      } else {
        if (store.get().sidebarCollapsed) {
          store.set({ sidebarCollapsed: false });
        }
      }
    });
  }

  renderConversations(conversations, currentId) {
    if (!conversations || conversations.length === 0) {
      this.convList.innerHTML = '<div class="empty-history">No voice calls recorded</div>';
      return;
    }

    const icons = [
      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>`,
      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,
      `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
    ];

    this.convList.innerHTML = conversations.map((c, i) => {
      const isActive = c.id === currentId;
      const iconSvg = icons[i % icons.length];
      return `
        <div class="conv-item cyber-conv-item ${isActive ? 'active' : ''}" data-id="${c.id}">
          <div class="conv-badge ${isActive ? 'badge-active' : ''}">
            ${iconSvg}
          </div>
          <div class="conv-info">
            <div class="conv-title">${this.escape(c.title || 'kemon acho?')}</div>
            <div class="conv-date">${this.formatDate(c.updatedAt)} • ${c.messages?.length || 0} msgs</div>
          </div>
          <div class="conv-actions">
            <button class="conv-delete" data-id="${c.id}" title="Delete">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <svg class="conv-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        </div>
      `;
    }).join('');

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
