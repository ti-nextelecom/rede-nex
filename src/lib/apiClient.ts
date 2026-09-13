const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3333/api').replace(/\/$/, '');

// Auth is handled via HttpOnly session cookie — no localStorage token
export function getAuthToken() { return null; }
export function setAuthToken(_token: string | null) {}

function authHeaders(extra?: HeadersInit) {
  return { ...(extra || {}) };
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
  const response = await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: authHeaders(),
  });

  await assertOk(response);
}

export async function apiDeleteJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: authHeaders(),
  });

  await assertOk(response);

  return response.json() as Promise<T>;
}
