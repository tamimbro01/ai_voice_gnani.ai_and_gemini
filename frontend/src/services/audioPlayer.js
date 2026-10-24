// ── Web Audio Player with Browser SpeechSynthesis Fallback ──────────────────

export class AudioPlayer {
  constructor() {
    this.audioCtx = null;
    this.activeSource = null;
    this.isPlaying = false;
  }

  getAudioContext() {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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

      const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
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
      console.warn('WAV buffer decode error, falling back:', err.message);
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

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.05;

    utterance.onend = () => {
      this.isPlaying = false;
      if (onEnded) onEnded();
    };

    utterance.onerror = () => {
      this.isPlaying = false;
      if (onEnded) onEnded();
    };

    window.speechSynthesis.speak(utterance);
  }

  stop() {
    if (this.activeSource) {
      try { this.activeSource.stop(); } catch {}
      this.activeSource = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.isPlaying = false;
  }
}

export const audioPlayer = new AudioPlayer();
