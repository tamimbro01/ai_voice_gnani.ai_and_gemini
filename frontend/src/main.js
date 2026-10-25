// ── Main Frontend Application Entry Point ────────────────────────────────────

import { store } from './state.js';
import { API } from './services/api.js';
import { audioRecorder } from './services/audioRecorder.js';
import { audioPlayer } from './services/audioPlayer.js';

import { ToastComponent } from './components/Toast.js';
import { SidebarComponent } from './components/Sidebar.js';
import { TopbarComponent } from './components/Topbar.js';
import { ChatAreaComponent } from './components/ChatArea.js';
import { VoiceControlsComponent } from './components/VoiceControls.js';

class VoiceAgentApp {
  constructor() {
    this.appShell = document.getElementById('app');
    this.turnInFlight = false;
    this.recorderStarting = false;
    this.voiceSessionId = 0;
    this.ttsController = null;
    this.chatController = null;
    this.voiceTurnTimer = null;
    this.idleRestartTimer = null;
    this.pendingVoiceSegments = [];
    this.init();
  }

  async init() {
    // 1. Toast
    this.toast = new ToastComponent(document.body);

    // 2. Sidebar
    this.sidebar = new SidebarComponent(this.appShell, {
      onNewChat: () => this.handleNewChat(),
      onSelectConversation: (id) => this.handleSelectConversation(id),
      onDeleteConversation: (id) => this.handleDeleteConversation(id),
      onClearAll: () => this.handleClearAll(),
      onLanguageChange: (lang, label) => {
        this.toast.show(`Language set to ${label}`);
      }
    });

    // 3. Main content area wrapper
    this.mainArea = document.createElement('main');
    this.mainArea.className = 'main-area';
    this.appShell.appendChild(this.mainArea);

    // 4. Topbar
    this.topbar = new TopbarComponent(this.mainArea);

    // 5. Chat Area with interactive suggestions
    this.chatArea = new ChatAreaComponent(this.mainArea, {
      onSendMessage: (text) => this.processUserSpeech(text)
    });

    // 6. Voice Controls
    this.voiceControls = new VoiceControlsComponent(this.mainArea, {
      onToggleRecord: () => this.handleToggleRecord(),
      onToggleVoice: () => this.handleToggleVoice(),
      onStopSpeaking: () => this.handleStopSpeaking()
    });

    // Load initial data
    await this.refreshConversations();
  }

  async refreshConversations() {
    try {
      const convs = await API.getConversations();
      store.set({ conversations: convs });
    } catch (e) {
      console.warn('Could not load history:', e.message);
    }
  }

  handleNewChat() {
    this.stopVoiceMode();

    store.set({
      currentConvId: `conv_${Date.now()}`,
      messages: [],
      transcriptPreview: '',
      status: { text: 'Ready for call', type: '' },
      voiceState: 'idle'
    });
  }

  async handleSelectConversation(id) {
    try {
      const conv = await API.getConversation(id);
      store.set({
        currentConvId: conv.id,
        messages: conv.messages || [],
        currentLang: conv.lang || 'en-IN',
        transcriptPreview: '',
        status: { text: 'Ready for call', type: '' }
      });
    } catch (err) {
      this.toast.show(`Error: ${err.message}`);
    }
  }

  async handleDeleteConversation(id) {
    try {
      await API.deleteConversation(id);
      if (store.get().currentConvId === id) {
        this.handleNewChat();
      }
      await this.refreshConversations();
      this.toast.show('Conversation deleted');
    } catch (err) {
      this.toast.show(`Error: ${err.message}`);
    }
  }

  async handleClearAll() {
    if (!confirm('Clear all local voice call history?')) return;
    try {
      await API.clearAllConversations();
      this.handleNewChat();
      await this.refreshConversations();
      this.toast.show('All history cleared');
    } catch (err) {
      this.toast.show(`Error: ${err.message}`);
    }
  }

  handleToggleVoice() {
    const next = !store.get().voiceEnabled;
    store.set({ voiceEnabled: next });
    this.toast.show(next ? '🔊 AI Voice ON' : '🔇 AI Voice OFF');
  }

  handleStopSpeaking() {
    if (this.ttsController) this.ttsController.abort();
    audioPlayer.stop();
    store.set({
      isSpeaking: false,
      voiceState: 'interrupted',
      status: { text: 'AI interrupted', type: 'active' }
    });
  }

  async handleToggleRecord() {
    if (store.get().voiceModeActive) await this.stopVoiceMode();
    else await this.startVoiceMode();
  }

