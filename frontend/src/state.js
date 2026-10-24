// ── Reactive Application State & Event Bus ────────────────────────────────────

export class EventEmitter {
  constructor() {
    this.events = {};
  }
  on(event, listener) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(listener);
    return () => this.off(event, listener);
  }
  off(event, listener) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(l => l !== listener);
  }
  emit(event, ...args) {
    if (!this.events[event]) return;
    this.events[event].forEach(listener => listener(...args));
  }
}

class Store extends EventEmitter {
  constructor() {
    super();
    this.state = {
      isRecording: false,
      isSpeaking: false,
      voiceEnabled: true,
      currentLang: 'en-IN',
      currentConvId: `conv_${Date.now()}`,
      messages: [],
      conversations: [],
      callDuration: 0,
      transcriptPreview: '',
      status: { text: 'Ready for call', type: '' }, // '', 'active', 'speaking', 'ai-thinking'
      sidebarCollapsed: false,
    };
  }

  get() {
    return this.state;
  }

  set(updates) {
    this.state = { ...this.state, ...updates };
    this.emit('change', this.state, updates);
  }
}

export const store = new Store();
