// Stateless helpers shared by HTTP and WebSocket entry points. No environment or DB imports.
export function parseRequestCookies(header = '') {
  const cookies = Object.create(null);
  for (const pair of String(header).split(';')) {
    const index = pair.indexOf('=');
    if (index < 1) continue;
    const key = pair.slice(0, index).trim();
    if (!key || Object.hasOwn(cookies, key)) continue;
    try { cookies[key] = decodeURIComponent(pair.slice(index + 1).trim()); }
    catch { /* A malformed unrelated cookie must not crash HTTP/WS authentication. */ }
  }
  return cookies;
}

export function requestOriginAllowed(origin, allowedOrigins) {
  // Non-browser clients still need a valid session. Browsers must use an explicit origin.
  return origin === undefined || (typeof origin === 'string' && allowedOrigins.has(origin));
}

export function passwordResetOrigin(allowedOrigins, production = true) {
  for (const origin of allowedOrigins) {
    try {
      const url = new URL(origin);
      if (url.origin !== origin || url.username || url.password) continue;
      if (url.protocol === 'https:' || (!production && url.protocol === 'http:')) return origin;
    } catch { /* Ignore invalid configuration, never fall back to a request Host header. */ }
  }
  throw Object.assign(new Error('Configure a origem do sistema em CORS_ORIGINS'), { statusCode: 503, code: 'CONFIGURATION_ERROR' });
}

// Per-key fixed windows: housekeeping never resets an active blocking window.
// Fail closed at capacity instead of allowing unbounded IP-map growth.
export function createRateLimiter({ limit, windowMs, maxKeys = 10000, now = Date.now }) {
  const entries = new Map();
  let cleanupAt = 0;
  return key => {
    const time = now();
    if (time >= cleanupAt) {
      for (const [id, entry] of entries) if (entry.until <= time) entries.delete(id);
      cleanupAt = time + Math.min(windowMs, 60000);
    }
    let entry = entries.get(key);
    if (!entry || entry.until <= time) {
      if (!entry && entries.size >= maxKeys) return false;
      entry = { count: 0, until: time + windowMs };
      entries.set(key, entry);
    }
    if (entry.count >= limit) return false;
    entry.count++;
    return true;
  };
}