  async startVoiceMode() {
    if (store.get().voiceModeActive) return;
    const sessionId = ++this.voiceSessionId;
    this.pendingVoiceSegments = [];
    store.set({ voiceModeActive: true, voiceState: 'listening', transcriptPreview: '', status: { text: 'Requesting microphone…', type: 'active' } });
    try {
      // Unlock mobile playback from the explicit voice-mode gesture.
      const ctx = audioPlayer.getAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
      await this.startListening(sessionId);
    } catch (err) {
      console.error('Voice mode start failed:', err);
      if (sessionId === this.voiceSessionId) {
        const message = ['NotAllowedError', 'PermissionDeniedError'].includes(err.name)
          ? 'Microphone permission denied. Allow microphone access in browser settings, then retry.'
          : (err.message || 'Microphone access failed. Check browser permissions.');
        await this.stopVoiceMode({ error: message });
        this.toast.show(`❌ ${message}`);
      }
    }
  }

  async startListening(sessionId = this.voiceSessionId) {
    if (!store.get().voiceModeActive || this.recorderStarting || store.get().isRecording || this.turnInFlight) return;
    this.recorderStarting = true;
    const lang = store.get().currentLang;
    store.set({ isRecording: true, voiceState: 'listening', transcriptPreview: '', status: { text: 'Listening… speak naturally', type: 'active' } });
    try {
      await audioRecorder.start({
        lang,
        onTranscriptUpdate: text => store.set({ transcriptPreview: text }),
        onAudioLevel: level => {
          store.set({ audioLevel: level });
          if (level > 0.025 && ['listening', 'transcribing'].includes(store.get().voiceState)) {
            store.set({ voiceState: 'recording', status: { text: 'Recording…', type: 'active' } });
          }
        },
        onFinalTranscript: text => this.queueVoiceTranscript(text, sessionId),
        onError: error => this.handleVoiceError(error, sessionId),
      });
      if (sessionId !== this.voiceSessionId || !store.get().voiceModeActive) {
        await audioRecorder.stop({ flush: false });
      }
    } catch (err) {
      throw err;
    } finally {
      this.recorderStarting = false;
    }
  }

  async stopVoiceMode({ error = '' } = {}) {
    this.voiceSessionId += 1;
    clearTimeout(this.voiceTurnTimer);
    this.voiceTurnTimer = null;
    clearTimeout(this.idleRestartTimer);
    this.idleRestartTimer = null;
    this.pendingVoiceSegments = [];
    if (this.chatController) this.chatController.abort();
    if (this.ttsController) this.ttsController.abort();
    audioPlayer.stop();
    if (audioRecorder.isRecording || audioRecorder.audioCtx || audioRecorder.mediaStream || audioRecorder.sttWs) {
      await audioRecorder.stop({ flush: false });
    }
    store.set({
      voiceModeActive: false,
      isRecording: false,
      isSpeaking: false,
      transcriptPreview: '',
      voiceState: error ? 'error' : 'idle',
      status: error ? { text: error, type: 'error' } : { text: 'Ready for call', type: '' },
    });
  }

  async handleVoiceError(error, sessionId) {
    if (sessionId !== this.voiceSessionId || !store.get().voiceModeActive) return;
    if (/no speech segment received for \d+ seconds/i.test(error?.message || '')) {
      store.set({ voiceState: 'listening', status: { text: 'Listening… reconnecting Gnani speech stream', type: 'active' } });
      if (audioRecorder.isRecording || audioRecorder.audioCtx || audioRecorder.sttWs) {
        await audioRecorder.stop({ flush: false });
      }
      store.set({ isRecording: false });
      this.idleRestartTimer = setTimeout(() => {
        this.idleRestartTimer = null;
        if (store.get().voiceModeActive && sessionId === this.voiceSessionId) void this.startListening(sessionId);
      }, 250);
      return;
    }
    const message = error?.name === 'NotAllowedError'
      ? 'Microphone permission denied. Allow microphone access in browser settings and retry.'
      : (error?.message || 'Voice recognition failed. Check the connection and retry.');
    console.error('Voice recognition error:', message);
    this.toast.show(message);
    await this.stopVoiceMode({ error: message });
  }

