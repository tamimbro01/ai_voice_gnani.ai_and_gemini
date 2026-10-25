export class GnaniService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.voiceMap = {
      'en-IN': 'Kaveri',
      'hi-IN': 'Nalini',
      'bn-IN': 'Kirra',
      'te-IN': 'Suhana',
      'ta-IN': 'Asmita',
    };
  }

  async synthesizeSpeech(text, lang = 'en-IN', { signal } = {}) {
    if (!this.apiKey) {
      throw new Error('GNANI_API_KEY is missing. Add it to backend/.env to enable Gnani speech.');
    }
    const url = 'https://api.vachana.ai/api/v1/tts/inference';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key-ID': this.apiKey,
      },
      signal,
      body: JSON.stringify({
        text: text.slice(0, 500),
        language: lang,
        model: 'timbre-v2.5',
        voice: this.voiceMap[lang] || 'Nalini',
        speed: 1.05,
        audio_config: {
          sample_rate: 48000,
          num_channels: 1,
          sample_width: 2,
          encoding: 'linear_pcm',
          container: 'wav',
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gnani TTS error (${response.status}): ${err}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
