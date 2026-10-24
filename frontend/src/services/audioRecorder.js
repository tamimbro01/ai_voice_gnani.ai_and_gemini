// ── Universal Mobile & Desktop Real-time Audio Recorder ────────────────────────
// Fully compatible with iOS Safari, Android Chrome, and Desktop Browsers.

import { CONFIG } from '../config.js';

export class AudioRecorder {
  constructor() {
    this.audioCtx = null;
    this.mediaStream = null;
    this.micSource = null;
    this.processorNode = null;
    this.sttWs = null;
    this.speechRecognizer = null;
    this.isRecording = false;

    this.gnaniText = '';
    this.speechText = '';
    this.interimText = '';

    this.onTranscriptUpdate = null;
    this.onAudioLevel = null;
  }

  // Linear interpolation downsampler to 16kHz PCM
  downsampleTo16k(inputBuffer, inputSampleRate) {
    if (inputSampleRate === 16000) return inputBuffer;
    const ratio = inputSampleRate / 16000;
    const outputLength = Math.round(inputBuffer.length / ratio);
    const output = new Float32Array(outputLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < output.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
      let sum = 0, count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < inputBuffer.length; i++) {
        sum += inputBuffer[i];
        count++;
      }
      output[offsetResult] = count > 0 ? sum / count : 0;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return output;
  }

  // Convert Float32 to 16-bit linear PCM
  float32ToInt16(float32Array) {
    const int16 = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16;
  }

