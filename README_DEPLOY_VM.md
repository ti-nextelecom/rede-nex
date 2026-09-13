# Rede Nex - Pacote de Deploy para VM

Este ZIP contem o frontend compilado, API Node.js, uploads e dump do PostgreSQL.

## Conteudo
- dist/                 Frontend Vite ja compilado
- server/               API/backend Node.js
- public/uploads/       Arquivos enviados pela aplicacao
- database/*.sql        Dump SQL e schema
- database/*.dump       Dump custom do PostgreSQL
- package.json          Scripts e dependencias
- .env.example          Modelo de configuracao sem senhas reais

## Requisitos na VM
- Node.js 20 ou superior
- PostgreSQL 15 ou superior
- Nginx ou Apache para servir o frontend, ou outro proxy reverso
- PM2 recomendado para manter a API online

## 1. Enviar e extrair
```bash
mkdir -p /opt/rede-nex
cd /opt/rede-nex
unzip rede_nex_vm_deploy_*.zip
```

## 2. Instalar dependencias
```bash
npm ci --omit=dev
```

Se a VM tambem for recompilar o frontend, use `npm ci` e depois `npm run build`.
Este pacote ja inclui `dist/`, entao recompilar nao e obrigatorio.

## 3. Configurar ambiente
```bash
cp .env.example .env
nano .env
```

Configure pelo menos:
```env
DATABASE_URL=postgresql://usuario:senha@localhost:5432/rede_nex
PORT=3333
JWT_SECRET=troque-por-uma-chave-forte
```

## 4. Criar e restaurar banco
Usando dump SQL:
```bash
createdb -U postgres rede_nex
psql -U postgres -d rede_nex -f database/rede_nex_*.sql
```

Ou usando dump custom:
```bash
createdb -U postgres rede_nex
pg_restore -U postgres -d rede_nex --no-owner --no-privileges database/rede_nex_*.dump
```

## 5. Subir API
Teste direto:
```bash
npm run api
```

Com PM2:
```bash
npm install -g pm2
pm2 start server/src/server.js --name rede-nex-api
pm2 save
pm2 startup
```

API local padrao:
```text
http://localhost:3333/api
```

## 6. Servir frontend com Nginx
Exemplo:
```nginx
server {
    listen 80;
    server_name seu-dominio.com.br;

    root /opt/rede-nex/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3333/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        alias /opt/rede-nex/public/uploads/;
    }
}
```

## 7. Validar
```bash
curl http://localhost:3333/api
curl http://localhost:3333/api/health
```

Depois abra o dominio/IP da VM no navegador.

## Observacao de seguranca
O arquivo `.env` real nao foi incluido neste pacote. Configure as senhas diretamente na VM.
