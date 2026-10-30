# REDE NEX — atualizar a VM existente

Este é um pacote de **atualização**, com frontend compilado e API Node conectada ao **PostgreSQL nativo existente**. Não usa Supabase nem exige trocar de banco. Não recria usuários nem restaura dumps. Não é um instalador de banco vazio.

## O que fica na VM

O `.env`, uploads, anexos, distribuição desktop e banco existentes não entram no pacote e não são substituídos. O update substitui somente `dist`, `server/src`, `server/agents`, `server/migrations`, `server/scripts`, `shared`, dependências, `package.json`, lockfile, `ecosystem.config.cjs` e manifesto do release. Versões antigas desses caminhos ficam no backup. Scripts administrativos legados fora do pacote deixam de fazer parte do código ativo; continuam recuperáveis no backup.

O guia antigo de `createdb`/`pg_restore` NÃO se aplica à atualização. **Não execute `restore-db.sh`, importadores Bitrix, consolidação ou purge-demo para atualizar.** A importação dos esboços RH é separada e exige mapa de usuários e correção das pendências descritas em `docs/modulo-rh.md`.

## Preparação única na VM

Requisitos: Linux, Node 22 ou 24 LTS, npm, PM2 disponível para o usuário do serviço, PostgreSQL existente, clientes `pg_dump`/`pg_restore` compatíveis com a versão do servidor, curl, flock e Nginx com HTTPS já configurado. Execute como o mesmo usuário não-root que é dono do app e do PM2, em janela de manutenção (há breve parada da API e desconexão do WebSocket).

1. Confirme a instalação atual, por exemplo `/opt/rede-nex/deploy_v2`. Confirme também nome PM2 (`rede-nex-server`), domínio, porta e caminhos reais de uploads. Esses valores vieram da configuração do projeto; precisam ser conferidos na VM.
2. Preserve o `.env` atual. Acrescente as chaves ausentes usando `.env.example` como referência, **sem copiar esse exemplo por cima do arquivo real**. Use `chmod 600 .env`. O arquivo explícito deve conter toda a configuração necessária; `.env.local` e `server/.env` não serão combinados no update.
3. Defina `NODE_ENV=production`, `DATABASE_URL` para o banco atual, `REDE_NEX_EXPECTED_DATABASE` com o nome EXATO desse banco, `CORS_ORIGINS` com o domínio HTTPS, `HOST=127.0.0.1` e `PORT=3333` (ou as portas reais). Use URL-encoding na senha da URL; alternativamente use as variáveis PG*, sem misturar as duas formas. Não informe senhas em argumentos/comandos ou no frontend.
4. A role da API deve ser `NOSUPERUSER NOBYPASSRLS` e ter os privilégios necessários no schema atual. Não altere atributos do usuário `postgres` para resolver isso. Se hoje a aplicação usa `postgres`, peça ao administrador para criar uma role de aplicação e conceder privilégios específicos sobre os objetos usados, antes de atualizar. A verificação recusa roles que ignoram RLS; isso protege o RH.
5. A role de migração precisa criar schemas/tabelas e ser dona dos objetos que altera. Pode ser a mesma role restrita caso já seja proprietária do banco/objetos. Se for diferente, forneça `REDE_NEX_MIGRATION_DATABASE_URL` somente ao processo de atualização, por variável de ambiente protegida. O migrador confere que ambas as conexões apontam para o mesmo servidor/banco e concede à API somente os novos objetos RH/TI/treinamento/navegação. Não concede acesso geral ao schema legado. As credenciais de migração não são repassadas à API pelo PM2 canônico.
6. Forneça `REDE_NEX_BACKUP_DATABASE_URL` ao processo de atualização usando uma role dedicada de backup com BYPASSRLS e leitura de todos os objetos (ou administrador). A URL deve apontar para o mesmo banco/servidor. Isso é necessário para um dump integral das tabelas RH com FORCE RLS; a role restrita da API não consegue fazer esse backup. Se a conexão de migração já possui esses privilégios, ela é usada como alternativa. O PM2 canônico limpa ambas as credenciais administrativas do ambiente da API. Não use `--enable-row-security` para contornar: poderia gerar backup parcial. Mantenha essas variáveis fora do `.env` de runtime, em ambiente protegido da operação de atualização.
7. Confirme leitura/escrita nos diretórios `UPLOADS_DIR`, `JRH_UPLOADS_DIR`, `PC_UPLOADS_DIR`. Mantenha os caminhos antigos no primeiro update. Variáveis não movem arquivos. Tenha backup separado dos uploads, anexos e downloads (o update preserva esses arquivos, mas o dump não os contém).
8. Se personalizou o agente, copie seu MD para um diretório persistente privado e configure `COPILOTO_AGENT_MD_PATH`. O MD padrão incluído é `server/agents/copiloto.md`; esse caminho é atualizado com o código. O briefing e comandos locais continuam separados do Copiloto externo; editar o MD não habilita envio de dados de trabalho ao provedor.

