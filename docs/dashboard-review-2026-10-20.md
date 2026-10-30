# Dashboard — revisão visual de 20/10/2026

Aplicado no código local, sem deploy ou migrações de banco.

- Hierarquia: saudação, indicadores pessoais, Jarvis com conversa já disponível, atalhos, Meu trabalho, Meus projetos e atividade recente.
- Identidade: grafite, laranja NEX e detalhes frios no núcleo decorativo do assistente. O núcleo não representa disponibilidade ou processamento real da IA.
- Estilos novos restritos à dashboard em `src/pages/dashboard-command.css`; o chat da equipe não foi alterado.
- A dashboard abre o assistente em modo de texto, sem iniciar conversa de voz automaticamente. Os recursos de voz existentes continuam disponíveis por ação do usuário.
- Mantidos os vínculos de responsável/participante, avisos de etapas indisponíveis e links com IDs de tarefas/projetos.

## Verificação

`npm.cmd run build` aprovado. `npm.cmd test`: 31 aprovados e 4 testes de banco não habilitados. Permanecem os avisos de Browserslist e chunk grande da Wiki.

Preview isolado: `npm.cmd run dev -- --config tests/dashboard-vite.config.ts`, em `http://127.0.0.1:5176/tests/fixtures/dashboard.html`. Usa os componentes reais com respostas fictícias; não carrega `.env`, não usa proxy de produção e não conecta a banco ou IA. Cenários adicionais: `?scenario=empty` e `?scenario=partial`.

Conferidos: desktop padrão/1440 px, tablet 768 px e celulares 390/320 px; sem transbordamento horizontal. Estados vazio/parcial, seletor de nova conversa, atalho do assistente e navegação de projeto preservando `?projeto=project-member` verificados. Projeto fictício sem vínculo não é exibido. A integração externa de IA/voz não foi acionada nesta validação.

Captura local com dados fictícios: `docs/frontend-review/dashboard-jarvis-2026-10-20.png` (imagem ignorada no Git e fora do release).
