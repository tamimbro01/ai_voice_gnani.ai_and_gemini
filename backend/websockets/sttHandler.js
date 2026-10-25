import { WebSocket } from 'ws';

export function setupSTTWebSocket(wss, gnaniApiKey) {
  wss.on('connection', (clientWs, req) => {
    const urlObj = new URL(req.url, 'http://localhost');
    const lang = urlObj.searchParams.get('lang') || 'en-IN';
    const sampleRate = urlObj.searchParams.get('sample_rate') || '16000';

    console.log(`[STT] Client connected | lang: ${lang} | rate: ${sampleRate}`);

    let gnaniWs = null;
    let isTerminated = false;
    let isFinalizing = false;
    let audioBuffer = [];
    let incomingPcmBuffer = Buffer.alloc(0);

    // Drain one 1024-byte / 16kHz PCM frame every 32ms, matching Gnani's
    // documented real-time cadence even while its upstream socket is opening.
    const audioDrainTimer = setInterval(() => {
      if (!audioBuffer.length || !gnaniWs || gnaniWs.readyState !== WebSocket.OPEN) return;
      const frame = audioBuffer.shift();
      try { gnaniWs.send(frame); } catch (err) {
        console.error('[STT] Audio frame send failed:', err.message);
      }
    }, 32);

    function connectGnani() {
      if (isTerminated) return;
      try {
        gnaniWs = new WebSocket('wss://api.vachana.ai/stt/v3/stream', {
          headers: {
            'x-api-key-id': gnaniApiKey,
            'lang_code': lang,
            'x-sample-rate': String(sampleRate),
            'x-vad-threshold': '0.55',
            'x-min-silence-ms': '700',
            'x-min-speech-ms': '100',
            'x-min-segment-ms': '120',
          },
        });

        gnaniWs.on('open', () => {
          console.log('[STT] Gnani stream connected');
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'status', status: 'connected' }));
          }
        });

        gnaniWs.on('message', (data) => {
          try {
            const raw = data.toString();
            const msg = JSON.parse(raw);

            if (msg.type === 'error') {
              console.error('[STT] Gnani service error:', msg.message || 'No message supplied');
            }
            let text = '';
            if (msg.text) {
              text = msg.text;
            } else if (msg.transcript) {
              text = msg.transcript;
            } else if (msg.alternatives && msg.alternatives[0]?.transcript) {
              text = msg.alternatives[0].transcript;
            } else if (msg.output && (msg.output.literal || msg.output.normalized)) {
              text = msg.output.literal || msg.output.normalized;
            }

            if (clientWs.readyState === WebSocket.OPEN) {
              const isFinal = msg.type === 'transcript' || msg.is_final === true;
              clientWs.send(JSON.stringify({
                type: msg.type || 'transcript',
                text: text.trim(),
                transcript: text.trim(),
                is_final: isFinal,
                segment_id: msg.segment_id,
                message: msg.type === 'error' ? String(msg.message || 'Gnani speech recognition failed.') : undefined,
              }));

              // If final transcript received, notify client that speech recognition is complete!
              if (isFinal && text.trim()) {
                clientWs.send(JSON.stringify({ type: 'finished', text: text.trim() }));
              }
            }
          } catch (e) {
            console.error('[STT] Parse error:', e.message);
          }
        });

        gnaniWs.on('error', (err) => {
          console.error('[STT] Gnani error:', err.message);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'error', message: err.message }));
          }
        });

        gnaniWs.on('close', (code, reason) => {
          const msg = reason?.toString() || '';
          console.log(`[STT] Gnani closed (${code}: ${msg})`);
          gnaniWs = null;

          if (clientWs.readyState === WebSocket.OPEN && !isTerminated) {
            clientWs.send(JSON.stringify({ type: 'error', message: 'Gnani speech recognition disconnected.' }));
          }
        });

      } catch (err) {
        console.error('[STT] Connect error:', err.message);
      }
    }

    connectGnani();

    async function flushAndFinalize() {
      if (isFinalizing) return;
      isFinalizing = true;

      // 1. Send any remaining bytes padded to a valid PCM frame.
      if (incomingPcmBuffer.length > 0) {
        const padded = Buffer.alloc(1024);
        incomingPcmBuffer.copy(padded);
        audioBuffer.push(padded);
        incomingPcmBuffer = Buffer.alloc(0);
      }

      // 2. Queue silence behind all microphone frames to close the last VAD turn.
      for (let i = 0; i < 30; i += 1) audioBuffer.push(Buffer.alloc(1024));
      const flushDeadline = Date.now() + 3000;
      while (audioBuffer.length && Date.now() < flushDeadline && gnaniWs?.readyState === WebSocket.OPEN) {
        await new Promise(r => setTimeout(r, 50));
      }

      isFinalizing = false;
    }

    clientWs.on('message', async (data, isBinary) => {
      if (isBinary) {
        if (isFinalizing) return;
        incomingPcmBuffer = Buffer.concat([incomingPcmBuffer, Buffer.from(data)]);

        while (incomingPcmBuffer.length >= 1024) {
          const chunk = incomingPcmBuffer.subarray(0, 1024);
          incomingPcmBuffer = incomingPcmBuffer.subarray(1024);

          if (audioBuffer.length < 150) audioBuffer.push(chunk);
          else if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'error', message: 'Gnani speech stream is overloaded. Please try again.' }));
          }
        }
      } else {
        try {
          const msg = JSON.parse(data.toString());
          console.log('[STT] Client control message:', msg);
          if (msg.type === 'stop') {
            await flushAndFinalize();
          }
        } catch (e) {
          console.warn('[STT] Control message parse error:', e.message);
        }
      }
    });

    clientWs.on('close', () => {
      isTerminated = true;
      clearInterval(audioDrainTimer);
      audioBuffer = [];
      incomingPcmBuffer = Buffer.alloc(0);
      if (gnaniWs && gnaniWs.readyState === WebSocket.OPEN) {
        try { gnaniWs.close(); } catch {}
      }
      console.log('[STT] Client disconnected');
    });

    clientWs.on('error', (err) => {
      console.error('[STT] Client socket error:', err.message);
    });
  });
}
