# Rede Nex - Codigo Fonte Completo

Este pacote contem o codigo-fonte React e a API Node.js para continuar desenvolvimento.

## Incluido
- src/ - codigo React original
- server/ - API/backend Node.js
- database/ - schema SQL e documentacao
- public/ - assets/uploads necessarios
- docs/ - documentacao, se existir
- package.json/package-lock.json
- configs Vite, TypeScript, Tailwind e ESLint

## Nao incluido
- node_modules/
- dist/
- .env real com senha/tokens
- .git/
- database/exports/

## Como rodar
```bash
npm install
cp .env.example .env
npm run api
npm run dev
```

Frontend: http://127.0.0.1:5173
API: http://localhost:3333/api
