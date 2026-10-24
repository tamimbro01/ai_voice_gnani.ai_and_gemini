import { WebSocket } from 'ws';

export function setupSTTWebSocket(wss, gnaniApiKey) {
  wss.on('connection', (clientWs, req) => {
    const urlObj = new URL(req.url, 'http://localhost');
    const lang = urlObj.searchParams.get('lang') || 'en-IN';
    const sampleRate = urlObj.searchParams.get('sample_rate') || '16000';

    console.log(`[STT] Client connected | lang: ${lang} | rate: ${sampleRate}`);

    let gnaniWs = null;
    let isClosed = false;
    let reconnectTimer = null;
    let audioBuffer = [];  // buffer audio chunks when WS is re-connecting

    function connectGnani() {
      if (isClosed) return;
      try {
        gnaniWs = new WebSocket('wss://api.vachana.ai/stt/v3/stream', {
          headers: {
            'x-api-key-id': gnaniApiKey,
            'lang_code': lang,
            'x-sample-rate': sampleRate,
            'x-format': 'transcribe',
            'x-enable-partials': 'true',
            'x-min-silence-ms': '450',
            'x-min-speech-ms': '200',
          },
        });

        gnaniWs.on('open', () => {
          console.log('[STT] Gnani stream connected');
          // Flush any buffered audio
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
            console.log('[STT] Frame:', raw);

            if (clientWs.readyState === WebSocket.OPEN) {
              const text = msg.text || msg.transcript || '';
              const isFinal = msg.type === 'transcript' || msg.is_final === true;
              clientWs.send(JSON.stringify({
                type: msg.type || 'transcript',
                text,
                transcript: text,
                is_final: isFinal,
                raw: msg,
              }));
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

          // 1001 = Going Away (server-initiated idle timeout); auto-reconnect if still recording
          if (!isClosed && (code === 1001 || code === 1000 || code === 1005)) {
            console.log('[STT] Auto-reconnecting to Gnani in 300ms...');
            reconnectTimer = setTimeout(connectGnani, 300);
          } else if (clientWs.readyState === WebSocket.OPEN && !isClosed) {
            clientWs.send(JSON.stringify({ type: 'status', status: 'disconnected' }));
          }
        });

      } catch (err) {
        console.error('[STT] Connect error:', err.message);
      }
    }

    // Initial connection
    connectGnani();

    // Forward client audio to Gnani
    clientWs.on('message', (data) => {
      if (Buffer.isBuffer(data) || data instanceof ArrayBuffer) {
        if (gnaniWs && gnaniWs.readyState === WebSocket.OPEN) {
          gnaniWs.send(data);
        } else {
          // Buffer the audio while reconnecting (max 100 chunks)
          if (audioBuffer.length < 100) audioBuffer.push(data);
        }
      } else {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'stop') {
            isClosed = true;
            clearTimeout(reconnectTimer);
            audioBuffer = [];
            if (gnaniWs && gnaniWs.readyState === WebSocket.OPEN) {
              setTimeout(() => { try { gnaniWs.close(); } catch {} }, 500);
            }
          }
        } catch {}
      }
    });

    clientWs.on('close', () => {
      isClosed = true;
      clearTimeout(reconnectTimer);
      audioBuffer = [];
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
