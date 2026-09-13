# Rede Nex

Aplicacao interna com Feed, Wiki, Treinamentos, Colaboradores e Dashboard usando frontend React/Vite, API local Node e PostgreSQL local.

## Arquitetura

```text
React/Vite -> API local Node -> PostgreSQL rede_nex
```

O navegador nao conecta direto no PostgreSQL. O frontend chama a API em `http://localhost:3333/api`, e a API consulta o banco local.

## Preparar Banco

No `psql`, conectado ao banco `rede_nex`, execute:

```sql
\i 'C:/Users/brsam/Downloads/REDE-NEX/project/database/local_postgres_schema.sql'
```

Esse script cria tabelas, indices, triggers e seeds para:

- departamentos
- perfis
- usuarios
- feed
- comunidades
- treinamentos
- wiki
- historico de versoes

## Configurar Ambiente

Crie um `.env` na raiz usando `.env.example` como base:

```env
DATABASE_URL=postgres://postgres:SUA_SENHA@localhost:5432/rede_nex
PORT=3333
VITE_API_URL=http://localhost:3333/api
```

## Rodar Local

Terminal 1, API:

```bash
npm run api
```

Terminal 2, frontend:

```bash
npm run dev
```

## Endpoints Principais

```text
GET  /api/health
GET  /api/dashboard
GET  /api/users
GET  /api/integrations/bitrix/users
GET  /api/integrations/bitrix/imports
POST /api/integrations/bitrix/users/import
POST /api/integrations/bitrix/users/sync
GET  /api/departments
GET  /api/trainings
GET  /api/feed/posts
POST /api/feed/posts
GET  /api/wiki/categories
POST /api/wiki/categories
PUT  /api/wiki/categories/:id
DELETE /api/wiki/categories/:id
GET  /api/wiki/articles
POST /api/wiki/articles
GET  /api/wiki/articles/:id
PUT  /api/wiki/articles/:id
PATCH /api/wiki/articles/:id/status
DELETE /api/wiki/articles/:id
GET  /api/wiki/articles/:id/versions
POST /api/wiki/articles/:id/versions/:versionId/restore
GET  /api/wiki/search?q=termo
```

## Fallback Do Frontend

As telas tentam usar a API local primeiro. Se a API estiver desligada, o app usa `src/lib/localDatabase.ts` como fallback para continuar navegavel.

## Validacao

```bash
npm run build
npm run lint
```

## Importar Usuarios Do Bitrix

Veja [docs/integrations/bitrix-users.md](docs/integrations/bitrix-users.md).
