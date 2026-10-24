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
    if (store.get().isRecording) {
      audioRecorder.stop();
      store.set({ isRecording: false });
    }
    if (store.get().isSpeaking) {
      audioPlayer.stop();
      store.set({ isSpeaking: false });
    }

    store.set({
      currentConvId: `conv_${Date.now()}`,
      messages: [],
      transcriptPreview: '',
      status: { text: 'Ready for call', type: '' }
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
    audioPlayer.stop();
    store.set({
      isSpeaking: false,
      status: { text: 'Ready for call', type: '' }
    });
  }

  async handleToggleRecord() {
    const { isRecording, isSpeaking } = store.get();

    if (isSpeaking) {
      this.handleStopSpeaking();
    }

    if (isRecording) {
      // STOP recording
      store.set({ status: { text: 'Processing speech…', type: 'ai-thinking' } });
      const finalText = await audioRecorder.stop();
      store.set({ isRecording: false, transcriptPreview: finalText });

      if (finalText && finalText.trim()) {
        await this.processUserSpeech(finalText.trim());
      } else {
        store.set({ status: { text: 'Ready for call', type: '' } });
        this.toast.show('🎤 No speech heard. Please speak clearly into the mic.');
      }
    } else {
      // START recording
      try {
        // Pre-warm audio player during user click gesture for mobile playback
        try {
          const ctx = audioPlayer.getAudioContext();
          if (ctx.state === 'suspended') ctx.resume();
        } catch {}

        const lang = store.get().currentLang;
        store.set({
          isRecording: true,
          transcriptPreview: '',
          status: { text: 'Listening… Speak now', type: 'active' }
        });

        await audioRecorder.start({
          lang,
          onTranscriptUpdate: (text) => {
            store.set({ transcriptPreview: text });
          }
        });
      } catch (err) {
        console.error('Recording start failed:', err);
        store.set({
          isRecording: false,
          status: { text: 'Ready for call', type: '' }
        });
        this.toast.show('❌ ' + (err.message || 'Microphone error'));
      }
    }
  }

  async processUserSpeech(userText) {
    const state = store.get();
    store.set({
      transcriptPreview: '',
      status: { text: 'AI thinking…', type: 'ai-thinking' }
    });

    // 1. Add user message
    const updatedMessages = [
      ...state.messages,
      { role: 'user', text: userText, timestamp: new Date().toISOString() }
    ];
    store.set({ messages: updatedMessages });
    this.chatArea.showTyping();

    try {
      // 2. Call Gemini API
      const res = await API.sendMessage({
        message: userText,
        conversationId: state.currentConvId,
        history: state.messages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          text: m.text
        })),
        lang: state.currentLang,
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
        await this.playAiVoice(aiText);
      } else {
        store.set({ status: { text: 'Ready for call', type: '' } });
      }

    } catch (err) {
      this.chatArea.removeTyping();
      console.error('Chat error:', err);
      store.set({
        status: { text: 'Ready for call', type: '' },
        messages: [
          ...updatedMessages,
          { role: 'assistant', text: `⚠️ ${err.message}`, timestamp: new Date().toISOString() }
        ]
      });
      this.toast.show(`Error: ${err.message}`);
    }
  }

  async playAiVoice(text) {
    store.set({
      isSpeaking: true,
      status: { text: 'AI speaking…', type: 'speaking' }
    });

    const onPlaybackEnd = () => {
      store.set({
        isSpeaking: false,
        status: { text: 'Ready for call', type: '' }
      });
    };

    try {
      const audioBuffer = await API.synthesizeSpeech({
        text,
        lang: store.get().currentLang
      });
      await audioPlayer.playWavBuffer(audioBuffer, onPlaybackEnd);
    } catch (err) {
      console.warn('Gnani TTS buffer play failed, using fallback:', err.message);
      audioPlayer.speakWithFallback(text, store.get().currentLang, onPlaybackEnd);
    }
  }
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  new VoiceAgentApp();
});
