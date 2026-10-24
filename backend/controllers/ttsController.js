export function createTTSController(gnaniService) {
  return async (req, res) => {
    const { text, lang = 'en-IN' } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text is required for TTS synthesis' });
    }

    try {
      const audioBuffer = await gnaniService.synthesizeSpeech(text, lang);
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Length', audioBuffer.byteLength);
      res.setHeader('Cache-Control', 'no-cache');
      return res.send(audioBuffer);
    } catch (err) {
      console.error('[TTSController Error]:', err.message);
      return res.status(500).json({ error: err.message || 'TTS synthesis failed' });
    }
  };
}
