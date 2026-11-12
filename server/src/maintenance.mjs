import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const FLAG_FILE = resolve(process.env.REDE_NEX_MAINTENANCE_FILE || '.runtime/maintenance.json');

export async function setMaintenance({ scheduledAt, minutesRemaining, message }) {
  await mkdir(resolve('.runtime'), { recursive: true }).catch(() => {});
  const data = { scheduledAt, minutesRemaining, message: message || null, setAt: new Date().toISOString() };
  await writeFile(FLAG_FILE, JSON.stringify(data));
}

export async function clearMaintenance() {
  await unlink(FLAG_FILE).catch(() => {});
}

export async function getMaintenance() {
  try {
    const raw = await readFile(FLAG_FILE, 'utf8');
    const data = JSON.parse(raw);
    const scheduledAt = new Date(data.scheduledAt).getTime();
    const now = Date.now();
    const minutesRemaining = Math.max(0, Math.ceil((scheduledAt - now) / 60000));
    if (now > scheduledAt + 60 * 60 * 1000) {
      await clearMaintenance();
      return null;
    }
    return { active: true, scheduledAt: data.scheduledAt, minutesRemaining, message: data.message };
  } catch {
    return null;
  }
}
