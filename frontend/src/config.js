// ── Frontend Configuration & Backend URL Resolver ────────────────────────────

/**
 * 🚀 RENDER DEPLOYMENT:
 * Render-এ ব্যাকএন্ড হোস্ট করার পর যে URL পাবেন (যেমন: 'https://ai-voice-backend.onrender.com'),
 * সেটি নিচের RENDER_BACKEND_URL এ পেস্ট করে দিন।
 * লোকালহোস্টে টেস্ট করার সময় এটি খালি ('') রাখলেও অটোমেটিক কাজ করবে।
 */
const RENDER_BACKEND_URL = ''; 

// Helper to convert https:// to wss:// and http:// to ws://
function toWebSocketUrl(httpUrl) {
  if (!httpUrl) return '';
  return httpUrl.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://');
}

// Check if running on localhost
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isSeparatePort = isLocalhost && window.location.port !== '3000';

export const CONFIG = {
  // HTTP REST API Base URL
  API_BASE_URL: RENDER_BACKEND_URL 
    ? RENDER_BACKEND_URL.replace(/\/+$/, '') 
    : (isSeparatePort ? 'http://localhost:3000' : (window.__ENV__?.API_BASE_URL || '')),

  // WebSocket Base URL
  WS_BASE_URL: RENDER_BACKEND_URL 
    ? toWebSocketUrl(RENDER_BACKEND_URL.replace(/\/+$/, '')) 
    : (isSeparatePort 
        ? 'ws://localhost:3000' 
        : (window.__ENV__?.WS_BASE_URL || ((window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host))),
};

console.log('🔗 [Frontend Config] API Base:', CONFIG.API_BASE_URL || '(same origin)');
console.log('⚡ [Frontend Config] WS Base:', CONFIG.WS_BASE_URL);
