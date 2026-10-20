import { readFileSync } from 'node:fs';
let release = 'development';
try {
  const manifest = JSON.parse(readFileSync(new URL('../../release-manifest.json', import.meta.url), 'utf8'));
  if (manifest.application === 'rede-nex' && typeof manifest.release === 'string') release = manifest.release;
} catch { /* Source checkout has no release manifest. */ }
export const releaseId = release;
