// Web Audio playback with a cancellable browser-speech fallback.
export class AudioPlayer {
  constructor() {
    this.audioCtx = null;
    this.activeSource = null;
    this.activeUtterance = null;
    this.finishActive = null;
    this.isPlaying = false;
  }

  getAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('Web Audio API is not supported by this browser.');
    if (!this.audioCtx || this.audioCtx.state === 'closed') this.audioCtx = new AudioContextClass();
    return this.audioCtx;
  }

  beginPlayback() {
    this.stop();
    this.isPlaying = true;
    return new Promise((resolve, reject) => {
      let settled = false;
      this.finishActive = (error = null) => {
        if (settled) return;
        settled = true;
        this.isPlaying = false;
        this.activeSource = null;
        this.activeUtterance = null;
        this.finishActive = null;
        if (error) reject(error);
        else resolve();
      };
    });
  }

  async playWavBuffer(arrayBuffer, onEnded) {
    const playback = this.beginPlayback();
    const finish = this.finishActive;
    try {
      const ctx = this.getAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
      const decodedBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      if (this.finishActive !== finish) return;
      const source = ctx.createBufferSource();
      source.buffer = decodedBuffer;
      source.connect(ctx.destination);
      this.activeSource = source;
      source.onended = () => finish();
      source.start(0);
      await playback;
    } catch (err) {
      if (this.finishActive === finish) finish(err);
      await playback.catch(() => {});
      throw err;
    } finally {
      if (onEnded) onEnded();
    }
  }

  async speakWithFallback(text, lang = 'en-IN', onEnded) {
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
      if (onEnded) onEnded();
      return;
    }

    const playback = this.beginPlayback();
    const finish = this.finishActive;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 1;
      utterance.onend = () => finish();
      utterance.onerror = (event) => finish(event.error === 'canceled' ? null : new Error(`Browser speech failed: ${event.error}`));
      this.activeUtterance = utterance;
      window.speechSynthesis.speak(utterance);
      await playback;
    } catch (err) {
      if (this.finishActive === finish) finish(err);
      await playback.catch(() => {});
      throw err;
    } finally {
      if (onEnded) onEnded();
    }
  }

  stop() {
    const finish = this.finishActive;
    const source = this.activeSource;
    const utterance = this.activeUtterance;
    if (finish) finish();
    if (source) {
      source.onended = null;
      try { source.stop(); } catch {}
    }
    if (utterance && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch {}
    }
    this.activeSource = null;
    this.activeUtterance = null;
    this.isPlaying = false;
  }
}

export const audioPlayer = new AudioPlayer();
