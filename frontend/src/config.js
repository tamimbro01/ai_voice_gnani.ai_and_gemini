// ── Frontend Configuration & Backend URL Resolver ────────────────────────────

// By default, if frontend is served by backend, origin is the same.
// If frontend is run on a separate port (e.g. Vite :5173 or LiveServer :5500),
// it defaults to connecting to http://localhost:3000.

const isSeparateHost = window.location.port !== '3000' && window.location.hostname === 'localhost';

export const CONFIG = {
  // Backend HTTP API Base URL (e.g. 'http://localhost:3000' or '' if same origin)
  API_BASE_URL: isSeparateHost ? 'http://localhost:3000' : (window.__ENV__?.API_BASE_URL || ''),

  // Backend WebSocket Base URL
  WS_BASE_URL: isSeparateHost 
    ? 'ws://localhost:3000' 
    : (window.__ENV__?.WS_BASE_URL || ((window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host)),
};

console.log('🔗 [Frontend Config] API Base:', CONFIG.API_BASE_URL || '(same origin)');
console.log('⚡ [Frontend Config] WS Base:', CONFIG.WS_BASE_URL);
