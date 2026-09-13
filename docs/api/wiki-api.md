# Wiki API Architecture

Arquitetura REST para conectar a WIKI NEX 2.0 a um banco PostgreSQL local.

## Visao Geral

```mermaid
flowchart LR
  Browser["Frontend Vite / React"] --> Api["API Local REST"]
  Api --> Service["Wiki Service"]
  Service --> Repo["Wiki Repository"]
  Repo --> Db["PostgreSQL rede_nex"]
  Api --> Files["Storage local /uploads"]
```

O frontend nunca deve acessar PostgreSQL diretamente. A API local recebe HTTP, valida dados, executa queries no PostgreSQL e devolve JSON.

## Stack Recomendada

- Runtime: Node.js 20+
- API: Express ou Fastify
- Banco: PostgreSQL local
- Driver: `pg`
- Validador: `zod`
- Uploads: `multer` ou storage local controlado pela API

## Estrutura Sugerida

```text
server/
  src/
    app.ts
    server.ts
    db/
      pool.ts
    modules/
      wiki/
        wiki.routes.ts
        wiki.controller.ts
        wiki.service.ts
        wiki.repository.ts
        wiki.schema.ts
        wiki.types.ts
    middleware/
      error-handler.ts
      auth.ts
  .env
  package.json
```

## Variaveis De Ambiente

```env
PORT=3333
DATABASE_URL=postgres://postgres:SENHA@localhost:5432/rede_nex
UPLOAD_DIR=uploads
```

## Modelo De Dados Da Wiki

Tabelas principais no arquivo `database/local_postgres_schema.sql`:

- `categories`: categorias com `type = 'wiki'`
- `wiki_articles`: artigos publicados, rascunhos e arquivados
- `wiki_versions`: historico de versoes por artigo
- `media_assets`: anexos e imagens vinculados ao artigo
- `users`: autor/editor

## Endpoints

Base URL local:

```text
http://localhost:3333/api
```

### Health

```http
GET /health
```

Resposta:

```json
{
  "status": "ok",
  "service": "rede-nex-api"
}
```

### Listar Categorias Da Wiki

```http
GET /wiki/categories
```

Resposta:

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Atendimento",
      "description": "Processos de atendimento ao cliente",
      "icon": "HeadphonesIcon",
      "color": "#ff7a00",
      "article_count": 4
    }
  ]
}
```

### Criar Categoria

```http
POST /wiki/categories
Content-Type: application/json
```

Body:

```json
{
  "name": "Operacao",
  "description": "Processos operacionais",
  "icon": "Workflow",
  "color": "#0057b8"
}
```

### Atualizar Categoria

```http
PUT /wiki/categories/:id
Content-Type: application/json
```

Body:

```json
{
  "name": "Operacao",
  "description": "Processos atualizados",
  "icon": "Workflow",
  "color": "#16a34a"
}
```

### Remover Categoria

```http
DELETE /wiki/categories/:id
```

Regra: so permitir remover quando nao houver artigos vinculados ou mover os artigos antes.

### Listar Artigos

```http
GET /wiki/articles?categoryId=uuid&status=published&search=olt&page=1&pageSize=20
```

Query params:

- `categoryId`: filtra por categoria
- `status`: `draft`, `published` ou `archived`
- `search`: busca em titulo, conteudo e tags
- `page`: pagina atual
- `pageSize`: tamanho da pagina

Resposta:

```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Configuracao de OLT Huawei",
      "slug": "configuracao-olt-huawei",
      "excerpt": "Requisitos, acesso ao equipamento e troubleshooting...",
      "status": "published",
      "tags": ["olt", "gpon"],
      "category": {
        "id": "uuid",
        "name": "Suporte Tecnico",
        "color": "#0057b8"
      },
      "author": {
        "id": "uuid",
        "name": "Rafael Souza",
        "photo_url": "https://..."
      },
      "created_at": "2026-06-22T10:00:00.000Z",
      "updated_at": "2026-06-22T10:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 42
  }
}
```

### Buscar Artigos

```http
GET /wiki/search?q=atendimento
```

Atalho para busca global da Wiki. Internamente pode usar `ILIKE` no inicio e depois evoluir para `to_tsvector`.

### Obter Artigo Por ID

```http
GET /wiki/articles/:id
```

Resposta:

```json
{
  "data": {
    "id": "uuid",
    "title": "Procedimento de Atendimento ao Cliente",
    "slug": "procedimento-atendimento-cliente",
    "content": "# Procedimento...",
    "status": "published",
    "tags": ["atendimento", "clientes"],
    "category_id": "uuid",
    "author_id": "uuid",
    "created_at": "2026-06-22T10:00:00.000Z",
    "updated_at": "2026-06-22T10:00:00.000Z"
  }
}
```

### Obter Artigo Por Slug

```http
GET /wiki/articles/slug/:slug
```

Usado para URLs amigaveis:

```text
/wiki/procedimento-atendimento-cliente
```

### Criar Artigo

```http
POST /wiki/articles
Content-Type: application/json
```

Body:

```json
{
  "title": "Novo procedimento",
  "slug": "novo-procedimento",
  "content": "# Novo procedimento\n\n## Objetivo",
  "category_id": "uuid",
  "author_id": "uuid",
  "status": "draft",
  "tags": ["processo", "operacao"]
}
```

Regras:

- `title` obrigatorio
- `slug` unico
- `status` default `draft`
- ao criar, tambem gerar primeira linha em `wiki_versions`

### Atualizar Artigo

```http
PUT /wiki/articles/:id
Content-Type: application/json
```

Body:

```json
{
  "title": "Procedimento revisado",
  "content": "# Procedimento revisado",
  "category_id": "uuid",
  "editor_id": "uuid",
  "status": "published",
  "tags": ["processo", "revisado"]
}
```

Regras:

- atualizar `updated_at`
- criar nova versao em `wiki_versions`
- `version_number = ultima_versao + 1`

### Publicar Artigo

```http
PATCH /wiki/articles/:id/status
Content-Type: application/json
```

Body:

```json
{
  "status": "published",
  "editor_id": "uuid"
}
```

### Arquivar Artigo

```http
DELETE /wiki/articles/:id
```

Recomendado: soft delete usando `status = 'archived'`, nao exclusao fisica.

### Historico De Versoes

```http
GET /wiki/articles/:id/versions
```

Resposta:

```json
{
  "data": [
    {
      "id": "uuid",
      "article_id": "uuid",
      "version_number": 3,
      "editor": {
        "id": "uuid",
        "name": "Ana Beatriz Santos"
      },
      "created_at": "2026-06-22T10:00:00.000Z"
    }
  ]
}
```

### Restaurar Versao

```http
POST /wiki/articles/:id/versions/:versionId/restore
Content-Type: application/json
```

Body:

```json
{
  "editor_id": "uuid"
}
```

### Upload De Anexo

```http
POST /wiki/articles/:id/attachments
Content-Type: multipart/form-data
```

Campos:

- `file`: arquivo
- `owner_id`: usuario que enviou

Resposta:

```json
{
  "data": {
    "id": "uuid",
    "bucket": "wiki-attachments",
    "path": "uploads/wiki/article-id/manual.pdf",
    "public_url": "/uploads/wiki/article-id/manual.pdf",
    "file_name": "manual.pdf",
    "file_type": "application/pdf",
    "file_size": 102400
  }
}
```

## Queries PostgreSQL Base

### Listagem Com Categoria E Autor

```sql
select
  a.id,
  a.title,
  a.slug,
  left(regexp_replace(coalesce(a.content, ''), '[#*_`]', '', 'g'), 180) as excerpt,
  a.status,
  a.tags,
  a.created_at,
  a.updated_at,
  json_build_object(
    'id', c.id,
    'name', c.name,
    'color', c.color
  ) as category,
  json_build_object(
    'id', u.id,
    'name', u.name,
    'photo_url', u.photo_url
  ) as author
