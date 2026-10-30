# Módulo RH — REDE NEX

Implementação local em `/rh`, separada da página pública Conexão RH (`/jrh`). Não publica dados no feed, Copiloto, calendário geral ou notificações. Os HTMLs recebidos são referências de dados e fluxos, não código executável da aplicação.

O módulo é **nativo da REDE NEX**, registrado em `App.tsx` dentro da rota protegida e do `Layout` oficial, com o mesmo login, cabeçalho, navegação e temas. Entrada em **Mais → Módulo RH**, na busca de módulos e no menu mobile, visível somente aos usuários autorizados. **Gerenciar acesso** abre a página existente `/permissoes`. A prévia isolada existe apenas como ferramenta de teste; não é o produto entregue. A integração também foi conferida diretamente em `/rh` no App completo, com API/banco de teste e sem erros de console.

## Funcionalidades e limites

- Visão geral com indicadores e agenda mensal dinâmica (ASO, férias, aviso, pagamento e retorno).
- ASO: referência do último exame, periodicidade configurável, previsão por mês ou agendamento por dia, realização e checklist. A realização passa a ser a referência da próxima validade; o histórico preserva as alterações.
- Férias: vários períodos aquisitivos por colaborador, saldo decimal preservado, uma programação/bloco por período, gozo, abono, pendência do colaborador, checklists e alertas de cobertura da equipe. Não representa fracionamento em múltiplos blocos: esse fluxo exige evolução da modelagem antes de seu uso.
- Cadastro de dados administrativos **vinculado obrigatoriamente ao ID de um usuário existente**. Não cria contas nem uma lista independente de pessoas. No formulário, o RH busca/seleciona o usuário; nome, foto, cargo, admissão e setor são apresentados/preenchidos a partir do perfil. Nome e foto dos cartões são consultados ao vivo na conta existente. Alterar cargo/setor administrativo no RH não modifica a conta.
- Filtros por nome, matrícula, equipe, situação e arquivamento. Exportação CSV exige permissão específica e neutraliza fórmulas de planilhas. O arquivo contém todos os registros autorizados, inclusive arquivados, e não apenas o filtro visual.
- Gravações reais na API, conflitos de edição por versão, arquivamento sem exclusão física e auditoria no banco. `/api/rh/history` lista os últimos 100 eventos visíveis (metadados); snapshots completos ficam no banco restrito.
- Limite explícito de 2.500 registros por listagem/exportação. Não usar uma listagem truncada como base de consolidação de toda a empresa.
- Sem laudos, diagnósticos ou resultados clínicos. Não colocar informações clínicas nas observações administrativas.

## Permissões

A página **Permissões** contém um painel novo, persistido no servidor, independente da matriz antiga de `localStorage`. A matriz legada continua identificada como local e **não autoriza RH**.

| Permissão | Finalidade |
| --- | --- |
| `rh.view` | Entrar no módulo |
| `rh.manage` | Criar/editar/arquivar o cadastro de colaboradores do RH |
| `aso.view`, `aso.manage`, `aso.export` | Visualizar, editar e exportar ASO |
| `vacations.view`, `vacations.manage`, `vacations.export` | Visualizar, editar e exportar férias |

Somente o perfil de nome exato **Administrador**, ativo, gerencia permissões e mantém acesso integral. Gestor não recebe acesso automático. Os demais começam sem acesso. Exceções por usuário podem **herdar, permitir ou negar**; uma negativa individual prevalece sobre a concessão do perfil. Editar/exportar exige também acesso ao módulo e visualização da área. Não são permissões de “ver apenas meus próprios dados”: a concessão de visualização autoriza os registros de RH da empresa nessa área.

O servidor revalida a autorização em cada requisição, inclusive exportações e links diretos. O navegador atualiza a navegação ao receber foco e a cada 60 segundos. Mudanças de perfil/usuário não reutilizam as permissões do usuário anterior. Apenas administradores podem descobrir a página antes da migração; a API nunca libera acesso por fallback.

## Banco e publicação (não executados em produção)

