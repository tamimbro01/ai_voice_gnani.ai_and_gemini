// ── Voice Controls Component ──────────────────────────────────────────────

import { store } from '../state.js';

export class VoiceControlsComponent {
  constructor(container, { onToggleRecord, onToggleVoice, onStopSpeaking }) {
    this.container = container;
    this.onToggleRecord = onToggleRecord;
    this.onToggleVoice = onToggleVoice;
    this.onStopSpeaking = onStopSpeaking;

    this.timerInterval = null;
    this.waveAnimFrame = null;

    this.render();
    this.bindEvents();
  }

  render() {
    this.el = document.createElement('div');
    this.el.className = 'voice-control-area cyber-control-deck';
    this.el.innerHTML = `
      <div class="hud-corner top-left"></div>
      <div class="hud-corner top-right"></div>
      <div class="hud-corner bottom-left"></div>
      <div class="hud-corner bottom-right"></div>

      <div class="transcript-preview" id="ctrlTranscriptPreview">
        <span class="transcript-text" id="ctrlTranscriptText"></span>
      </div>

      <div class="deck-grid">
        <!-- Left Telemetry Logs -->
        <div class="deck-col-left">
          <p class="deck-log">> Waiting for your voice...</p>
          <p class="deck-log">> Stay curious...</p>
          <p class="deck-log">> The future is voice...</p>
          <p class="deck-dash">—</p>
        </div>

        <!-- Center Waveforms & Glowing Mic -->
        <div class="deck-col-center">
          <div class="deck-mic-row">
            <div class="waveform-vis left-waves" id="ctrlWaveformVis">
              <div class="wave-bar" style="--i:0"></div>
              <div class="wave-bar" style="--i:1"></div>
              <div class="wave-bar" style="--i:2"></div>
              <div class="wave-bar" style="--i:3"></div>
              <div class="wave-bar" style="--i:4"></div>
              <div class="wave-bar" style="--i:5"></div>
              <div class="wave-bar" style="--i:6"></div>
              <div class="wave-bar" style="--i:7"></div>
            </div>

            <div class="cyber-mic-anchor">
              <div class="mic-glow-halo"></div>
              <button class="mic-btn cyber-mic-button" id="ctrlMicBtn" title="Start voice conversation">
                <div class="mic-ripple" id="ctrlMicRipple"></div>
                <svg class="mic-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                  <path d="M19 10v2a7 7 0 01-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
                <svg class="stop-icon hidden" width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2"/>
                </svg>
              </button>
            </div>

            <div class="side-controls deck-side-actions">
              <button class="ctrl-btn cyber-speaker-btn" id="ctrlSpeakToggleBtn" title="Toggle AI voice response">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                </svg>
              </button>
              <button class="ctrl-btn cyber-speaker-btn" id="ctrlStopSpeakBtn" title="Interrupt AI and speak" style="display:none;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2"/>
                </svg>
              </button>
            </div>

            <div class="waveform-vis right-waves" id="ctrlWaveformVisRight">
              <div class="wave-bar" style="--i:7"></div>
              <div class="wave-bar" style="--i:6"></div>
              <div class="wave-bar" style="--i:5"></div>
              <div class="wave-bar" style="--i:4"></div>
              <div class="wave-bar" style="--i:3"></div>
              <div class="wave-bar" style="--i:2"></div>
              <div class="wave-bar" style="--i:1"></div>
              <div class="wave-bar" style="--i:0"></div>
            </div>
          </div>

          <div class="mic-hint cyber-mic-hint" id="ctrlMicHint">Click microphone to start voice conversation</div>
        </div>

        <!-- Right Watermark -->
        <div class="deck-col-right">
          <div class="deck-watermark script-glow">Better<br>Together</div>
        </div>
      </div>
    `;
    this.container.appendChild(this.el);

    this.micBtn = this.el.querySelector('#ctrlMicBtn');
    this.micIcon = this.micBtn.querySelector('.mic-icon');
    this.stopIcon = this.micBtn.querySelector('.stop-icon');
    this.transcriptText = this.el.querySelector('#ctrlTranscriptText');
    this.waveformVis = this.el.querySelector('#ctrlWaveformVis');
    this.waveformVisRight = this.el.querySelector('#ctrlWaveformVisRight');
    this.micHint = this.el.querySelector('#ctrlMicHint');
    this.speakToggleBtn = this.el.querySelector('#ctrlSpeakToggleBtn');
    this.stopSpeakBtn = this.el.querySelector('#ctrlStopSpeakBtn');
  }

