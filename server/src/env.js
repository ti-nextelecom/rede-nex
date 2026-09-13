import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

for (const file of ['.env', '.env.local', 'server/.env']) {
  const fullPath = resolve(process.cwd(), file);
  if (!existsSync(fullPath)) continue;

  for (const line of readFileSync(fullPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;

    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();

    if (!process.env[key]) {
      process.env[key] = rawValue.replace(/^["']|["']$/g, '');
    }
  }
}
