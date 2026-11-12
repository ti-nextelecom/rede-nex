# Perfil Comportamental — 03/11/2026

## Entrega local

Novo módulo em `/perfil-comportamental`, disponível na navegação do Rede NEX. O colaborador usa a sessão atual e o cadastro existente; não existe criação de e-mail, conta adicional ou autenticação no serviço do HTML original.

- Questionário com 20 perguntas, navegação por teclado, revisão antes da conclusão e rascunho salvo no banco. As gravações são serializadas, com controle de revisão e vínculo à conta e à tentativa.
- Resultado calculado na API, com perfil-base, traços secundários, avatar híbrido ou composição explícita. Respostas inválidas/incompletas e resultados fornecidos pelo navegador são recusados.
- Dez artes originais preservadas, biblioteca de avatares, distribuição dos pontos, orientações de comunicação, impressão/PDF pelo navegador e histórico de avaliações concluídas.
- Avatar e nome no perfil e no diretório de colaboradores; símbolo junto aos avatares que utilizam `AchievementAvatar`. Fotos e bordas de conquistas existentes são preservadas. As imagens grandes são carregadas apenas onde necessárias.
- Área do gestor com busca, filtros por situação e avatar, pendências, paginação, exportação da lista carregada, respostas e histórico individual.

## Organograma e privacidade

O acesso segue `departments.manager_id`, `departments.parent_id` e `users.department_id`: cada gestor consulta seu setor e os subordinados. Um cargo/role denominado Gestor sem vínculo no organograma não libera acesso geral. Administrador tem a aba **Visão administrativa**, identificada também pelo perfil da sessão, sem depender de ter respondido ao questionário ou gerenciar um setor. Essa visão inclui todos os usuários, inclusive inativos, sem setor e o próprio administrador; o próprio colaborador acessa suas avaliações. Alterações no organograma afetam as consultas seguintes. Ciclos e hierarquias com mais de 64 níveis não liberam acesso por hierarquia.

Rascunhos são privados do próprio colaborador, inclusive perante gestores. Os demais usuários ativos recebem apenas a identidade do avatar, composição e data. Respostas, pontuação e orientações não são retornadas pelo endpoint de selos. A confirmação final informa essa distinção ao colaborador.

A visibilidade da aba na interface não concede acesso por si só. Se a API/migração estiver pendente, a aba permanece visível para o administrador e apresenta o motivo de não carregar os resultados. As permissões são verificadas na API e em políticas RLS habilitadas e forçadas. Avaliações concluídas têm bloqueio de alteração/exclusão; uma nova tentativa conserva o histórico e substitui o selo somente ao concluir. Repetir o mesmo envio retorna a avaliação existente, sem duplicação nem reversão do selo para uma avaliação antiga.

## Fidelidade ao HTML fornecido

Origem: `NEX_Avatares_v21_Premium_v4.html`, SHA256 `3cdbda981991c4afa75e7e74249d49396f46cf30e9197bac02913055af6741e0`.

O conteúdo foi extraído como dados com análise de sintaxe e leitura de marcação, sem executar os scripts. As dez imagens foram copiadas byte a byte; os testes conferem os hashes. Login externo, PocketBase e criação de e-mail não foram incorporados.

Versão integrada: `nex-v21-premium-v4.1`. Pesos originais de 1 a 2, total 29,5; limiares efetivos do código original: traços secundários em 65% e combinação em 82% da pontuação principal. Combinações preservadas: Águia/Lobo → Orca, Golfinho/Lobo → Cisne, Tigre/Golfinho → Leão, Águia/Tigre → Onça e Tigre/Falcão → Puma.

Adaptação explícita: combinações sem híbrido próprio exibem os nomes dos componentes. Empates entre mais de duas maiores pontuações exibem os avatares empatados, sem atribuição arbitrária de um único avatar. Cada avaliação guarda o questionário, respostas, regras e resultado daquela versão. Os percentuais expressam distribuição de pontos, não probabilidades. O módulo descreve preferências declaradas e não automatiza decisões de contratação, promoção ou avaliação de desempenho.

## Banco e ativação

É necessário publicar API, frontend e a migração **aditiva** `server/migrations/20261106_behavioral_profiles.sql` juntos. Ela cria:

1. `behavioral_assessments`: avaliações concluídas e seus snapshots.
2. `behavioral_drafts`: um rascunho por usuário.
3. `behavioral_badges`: identidade mais recente para exibição interna.

Inclui funções, políticas, índices e bloqueio de alteração do histórico. O migrador concede somente os privilégios necessários à role de execução; o verificador de implantação exige RLS nas três tabelas. Use o fluxo de atualização e backup descrito no README da VM. Não execute importadores, restauração de dumps ou recriação de usuários para ativar o módulo.

**Nenhuma migração ou gravação foi aplicada ao banco remoto durante esta implementação.** Até a atualização da API/banco, a tela informa a indisponibilidade e os avatares continuam funcionando sem selos comportamentais.

## Validação local

- Seis testes de conteúdo, pesos, cinco perfis-base, cinco híbridos, limiares, empates, entradas inválidas, snapshots e integridade das dez imagens: aprovados.
- Um teste de integração com PostgreSQL local descartável e HTTP real: aprovado. Cobre hierarquia direta/superior, negação fora da equipe, administrador sem setor com listagem global (incluindo ele próprio, inativos e pessoas sem setor), ciclos, rascunhos/revisões, repetição concorrente do envio, histórico, selo público, RLS, conta divergente e mudança de setor.
- TypeScript, build de produção e ESLint dos novos componentes/serviços: aprovados. Verificação de sintaxe de 101 arquivos JavaScript da API, scripts e código compartilhado: aprovada. O build ainda informa fontes Open Sans ausentes e um aviso de importação estática/dinâmica em notificações, anteriores ao módulo.
- Suíte geral: 71 testes, 62 aprovados, oito integrações opcionais ignoradas e uma falha preexistente em `hosting: privileged runtime or unexpected database is rejected`. O helper `requireSafeRole` já estava vazio na versão recebida do GitHub. Essa decisão de implantação não foi alterada neste módulo; a suíte completa ainda não está aprovada para um pacote de release.
- A inspeção visual e a interação autenticada do novo módulo ainda precisam ser confirmadas. A ferramenta não encontrou conector de navegador; a prévia local no VS Code foi identificada, mas mudanças na posição da janela impediram a navegação segura. Compilação e testes HTTP não substituem essa inspeção. O PostgreSQL iniciado para os testes foi encerrado após a validação.

Para repetir os testes focados: `node --test tests/behavioral-profiles.test.mjs`. Para a integração, use `RUN_BEHAVIORAL_DB_TESTS=1` com o PostgreSQL **local de testes** em `127.0.0.1:55482`, roles `rh_test`/`rh_app`; ela cria e remove um banco descartável. Não aponte esse teste para produção.
