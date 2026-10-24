export class GnaniService {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('GNANI_API_KEY is not defined in environment variables');
    }
    this.apiKey = apiKey;
    this.voiceMap = {
      'en-IN': 'Nalini',
      'hi-IN': 'Nalini',
      'bn-IN': 'Nalini',
      'te-IN': 'Nalini',
      'ta-IN': 'Nalini',
    };
  }

  async synthesizeSpeech(text, lang = 'en-IN') {
    const url = 'https://api.vachana.ai/api/v1/tts/inference';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key-ID': this.apiKey,
      },
      body: JSON.stringify({
        text: text.slice(0, 500),
        lang_code: lang,
        model: 'timbre-v2.5',
        voice: this.voiceMap[lang] || 'Nalini',
        speed: 1.05,
        audio_config: {
          sample_rate: 24000,
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
