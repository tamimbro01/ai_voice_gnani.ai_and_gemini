// ── Topbar Component ──────────────────────────────────────────────────────

import { store } from '../state.js';

export class TopbarComponent {
  constructor(container) {
    this.container = container;
    this.render();
    this.bindEvents();
  }

  render() {
    this.el = document.createElement('header');
    this.el.className = 'topbar cyber-topbar';
    this.el.innerHTML = `
      <div class="topbar-left">
        <button class="cyber-icon-btn sidebar-toggle" id="sidebarToggleBtn" title="Toggle Sidebar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <button class="cyber-bracket-btn" id="cyberTargetBtn" title="Target System Active">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
        </button>
      </div>

      <div class="topbar-center">
        <span class="status-dot online" id="headerStatusDot"></span>
        <span class="status-text" id="headerStatusText">Ready for call</span>
      </div>

      <div class="topbar-right">
        <div class="model-badge-cyber" id="modelSelectorPill" title="AI Model Active">
          <svg class="hex-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2l8.5 5v10L12 22l-8.5-5V7L12 2z"/>
            <path d="M12 22V12m0 0L3.5 7M12 12l8.5-5"/>
          </svg>
          <span>Gemini × Gemini.ai</span>
          <svg class="chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>
    `;
    this.container.appendChild(this.el);

    this.statusDot = this.el.querySelector('#headerStatusDot');
    this.statusText = this.el.querySelector('#headerStatusText');
  }

  bindEvents() {
    const toggleBtn = this.el.querySelector('#sidebarToggleBtn');
    toggleBtn.addEventListener('click', () => {
      const current = store.get().sidebarCollapsed;
      store.set({ sidebarCollapsed: !current });
    });

    store.on('change', (state, updates) => {
      if (updates.status !== undefined) {
        this.statusText.textContent = state.status.text;
        this.statusDot.className = 'status-dot' + (state.status.type ? ' ' + state.status.type : '');
      }
    });
  }
}
