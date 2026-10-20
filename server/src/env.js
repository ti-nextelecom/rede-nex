import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// An explicit file is exclusive: releases must never inherit a developer .env.local.
const explicitFile = process.env.REDE_NEX_ENV_FILE;
if (explicitFile && !existsSync(resolve(explicitFile))) throw new Error('REDE_NEX_ENV_FILE não encontrado');
for (const file of explicitFile ? [explicitFile] : ['.env', ...(process.env.NODE_ENV === 'production' ? [] : ['.env.local']), 'server/.env']) {
  const fullPath = resolve(process.cwd(), file);
  if (!existsSync(fullPath)) continue;

  for (const line of readFileSync(fullPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;

    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();

    if (process.env[key] === undefined) {
      process.env[key] = rawValue.replace(/^["']|["']$/g, '');
    }
  }
}
