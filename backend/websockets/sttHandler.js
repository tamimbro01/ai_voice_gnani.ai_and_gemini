import { WebSocket } from 'ws';

export function setupSTTWebSocket(wss, gnaniApiKey) {
  wss.on('connection', (clientWs, req) => {
    const urlObj = new URL(req.url, 'http://localhost');
    const lang = urlObj.searchParams.get('lang') || 'en-IN';
    const sampleRate = urlObj.searchParams.get('sample_rate') || '16000';

    console.log(`[STT WebSocket] Client connected | lang: ${lang} | rate: ${sampleRate}`);

    let gnaniWs = null;
    let isClosed = false;

    try {
      gnaniWs = new WebSocket('wss://api.vachana.ai/stt/v3/stream', {
        headers: {
          'x-api-key-id': gnaniApiKey,
          'lang_code': lang,
          'x-sample-rate': sampleRate,
          'x-format': 'transcribe',
          'x-min-silence-ms': '350',
          'x-min-speech-ms': '180',
        },
      });

      gnaniWs.on('open', () => {
        console.log('[STT WebSocket] Connected to Gnani stream');
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ type: 'status', status: 'connected' }));
        }
      });

      gnaniWs.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'transcript', ...msg }));
          }
        } catch (e) {
          console.error('[STT WebSocket] Error parsing Gnani frame:', e);
        }
      });

      gnaniWs.on('error', (err) => {
        console.error('[STT WebSocket] Gnani upstream error:', err.message);
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ type: 'error', message: err.message }));
        }
      });

      gnaniWs.on('close', (code) => {
        console.log(`[STT WebSocket] Gnani upstream closed (${code})`);
        if (clientWs.readyState === WebSocket.OPEN && !isClosed) {
          clientWs.send(JSON.stringify({ type: 'status', status: 'disconnected' }));
        }
      });

    } catch (err) {
      console.error('[STT WebSocket] Connection error:', err);
    }

    clientWs.on('message', (data) => {
      if (Buffer.isBuffer(data) || data instanceof ArrayBuffer) {
        if (gnaniWs && gnaniWs.readyState === WebSocket.OPEN) {
          gnaniWs.send(data);
        }
      } else {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'stop' && gnaniWs) {
            gnaniWs.close();
          }
        } catch {}
      }
    });

    clientWs.on('close', () => {
      isClosed = true;
      if (gnaniWs && gnaniWs.readyState === WebSocket.OPEN) {
        gnaniWs.close();
      }
    });

    clientWs.on('error', (err) => {
      console.error('[STT WebSocket] Client socket error:', err.message);
    });
  });
}
