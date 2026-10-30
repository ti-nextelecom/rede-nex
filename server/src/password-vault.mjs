import { validateVaultEnvelope } from '../../shared/passwordVault.mjs';
const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode, code: 'VAULT_ERROR' });
export function passwordVault(pool) {
  async function transaction(userId, work) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.vault_user_id',$1,true)", [userId]);
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  const get = userId => transaction(userId, async client => (await client.query('SELECT envelope,revision FROM public.password_vaults WHERE user_id=$1', [userId])).rows[0] || { envelope: null, revision: 0 });
  async function save(userId, payload) {
    if (!payload || Object.keys(payload).sort().join(',') !== 'envelope,expected_revision' || !Number.isInteger(payload.expected_revision) || payload.expected_revision < 0 || payload.expected_revision > 2147483646) throw fail(400, 'Solicitação do cofre inválida.');
    let envelope;
    try { envelope = validateVaultEnvelope(payload.envelope); } catch { throw fail(400, 'Cofre criptografado inválido.'); }
    return transaction(userId, async client => {
      const result = payload.expected_revision === 0
        ? await client.query('INSERT INTO public.password_vaults(user_id,envelope) VALUES($1,$2) ON CONFLICT(user_id) DO NOTHING RETURNING revision', [userId, envelope])
        : await client.query('UPDATE public.password_vaults SET envelope=$2,revision=revision+1,updated_at=now() WHERE user_id=$1 AND revision=$3 RETURNING revision', [userId, envelope, payload.expected_revision]);
      if (!result.rows[0]) throw fail(409, 'O cofre mudou em outra sessão. Bloqueie e abra novamente antes de salvar.');
      return result.rows[0];
    });
  }
  return { get, save };
}
export function createVaultRouter({ pool, requireUser, readJson, sendJson, sendError }) {
  const repository = passwordVault(pool);
  return async (req, res, path) => {
    if (path !== '/api/users/me/password-vault') return false;
    const user = await requireUser(req, res);
    if (!user) return true;
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'GET') sendJson(req, res, 200, { data: { ...await repository.get(user.id), owner_id: user.id } });
    else if (req.method === 'PUT') {
      if (req.headers['x-nex-user-id'] !== user.id) { sendError(req, res, 409, 'ACCOUNT_CHANGED', 'A conta mudou. Abra o cofre novamente.'); return true; }
      sendJson(req, res, 200, { data: await repository.save(user.id, await readJson(req)) });
    } else sendError(req, res, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
    return true;
  };
}
