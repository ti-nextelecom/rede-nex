# Espaço pessoal, pop-ups e Copiloto

## O que muda

- Chat: faixa de leitura de até 960 px em telas ultralargas, fontes de mensagem de 18 px, sequências agrupadas em até cinco minutos, separadores por dia, imagens sem corte e ancoragem após carregamento de mídia. Respostas antigas não substituem a conversa atualmente selecionada.
- Tarefas: lista inicial de pendências pessoais, resumo clicável, filtros de envolvimento/status/prazo, ordenação e todas as visualizações anteriores. `cancelled` aparece como Cancelada e não conta como pendência ou atraso. Nenhum registro foi recategorizado no banco.
- Dashboard: Meu trabalho e Meus projetos ocupam a mesma largura, um abaixo do outro, com quadros de quatro colunas. Projetos: atenção, andamento, não iniciados e concluídos. O vínculo responsável/participante, progresso, prazo e pendências ficam nos cartões. Etapas não consultadas são desconhecidas, não zero.
- Feed: removidos Continue explorando e Comunidade em movimento, inclusive a variante mobile e os estilos exclusivos. Perfil, mural, stories e interações permanecem.
- Avisos: pop-ups de chat, tarefas e projetos; contador por conversa; dispensar; acesso por teclado; link para o item exato. O polling usa as notificações do usuário autenticado. WS apenas antecipa a sincronização, sem duplicá-la. Conversas silenciadas não produzem pop-ups; a conversa aberta não gera aviso sobre si mesma. Histórico existente não é reapresentado como novo ao entrar.

## Hospedagem e o Markdown do agente

### Conversa independente na dashboard

O painel mostra **briefing e conversa simultaneamente**, sem abas ou botão para abrir o chat. No desktop, a conversa fica ao lado do resumo; em telas menores, logo abaixo dele, sempre montada e visível. As prioridades aparecem abaixo dos dois. Não navega para `/copiloto`. O componente `DashboardCopilotChat.tsx` tem histórico próprio e não lê, grava ou reutiliza mensagens de `CopilotoPage` ou `CopilotoWidget`.

O histórico permanece durante as atualizações periódicas dos indicadores. É mantido somente em memória nesta dashboard aberta, limitado às últimas 81 mensagens e descartado ao sair/recarregar a página ou trocar de usuário. O componente pai usa `key={user.id}` para separar sessões de usuários. O chat não recebe foco automaticamente ao entrar na página.

Validação da exibição permanente em 16/10/2026: conversa e compositor visíveis na primeira abertura em desktop de 1440×1000, sem troca de aba e sem foco automático; em 390×844 o chat permanece aberto abaixo do resumo, sem rolagem horizontal. Envio por botão e Enter confirmado na dashboard autenticada, sem redirecionamento e sem chamada a IA externa. Evidência: `docs/frontend-review/dashboard-chat-always-visible.png`.

As respostas atuais são **operacionais**, calculadas em `shared/dashboardCopilot.mjs`, com o snapshot pessoal já exibido na dashboard. Não há chamada ao Copiloto geral nem ao provedor externo ao enviar uma pergunta. O assistente consulta vencidas, entregas de hoje, prioridades, projetos como responsável/participante e etapas; pode manter o projeto escolhido no contexto da pergunta seguinte. Explica quando o recorte de até cinco prioridades não contém a lista completa e não executa alterações nos dados.

O assistente geral continua independente no botão flutuante e na página original. Uma futura IA para esta conversa deverá usar canal, histórico e instruções próprios, sem encaminhá-la ao assistente geral, e continua dependendo da autorização de compartilhamento descrita abaixo. O MD atual do Copiloto geral não controla as respostas determinísticas desta conversa.

### Comandos locais e formulários reais

O painel foi simplificado: cores neutras, sem robô destacado/degradês, projetos em lista e conversa sempre aberta. `shared/dashboardActions.mjs` reconhece comandos explícitos; não é um LLM e não envia tarefas/projetos ao provedor. Exemplos: `abra o projeto Zabbix`, `abra minhas tarefas vencidas`, `crie uma tarefa "Conferir contrato" amanhã às 9h`, `novo projeto "Expansão"`, `me lembre de conferir o contrato amanhã às 14h30`.

Abrir um item conhecido navega para a tela interna real; nomes ambíguos mostram opções, nomes ausentes abrem busca sem inventar registros. Criar/preparar nunca grava: mostra uma revisão cancelável na conversa, depois preenche o formulário nativo. Só o botão Salvar/Criar desse formulário chama a API, com as permissões normais. Não conclui, exclui, envia mensagens nem executa SQL/comandos externos. Destinos passam por lista fechada de rotas e parâmetros. Nenhuma criação é tentada automaticamente, inclusive no preview de leitura.

