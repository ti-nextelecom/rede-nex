// Canonical production config. One process: signaling/rate limits live in memory.
const fs = require('node:fs');
const path = require('node:path');
const envFile = process.env.REDE_NEX_ENV_FILE || path.join(__dirname, '.env');
const fileValues = {};
for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
  const index = trimmed.indexOf('=');
  fileValues[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '');
}
// Explicit empty defaults clear stale PM2 values when switching DB credentials.
const keys = 'FIREBASE_SERVICE_ACCOUNT_PATH GOOGLE_APPLICATION_CREDENTIALS FIREBASE_PROJECT_ID FIREBASE_USE_ADC DATABASE_URL PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD CORS_ORIGINS MAX_JSON_BYTES UPLOADS_DIR JRH_UPLOADS_DIR PC_UPLOADS_DIR DOWNLOADS_DIR COPILOTO_AGENT_MD_PATH OPENROUTER_API_KEY RESEND_API_KEY BITRIX_WEBHOOK_URL HUBSOFT_AJUDA_CLIENT_ID HUBSOFT_AJUDA_CLIENT_SECRET HUBSOFT_AJUDA_USERNAME HUBSOFT_AJUDA_PASSWORD HUBSOFT_AJUDA_RESPONSAVEL_ID HUBSOFT_AJUDA_SETOR_ID HUBSOFT_DB_HOST HUBSOFT_DB_PORT HUBSOFT_DB_NAME HUBSOFT_DB_USER HUBSOFT_DB_PASS'.split(' ');
const runtimeEnv = Object.fromEntries(keys.map(key => [key, process.env[key] ?? fileValues[key] ?? '']));
module.exports = {
  apps: [{
    name: process.env.REDE_NEX_PM2_NAME || 'rede-nex-server',
    script: 'server/src/server.js',
    cwd: __dirname,
    interpreter: process.execPath,
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '768M',
    kill_timeout: 12000,
    min_uptime: '10s',
    max_restarts: 10,
    time: true,
    env: {
      ...runtimeEnv,
      NODE_ENV: 'production',
      HOST: process.env.HOST || fileValues.HOST || '127.0.0.1',
      PORT: process.env.PORT || fileValues.PORT || '3333',
      REDE_NEX_ENV_FILE: envFile,
      REDE_NEX_MIGRATION_DATABASE_URL: '', // Never give the API migration-owner credentials.
      REDE_NEX_BACKUP_DATABASE_URL: '',
    },
  }],
};
