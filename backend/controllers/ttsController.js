export function createTTSController(gnaniService) {
  return async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { text, lang = 'en-IN' } = body;

    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Text is required for TTS synthesis' });
    }
    if (text.length > 500) return res.status(413).json({ error: 'Text is too long for one speech response.' });

    const supportedLanguages = new Set(['en-IN', 'bn-IN', 'hi-IN', 'te-IN', 'ta-IN']);
    const safeLang = supportedLanguages.has(lang) ? lang : 'en-IN';
    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });

    try {
      const audioBuffer = await gnaniService.synthesizeSpeech(text.trim(), safeLang, { signal: controller.signal });
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Length', audioBuffer.byteLength);
      res.setHeader('Cache-Control', 'no-cache');
      return res.send(audioBuffer);
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error('[TTSController Error]:', err.message);
      return res.status(500).json({ error: err.message || 'TTS synthesis failed' });
    }
  };
}
