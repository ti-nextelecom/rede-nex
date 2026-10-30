# REDE NEX — fonte e distribuição

O repositório é o ambiente de desenvolvimento. Para atualizar a VM com PostgreSQL existente, leia `README_DEPLOY_VM.md` e gere `npm run release:build` (`npm.cmd` no PowerShell).

O release é uma lista explícita de código/runtime: `dist`, API, módulos compartilhados, migrações, MD do agente e ferramentas de atualização. Não inclui `.env` real, dumps SQL, banco, uploads, fotos pessoais, esboços RH, backups, testes de fixture, screenshots de revisão, `.git` ou `node_modules`. Dependências são instaladas na VM por `npm ci --omit=dev --ignore-scripts` usando o lockfile.

Desenvolvimento: `npm ci`, configurar ambiente local privado e executar `npm run dev`/`npm run api` conforme a finalidade. O preview remoto em `.env.development.local` deve manter seu bloqueio de escrita; não o copie para produção. O build de release usa `/api` no mesmo domínio e retira o bloqueio de preview apenas do bundle de produção.

Não use os scripts de importação/consolidação/restauração como mecanismo de atualização. O projeto não fornece o schema completo de uma instalação vazia: mantém e verifica o banco legado da VM, aplicando apenas as migrações versionadas novas.