  setupSpeechFallback(lang) {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        this.speechRecognizer = new SpeechRec();
        this.speechRecognizer.continuous = true;
        this.speechRecognizer.interimResults = true;
        this.speechRecognizer.lang = lang;

        this.speechRecognizer.onresult = (event) => {
          let interim = '';
          let finalChunk = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const text = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalChunk += text;
            } else {
              interim += text;
            }
          }
          if (finalChunk.trim()) {
            this.speechText += (this.speechText ? ' ' : '') + finalChunk.trim();
          }
          if (interim.trim() && !this.gnaniText) {
            this.interimText = interim.trim();
          }
          this.emitTranscript();
        };

        this.speechRecognizer.onerror = (e) => {
          console.warn('[WebSpeech mobile/desktop info]:', e.error);
        };
      } catch (err) {
        console.warn('SpeechRecognition initialization error:', err);
      }
    }
  }

  getBestTranscript() {
    return (this.gnaniText.trim() || this.speechText.trim() || this.interimText.trim());
  }

  emitTranscript() {
    const full = this.getBestTranscript();
    if (this.onTranscriptUpdate && full) {
      this.onTranscriptUpdate(full);
    }
  }

  async start({ lang = 'en-IN', onTranscriptUpdate, onAudioLevel }) {
    this.onTranscriptUpdate = onTranscriptUpdate;
    this.onAudioLevel = onAudioLevel;
    this.gnaniText = '';
    this.speechText = '';
    this.interimText = '';

    // Mobile Check: Ensure Secure Context (HTTPS or localhost)
    if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      throw new Error('Microphone requires HTTPS on mobile devices. Please open via https:// or localhost.');
    }

    // 1. Initialize AudioContext at mobile hardware native sample rate
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('Web Audio API not supported on this device.');
    }

    this.audioCtx = new AudioContextClass();

    // Mobile Audio Unlock: Resume context on user gesture
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    // iOS Audio Warmup: play 1 silent frame to unlock hardware audio pipeline
    try {
      const silent = this.audioCtx.createBuffer(1, 1, this.audioCtx.sampleRate);
      const src = this.audioCtx.createBufferSource();
      src.buffer = silent;
      src.connect(this.audioCtx.destination);
      src.start(0);
    } catch {}

    // 2. Request Mobile Microphone
    const mediaDevices = navigator.mediaDevices || (navigator.getUserMedia ? {
      getUserMedia: (c) => new Promise((res, rej) => navigator.getUserMedia(c, res, rej))
    } : null);

    if (!mediaDevices || !mediaDevices.getUserMedia) {
      throw new Error('Microphone permission not available. Ensure you are on HTTPS.');
    }

    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }
    };

    try {
      this.mediaStream = await mediaDevices.getUserMedia(constraints);
    } catch (err) {
      console.warn('Strict constraints failed, trying basic audio stream:', err.message);
      this.mediaStream = await mediaDevices.getUserMedia({ audio: true });
    }

    // 3. Connect Upstream STT WebSocket
    try {
      const wsUrl = `${CONFIG.WS_BASE_URL}/ws/stt?lang=${encodeURIComponent(lang)}&sample_rate=16000`;
      this.sttWs = new WebSocket(wsUrl);
      this.sttWs.binaryType = 'arraybuffer';

      this.sttWs.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const text = (msg.text || msg.transcript || '').trim();
          const isFinal = msg.is_final === true || msg.type === 'transcript';

          if (isFinal && text) {
            this.gnaniText += (this.gnaniText ? ' ' : '') + text;
            this.interimText = '';
            this.emitTranscript();
          } else if (text) {
            this.interimText = text;
            this.emitTranscript();
          }
        } catch (e) {
          console.error('[STT WebSocket Parse Error]:', e);
        }
      };
    } catch (wsErr) {
      console.warn('STT WebSocket connect failed, relying on speech fallback:', wsErr);
    }

    // 4. Parallel Speech Recognition fallback
    this.setupSpeechFallback(lang);
    if (this.speechRecognizer) {
      try { this.speechRecognizer.start(); } catch {}
    }

    // 5. Mobile Audio Processor Node
    const sampleRate = this.audioCtx.sampleRate;
    this.micSource = this.audioCtx.createMediaStreamSource(this.mediaStream);
    this.processorNode = this.audioCtx.createScriptProcessor(4096, 1, 1);

    this.processorNode.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      const inputFloat32 = e.inputBuffer.getChannelData(0);

      // Audio Level for Waveform Animation
      if (this.onAudioLevel) {
        let sum = 0;
        for (let i = 0; i < inputFloat32.length; i++) sum += inputFloat32[i] * inputFloat32[i];
        const rms = Math.sqrt(sum / inputFloat32.length);
        this.onAudioLevel(rms);
      }

      // Downsample to 16000Hz PCM & send
      const downsampled16k = this.downsampleTo16k(inputFloat32, sampleRate);
      const int16 = this.float32ToInt16(downsampled16k);

      if (this.sttWs && this.sttWs.readyState === WebSocket.OPEN) {
        this.sttWs.send(int16.buffer);
      }
    };

    this.micSource.connect(this.processorNode);
    this.processorNode.connect(this.audioCtx.destination);
    this.isRecording = true;
  }

  async stop() {
    this.isRecording = false;

    // Disconnect audio mic stream immediately
    if (this.processorNode) {
      try { this.processorNode.disconnect(); } catch {}
      this.processorNode = null;
    }
    if (this.micSource) {
      try { this.micSource.disconnect(); } catch {}
      this.micSource = null;
    }
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach(t => t.stop());
      } catch {}
      this.mediaStream = null;
    }
    if (this.speechRecognizer) {
      try { this.speechRecognizer.stop(); } catch {}
      this.speechRecognizer = null;
    }

    // Send stop control signal to Gnani
    if (this.sttWs && this.sttWs.readyState === WebSocket.OPEN) {
      try { this.sttWs.send(JSON.stringify({ type: 'stop' })); } catch {}
    }

    // Wait a brief 350ms window for any in-flight transcript frame from Gnani to arrive!
    await new Promise(resolve => setTimeout(resolve, 350));

    if (this.sttWs) {
      try { this.sttWs.close(); } catch {}
      this.sttWs = null;
    }

    return this.getBestTranscript();
  }
}

export const audioRecorder = new AudioRecorder();
