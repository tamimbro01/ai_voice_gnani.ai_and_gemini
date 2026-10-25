// ── Frontend Configuration & Environment Variables ───────────────────────────

// Read directly from Environment Variables (Vite & Vercel inject these from .env)
const envApiUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || '';
const envWsUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_BASE_URL) || '';

// Convert configured backend URLs to the WebSocket protocol. An HTTPS page
// must never attempt ws://, even when VITE_WS_BASE_URL was set incorrectly.
export function toWebSocketUrl(baseUrl, pageProtocol = window.location.protocol) {
  if (!baseUrl) return '';
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  const securePage = pageProtocol === 'https:';

  if (/^https:\/\//i.test(trimmed)) return trimmed.replace(/^https:/i, 'wss:');
  if (/^http:\/\//i.test(trimmed)) return trimmed.replace(/^http:/i, securePage ? 'wss:' : 'ws:');
  if (/^wss:\/\//i.test(trimmed)) return trimmed;
  if (/^ws:\/\//i.test(trimmed)) return trimmed.replace(/^ws:/i, securePage ? 'wss:' : 'ws:');

  throw new Error('WebSocket backend URL must use ws://, wss://, http://, or https://.');
}

function isLoopbackBackend(baseUrl) {
  try {
    return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(new URL(baseUrl).hostname);
  } catch {
    return false;
  }
}

export function resolveWebSocketBase({ wsUrl = '', apiUrl = '', protocol, hostname, host }) {
  const localPage = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname);
  const envApiUrlForPage = apiUrl && !(isLoopbackBackend(apiUrl) && !localPage) ? apiUrl : '';
  const envWsUrlForPage = wsUrl && !(isLoopbackBackend(wsUrl) && !localPage) ? wsUrl : '';
  const pageWebSocketUrl = `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}`;
  for (const candidate of [envWsUrlForPage, envApiUrlForPage]) {
    if (!candidate) continue;
    try {
      return toWebSocketUrl(candidate, protocol);
    } catch (error) {
      console.error('[Environment Config] Ignoring an invalid WebSocket backend URL:', error.message);
    }
  }
  return pageWebSocketUrl;
}

// Compute API Base URL from Environment Variable
const localPage = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(window.location.hostname);
const resolvedApiUrl = envApiUrl && !(isLoopbackBackend(envApiUrl) && !localPage)
  ? envApiUrl.replace(/\/+$/, '')
  : '';

// Compute WebSocket Base URL from Environment Variable
const resolvedWsUrl = resolveWebSocketBase({
  wsUrl: envWsUrl,
  apiUrl: resolvedApiUrl,
  protocol: window.location.protocol,
  hostname: window.location.hostname,
  host: window.location.host,
});

export const CONFIG = {
  // Read from .env (VITE_API_BASE_URL)
  API_BASE_URL: resolvedApiUrl,

  // Read from .env (VITE_WS_BASE_URL)
  WS_BASE_URL: resolvedWsUrl,
};

console.log('🔗 [Environment Config] API Base:', CONFIG.API_BASE_URL || '(current host)');
