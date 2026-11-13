# Escalas e folgas

O módulo fica em **Mais recursos → Escalas e folgas**, na rota `/escalas`.

## Organização

- Visões semanal e mensal com dias de trabalho, folgas e folgas combinadas.
- Grade dividida por setor, com identificação do supervisor e a escala dos colaboradores. O supervisor aparece primeiro quando sua escala está disponível para a conta que consulta.
- Fundo sólido seguindo o tema escolhido e filtro de setores sempre visível.
- Filtros por setor, colaborador e hierarquia do supervisor.
- Planejamento 5×2 por período, com seleção dos cinco dias de trabalho, horários e colaboradores.
- Revisão antes de confirmar o planejamento, com contagem dos dias e das folgas combinadas que serão substituídas quando essa opção estiver selecionada.
- Ajuste individual ao clicar no dia, com observação opcional sobre o acordo de folga.
- Turnos com saída anterior à entrada terminam no dia seguinte, indicado por `+1` na grade semanal.
- Histórico com autor, data e conteúdo anterior e posterior de cada alteração.

O planejamento preenche o período escolhido, de até 93 dias por operação. Os horários representam entrada e saída do turno. A grade mensal possui rolagem horizontal e mantém o colaborador visível na primeira coluna.

O formulário inicia com trabalho de segunda a sexta, das 08h às 17h. O supervisor pode ajustar os dias, horários, período e colaboradores antes da confirmação.

## Acesso adotado

Administradores podem consultar e editar todas as equipes. Responsáveis cadastrados no organograma podem editar seu setor e os setores subordinados. Responsáveis de setor e contas com papel Gestor ou Supervisor podem consultar as escalas das áreas para coordenar a cobertura. Colaboradores podem consultar a própria escala.

Uma conta Gestor ou Supervisor precisa estar vinculada como responsável no organograma para editar uma equipe. As validações são feitas na API e nas políticas de acesso do banco.

## Avisos e consistência

Cada salvamento com alterações cria um aviso para os demais supervisores, gestores e administradores ativos. O aviso identifica o autor, o período e a quantidade de dias e colaboradores alterados e abre a escala correspondente.

Escala, histórico e notificações são gravados na mesma transação. Revisões detectam edições concorrentes. A identificação da operação permite repetir uma solicitação após falha de conexão sem duplicar alterações ou avisos. Os avisos usam a central de notificações existente e seguem o mecanismo de entrega Android já configurado na instalação.

## Aplicação na VM

Esta atualização inclui a migração `server/migrations/20261113_work_schedules.sql`, que cria as tabelas `work_schedule_entries`, `work_schedule_operations` e `work_schedule_history`, seus índices e políticas de acesso.

O fluxo existente de atualização da VM aplica a migração e concede os privilégios ao usuário de execução. A verificação de release exige os arquivos do módulo e a checagem de implantação verifica as tabelas, as políticas e os privilégios.

Os testes usam dados fictícios em PostgreSQL local. A grade por setor foi conferida visualmente no desktop e em largura de 390 pixels, nos temas escuro e claro, incluindo filtro de setor, supervisor, colaboradores e rolagem dos dias. A aplicação na VM e a validação em aparelho Android estão pendentes.
