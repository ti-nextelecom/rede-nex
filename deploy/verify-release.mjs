import { readFile, readdir, lstat } from 'node:fs/promises';
import { resolve, join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const allowedRoots = new Set(['dist', 'server', 'shared', 'deploy', 'docs', 'package.json', 'package-lock.json', 'ecosystem.config.cjs', '.env.example', 'README_DEPLOY_VM.md', 'release-manifest.json']);
export async function releaseFiles(root) {
  const output = [];
  async function walk(directory) {
    for (const name of await readdir(directory)) {
      const path = join(directory, name); const rel = relative(root, path).split(sep).join('/');
      if (directory === root && name === 'node_modules') continue; // npm ci recreates this, never included in the archive.
      if (!allowedRoots.has(rel.split('/')[0]) || /(^|\/)(uploads|downloads|backups|database|tests|\.git|\.cache)(\/|$)/i.test(rel)) throw new Error('Arquivo fora da lista do release: ' + rel);
      if ((name.startsWith('.env') && rel !== '.env.example') || /\.(dump|bak|log|map)$|\.bak[._]/i.test(name)) throw new Error('Arquivo sensível/temporário no release: ' + rel);
      const stat = await lstat(path);
      if (stat.isSymbolicLink()) throw new Error('Symlink não permitido no pacote: ' + rel);
      if (stat.isDirectory()) await walk(path);
      else if (stat.isFile()) output.push(rel);
      else throw new Error('Tipo de arquivo não permitido: ' + rel);
    }
  }
  await walk(root); return output.sort();
}
export async function verifyRelease(root) {
  root = resolve(root);
  const manifest = JSON.parse(await readFile(join(root, 'release-manifest.json'), 'utf8'));
  if (manifest.application !== 'rede-nex' || manifest.format !== 1 || !manifest.files || !manifest.release) throw new Error('Manifesto inválido');
  const files = (await releaseFiles(root)).filter(path => path !== 'release-manifest.json');
  for (const required of ['dist/index.html', 'server/src/server.js', 'server/scripts/migrate.mjs', 'server/migrations/20261016_hr_module.sql', 'shared/hr.mjs', 'server/src/task-authoring.mjs', 'server/src/task-checklist-progress.mjs', 'server/src/architecture.mjs', 'server/src/behavioral-profiles.mjs', 'server/migrations/20261105_architecture.sql', 'server/migrations/20261106_behavioral_profiles.sql', 'dist/fonts/open-sans-variable.ttf', 'dist/fonts/open-sans-italic-variable.ttf', 'dist/fonts/OFL-OpenSans.txt', 'dist/native-offline.html', ...['aguia','cisne','falcao','golfinho','leao','lobo','onca','orca','puma','tigre'].map(name => 'dist/behavioral-profiles/' + name + '.png'), 'package.json', 'package-lock.json', 'ecosystem.config.cjs', 'deploy/update.sh']) {
    if (!files.includes(required)) throw new Error('Arquivo obrigatório ausente: ' + required);
  }
  if (files.length !== Object.keys(manifest.files).length) throw new Error('Inventário do pacote diverge do manifesto');
  for (const path of files) {
    const hash = createHash('sha256').update(await readFile(join(root, path))).digest('hex');
    if (manifest.files[path] !== hash) throw new Error('Checksum inválido: ' + path);
  }
  return manifest;
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  verifyRelease(process.argv[2] || process.cwd()).then(result => console.log('Release íntegro: ' + result.release))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
