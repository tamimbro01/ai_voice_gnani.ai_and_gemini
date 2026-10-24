// ── Toast Notification Component ──────────────────────────────────────────

export class ToastComponent {
  constructor(container) {
    this.container = container;
    this.timer = null;
    this.render();
  }

  render() {
    this.el = document.createElement('div');
    this.el.className = 'toast';
    this.el.id = 'appToast';
    this.container.appendChild(this.el);
  }

  show(message, duration = 3000) {
    this.el.textContent = message;
    this.el.classList.add('show');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.el.classList.remove('show');
    }, duration);
  }
}
