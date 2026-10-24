// ── Frontend Configuration & Environment Variables ───────────────────────────

// Read directly from Environment Variables (Vite & Vercel inject these from .env)
const envApiUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || '';
const envWsUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_BASE_URL) || '';

// Helper to convert HTTP URL to WebSocket URL (http:// -> ws://, https:// -> wss://)
function toWebSocketUrl(httpUrl) {
  if (!httpUrl) return '';
  return httpUrl.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://');
}

// Compute API Base URL from Environment Variable
const resolvedApiUrl = envApiUrl ? envApiUrl.replace(/\/+$/, '') : '';

// Compute WebSocket Base URL from Environment Variable
const resolvedWsUrl = envWsUrl 
  ? envWsUrl.replace(/\/+$/, '') 
  : (resolvedApiUrl 
      ? toWebSocketUrl(resolvedApiUrl) 
      : ((window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host));

export const CONFIG = {
  // Read from .env (VITE_API_BASE_URL)
  API_BASE_URL: resolvedApiUrl,

  // Read from .env (VITE_WS_BASE_URL)
  WS_BASE_URL: resolvedWsUrl,
};

console.log('🔗 [Environment Config] API Base:', CONFIG.API_BASE_URL || '(current host)');
console.log('⚡ [Environment Config] WS Base:', CONFIG.WS_BASE_URL);