9. Logos oficiais não estão neste checkout. Antes de parar a API, o atualizador copia somente os quatro assets da marca usados pelo frontend, a partir de `public/assets/images` ou `dist/assets/images` da instalação atual: `logo_nex.png`, `logo_nextelecom-pagina-inicial.png`, `favicon_copa.png`, `nex_bg.svg`. Se estiverem em outra pasta, configure `REDE_NEX_BRAND_ASSETS_DIR`. Se faltarem, o update para; forneça os arquivos oficiais, não fotos de usuários. A cópia local é registrada com hashes no manifesto da versão instalada; o arquivo tar original permanece intacto.

PM2 deve ter **uma instância fork**, usando `<pasta>/server/src/server.js` com `cwd` igual à pasta do app. Há estado de chamadas/rate limit em memória; não use cluster/duas instâncias. Se a instalação atual divergir, faça essa adequação manualmente em manutenção e confira login/saúde antes de usar o atualizador. Use apenas `ecosystem.config.cjs`; o `.js` antigo não é a configuração PM2 suportada desta entrega. Para a primeira configuração do processo, após instalar dependências e verificar/migrar o banco:

```bash
export REDE_NEX_ENV_FILE=/opt/rede-nex/deploy_v2/.env
pm2 start /opt/rede-nex/deploy_v2/ecosystem.config.cjs
pm2 save
```

Não crie outro processo com nome diferente se já houver um atendendo a mesma porta. Configure a inicialização automática do PM2 para o usuário do serviço conforme a política da VM.

## Atualização normal (depois da preparação única)

As melhorias de mídias/envio de 30/10 exigem API, frontend e a migração aditiva `20261104_chat_message_delivery.sql` juntos. Ela permite confirmar e repetir um envio sem duplicar a mensagem. A migração `20261103_password_vault.sql` também é necessária para o cofre de senhas. Veja [detalhes e validações locais](docs/midias-editor-envio-2026-10-30.md). Nenhuma dessas instruções indica que o banco da VM já foi atualizado.

Gere o pacote na máquina de desenvolvimento com `npm run release:build` (`npm.cmd` no PowerShell). Ele exige TypeScript, testes e build Vite aprovados. Saída: `.cache/releases/rede-nex-<data>.tar.gz` e `.sha256`. Leve somente esses dois arquivos à VM, por canal seguro, e extraia em pasta privada **diferente da instalação atual**, nunca dentro de `dist` nem de uploads.

```bash
sha256sum -c rede-nex-<data>.tar.gz.sha256
mkdir -m 700 release-novo
tar -xzf rede-nex-<data>.tar.gz -C release-novo
cd release-novo
bash deploy/update.sh /opt/rede-nex/deploy_v2 /opt/rede-nex/backups
```

Substitua `<data>` pelo nome real do arquivo e ajuste os dois caminhos. Se o `.env` fica fora da aplicação, exporte `REDE_NEX_ENV_FILE` absoluto antes. Se o nome PM2 é outro, exporte `REDE_NEX_PM2_NAME` antes. Não execute o update a partir da própria instalação ativa. O pacote extraído é consumido ao mover o código; para repetir, extraia outra cópia limpa.

Aplicação, pacote extraído e pasta local de rollback precisam estar no mesmo filesystem (verificado antes da parada), para mover diretórios por renomeação, sem cópias parciais entre discos. Nenhum deles pode ficar dentro do outro. Copie o backup validado também para armazenamento separado conforme a política da empresa; rollback local não substitui backup contra perda do disco.