Lembretes usam a agenda existente, como agendamento pessoal se nenhum outro participante for escolhido. Não há serviço novo de alarme/push programado: o formulário e a resposta deixam isso explícito. Datas usam o dia civil de Bahia; o formulário sempre permite conferir/editar. Dados do rascunho ficam transitoriamente na URL e são consumidos pela página. O histórico da conversa continua somente em memória.

O prompt existente do Copiloto foi extraído para `server/agents/copiloto.md`, mantendo a integração existente. `server/src/copilotoContext.js` lê o Markdown a cada solicitação. Para mudar o tom, as instruções e as prioridades de orientação, edite esse MD. Não precisa recompilar o frontend para alterar o prompt.

Publique o backend atualizado junto do frontend e inclua no pacote:

- `server/agents/copiloto.md`
- `server/src/copilotoContext.js` e `server/src/workNotifications.js`
- `shared/personalWork.mjs`

O caminho padrão do MD é relativo ao módulo, não ao diretório de execução. Opcionalmente configure `COPILOTO_AGENT_MD_PATH` **somente no servidor** para um arquivo UTF-8 controlado pela equipe. Nunca use variáveis `VITE_*` para credenciais. Não publique `tests/` ou arquivos de ambiente no diretório público. A chave do provedor existente permanece no servidor, sem mudança de fornecedor ou modelo.

### Limite de privacidade: análise externa ainda não ativada

A dashboard já mostra um briefing operacional calculado com dados reais. O endpoint do Copiloto reconhece `intent: daily-briefing` e monta o resumo internamente a partir de `requireUser`, sem aceitar IDs de usuário ou contexto fornecidos pelo navegador. **Esse resumo é determinístico, não uma análise gerada por IA.**

A proteção do ambiente bloqueou a proposta de enviar tarefas, projetos e etapas ao OpenRouter sem consentimento específico. Por isso o ramo de briefing retorna antes de qualquer chamada ao provedor. Os clientes marcam o resumo como `internalOnly` e o excluem de históricos enviados em perguntas posteriores. O provedor recebe apenas a conversa geral e as instruções do agente, como na integração anterior.

As orientações de briefing no MD estão preparadas para uma futura integração autorizada. **Editar o MD não autoriza nem habilita compartilhamento externo.** Após aprovação do responsável pela organização, será necessário integrar o contexto mínimo aprovado ao provedor, com revisão de segurança. Até lá o briefing operacional permanece funcional dentro da REDE NEX.

## Regras de seleção e limites legados

As regras compartilhadas estão em `shared/personalWork.mjs` e são usadas pelo navegador e pelo backend. Tarefas pessoais são as atribuídas ou sob responsabilidade do usuário; tarefas apenas delegadas a outras pessoas não viram ações pessoais. Sem responsável/participantes, o criador é considerado. Tarefas canceladas/concluídas não são pendências. Datas usam o dia civil de America/Bahia, preservando prazos sem horário.

Participantes de projetos são identificados por ID em responsáveis e assignees de etapas. O cadastro atual guarda o responsável principal por nome, sem ID: usa-se correspondência exata do nome completo como compatibilidade, nunca parcial. Isso é personalização da dashboard, **não controle de autorização**. Nomes homônimos exigem futuramente um ID persistente de responsável (não foi criada migração neste trabalho). No envio de notificações por nome, vínculos ambíguos não recebem aviso.

Os avisos são gravados somente nas ações normais de criação/edição/comentário/atribuição executadas pelo usuário. Destinatários são explicitamente limitados às pessoas envolvidas, sem broadcast quando a lista está vazia; o autor não recebe aviso da própria ação. Falhas no aviso são registradas sem desfazer uma tarefa já salva. A prova visual usa dados fictícios e não envia mensagens nem modifica tarefas de produção.

O preview remoto local continua com `VITE_REMOTE_READ_ONLY=true`. Os novos POST/PATCH também obedecem ao bloqueio existente. O `/ws` tem proxy para receber eventos; o gerenciador envia apenas o ping habitual enquanto ninguém inicia uma ação. O navegador pode validar consultas e navegação, mas o ciclo de gravação de notificações precisa de homologação com backend atualizado e dados de teste antes de produção.

## Verificação

```powershell
node --test tests/personal-work.test.mjs
node --test tests/dashboard-copilot.test.mjs
node --check server/src/server.js
node --check server/src/copilotoContext.js
node --check server/src/workNotifications.js
node node_modules/vite/bin/vite.js build
```

Teste isolado dos pop-ups durante o desenvolvimento: `/tests/fixtures/popups.html`. Todas as chamadas de API dessa página são interceptadas com dados fictícios; não há consultas ou gravações na API externa. Testar: nova mensagem, contador 2, tarefa, projeto, repetição sem duplicação, abertura de cada destino e silenciamento.

Os erros TypeScript legados foram corrigidos na preparação de hospedagem; os resultados atuais do build/testes ficam em `docs/hosting-verification.md`. A verificação visual ultralarga foi feita com sessão autenticada e sem alterações nos dados remotos.