from wiki_articles a
left join categories c on c.id = a.category_id
left join users u on u.id = a.author_id
where c.type = 'wiki'
  and ($1::text is null or a.status = $1)
  and ($2::uuid is null or a.category_id = $2)
  and (
    $3::text is null
    or a.title ilike '%' || $3 || '%'
    or a.content ilike '%' || $3 || '%'
    or exists (select 1 from unnest(a.tags) tag where tag ilike '%' || $3 || '%')
  )
order by a.updated_at desc
limit $4 offset $5;
```

### Criar Artigo Com Versao Inicial

```sql
with inserted as (
  insert into wiki_articles (
    title,
    slug,
    content,
    category_id,
    author_id,
    status,
    tags
  )
  values ($1, $2, $3, $4, $5, coalesce($6, 'draft'), $7)
  returning *
)
insert into wiki_versions (
  article_id,
  content,
  editor_id,
  version_number
)
select id, content, author_id, 1
from inserted
returning article_id;
```

### Atualizar Artigo E Gerar Versao

```sql
with next_version as (
  select coalesce(max(version_number), 0) + 1 as value
  from wiki_versions
  where article_id = $1
),
updated as (
  update wiki_articles
  set
    title = $2,
    content = $3,
    category_id = $4,
    status = $5,
    tags = $6,
    updated_at = now()
  where id = $1
  returning *
)
insert into wiki_versions (
  article_id,
  content,
  editor_id,
  version_number
)
select updated.id, updated.content, $7, next_version.value
from updated, next_version
returning article_id, version_number;
```

## Padrao De Resposta

Sucesso:

```json
{
  "data": {}
}
```

Erro:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Titulo e obrigatorio",
    "details": {}
  }
}
```

## Codigos De Erro

- `VALIDATION_ERROR`: payload invalido
- `NOT_FOUND`: recurso nao encontrado
- `CONFLICT`: slug ou nome duplicado
- `DATABASE_ERROR`: erro inesperado do banco
- `UNAUTHORIZED`: usuario nao autenticado
- `FORBIDDEN`: usuario sem permissao

## Proximo Passo De Implementacao

1. Criar `server/package.json`.
2. Instalar `express`, `pg`, `zod`, `cors`, `dotenv`.
3. Criar `server/src/db/pool.ts`.
4. Implementar `wiki.repository.ts` com as queries acima.
5. Trocar `src/lib/localDatabase.ts` por um cliente HTTP (`fetch('/api/wiki/...')`).