O comando verifica manifesto SHA256, processo PM2 e compatibilidade do schema/colunas; instala dependências pelo lockfile na pasta extraída; para a API; salva configuração privada e dump custom validado com `pg_restore --list`; aplica as migrações pendentes em transação com trava, limite de tempo e checksum; verifica RH/RLS; guarda código/dependências anteriores; troca os caminhos gerenciados e reinicia. O sucesso exige `/api/health` responder `status: ok` com consulta ao banco. Não altera Nginx, firewall, certificados nem configura integrações externas automaticamente.

**Limites:** checksums verificam integridade, não autenticidade do remetente. Confira o hash recebido por canal confiável. O inventário do banco é uma verificação de compatibilidade, não uma auditoria completa de todos os SQLs/permissões legados. Se faltar uma tabela/coluna, o update para antes de modificar o banco: é preciso comparar o schema da VM, não inventar nem restaurar tabelas automaticamente. Integrações sem credenciais são listadas como avisos; e-mail/Bitrix/HubSoft/Copiloto externo exigem suas chaves reais na VM. O assistente operacional local não depende dessas chaves.

## Nginx e validação final

Use `deploy/nginx.conf.example` como referência, preservando certificados/configuração atual. Ajuste domínio, root e porta, teste `sudo nginx -t` e somente então recarregue. `/api/` e `/uploads/` vão para a API; `/ws` precisa do encaminhamento Upgrade/Connection. HTML/SW não ficam presos em cache e assets versionados têm cache longo. Não publique a raiz do repositório: somente `dist` é root público. Não crie alias para anexos privados de prestação de contas. URLs `/uploads` de mídia cadastral/chat/wiki passam a exigir sessão; o Jornal RH mantém sua rota de mídia legada. Recursos fora do inventário `media_assets` precisam ter sua URL legada conferida antes de remover aliases antigos.

```bash
curl --fail http://127.0.0.1:3333/api/health
curl --fail https://rede.nextelecom.net.br/api/health
pm2 logs rede-nex-server --lines 50 --nostream
```

No navegador, valide login/cookie HTTPS, fotos antigas e novas, chat/WebSocket, upload e download, tarefas, projetos pessoais, agenda, avisos, RH e permissões por usuário. Use contas de homologação e dados fictícios para testar gravações. Administrador vê RH; colaborador só após concessão em Permissões. Testes de banco isolado não substituem essa homologação na VM.

## Falha e recuperação

Uma falha antes da troca de código mantém o código atual. Se a API já foi parada, o script tenta reiniciá-la. Durante/depois da troca, tenta recolocar os diretórios antigos e guarda a versão que falhou em `failed-code`; confira saída, logs e saúde, pois recuperação também pode falhar por permissões/disco. O backup fica em `backups/update-XXXXXXXX/`: `code/` com caminhos anteriores, `config.env` privado e `database-*.dump`. Não apague até homologar e cumprir a retenção da empresa.

Migrações desta entrega são aditivas; uma migração confirmada permanece se o código voltar. Não há down automático nem restauração automática do banco (isso poderia apagar trabalho posterior ao backup). Para recuperação tardia: pare a API, preserve o código com problema, reponha os caminhos de `code/` na pasta original, preserve `.env`/uploads, reinicie o processo e confira saúde. A restauração de dados exige decisão do administrador e teste em banco separado. Dump validado por catálogo ainda precisa de ensaio periódico de restauração.

Comandos individuais, somente dentro do pacote/repo com ambiente explícito:

```bash
npm run deploy:check -- --before-migrations  # somente leitura
npm run db:status                           # somente leitura, sem criar ledger
npm run deploy:backup -- /opt/rede-nex/backups/manual
npm run db:migrate                          # grava; execute SOMENTE após backup e autorização
npm run deploy:check                        # schema pós-migração e RLS
```

Referências: [Nginx WebSocket](https://nginx.org/en/docs/http/websocket.html), [PM2](https://pm2.keymetrics.io/docs/usage/application-declaration/), [pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html).
