# Arquitetura — plantas baixas e projetos de segurança

Novo módulo local em `/arquitetura`, acessível pelo menu de módulos e pela navegação lateral. Não houve publicação nem atualização do banco de produção.

## Fluxo de trabalho

1. Abra Arquitetura e selecione Novo projeto, Base residencial ou Base condomínio. Informe o nome e, se desejar, marque como modelo reutilizável.
2. Desenhe paredes, ambientes retangulares, portas, janelas, cotas, trajetos de infraestrutura e anotações. As coordenadas e medidas são em metros, com ajuste à grade de 10 cm e modo ortogonal opcional.
3. Selecione ou arraste equipamentos da biblioteca para a planta. Há câmeras dome/bullet, leitores faciais, fechaduras NA/NF, interfone, botoeira, controladora, switch PoE, rack/NVR e pontos de rede.
4. No painel Propriedades, edite identificação, posição, medidas, rotação, camada, observações, modelo, endereço/IP e altura de instalação. Câmeras também têm alcance e ângulo ilustrados de visão. O tamanho do símbolo é gráfico e configurável.
5. Organize pavimentos e camadas. É possível ocultar/bloquear camadas e adicionar, renomear, duplicar ou remover pavimentos. As ações de desenho têm desfazer/refazer.
6. Use Salvar projeto para gravar no servidor. O rascunho local automático é separado da confirmação de salvamento no banco.

As bases são modelos editáveis para iniciar o trabalho. Não são criadas contas, projetos de exemplo ou dados de demonstração no banco de produção durante a instalação.

## Compartilhamento

Conforme a preferência definida para este módulo, **novos projetos ficam visíveis para toda a equipe por padrão**. Somente usuários ativos participam. O responsável escolhe colaboradores com permissão de edição; os demais têm acesso de leitura, exportação e reutilização como cópia.

O painel Projeto → Compartilhamento também permite restringir uma planta ao responsável e a colaboradores escolhidos. Somente o responsável pode alterar acessos e arquivar/restaurar projetos. Os convites são aplicados ao salvar o projeto. A opção de cópia cria outro projeto com o usuário atual como responsável, sem copiar convites de edição.

## Referências, modelos e saídas

- PNG, JPEG e WebP podem ser usados como referência. PDF importa somente a primeira página, rasterizada localmente. O original não é modificado. A referência é uma base visual: o traçado de paredes e elementos continua manual.
- A calibração usa dois pontos de uma medida conhecida e o comprimento real em metros. Redimensiona somente a referência, preservando os elementos já desenhados.
- Referências ficam incorporadas à planta, com opacidade e posição ajustáveis. Não há dependência de URLs externas para reabrir a imagem.
- Modelo reutilizável preserva os pavimentos, elementos e referências. A ação Usar modelo cria uma nova cópia.
- Exportação editável `.nexplan.json`, importação do mesmo formato, SVG vetorial, PNG e quantitativo CSV com equipamentos/modelos/pavimentos e comprimento geométrico dos trajetos.
- Pranchas para impressão ou Salvar como PDF pelo navegador, em A4/A3 paisagem, com escala escolhida, identificação e legenda. A impressão recusa uma escala que não caiba no papel. No diálogo de impressão, usar tamanho real/100%, papel correspondente e sem ajuste automático.
- Miniaturas usam os primeiros 150 elementos do primeiro pavimento, sem imagem de referência, para limitar o tamanho da listagem.
- Esta entrega é um editor 2D próprio. Não inclui leitura/escrita de DWG/DXF, modelagem 3D, levantamento automático de paredes ou edição simultânea em tempo real.

## Preservação do trabalho

