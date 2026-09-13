# Importacao De Usuarios Do Bitrix

Esta integracao leva colaboradores cadastrados no Bitrix24 para o PostgreSQL local da Rede Nex.

## O Que Foi Preparado

- Campos Bitrix em `users`:
  - `bitrix_id`
  - `bitrix_department`
  - `bitrix_active`
  - `bitrix_last_sync_at`
  - `source`
- Auditoria em `bitrix_user_imports`.
- API:
  - `GET /api/integrations/bitrix/users`
  - `GET /api/integrations/bitrix/imports`
  - `POST /api/integrations/bitrix/users/import`
  - `POST /api/integrations/bitrix/users/sync`
- Script:
  - `npm run bitrix:import -- --file caminho.csv`
  - `npm run bitrix:import -- --file caminho.json`
  - `npm run bitrix:import` usando `BITRIX_WEBHOOK_URL`

## Atualizar O Banco

No `psql`:

```sql
\i 'C:/Users/brsam/Downloads/REDE-NEX/project/database/local_postgres_schema.sql'
```

## Importar Por CSV

Exporte os usuarios do Bitrix e salve como CSV. O importador aceita cabecalhos comuns:

```text
ID,NAME,LAST_NAME,EMAIL,WORK_POSITION,PERSONAL_MOBILE,ACTIVE,DEPARTMENT_NAME
```

Tambem aceita cabecalhos em portugues:

```text
Bitrix ID,Nome,Sobrenome,E-mail,Cargo,Telefone,Ativo,Departamento
```

Rode:

```bash
npm run bitrix:import -- --file "C:\caminho\usuarios-bitrix.csv"
```

## Importar Por JSON

O arquivo pode ser um array:

```json
[
  {
    "ID": "123",
    "NAME": "Ana",
    "LAST_NAME": "Santos",
    "EMAIL": "ana.santos@nexcorporativo.net.br",
    "WORK_POSITION": "CS",
    "ACTIVE": "Y",
    "DEPARTMENT_NAME": "CS"
  }
]
```

Ou um objeto:

```json
{
  "users": []
}
```

Rode:

```bash
npm run bitrix:import -- --file "C:\caminho\usuarios-bitrix.json"
```

## Sincronizar Por Webhook Bitrix

No `.env`, configure:

```env
BITRIX_WEBHOOK_URL=https://nextelecom.bitrix24.com.br/rest/USER_ID/WEBHOOK_CODE/
```

Depois rode:

```bash
npm run bitrix:import
```

Ou, com a API ligada:

```bash
curl -X POST http://localhost:3333/api/integrations/bitrix/users/sync
```

## Conferir Usuarios Importados

Com a API ligada:

```text
http://localhost:3333/api/integrations/bitrix/users
```

No PostgreSQL:

```sql
select
  name,
  email,
  position,
  bitrix_id,
  bitrix_department,
  bitrix_active,
  bitrix_last_sync_at
from users
where source = 'bitrix' or bitrix_id is not null
order by name;
```

## Regras De Importacao

- Identifica usuario por `email`.
- Atualiza dados se o e-mail ja existir.
- Cria departamento automaticamente se vier do Bitrix e ainda nao existir.
- Define perfil padrao como `Colaborador`.
- Marca `status = inactive` quando o Bitrix indicar usuario inativo.
- Nao grava senha nem credenciais do Bitrix no banco.
