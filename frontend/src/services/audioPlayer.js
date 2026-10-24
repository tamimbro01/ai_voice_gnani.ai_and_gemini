// ── Mobile-Compatible Web Audio Player with Fallback ──────────────────────────

export class AudioPlayer {
  constructor() {
    this.audioCtx = null;
    this.activeSource = null;
    this.isPlaying = false;
  }

  getAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      this.audioCtx = new AudioContextClass();
    }
    return this.audioCtx;
  }

  async playWavBuffer(arrayBuffer, onEnded) {
    this.stop();
    this.isPlaying = true;

    try {
      const ctx = this.getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // decodeAudioData with both Promise and callback syntax for iOS Safari
      const decodedBuffer = await new Promise((resolve, reject) => {
        ctx.decodeAudioData(arrayBuffer, resolve, reject);
      });

      this.activeSource = ctx.createBufferSource();
      this.activeSource.buffer = decodedBuffer;
      this.activeSource.connect(ctx.destination);

      this.activeSource.onended = () => {
        this.isPlaying = false;
        this.activeSource = null;
        if (onEnded) onEnded();
      };

      this.activeSource.start(0);
    } catch (err) {
      console.warn('WAV buffer decode error on mobile, using speech fallback:', err.message);
      this.isPlaying = false;
      throw err;
    }
  }

  speakWithFallback(text, lang = 'en-IN', onEnded) {
    if (!window.speechSynthesis) {
      if (onEnded) onEnded();
      return;
    }
    this.stop();
    this.isPlaying = true;

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 1.0;

      utterance.onend = () => {
        this.isPlaying = false;
        if (onEnded) onEnded();
      };

      utterance.onerror = () => {
        this.isPlaying = false;
        if (onEnded) onEnded();
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      this.isPlaying = false;
      if (onEnded) onEnded();
    }
  }

  stop() {
    if (this.activeSource) {
      try { this.activeSource.stop(); } catch {}
      this.activeSource = null;
    }
    if (window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch {}
    }
    this.isPlaying = false;
  }
}

export const audioPlayer = new AudioPlayer();