Migração versionada: `server/migrations/20261016_hr_module.sql`. É transacional e reexecutável; **não roda no startup** e não altera cadastros existentes de usuários/perfis. Tabelas novas no schema `nex_hr`:

| Tabela | Conteúdo |
| --- | --- |
| `employees` | Dados administrativos vinculados a `public.users.id` por `user_id` obrigatório e único; matrícula opcional, revisão e arquivamento |
| `asos` | Controle corrente de ASO por colaborador |
| `vacations` | Período aquisitivo/concessivo e programação; unicidade por colaborador/período |
| `grants`, `settings` | Regras por perfil/usuário e revisão para evitar sobrescrita concorrente |
| `audit` | Ator, operação, snapshots anterior/posterior e horário |
| `import_keys` | Vínculos dos IDs dos HTMLs para importação idempotente |

IDs de negócio são UUID; datas de calendário são `date`, auditoria é `timestamptz`, saldo é `numeric(6,2)`. Chaves estrangeiras estão indexadas. O FK único de `employees.user_id` impede colaboradores duplicados ou sem conta existente; o vínculo não pode ser trocado após a criação. A exclusão física de um usuário com histórico de RH é bloqueada pelo FK; desativar a conta preserva os registros e exibe aviso de conta inativa. `grants.target_id` é polimórfico (perfil/usuário) e validado contra `public.roles`/`public.users` pela API; concessões órfãs não dão acesso a outros IDs.

RLS está habilitada e forçada nas tabelas novas. Cada operação usa transação e `set_config('nex_hr.actor', id, true)`; o contexto não vaza para outra conexão do pool. A API utiliza exclusivamente o ID da sessão autenticada, nunca um ID de ator fornecido pelo navegador. Funções são `SECURITY INVOKER`, com `search_path` fixo. Auditoria não possui políticas para UPDATE/DELETE. **A conexão de execução deve usar um papel PostgreSQL sem SUPERUSER/BYPASSRLS**; usuários com esses privilégios podem contornar RLS e não devem ser usados pelo serviço.

Ordem de publicação, em janela aprovada e com backup conferido:

1. Conferir o destino de banco e as tabelas públicas `users(id, name, role_id, status, photo_url, position, admission_date, department_id)`, `roles(id, name)` e `departments(id, name)`. Preparar usuário de execução com privilégios mínimos; não expor credenciais ao frontend. A migração é nova, ainda não publicada; não usar uma versão de rascunho sem o FK `user_id`.
2. Executar a migração com o proprietário de migrações. Exemplo administrativo: `psql "$env:RH_MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -f server/migrations/20261016_hr_module.sql`. A variável deve apontar explicitamente ao destino aprovado e não deve ser registrada em logs.
3. Se o usuário da API não for o proprietário das novas tabelas, conceder privilégios ao papel real de execução, sem conceder acesso a `PUBLIC`. Modelo abaixo; substituir `rede_nex_runtime` pelo papel correto antes de executar.
4. Publicar backend e frontend compatíveis. Conferir `/api/access/me`, abrir `/rh` como Administrador e configurar cada usuário/perfil no painel **Permissões**.
5. Corrigir a pendência do esboço, revisar associações por nome, simular e só então importar com aprovação do destino. Validar com usuário permitido e negado; testar persistência e exportação.

```sql
-- Receita para um papel de execução já existente, sem SUPERUSER/BYPASSRLS.
GRANT USAGE ON SCHEMA nex_hr TO rede_nex_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON nex_hr.grants TO rede_nex_runtime;
GRANT SELECT, UPDATE ON nex_hr.settings TO rede_nex_runtime;
GRANT SELECT, INSERT, UPDATE ON nex_hr.employees, nex_hr.asos, nex_hr.vacations TO rede_nex_runtime;
GRANT SELECT, INSERT ON nex_hr.audit TO rede_nex_runtime;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA nex_hr TO rede_nex_runtime;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA nex_hr TO rede_nex_runtime;
-- As funções de autorização consultam somente estes campos públicos.
GRANT SELECT(id, role_id, status, name, photo_url, position, admission_date, department_id) ON public.users TO rede_nex_runtime;
GRANT SELECT(id, name) ON public.roles TO rede_nex_runtime;
GRANT SELECT(id, name) ON public.departments TO rede_nex_runtime;
-- Importador separado: proprietário ou papel administrativo aprovado.
-- O serviço web não precisa de privilégios em import_keys.
```

