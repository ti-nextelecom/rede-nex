import './env.js';

function endpoint(method) {
  const base = process.env.BITRIX_WEBHOOK_URL;
  if (!base) {
    throw new Error('BITRIX_WEBHOOK_URL não configurado no .env');
  }
  return `${base.replace(/\/$/, '')}/${method}.json`;
}

async function callBitrix(method, params = {}) {
  const response = await fetch(endpoint(method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`Bitrix HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(`${payload.error}: ${payload.error_description || 'Erro Bitrix'}`);
  }
  return payload;
}

async function fetchDepartments() {
  try {
    const payload = await callBitrix('department.get');
    return new Map((payload.result || []).map(item => [String(item.ID), item.NAME]));
  } catch {
    return new Map();
  }
}

export async function fetchBitrixUsers() {
  const departments = await fetchDepartments();
  const users = [];
  let start = 0;

  do {
    const payload = await callBitrix('user.get', {
      filter: { ACTIVE: true },
      start,
    });

    for (const user of payload.result || []) {
      const departmentIds = Array.isArray(user.UF_DEPARTMENT) ? user.UF_DEPARTMENT : [];
      users.push({
        ...user,
        DEPARTMENT_NAME: departmentIds.map(id => departments.get(String(id))).filter(Boolean).join(', '),
      });
    }

    start = payload.next;
  } while (start !== undefined && start !== null);

  return users;
}
