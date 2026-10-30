import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const [target, name] = process.argv.slice(2);
try {
  if (!target || !name) throw new Error('Informe pasta do app e nome PM2');
  const apps = JSON.parse(execFileSync('pm2', ['jlist'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  const matches = apps.filter(app => app.name === name);
  if (matches.length !== 1) throw new Error('Esperado um único processo PM2 existente com nome ' + name);
  const env = matches[0].pm2_env;
  if (resolve(env.pm_cwd) !== resolve(target) || resolve(env.pm_exec_path) !== resolve(target, 'server/src/server.js')) throw new Error('O PM2 indicado não pertence a esta pasta/API');
  if (env.exec_mode !== 'fork_mode' || env.status !== 'online') throw new Error('A atualização exige uma instância fork online. Revise PM2 antes de continuar');
  console.log('PM2 verificado: ' + name);
} catch (error) { console.error(error.message); process.exitCode = 1; }
