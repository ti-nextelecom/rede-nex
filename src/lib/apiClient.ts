const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const READ_ONLY_REMOTE = import.meta.env.VITE_REMOTE_READ_ONLY === 'true';
const SESSION_POST_PATHS = new Set(['/auth/login', '/auth/logout']);

// Auth is handled via HttpOnly session cookie — no localStorage token
export function getAuthToken() { return null; }
export function setAuthToken(_token: string | null) {}

function authHeaders(extra?: HeadersInit) {
  return { ...(extra || {}) };
}

function assertWriteAllowed(path: string) {
  if (READ_ONLY_REMOTE && !SESSION_POST_PATHS.has(path)) {
    throw new Error('Este ambiente local está em modo de visualização. Alterações nos dados da Rede NEX estão bloqueadas.');
  }
}

async function readApiError(response: Response) {
  try {
    const payload = await response.json() as { error?: { message?: string; code?: string } };
    return payload.error?.message || payload.error?.code || response.statusText;
  } catch {
    return response.statusText;
  }
}

async function assertOk(response: Response) {
  if (!response.ok) {
    throw new Error(`API ${response.status}: ${await readApiError(response)}`);
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: authHeaders(),
  });

  await assertOk(response);

  return response.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  assertWriteAllowed(path);
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });

  await assertOk(response);

  return response.json() as Promise<T>;
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  assertWriteAllowed(path);
  const response = await fetch(`${API_URL}${path}`, {
    method: 'PUT',
    credentials: 'include',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });

  await assertOk(response);

  return response.json() as Promise<T>;
}

export async function apiPatch<T>(path: string, body: unknown = {}): Promise<T> {
  assertWriteAllowed(path);
  const response = await fetch(`${API_URL}${path}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });

  await assertOk(response);

  return response.json() as Promise<T>;
}

export async function apiDelete(path: string): Promise<void> {
  assertWriteAllowed(path);
  const response = await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: authHeaders(),
  });

  await assertOk(response);
}

export async function apiDeleteJson<T>(path: string): Promise<T> {
  assertWriteAllowed(path);
  const response = await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: authHeaders(),
  });

  await assertOk(response);

  return response.json() as Promise<T>;
}
