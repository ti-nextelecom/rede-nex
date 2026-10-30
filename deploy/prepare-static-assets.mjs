import '../server/src/env.js';
import { access, lstat, mkdir, copyFile, chmod, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const brandAssets = ['logo_nex.png', 'logo_nextelecom-pagina-inicial.png', 'favicon_copa.png', 'nex_bg.svg'];
export async function preserveBrandAssets(release, current, override = process.env.REDE_NEX_BRAND_ASSETS_DIR) {
  release = resolve(release); current = resolve(current);
  if (release === current) throw new Error('Release e instalação atual precisam ser diferentes');
  const sources = [override, join(current, 'public/assets/images'), join(current, 'dist/assets/images')].filter(Boolean);
  const manifestPath = join(release, 'release-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.application !== 'rede-nex' || !manifest.files) throw new Error('Manifesto inválido');
  const preserved = [];
  for (const name of brandAssets) {
    const relative = 'dist/assets/images/' + name; const destination = join(release, relative);
    if (await access(destination).then(() => true, () => false)) continue;
    let source;
    for (const folder of sources) {
      const candidate = join(folder, name);
      const stat = await lstat(candidate).catch(() => null);
      if (stat?.isFile() && !stat.isSymbolicLink() && stat.size > 0 && stat.size <= 10 * 1024 * 1024) { source = candidate; break; }
    }
    if (!source) throw new Error('Asset oficial ausente: ' + name + '. Configure REDE_NEX_BRAND_ASSETS_DIR com os arquivos da marca; a API ainda não foi parada');
    await mkdir(join(release, 'dist/assets/images'), { recursive: true });
    await copyFile(source, destination); await chmod(destination, 0o644);
    manifest.files[relative] = createHash('sha256').update(await readFile(destination)).digest('hex');
    preserved.push(relative);
  }
  manifest.preservedBrandAssets = [...new Set([...(manifest.preservedBrandAssets || []), ...preserved])];
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  return preserved;
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  if (process.argv.length !== 4) { console.error('Uso: prepare-static-assets.mjs /release-extraido /app-atual'); process.exitCode = 1; }
  else preserveBrandAssets(process.argv[2], process.argv[3]).then(files => console.log('Assets oficiais preservados: ' + files.length))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
