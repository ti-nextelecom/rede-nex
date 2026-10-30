import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

let _messaging = null;

async function getMessaging() {
  if (_messaging) return _messaging;
  const { default: admin } = await import('firebase-admin');
  if (!admin.apps.length) {
    const dir = dirname(fileURLToPath(import.meta.url));
    const sa = JSON.parse(readFileSync(join(dir, '../firebase-service-account.json'), 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
  _messaging = admin.messaging();
  return _messaging;
}

export async function sendFcmToUsers(userIds, { title, body, data = {} }) {
  if (!userIds?.length) return;
  try {
    const { rows } = await pool.query('SELECT token FROM device_fcm_tokens WHERE user_id = ANY($1)', [userIds]);
    if (!rows.length) return;
    const tokens = rows.map(r => r.token);
    const msg = await getMessaging();
    await msg.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: { priority: 'high', notification: { channelId: 'rede-nex-chat', sound: 'default' } },
    });
  } catch (e) {
    console.error('[FCM] send error:', e.message);
  }
}
