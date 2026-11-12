import { mkdir, cp, readFile, writeFile, readdir, lstat } from 'node:fs/promises';
import { resolve, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { releaseFiles, verifyRelease } from '../deploy/verify-release.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
function run(command, args, options = {}) {
  return new Promise((done, fail) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit', windowsHide: true, ...options });
    child.on('error', fail); child.on('exit', code => code === 0 ? done() : fail(new Error(command + ' falhou: ' + code)));
  });
}
async function main() {
  if (process.argv.length !== 2) throw new Error('release:build não aceita pular build/testes');
  // No developer VITE_* value may leak into the deploy build.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('VITE_')));
  Object.assign(env, { NODE_ENV: 'production', VITE_API_URL: '/api', VITE_REMOTE_READ_ONLY: 'false', VITE_REMOTE_API_TARGET: '' });
  await run(process.execPath, ['scripts/check-server.mjs']);
  await run(process.execPath, ['node_modules/typescript/bin/tsc', '-b']);
  const tests = (await readdir(join(root, 'tests'))).filter(name => name.endsWith('.test.mjs')).map(name => 'tests/' + name);
  // Bound database-test parallelism so busy workstations do not exhaust the test deadline.
  await run(process.execPath, ['--test', '--test-concurrency=2', ...tests]);
  // Exclude private uploads/dumps even when someone has placed them inside public/.
  async function checkPublic(directory) {
    for (const name of await readdir(directory)) {
      const path = join(directory, name); const stat = await lstat(path);
      if (stat.isSymbolicLink() || /^(uploads|backups|downloads|database|\.env.*)$/i.test(name) || /\.(dump|sql|bak|log)$/i.test(name)) throw new Error('Retire dados privados de public/ antes do build: ' + relative(root, path));
      if (stat.isDirectory()) await checkPublic(path);
    }
  }
  await checkPublic(join(root, 'public'));
  await run(process.execPath, ['--input-type=module', '-e', "globalThis.__dirname=process.cwd(); const {build}=await import('vite'); await build({configLoader:'runner', mode:'production'});"], { env });
  const release = new Date().toISOString().replace(/[:.]/g, '-');
  const output = join(root, '.cache', 'releases'); const stage = join(output, 'rede-nex-' + release);
  await mkdir(stage, { recursive: true });
  const include = ['dist', 'server/src', 'server/agents', 'server/migrations', 'shared', 'deploy',
    'package.json', 'package-lock.json', 'ecosystem.config.cjs', '.env.example', 'README_DEPLOY_VM.md',
    ...(await readdir(join(root, 'docs'))).filter(name => name.endsWith('.md')).map(name => 'docs/' + name)];
  for (const path of include) {
    await cp(join(root, path), join(stage, path), { recursive: true, filter: source => !/\.(bak.*|log|map)$/.test(source) && !source.split(/[\\/]/).some(part => part.startsWith('.env') && part !== '.env.example') });
  }
  for (const name of ['deploy-common.mjs', 'deploy-check.mjs', 'migrate.mjs', 'backup.mjs', 'import-hr-prototypes.mjs']) {
    await mkdir(join(stage, 'server/scripts'), { recursive: true });
    await cp(join(root, 'server/scripts', name), join(stage, 'server/scripts', name));
  }
  const files = {};
  for (const path of await releaseFiles(stage)) {
    if (path.endsWith('.sh')) await writeFile(join(stage, path), (await readFile(join(stage, path), 'utf8')).replace(/\r\n/g, '\n'));
    files[path.split(sep).join('/')] = createHash('sha256').update(await readFile(join(stage, path))).digest('hex');
  }
  await writeFile(join(stage, 'release-manifest.json'), JSON.stringify({ format: 1, application: 'rede-nex', release, createdAt: new Date().toISOString(), apiBase: '/api', files }, null, 2) + '\n');
  await verifyRelease(stage);
  const archive = stage + '.tar.gz';
  await run('tar', ['-czf', archive, '-C', stage, '.']);
  const checksum = createHash('sha256').update(await readFile(archive)).digest('hex');
  await writeFile(archive + '.sha256', checksum + '  ' + archive.split(/[\\/]/).pop() + '\n');
  console.log('\nPacote pronto: ' + archive + '\nSHA256: ' + checksum);
}
main().catch(error => { console.error('Release não gerado:', error.message); process.exitCode = 1; });
