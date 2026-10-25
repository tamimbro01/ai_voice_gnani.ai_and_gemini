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
    this.frameTimer = null;
    this.connectionTimer = null;
    this.pendingAudio = [];
    this.isRecording = false;

    this.gnaniText = '';
    this.interimText = '';
    this.seenSegments = new Set();

    this.onTranscriptUpdate = null;
    this.onFinalTranscript = null;
    this.onError = null;
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

  getBestTranscript() {
    return this.gnaniText.trim();
  }

  emitTranscript() {
    const full = this.getBestTranscript();
    if (this.onTranscriptUpdate && full) {
      this.onTranscriptUpdate(full);
    }
  }

  async start({ lang = 'en-IN', onTranscriptUpdate, onFinalTranscript, onError, onAudioLevel }) {
    this.onTranscriptUpdate = onTranscriptUpdate;
    this.onFinalTranscript = onFinalTranscript;
    this.onError = onError;
    this.onAudioLevel = onAudioLevel;
    this.gnaniText = '';
    this.interimText = '';
    this.pendingAudio = [];
    this.seenSegments.clear();

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
      this.connectionTimer = setTimeout(() => {
        if (this.sttWs?.readyState !== WebSocket.OPEN && this.onError) {
          this.onError(new Error('Gnani speech recognition did not connect. Check your network or API key.'));
        }
      }, 10000);
      this.sttWs.onopen = () => clearTimeout(this.connectionTimer);

      this.sttWs.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'error') {
            if (this.onError) this.onError(new Error(msg.message || 'Gnani speech recognition failed.'));
            return;
          }
          if (msg.type === 'status' && msg.status === 'disconnected') {
            if (this.onError) this.onError(new Error('Gnani speech recognition disconnected.'));
            return;
          }

          const text = (msg.text || msg.transcript || '').trim();
          const isFinal = msg.is_final === true || msg.type === 'transcript';

          if (isFinal && text) {
            if (msg.segment_id && this.seenSegments.has(msg.segment_id)) return;
            if (msg.segment_id) this.seenSegments.add(msg.segment_id);
            this.gnaniText += (this.gnaniText ? ' ' : '') + text;
            this.interimText = '';
            this.emitTranscript();
            this.isFinished = true;
            if (this.onFinalTranscript) this.onFinalTranscript(text);
          } else if (text) {
            this.interimText = text;
            this.emitTranscript();
          }
        } catch (e) {
          console.error('[STT WebSocket Parse Error]:', e);
        }
      };
      this.sttWs.onerror = () => {
        if (this.onError) this.onError(new Error('Could not connect to Gnani speech recognition. Check the server and API key.'));
      };
      this.sttWs.onclose = () => clearTimeout(this.connectionTimer);
    } catch (wsErr) {
      this.mediaStream?.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
      if (this.audioCtx && this.audioCtx.state !== 'closed') {
        try { await this.audioCtx.close(); } catch {}
      }
      this.audioCtx = null;
      throw new Error(`Gnani speech recognition could not start: ${wsErr.message}`);
    }

    // 4. Capture actual microphone audio and pace Gnani's PCM frames.
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

      // Downsample to 16kHz PCM and buffer into exact 1024-byte frames.
      const downsampled16k = this.downsampleTo16k(inputFloat32, sampleRate);
      const int16 = this.float32ToInt16(downsampled16k);
      const pcm = new Uint8Array(int16.buffer);
      for (let i = 0; i < pcm.length; i += 1) this.pendingAudio.push(pcm[i]);
      if (this.pendingAudio.length > 32000) {
        const discard = Math.floor((this.pendingAudio.length - 32000) / 2) * 2;
        this.pendingAudio.splice(0, discard);
      }
    };

    this.frameTimer = setInterval(() => {
      if (!this.sttWs || this.sttWs.readyState !== WebSocket.OPEN || this.pendingAudio.length < 1024) return;
      const frame = new Uint8Array(1024);
      for (let i = 0; i < frame.length; i += 1) frame[i] = this.pendingAudio.shift();
      this.sttWs.send(frame.buffer);
    }, 32);

    this.micSource.connect(this.processorNode);
    this.processorNode.connect(this.audioCtx.destination);
    this.isRecording = true;
  }

  async stop({ flush = true } = {}) {
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
    clearInterval(this.frameTimer);
    this.frameTimer = null;
    clearTimeout(this.connectionTimer);
    this.connectionTimer = null;
    this.pendingAudio = [];
    this.isFinished = false;

    // Manual stop asks the proxy to flush VAD using valid silent PCM frames.
    // A Gnani-finalized turn already crossed its speech boundary, so it closes fast.
    if (flush && this.sttWs && this.sttWs.readyState === WebSocket.OPEN) {
      try { this.sttWs.send(JSON.stringify({ type: 'stop' })); } catch {}
    }

    const startWait = Date.now();
    while (flush && Date.now() - startWait < 3000) {
      if (this.isFinished || this.gnaniText.trim()) {
        break;
      }
      await new Promise(r => setTimeout(r, 60));
    }

    if (this.sttWs) {
      try { this.sttWs.close(); } catch {}
      this.sttWs = null;
    }

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try { await this.audioCtx.close(); } catch {}
    }
    this.audioCtx = null;

    return this.getBestTranscript();
  }
}

export const audioRecorder = new AudioRecorder();