Se a migração estiver ausente, a API retorna `503 HR_SETUP_REQUIRED` com mensagem clara. Não exibe dados de demonstração como se fossem dados salvos. O ambiente local habitual continua com a API remota protegida pelo modo somente visualização; não desabilitar essa proteção para testar gravações no banco real.

## Mapeamento dos esboços

| Origem | Destino / tratamento |
| --- | --- |
| ASO `id` (`r004` etc.) | `import_keys` — não é matrícula |
| Férias `id` (`00224` etc.) | Matrícula como texto, preservando zeros; `nf1`/`nf2` não viram matrícula |
| Usuário existente + mapa explícito | `user_id` obrigatório (UUID), único, FK de `public.users.id`; nunca criar conta no importador |
| `nome`, `curto`, `team` | Nome original como referência/snapshot; identidade exibida e foto vêm de `public.users`; `short_name`, `team` administrativos |
| ASO `area`, `empresa`, `cargo`, `adm` | `area`, `company`, `position`, `admission_on` |
| ASO `ult`, `per`, `obs` | `last_exam_on`, `periodicity_months`, `notes` |
| ASO `mes`, `dia`, `realizado` (estado do esboço) | `planned_month`, `scheduled_on`, `completed_on` na aplicação; valores em localStorage do navegador original não estão contidos no HTML e não são lidos pelo importador |
| Férias `periods[].ini`, `fim`, `saldo` | Período aquisitivo e saldo decimal, um registro por período |
| Férias `periods[].limite` | `source_start_limit`, preservado como referência do esboço; não confundir com fim concessivo |
| Férias `periods[].tipo` | Referência vencido/a vencer; situação atual é obtida das datas, não congelada na data do HTML |
| Fim concessivo | Sugestão de `fim + 12 meses`, ajustável no formulário pelo RH |
| Férias `DEFAULTS.inicio`, `mes`, `gozo`, `abono`, `pendente` | Programação do primeiro período vencido (ou primeiro período disponível); parser restrito a literais |
| Férias `nf` | `needs_review=true`, sem associação automática a conta ou matrícula |
| Confirmações `done[]` no navegador original | Checklists próprios, persistidos na API; estado externo não está embutido nos HTMLs |

Não executar scripts dos esboços, não usar `eval` e não copiá-los para `public/`. Notas como “OUTUBRO” são preservadas como texto: o importador não inventa um ano para criar agendamento. Nomes normalizados ajudam somente a comparar os dois esboços durante a simulação. **O vínculo a usuários da REDE NEX exige um mapa explícito de UUIDs**, não uma inferência por nome. Homônimos e matrículas conflitantes exigem revisão humana. Reimportação não sobrescreve registros já vinculados; conflitos ou dados inválidos revertem a transação inteira.

### Simulação realizada em 16/10/2026

115 linhas de ASO, 22 pessoas no esboço de férias, 28 períodos aquisitivos, 17 correspondências por nome e 120 pessoas propostas para vinculação aos usuários existentes. Dois cadastros precisam de revisão. **A linha 80 de ASO contém realização futura**: a simulação validou 114 ASO e bloqueia a importação total até corrigir a data ou movê-la conscientemente para agendamento. Sem mapa, os 120 ficam sinalizados como `unlinkedUsers`, impedindo gravação. Nenhuma data foi alterada por suposição, nenhuma conta foi criada e nenhum registro real foi importado.

```powershell
# Apenas lê e valida os arquivos locais. NÃO abre conexão com banco.
node server/scripts/import-hr-prototypes.mjs --aso 'C:\Users\brsam\Downloads\Cronograma de ASO NEX.html' --vacations 'C:\Users\brsam\Downloads\Cronograma de Férias NEX.html'

# Somente depois da revisão dos dados e aprovação do banco de destino:
# definir HR_IMPORT_DATABASE_URL em ambiente seguro, não colocar credencial no código.
node server/scripts/import-hr-prototypes.mjs --aso 'caminho-aprovado-ASO.html' --vacations 'caminho-aprovado-Ferias.html' --user-map 'vinculos-privados.json' --apply --accept-name-matches --actor 'UUID-DO-ADMINISTRADOR-ATIVO'
```

