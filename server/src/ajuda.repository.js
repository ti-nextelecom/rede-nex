import './env.js';

const HS_HOST = 'https://api.nextelecom.hubsoft.com.br';

const CAT_MAP = {
  helpdesk:      { id: 26, label: 'HELPDESK',      prazo_min: 2880 },
  correcao:      { id: 27, label: 'CORREÇÃO',       prazo_min: 1440 },
  desenvolvimento: { id: 25, label: 'DESENVOLVIMENTO', prazo_min: 10080 },
};

let tokenCache = null;
let tokenExpiry = 0;

function isConfigured() {
  return !!(
    process.env.HUBSOFT_AJUDA_CLIENT_ID &&
    process.env.HUBSOFT_AJUDA_CLIENT_SECRET &&
    process.env.HUBSOFT_AJUDA_USERNAME &&
    process.env.HUBSOFT_AJUDA_PASSWORD
  );
}

async function getToken() {
  if (!isConfigured()) throw Object.assign(new Error('Integração HubSoft não configurada. Preencha HUBSOFT_AJUDA_* no .env'), { statusCode: 503 });
  if (tokenCache && Date.now() < tokenExpiry) return tokenCache;

  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: process.env.HUBSOFT_AJUDA_CLIENT_ID,
    client_secret: process.env.HUBSOFT_AJUDA_CLIENT_SECRET,
    username: process.env.HUBSOFT_AJUDA_USERNAME,
    password: process.env.HUBSOFT_AJUDA_PASSWORD,
    scope: '*',
  });

  const res = await fetch(`${HS_HOST}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await res.json();
  if (!data.access_token) throw Object.assign(new Error('Autenticação HubSoft falhou: ' + (data.message || data.error || JSON.stringify(data).substring(0, 150))), { statusCode: 502 });

  tokenCache = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in ? data.expires_in * 1000 : 1800000) - 60000;
  return tokenCache;
}

export async function createChamado({ userName, tipo, descricao, urgente }) {
  const token = await getToken();
  const cat = CAT_MAP[tipo?.toLowerCase()] || CAT_MAP.helpdesk;
  const responsavelId = parseInt(process.env.HUBSOFT_AJUDA_RESPONSAVEL_ID || '100', 10);
  const setorId = parseInt(process.env.HUBSOFT_AJUDA_SETOR_ID || '37', 10);
  const amanha = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const payload = {
    titulo: `CHAMADO TI [${cat.label}] - ${userName}`,
    descricao_abertura: descricao,
    id_usuario_responsavel: responsavelId,
    id_setor_responsavel: setorId,
    id_tarefa_categoria: cat.id,
    id_prioridade: urgente ? 5 : 4,
    data_limite: amanha,
    hora_limite: '18:00',
    usuarios: [responsavelId],
  };

  const res = await fetch(`${HS_HOST}/api/v1/integracao/tarefa`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (data.status !== 'success' || !data.tarefa) {
    throw Object.assign(new Error(data.msg || 'HubSoft recusou a criação do chamado'), { statusCode: 502 });
  }

  const t = data.tarefa;
  return {
    id_chamado: t.id_tarefa,
    titulo: t.titulo,
    categoria: cat.label,
    prazo: amanha + ' 18:00',
    responsavel: 'Suporte TI',
  };
}

export async function listChamadosRecentes() {
  const token = await getToken();
  const res = await fetch(`${HS_HOST}/api/v1/integracao/tarefa?pagina=1&itens_por_pagina=20`, {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
  });
  const data = await res.json();
  const items = (data.data || data.tarefas?.data || []).filter(t => [25, 26, 27].includes(t.id_tarefa_categoria));
  return items.map(t => ({
    id: t.id_tarefa,
    titulo: t.titulo,
    status: t.status,
    categoria: t.tarefa_categoria?.nome || 'TI',
    prazo: t.data_limite_br,
    data_abertura: t.data_cadastro_br,
  }));
}

export function ajudaConfigured() {
  return isConfigured();
}
