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
    let reconnectTimer = null;
    let audioBuffer = [];
    let incomingPcmBuffer = Buffer.alloc(0);

    function connectGnani() {
      if (isTerminated) return;
      try {
        gnaniWs = new WebSocket('wss://api.vachana.ai/stt/v3/stream', {
          headers: {
            'x-api-key-id': gnaniApiKey,
            'lang_code': lang,
            'x-sample-rate': String(sampleRate),
          },
        });

        gnaniWs.on('open', () => {
          console.log('[STT] Gnani stream connected');
          if (audioBuffer.length > 0) {
            audioBuffer.forEach(chunk => {
              try { gnaniWs.send(chunk); } catch {}
            });
            audioBuffer = [];
          }
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'status', status: 'connected' }));
          }
        });

        gnaniWs.on('message', (data) => {
          try {
            const raw = data.toString();
            const msg = JSON.parse(raw);
            console.log('[STT] Gnani message:', raw);

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
                raw: msg,
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

          if (!isTerminated && (code === 1001 || code === 1000 || code === 1005)) {
            console.log('[STT] Reconnecting to Gnani in 200ms...');
            reconnectTimer = setTimeout(connectGnani, 200);
          } else if (clientWs.readyState === WebSocket.OPEN && !isTerminated) {
            clientWs.send(JSON.stringify({ type: 'status', status: 'disconnected' }));
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

      // 1. Send any remaining bytes padded to 1024
      if (incomingPcmBuffer.length > 0 && gnaniWs && gnaniWs.readyState === WebSocket.OPEN) {
        const padded = Buffer.alloc(1024);
        incomingPcmBuffer.copy(padded);
        try { gnaniWs.send(padded); } catch {}
        incomingPcmBuffer = Buffer.alloc(0);
      }

      // 2. Stream 30 silence frames (approx 1 sec) to trigger Gnani VAD speech_end & final transcript
      if (gnaniWs && gnaniWs.readyState === WebSocket.OPEN) {
        const silence = Buffer.alloc(1024);
        for (let i = 0; i < 30; i++) {
          if (!gnaniWs || gnaniWs.readyState !== WebSocket.OPEN) break;
          try { gnaniWs.send(silence); } catch {}
          await new Promise(r => setTimeout(r, 32));
        }
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

          if (gnaniWs && gnaniWs.readyState === WebSocket.OPEN) {
            try { gnaniWs.send(chunk); } catch {}
          } else {
            if (audioBuffer.length < 150) audioBuffer.push(chunk);
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
      clearTimeout(reconnectTimer);
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