- Histórico de até 40 ações de desenho. Nova edição após desfazer invalida somente a sequência de refazer.
- Seleção múltipla, movimentação conjunta, copiar/colar, duplicar, rotação, deslocamento com setas, zoom e pan.
- Rascunhos em IndexedDB isolados por conta e projeto. Uma cópia em memória permite continuar e exportar se o navegador bloquear o armazenamento; a interface informa que é necessário salvar/exportar antes de fechar.
- Ao reabrir um projeto com rascunho pendente, é possível recuperar o rascunho ou abrir a versão do servidor. Uma revisão antiga não pode substituir uma revisão mais recente; exportar ou Salvar cópia preserva as alterações locais.
- A confirmação de salvamento de uma versão anterior não apaga alterações feitas enquanto a solicitação estava em andamento.
- Projetos arquivados preservam os desenhos e podem ser restaurados pelo responsável.

## Banco e API

Migração aditiva: `server/migrations/20261105_architecture.sql`. Cria `public.architecture_projects`, índices e políticas/funções do módulo. Usa UUIDs compatíveis com o schema existente, referências ao responsável e documento JSONB validado. Não altera fotos, fundos, anexos ou mensagens existentes.

Rotas autenticadas:

- `GET /api/architecture/projects?archived=0&offset=0` — projetos acessíveis, com paginação de 100 registros e resumo/miniatura.
- `POST /api/architecture/projects` — cria projeto do usuário autenticado.
- `GET /api/architecture/projects/:id` — reabre documento autorizado.
- `PUT /api/architecture/projects/:id` — salva com `expected_revision`.
- `PUT /api/architecture/projects/:id/archive` — arquiva/restaura com revisão e autorização do responsável.

Escritas exigem `X-Nex-User-Id` igual à sessão. Todas as consultas aplicam o filtro de acesso explicitamente; a tabela também usa RLS habilitada e forçada, com contexto por transação. A API mantém isolamento mesmo se uma instalação legada estiver conectada com uma role que ignore RLS. A trigger impede troca de proprietário e mudanças de compartilhamento/arquivamento por editores.

Limites: 20 pavimentos, 10.000 elementos, até 100 convidados por lista e documento de até 5,5 MB antes da normalização. Referências são reduzidas localmente ao maior lado de 2.000 px e limitadas a 1,5 milhão de caracteres em base64 por imagem. O servidor rejeita geometrias não finitas, IDs repetidos, tipos desconhecidos e referências ativas/externas. Exportações escapam os textos do usuário e o CSV evita interpretação de fórmulas em campos textuais.

API, frontend e migração devem ser atualizados juntos pelo fluxo normal da VM, com backup. A checagem de implantação verifica a nova tabela/RLS e o migrador concede SELECT/INSERT/UPDATE para a role de execução restrita. A autorização de mudanças no banco de produção continua separada dos testes locais.

## Verificações locais

- TypeScript e compilação Vite de produção aprovados. A página Arquitetura é carregada sob demanda (aproximadamente 82 kB antes de gzip).
- Sintaxe de 88 arquivos JS do servidor e módulos compartilhados aprovada.

- Seis testes de geometria, modelos, referências, SVG seguro, inventário, histórico e validação de metadados aprovados.
- Teste real em banco PostgreSQL local descartável e role restrita aprovado: criar/salvar/reabrir, leitura/edição, isolamento, usuário inativo, convite, equipe, arquivar/restaurar, conflito de revisão, dois salvamentos simultâneos, rotas HTTP sem sessão e troca de conta. Também conferiu os filtros de acesso com conexão privilegiada, além da RLS.
- ESLint dos componentes/serviços novos sem erros ou avisos.
- Suíte geral: 56 aprovados, sete testes de banco não ativados nessa execução e uma falha preexistente de implantação: `requireSafeRole` não rejeita a role que o teste espera rejeitar. A validação específica de banco acima foi executada separadamente com sucesso.
- O script `scripts/check-server.mjs`, citado pelo package.json recebido, está ausente. A sintaxe JS é conferida diretamente sem recriar esse script administrativo.
- Homologação visual interativa ainda não confirmada: o host de acesso ao navegador estava indisponível. Não se declara teste de interação em dispositivos reais, importação/print real pelo navegador ou publicação na VM.
