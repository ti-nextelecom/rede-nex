# Mídias, edição de imagens e confirmação de envio

Implementado nos arquivos locais. Não houve publicação, envio de mensagens a usuários reais nem alteração do banco de produção.

## Visualização e edição

- Visualizador compartilhado com imagens, PDFs, áudio e vídeo; demais formatos mantêm acesso ao arquivo original. Imagens e PDFs possuem zoom, ajuste à tela e rolagem sem recortar as bordas. Imagens também permitem arrastar, duplo clique e gesto de pinça. PDFs renderizam uma página por vez com navegação e worker incluído no build, sem depender de CDN.
- Esc fecha o visualizador/editor superior. Os botões têm rótulos acessíveis, o diálogo mantém o foco e tenta devolvê-lo ao controle de origem ao fechar. Atalhos +, - e 0 controlam o zoom.
- Editor antes do upload com corte, riscos livres, setas, retângulos, cor, espessura, desfazer e restaurar. No chat, use “Cortar e marcar imagem” na prévia do anexo; Feed, JRH, Drive, anexos do checklist e imagens do compositor de tarefas oferecem o editor na seleção.
- A edição cria outro File. “Usar original” conserva o arquivo selecionado, e cancelar não altera mídias já salvas. GIF editado gera cópia estática, com aviso explícito. Prévia limitada a 1536 pixels no maior lado; exportação de cópia limitada a 4096 pixels e 20 MB para controlar memória e tempo de processamento.
- Visualizador aplicado ao chat e suas galerias, Feed, JRH, projetos, arquivos de tarefas e Drive. A Wiki mantém sua leitura inline e oferece “Ampliar PDF”. Links para o original continuam disponíveis quando um formato ou servidor externo não permitir a prévia.

## Envio e mensagem de destino

- Enviar texto adiciona imediatamente uma mensagem pendente ao histórico e libera o campo. A fila pertence à conta, envia em ordem por conversa e permite outras conversas em paralelo. Novas teclas após o envio não são apagadas pela confirmação anterior.
- Cada envio recebe um UUID estável. Uma tentativa após falha reutiliza esse UUID; o banco retorna a mensagem já criada se a primeira resposta se perder. Reutilizar o ID com outro conteúdo ou conversa é recusado. Notificações, WebSocket e XP são emitidos apenas na primeira inserção.
- Falhas exibem “Não enviada”, com tentar novamente e descartar. Textos pendentes sobrevivem à recarga por conta e não são reenviados automaticamente ao entrar. O polling também reconcilia a fila quando encontra uma mensagem já entregue, mesmo se a resposta original falhar.
- Anexos têm trava durante o envio, indicador de atividade, URL de upload e identificação reutilizados em nova tentativa. O cabeçalho da conta esperada impede que uma solicitação pendente seja enviada como outro usuário após troca de sessão.
- Clicar na mensagem fixada ou no trecho citado de uma resposta carrega o contexto e centraliza a mensagem original. Avisos de menção preservam a mesma navegação para texto ou mídia. O acesso continua condicionado à participação na conversa. Mensagens removidas ou inacessíveis apresentam aviso.

## Atualização necessária

Esta etapa acrescenta `server/migrations/20261104_chat_message_delivery.sql`: coluna UUID opcional `client_message_id` e índice único parcial por remetente/identificação. Não remove mensagens, usuários ou anexos existentes.

Atualize API, frontend e migração em conjunto pelo fluxo normal de atualização da VM, com backup. Não publique somente o frontend: a nova confirmação exige que a API devolva `client_message_id`. O verificador de implantação exige a coluna após as migrações. A migração anterior do cofre (`20261103_password_vault.sql`) continua necessária se aquele módulo também for publicado.

## Verificações

- TypeScript e build Vite aprovados. ESLint dos componentes de mídia e serviço sem erros ou avisos. Sintaxe dos novos módulos JS e servidor aprovada.
- 13 testes focados aprovados: envio imediato, ordem por conversa, paralelismo, resposta perdida, nova tentativa com mesma identificação, isolamento de conta, persistência sem reenvio automático, reconciliação pelo histórico, zoom/corte, fontes de mídia seguras e regressões de leitura/menções/desempenho.
- Teste em PostgreSQL local descartável aprovado com role restrita: duas requisições simultâneas geram uma linha; conflito de conteúdo/conversa é recusado; novos IDs permitem textos intencionalmente iguais; UUID inválido é recusado; migração pode ser reaplicada. O banco descartável foi removido e o processo local encerrado.
- A suíte ampla executada antes da última inclusão de teste teve 49 aprovados, 6 de banco não ativados e uma falha preexistente no teste de `requireSafeRole`. A implementação recebida do GitHub não rejeita a role que o teste espera rejeitar; esta etapa não altera essa decisão de implantação.
- Validação visual interativa pendente: o host de acesso ao navegador estava indisponível. Não se declara homologação visual, medição de latência real ou teste de upload/envio em produção.

Referência técnica do worker PDF: [documentação oficial do React-PDF](https://github.com/wojtekmaj/react-pdf/blob/main/packages/react-pdf/README.md).
