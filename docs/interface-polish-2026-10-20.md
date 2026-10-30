# Voz, dashboard, projetos e chat — 20/10/2026

Alterações locais. Nenhum deploy, migração ou escrita no banco de produção.

## Implementação

- `useJarvisSpeech.ts` controla preparação, reprodução, bloqueio, falha e término do TTS. AbortController e versões de reprodução impedem que um áudio cancelado comece depois. A animação é um efeito estilizado, ligado à reprodução real, não uma análise da amplitude da voz.
- Ondas e núcleo do Jarvis reagem ao estado de fala. Há botão para interromper; movimento reduzido é respeitado. Pop-up global continua usando o mesmo componente de voz.
- Cartões dos projetos da dashboard têm barra de progresso com altura própria e rodapé de data separado. Sem rolagem interna que corte datas: até dois cartões por situação, com acesso aos demais projetos.
- Calendário mensal e agenda do dia reutilizam `GET /api/calendar/events`, com autenticação/permissões existentes, fuso America/Bahia e fim de evento exclusivo. Mudança de mês, Hoje, atualização e falhas são tratados sem simular agenda vazia.
- Chat segue o modo escuro nativo. Preferências de imagem de fundo e cores das mensagens são preservadas; apenas o fundo padrão claro legado é migrado visualmente. Painéis, menus, perfil e histórico têm superfícies escuras. O menu da mensagem foi deslocado para não encobrir o texto no celular.
- Projetos: seletores de usuários, diálogos, cabeçalho e linhas das etapas com cores/contraste escuros, mantendo status e navegação por `?projeto=ID`.

## Evidências de validação

Preview de componentes reais com API fictícia: `npm.cmd run dev -- --config tests/dashboard-vite.config.ts`, URL `http://127.0.0.1:5176/tests/fixtures/dashboard.html`. Sem `.env`, proxy de produção, conexão ao banco ou provedor de IA. O áudio é um tom sintético de teste, não fala de um provedor.

- Reprodução ativa: `data-voice-state="speaking"` e animação `jarvis-voice-wave`; parada manual e término natural retornaram a `idle`.
- Cancelamento durante preparação: a resposta tardia não iniciou áudio. Falha de TTS (`?scenario=tts-error`) mostrou `error`, sem animação de fala.
- Agenda: compromisso de hoje, troca de mês, retorno a Hoje e falha (`?scenario=calendar-error`) conferidos. Novos testes cobrem ano bissexto, grade mensal, fuso e fim à meia-noite.
- Datas dos cartões dentro dos limites, abaixo da barra de progresso de 4 px. Projetos continuam abaixo de Meu trabalho.
- Chat em 390 e 320 px, com compositor e ferramentas disponíveis; menus não cruzam o texto. Projetos e chat também conferidos em desktop de 1440 px.
- Tabela de etapas: cabeçalho com texto `rgb(173, 190, 211)` e linhas escuras. Perfil e personalização do chat conferidos sem fundo branco.
- Testes locais: 33 aprovados, 4 testes de banco não habilitados. Build de produção validado; avisos conhecidos de Browserslist e chunk da Wiki permanecem.

Capturas em `docs/frontend-review/`: `jarvis-speaking-2026-10-20.png`, `dashboard-calendar-2026-10-20.png`, `projects-dark-2026-10-20.png` e `chat-futuristic-2026-10-20.png`. Imagens e fixtures não são incluídas no pacote de produção.

Limite: o provedor real de TTS/IA, permissões de microfone, chamadas e mutações de mensagens/eventos não foram acionados nesta revisão isolada.
