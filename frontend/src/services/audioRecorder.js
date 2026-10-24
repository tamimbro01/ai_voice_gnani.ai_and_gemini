// ── Real-time Audio Recorder (PCM 16kHz) + WebSpeech Parallel Fallback ──────

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

    this.accumulatedText = '';
    this.interimText = '';

    this.onTranscriptUpdate = null;
    this.onAudioLevel = null;
  }

  setupSpeechFallback(lang) {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
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
          this.accumulatedText += (this.accumulatedText ? ' ' : '') + finalChunk.trim();
        }
        this.interimText = interim;
        this.emitTranscript();
      };

      this.speechRecognizer.onerror = (e) => {
        console.warn('[WebSpeech fallback error]:', e.error);
      };
    }
  }

  emitTranscript() {
    const full = (this.accumulatedText + (this.accumulatedText && this.interimText ? ' ' : '') + this.interimText).trim();
    if (this.onTranscriptUpdate) {
      this.onTranscriptUpdate(full);
    }
  }

  async start({ lang = 'en-IN', onTranscriptUpdate, onAudioLevel }) {
    this.onTranscriptUpdate = onTranscriptUpdate;
    this.onAudioLevel = onAudioLevel;
    this.accumulatedText = '';
    this.interimText = '';

    // Audio Context
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    // Mic access
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }
    });

    // Upstream STT WebSocket using CONFIG.WS_BASE_URL
    const wsUrl = `${CONFIG.WS_BASE_URL}/ws/stt?lang=${encodeURIComponent(lang)}&sample_rate=16000`;
    this.sttWs = new WebSocket(wsUrl);
    this.sttWs.binaryType = 'arraybuffer';

    this.sttWs.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'transcript') {
          const text = msg.transcript || msg.text || msg.result || '';
          const isFinal = msg.is_final === true || msg.isFinal === true;
          if (isFinal && text.trim()) {
            this.accumulatedText += (this.accumulatedText ? ' ' : '') + text.trim();
          } else if (text.trim()) {
            this.interimText = text.trim();
          }
          this.emitTranscript();
        }
      } catch (e) {
        console.error('[STT WebSocket Frame Error]:', e);
      }
    };

    // Parallel Speech Recognition for zero latency
    this.setupSpeechFallback(lang);
    if (this.speechRecognizer) {
      try { this.speechRecognizer.start(); } catch {}
    }

    // Audio Processing Node (PCM 16-bit)
    this.micSource = this.audioCtx.createMediaStreamSource(this.mediaStream);
    this.processorNode = this.audioCtx.createScriptProcessor(4096, 1, 1);

    this.processorNode.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      const float32 = e.inputBuffer.getChannelData(0);

      // Simple RMS calculation for visualizer
      if (this.onAudioLevel) {
        let sum = 0;
        for (let i = 0; i < float32.length; i++) sum += float32[i] * float32[i];
        const rms = Math.sqrt(sum / float32.length);
        this.onAudioLevel(rms);
      }

      // Convert float32 to 16-bit linear PCM and send via WS
      if (this.sttWs && this.sttWs.readyState === WebSocket.OPEN) {
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        this.sttWs.send(int16.buffer);
      }
    };

    this.micSource.connect(this.processorNode);
    this.processorNode.connect(this.audioCtx.destination);
    this.isRecording = true;
  }

  stop() {
    this.isRecording = false;

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.speechRecognizer) {
      try { this.speechRecognizer.stop(); } catch {}
      this.speechRecognizer = null;
    }
    if (this.sttWs) {
      if (this.sttWs.readyState === WebSocket.OPEN) {
        try { this.sttWs.send(JSON.stringify({ type: 'stop' })); } catch {}
        this.sttWs.close();
      }
      this.sttWs = null;
    }

    const finalText = (this.accumulatedText.trim() || this.interimText.trim());
    return finalText;
  }
}

export const audioRecorder = new AudioRecorder();