  queueVoiceTranscript(text, sessionId) {
    const segment = String(text || '').trim();
    if (!segment || sessionId !== this.voiceSessionId || this.turnInFlight) return;
    this.pendingVoiceSegments.push(segment);
    store.set({ voiceState: 'transcribing', status: { text: 'Speech recognized. Finishing your sentence…', type: 'ai-thinking' } });
    clearTimeout(this.voiceTurnTimer);
    this.voiceTurnTimer = setTimeout(() => {
      const transcript = this.pendingVoiceSegments.join(' ').trim();
      this.pendingVoiceSegments = [];
      this.voiceTurnTimer = null;
      void this.handleVoiceTranscript(transcript, sessionId);
    }, 1100);
  }

  async handleVoiceTranscript(text, sessionId) {
    const transcript = String(text || '').trim();
    if (!transcript || sessionId !== this.voiceSessionId || this.turnInFlight) return;
    this.turnInFlight = true;
    store.set({ voiceState: 'transcribing', status: { text: 'Transcript received. Thinking…', type: 'ai-thinking' } });
    try {
      await audioRecorder.stop({ flush: false });
      store.set({ isRecording: false, transcriptPreview: '' });
      await this.processUserSpeech(transcript, { voiceTurn: true });
    } finally {
      this.turnInFlight = false;
      if (store.get().voiceModeActive && sessionId === this.voiceSessionId) {
        await this.startListening(sessionId);
      }
    }
  }

  async processUserSpeech(userText, { voiceTurn = false } = {}) {
    const cleanText = String(userText || '').trim();
    if (!cleanText) return;
    const state = store.get();
    store.set({
      transcriptPreview: '',
      voiceState: voiceTurn ? 'thinking' : state.voiceState,
      status: { text: 'AI thinking…', type: 'ai-thinking' }
    });

    // 1. Add user message
    const updatedMessages = [
      ...state.messages,
      { role: 'user', text: cleanText, timestamp: new Date().toISOString() }
    ];
    store.set({ messages: updatedMessages });
    this.chatArea.showTyping();
    if (voiceTurn) this.chatController = new AbortController();

    try {
      // 2. Call Gemini API
      const res = await API.sendMessage({
        message: cleanText,
        conversationId: state.currentConvId,
        history: state.messages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          text: m.text
        })),
        lang: state.currentLang,
        signal: voiceTurn ? this.chatController.signal : undefined,
      });

      this.chatArea.removeTyping();

      const aiText = res.text;
      const finalMessages = [
        ...updatedMessages,
        { role: 'assistant', text: aiText, timestamp: new Date().toISOString() }
      ];

      store.set({
        messages: finalMessages,
        currentConvId: res.conversationId
      });

      await this.refreshConversations();

      // 3. Synthesize & play voice
      if (store.get().voiceEnabled) {
        await this.playAiVoice(aiText, voiceTurn);
      } else {
        store.set({ voiceState: voiceTurn ? 'listening' : store.get().voiceState, status: { text: 'Ready for call', type: '' } });
      }

    } catch (err) {
      this.chatArea.removeTyping();
      if (err.name === 'AbortError') return;
      console.error('Chat error:', err);
      store.set({
        voiceState: voiceTurn ? 'error' : store.get().voiceState,
        status: { text: err.message || 'AI request failed', type: 'error' },
        messages: [
          ...updatedMessages,
          { role: 'assistant', text: `⚠️ ${err.message}`, timestamp: new Date().toISOString() }
        ]
      });
      this.toast.show(`Error: ${err.message}`);
    } finally {
      if (voiceTurn) this.chatController = null;
    }
  }

  async playAiVoice(text, voiceTurn = false) {
    this.ttsController = new AbortController();
    store.set({
      isSpeaking: true,
      voiceState: 'speaking',
      status: { text: 'AI speaking…', type: 'speaking' }
    });

    const onPlaybackEnd = () => {
      store.set({
        isSpeaking: false,
        voiceState: voiceTurn && store.get().voiceModeActive ? 'listening' : 'idle',
        status: { text: 'Ready for call', type: '' }
      });
    };

    try {
      const audioBuffer = await API.synthesizeSpeech({
        text,
        lang: store.get().currentLang,
        signal: this.ttsController.signal
      });
      await audioPlayer.playWavBuffer(audioBuffer);
      onPlaybackEnd();
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn('Gnani TTS buffer play failed, using fallback:', err.message);
      try {
        await audioPlayer.speakWithFallback(text, store.get().currentLang);
        onPlaybackEnd();
      } catch (fallbackError) {
        console.warn('Browser speech fallback failed:', fallbackError.message);
        onPlaybackEnd();
      }
    } finally {
      this.ttsController = null;
    }
  }
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  new VoiceAgentApp();
});
