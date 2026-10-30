# Verificação da preparação de hospedagem

Escopo: preparar atualização local da instalação existente, sem acesso SSH nem alteração do PostgreSQL real da VM. O pacote conecta à mesma API/banco nativo; não contém cópia de dados reais.

## Fluxo

`release:build` → TypeScript/testes/Vite → lista explícita de arquivos → manifesto/hash → VM: pré-verificação → parada API → backup → migrações transacionais → validação RLS → troca de código → PM2 → saúde/banco.

As migrações atuais adicionam RH e versionam o DDL legado de TI/treinamentos/navegação. Dados de exemplo não são carregados no início da API. O arquivo de migração aplicado não pode ser editado/removido sem a recusa do migrador; mudanças futuras entram em outro arquivo SQL. Status não cria tabelas. Banco inesperado, conexão de migração divergente, role SUPERUSER/BYPASSRLS, schema incompatível e trava ocupada interrompem a atualização.

## Evidências e limites

Os resultados executados nesta entrega são registrados ao final deste arquivo. Testes PostgreSQL usam exclusivamente o cluster de teste localhost:55482, bancos descartáveis com nomes `rh_module_test_*`, role restrita e pessoas fictícias. Nenhum teste de integração usa `DATABASE_URL` real ou importação dos esboços RH.

Na VM ainda precisam ser validados: versão dos clientes PostgreSQL, role/privilégios do banco legado, schema completo, paths/permissões/disco para backups e mídias, PM2 como usuário correto, Nginx/TLS, restore do backup em banco separado, integrações externas e gravações de homologação. O script Linux não representa uma publicação já executada. Este preparo não é uma auditoria de segurança integral do sistema legado.

## Resultados locais — 16/10/2026

- `npm.cmd run build`: aprovado (TypeScript e Vite). Avisos não bloqueantes: Wiki acima de 500 kB e base Browserslist antiga.
- Suíte completa com `RUN_HR_DB_TESTS=1`: 35 testes aprovados, nenhum ignorado. Inclui assistente pessoal, comandos, permissões RH, API RH, conflitos, importação fictícia, migração idempotente, checksum, rollback transacional, backup/restauração e inicialização da API.
- Backup real via `pg_dump`, validação de catálogo e restauração real via `pg_restore` em OUTRO banco fictício: preservou colaborador, ASO e férias sob FORCE RLS. A role da API não ignora RLS; backup usa role administrativa apenas no teste.
- API real iniciada com banco fictício, sem credenciais opcionais: saúde 200; RH, mídia autenticada e TI recusaram acesso anônimo com 401. Startup não criou tabelas/projetos de exemplo. Módulo TI legado agora exige autenticação e usa a identidade real no histórico.
- `bash -n deploy/update.sh` e checagem de sintaxe Node: aprovadas. Execução PM2/Nginx/update Linux completo permanece pendente na VM; não simular aprovação dessa etapa com o teste de sintaxe.
- ESLint direcionado aos componentes do assistente e contratos de API alterados: sem erros. A revisão React manteve navegação/rascunhos sem efeitos de gravação automática.
- Navegador autenticado no preview somente leitura: abertura do projeto Zabbix correto; rascunho de tarefa preenchido para 17/10/2026 09:00; lembrete como evento 17/10/2026 14:30–15:30 sem participantes adicionais; novo projeto com título preenchido. Formulários cancelados, sem envio/salvamento de registros remotos.
- `release:build`: TypeScript, testes sem banco (integrações explicitamente ignoradas nesse comando), Vite e manifesto/inventário SHA256 aprovados. O pacote é independente do `.env.development.local`: API `/api` no mesmo domínio, gravações normais habilitadas apenas no bundle de produção. O preview local continua protegido.
- Instalação limpa das dependências do primeiro pacote com `npm ci --omit=dev --ignore-scripts`: aprovada. Detectou-se que `tailwindcss-animate` puxava ferramentas de build para runtime; foi movido para devDependencies.
- Segurança de dependências: DOMPurify atualizado no lockfile para 3.4.17 e React Router para 7.18.4, compatível com React 18/Node 22. `npm audit --omit=dev`: zero avisos em 16/10/2026 após essas correções. Isso não substitui auditoria do código nem cobre dependências de desenvolvimento. O roteador foi atualizado por avisos de navegação externa/SSR, não por mudança de arquitetura; a aplicação continua SPA declarativa, sem SSR. Referências: [aviso de redirecionamento](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6), [aviso de hidratação SSR](https://github.com/advisories/GHSA-337j-9hxr-rhxg).
- Layout da conversa conferido em tela ultralarga e 390×844, com rascunhos nativos cancelados. Evidências locais em `docs/frontend-review/`, deliberadamente fora do pacote por poderem mostrar dados internos.
- Link de projeto mantém o identificador na URL; reabrir/recarregar o link de Zabbix mostra os detalhes corretos. Parâmetros de navegação não são alterados por mutação do objeto compartilhado do roteador.
