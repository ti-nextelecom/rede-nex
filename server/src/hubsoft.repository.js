import './env.js';
import pkg from 'pg';
const { Pool } = pkg;

const HS_HOST = 'https://api.nextelecom.hubsoft.com.br';

// ── REST API auth ─────────────────────────────────────────────────────────────
let _token = null;
let _tokenExpiry = 0;

async function getToken() {
  if (_token && Date.now() < _tokenExpiry) return _token;
  const body = new URLSearchParams({
    grant_type:    'password',
    client_id:     process.env.HUBSOFT_AJUDA_CLIENT_ID,
    client_secret: process.env.HUBSOFT_AJUDA_CLIENT_SECRET,
    username:      process.env.HUBSOFT_AJUDA_USERNAME,
    password:      process.env.HUBSOFT_AJUDA_PASSWORD,
    scope:         '*',
  });
  const res = await fetch(`${HS_HOST}/oauth/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body:    body.toString(),
  });
  if (!res.ok) throw new Error(`HubSoft auth HTTP ${res.status}`);
  const data = await res.json();
  if (!data.access_token) throw new Error(`HubSoft auth: ${data.message || 'no token'}`);
  _token       = data.access_token;
  _tokenExpiry = Date.now() + ((data.expires_in ?? 1800) * 1000) - 60000;
  return _token;
}

async function hsGet(path, params = {}) {
  const token   = await getToken();
  const filtered = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''));
  const qs      = new URLSearchParams(filtered).toString();
  const url     = `${HS_HOST}${path}${qs ? '?' + qs : ''}`;
  const res     = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`HubSoft ${res.status}: ${path}`);
  return res.json();
}

// ── In-memory cache ───────────────────────────────────────────────────────────
const _cache = new Map();

function cacheGet(key) {
  const e = _cache.get(key);
  if (!e || Date.now() > e.exp) { _cache.delete(key); return null; }
  return e.val;
}

function cacheSet(key, val, ttlMs) {
  _cache.set(key, { val, exp: Date.now() + ttlMs });
}

// ── HubSoft DB pool — métricas agregadas apenas ───────────────────────────────
let _hsPool = null;

function getHsPool() {
  if (!_hsPool) {
    _hsPool = new Pool({
      host:                    process.env.HUBSOFT_DB_HOST || '170.84.39.233',
      port:                    Number(process.env.HUBSOFT_DB_PORT || 9432),
      database:                process.env.HUBSOFT_DB_NAME || 'hubsoft',
      user:                    process.env.HUBSOFT_DB_USER || 'nextecnologia',
      password:                process.env.HUBSOFT_DB_PASS,
      max:                     1,
      idleTimeoutMillis:       15000,
      connectionTimeoutMillis: 5000,
      ssl:                     { rejectUnauthorized: false },
    });
    _hsPool.on('error', (err) => {
      console.error('[hubsoft] pool error:', err.message);
      _hsPool = null;
    });
  }
  return _hsPool;
}

async function hsDbQuery(sql, params = []) {
  const pool   = getHsPool();
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────

export async function getMetricas() {
  const cached = cacheGet('metricas');
  if (cached) return cached;

  const { rows } = await hsDbQuery(`
    SELECT
      COUNT(*) FILTER (WHERE ss.prefixo = 'servico_habilitado') AS base_ativa,
      COUNT(*) FILTER (WHERE ss.prefixo IN ('suspenso_debito','suspenso_parcialmente','dedicado_suspenso')) AS suspensos,
      COUNT(*) AS total_servicos,
      ROUND(AVG(COALESCE(cs.valor, svc.valor))::numeric, 2) AS ticket_medio
    FROM cliente_servico cs
    JOIN servico svc       ON svc.id_servico       = cs.id_servico
    JOIN servico_status ss ON ss.id_servico_status = cs.id_servico_status
    JOIN cliente cl        ON cl.id_cliente        = cs.id_cliente
    WHERE cl.ativo = true
      AND ss.prefixo IN ('servico_habilitado','suspenso_debito','suspenso_parcialmente','dedicado_suspenso')
  `);

  const data = {
    base_ativa:     Number(rows[0].base_ativa),
    suspensos:      Number(rows[0].suspensos),
    total_servicos: Number(rows[0].total_servicos),
    ticket_medio:   Number(rows[0].ticket_medio),
    cached_at:      new Date().toISOString(),
  };
  cacheSet('metricas', data, 5 * 60 * 1000);
  return data;
}

export async function buscarCliente(q, { pagina = 1, limite = 20 } = {}) {
  const key    = `busca:${q}:${pagina}:${limite}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const data = await hsGet('/api/v1/integracao/cliente', {
    busca: 'nome', termo_busca: q,
    pagina, itens_por_pagina: limite,
  });
  cacheSet(key, data, 60 * 1000);
  return data;
}

export async function getClienteFinanceiro(idCliente) {
  const key    = `fin:${idCliente}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const data = await hsGet('/api/v1/integracao/cliente/financeiro', { id_cliente: idCliente });
  cacheSet(key, data, 2 * 60 * 1000);
  return data;
}

export async function getClienteOS(idCliente, { pagina = 1, limite = 20 } = {}) {
  const key    = `os:${idCliente}:${pagina}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const data = await hsGet('/api/v1/integracao/cliente/ordem_servico', {
    id_cliente: idCliente, pagina, itens_por_pagina: limite,
  });
  cacheSet(key, data, 60 * 1000);
  return data;
}

export async function getClienteAtendimentos(idCliente, { pagina = 1, limite = 20 } = {}) {
  const key    = `atend:${idCliente}:${pagina}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const data = await hsGet('/api/v1/integracao/cliente/atendimento', {
    id_cliente: idCliente, pagina, itens_por_pagina: limite,
  });
  cacheSet(key, data, 60 * 1000);
  return data;
}