  bindEvents() {
    this.micBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(40); } catch {}
      }
      if (this.onToggleRecord) this.onToggleRecord();
    });

    this.speakToggleBtn.addEventListener('click', () => {
      if (this.onToggleVoice) this.onToggleVoice();
    });

    this.stopSpeakBtn.addEventListener('click', () => {
      if (this.onStopSpeaking) this.onStopSpeaking();
    });

    store.on('change', (state, updates) => {
      if (updates.transcriptPreview !== undefined) {
        this.transcriptText.textContent = state.transcriptPreview;
      }
      if (updates.audioLevel !== undefined) this.handleAudioLevel(state.audioLevel);

      if (updates.voiceEnabled !== undefined) {
        this.speakToggleBtn.classList.toggle('muted', !state.voiceEnabled);
      }

      if (updates.isSpeaking !== undefined) {
        this.micBtn.classList.toggle('playing', state.isSpeaking);
        this.stopSpeakBtn.style.display = state.isSpeaking ? 'grid' : 'none';
      }

      if (updates.isRecording !== undefined) {
        this.handleRecordingState(state.isRecording);
      }

      if (updates.voiceModeActive !== undefined || updates.voiceState !== undefined) {
        this.micBtn.classList.toggle('voice-mode-active', state.voiceModeActive);
        this.micBtn.title = state.voiceModeActive ? 'Stop voice conversation' : 'Start voice conversation';
        if (!state.isRecording) {
          const labels = {
            idle: 'Click microphone to start voice conversation',
            listening: 'Listening… speak naturally. Click to stop',
            transcribing: 'Transcribing speech…',
            thinking: 'AI thinking…',
            speaking: 'AI speaking… tap interrupt or speak to interrupt',
            interrupted: 'AI interrupted. Listening…',
            error: state.status.text || 'Voice error. Click to retry.',
          };
          this.micHint.textContent = labels[state.voiceState] || labels.idle;
        }
      }
    });
  }

  handleRecordingState(isRecording) {
    this.micBtn.classList.toggle('recording', isRecording);
    this.micIcon.classList.toggle('hidden', isRecording);
    this.stopIcon.classList.toggle('hidden', !isRecording);
    this.waveformVis.classList.toggle('active', isRecording);
    if (this.waveformVisRight) this.waveformVisRight.classList.toggle('active', isRecording);

    if (isRecording) {
      this.startTimer();
      this.startWaveformAnimation();
    } else {
      this.stopTimer();
      this.stopWaveformAnimation();
    }
  }

  startTimer() {
    const start = Date.now();
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const secs = String(elapsed % 60).padStart(2, '0');
      this.micHint.textContent = `${store.get().voiceState === 'recording' ? 'Recording' : 'Listening'}: ${mins}:${secs} • Click to stop`;
    }, 1000);
  }

  stopTimer() {
    clearInterval(this.timerInterval);
    const state = store.get();
    this.micHint.textContent = state.voiceModeActive ? 'Listening… speak naturally. Click to stop' : 'Click microphone to start voice conversation';
  }

  startWaveformAnimation() {
    cancelAnimationFrame(this.waveAnimFrame);
  }

  handleAudioLevel(level) {
    const strength = Math.min(1, Math.max(0, level * 8));
    const updateBars = (container) => {
      if (!container) return;
      const bars = container.querySelectorAll('.wave-bar');
      bars.forEach((bar, index) => {
        const distribution = 0.35 + Math.abs(Math.sin((index + 1) * 1.7)) * 0.65;
        bar.style.height = `${6 + strength * distribution * 34}px`;
      });
    };
    updateBars(this.waveformVis);
    updateBars(this.waveformVisRight);
  }

  stopWaveformAnimation() {
    cancelAnimationFrame(this.waveAnimFrame);
    const resetBars = (container) => {
      if (!container) return;
      const bars = container.querySelectorAll('.wave-bar');
      bars.forEach(bar => {
        bar.style.height = '6px';
      });
    };
    resetBars(this.waveformVis);
    resetBars(this.waveformVisRight);
  }
}
