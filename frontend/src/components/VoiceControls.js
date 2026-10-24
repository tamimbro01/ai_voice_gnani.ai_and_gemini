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
    this.el.className = 'voice-control-area';
    this.el.innerHTML = `
      <div class="transcript-preview" id="ctrlTranscriptPreview">
        <span class="transcript-text" id="ctrlTranscriptText"></span>
      </div>

      <div class="controls-row">
        <div class="waveform-vis" id="ctrlWaveformVis">
          <div class="wave-bar" style="--i:0"></div>
          <div class="wave-bar" style="--i:1"></div>
          <div class="wave-bar" style="--i:2"></div>
          <div class="wave-bar" style="--i:3"></div>
          <div class="wave-bar" style="--i:4"></div>
          <div class="wave-bar" style="--i:5"></div>
          <div class="wave-bar" style="--i:6"></div>
          <div class="wave-bar" style="--i:7"></div>
          <div class="wave-bar" style="--i:8"></div>
        </div>

        <button class="mic-btn" id="ctrlMicBtn" title="Click to speak">
          <div class="mic-ripple" id="ctrlMicRipple"></div>
          <svg class="mic-icon" width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1a4 4 0 014 4v6a4 4 0 01-8 0V5a4 4 0 014-4zm0 2a2 2 0 00-2 2v6a2 2 0 004 0V5a2 2 0 00-2-2z"/>
            <path d="M19 10a1 1 0 012 0 9 9 0 01-8 8.94V21h2a1 1 0 010 2H9a1 1 0 010-2h2v-2.06A9 9 0 013 10a1 1 0 012 0 7 7 0 0014 0z"/>
          </svg>
          <svg class="stop-icon hidden" width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
            <rect x="4" y="4" width="16" height="16" rx="2"/>
          </svg>
        </button>

        <div class="side-controls">
          <button class="ctrl-btn" id="ctrlSpeakToggleBtn" title="Toggle AI voice response">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
            </svg>
          </button>
          <button class="ctrl-btn" id="ctrlStopSpeakBtn" title="Interrupt speaking" style="display:none;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" rx="2"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="mic-hint" id="ctrlMicHint">Click microphone to start voice input</div>
    `;
    this.container.appendChild(this.el);

    this.micBtn = this.el.querySelector('#ctrlMicBtn');
    this.micIcon = this.micBtn.querySelector('.mic-icon');
    this.stopIcon = this.micBtn.querySelector('.stop-icon');
    this.transcriptText = this.el.querySelector('#ctrlTranscriptText');
    this.waveformVis = this.el.querySelector('#ctrlWaveformVis');
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
    });
  }

  handleRecordingState(isRecording) {
    this.micBtn.classList.toggle('recording', isRecording);
    this.micIcon.classList.toggle('hidden', isRecording);
    this.stopIcon.classList.toggle('hidden', !isRecording);
    this.waveformVis.classList.toggle('active', isRecording);

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
      this.micHint.textContent = `Call in progress: ${mins}:${secs} • Click to finish`;
    }, 1000);
  }

  stopTimer() {
    clearInterval(this.timerInterval);
    this.micHint.textContent = 'Click microphone to start voice input';
  }

  startWaveformAnimation() {
    const bars = this.waveformVis.querySelectorAll('.wave-bar');
    const step = () => {
      if (!store.get().isRecording) return;
      bars.forEach(bar => {
        const h = Math.floor(Math.random() * 32) + 4;
        bar.style.height = `${h}px`;
      });
      this.waveAnimFrame = requestAnimationFrame(step);
    };
    cancelAnimationFrame(this.waveAnimFrame);
    step();
  }

  stopWaveformAnimation() {
    cancelAnimationFrame(this.waveAnimFrame);
    const bars = this.waveformVis.querySelectorAll('.wave-bar');
    bars.forEach(bar => {
      bar.style.height = '8px';
    });
  }
}