O importador **não carrega `.env` nem `DATABASE_URL`**. Só conecta com `--apply` e `HR_IMPORT_DATABASE_URL` explícitos. A saída padrão contém contagens/índices de pendências, não nomes ou credenciais. O arquivamento não é política de retenção: definir prazos de guarda, backup, restauração e acesso a exportações antes de produção.

O JSON privado de vínculos deve mapear cada ID de origem ao UUID real do usuário, por exemplo `{ "aso:r004": "UUID-EXISTENTE", "vacations:00224": "MESMO-UUID-SE-FOR-A-MESMA-PESSOA" }`. Identidades diferentes não podem usar o mesmo usuário; cadastros ASO e férias da mesma pessoa devem apontar ao mesmo UUID. Guardar esse arquivo fora de `public/` e do versionamento. A simulação aceita `--user-map` para conferir os vínculos antes de abrir conexão. Na gravação, a existência do usuário é verificada no banco e o nome canônico da conta prevalece sobre o texto do HTML.

## Datas e critérios operacionais

Validades usam meses de calendário com ajuste do último dia. Férias contam início/fim inclusivamente; aviso estimado = início − 30 dias, pagamento = início − 2 dias e último início estimado = fim concessivo − (gozo − 1). Aviso/pagamento seguem as referências dos arts. 135 e 145 da [CLT oficial](https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm). O art. 134 também exige análise de DSR/feriados. O módulo não determina automaticamente legalidade de concessão, fracionamento, abono, regras coletivas ou periodicidade médica. Esses pontos dependem de validação do RH/PCMSO e do calendário aplicável.

## Testes e evidências

Teste integrado usa cluster PostgreSQL novo em `.cache/rh-test-db-20261016`, apenas `127.0.0.1:55482`, usuário de aplicação `rh_app` sem SUPERUSER, banco fictício novo por execução. Não reutiliza `.env`, conexão real ou nomes reais. O banco de teste usa autenticação trust: nunca expor a porta, reutilizar em produção ou armazenar dados reais nele.

```powershell
# Com o cluster isolado inicializado e em execução:
$env:RUN_HR_DB_TESTS='1'
node --test tests/hr.test.mjs

# Prévia visual isolada, em terminais separados:
node tests/hr-fixture-server.mjs
npx.cmd vite --config tests/hr-vite.config.ts --mode test
# http://127.0.0.1:5174/tests/fixtures/rh.html
```

`tests/hr-fixture-server.mjs` permite selecionar atores **fictícios** por cookie/cabeçalho. Nunca hospedar `tests/`, rodar a fixture com banco real ou disponibilizar essas rotas no servidor principal. O build normal não inclui a fixture.

Verificação cobre navegador → API → PostgreSQL → resposta → recarga, regras por perfil e usuário, RLS sem ator, ausência de vazamento do contexto no pool, migração repetida, edição concorrente, exportação autorizada/negada, CSV seguro e parser sem execução. Também cobre vínculo obrigatório/único com usuário existente, bloqueio de troca de identidade, avatar carregado no cartão e atualização automática do nome/foto após mudança no perfil. O seletor de usuários e a persistência do vínculo foram testados dentro do App completo em `/rh`. Layout de celular validado em 390×844 com modal rolável e sem transbordamento horizontal. Revisão de React aplicada a hooks, componentes de formulário e controles acessíveis. Os 21 testes de RH e regressão passaram; compilação de assets (`vite build`) passou. ESLint dos componentes novos ficou sem erros, com um aviso de Fast Refresh para exportação conjunta do contexto/hook.

Evidências locais com dados fictícios: `docs/frontend-review/rh-mobile.png` e `rh-desktop.png`. O typecheck geral ainda possui erros preexistentes em outros módulos; não declarar que o build completo com `tsc -b` passou enquanto eles não forem corrigidos.
