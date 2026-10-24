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
    this.el.className = 'topbar';
    this.el.innerHTML = `
      <button class="sidebar-toggle" id="sidebarToggleBtn" title="Toggle Sidebar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>
      <div class="topbar-center">
        <span class="status-dot" id="headerStatusDot"></span>
        <span class="status-text" id="headerStatusText">Ready for call</span>
      </div>
      <div class="topbar-right">
        <span class="powered-badge">Gemini × Gnani.ai</span>
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
