# Chat: anexos no celular — 06/11/2026

O envio de arquivos usava uma prévia com altura mínima de 280 px, mais cabeçalho, ferramentas e legenda, dentro do próprio painel do chat. Em telas pequenas e com teclado aberto o conjunto podia ultrapassar a área disponível.

O novo ChatAttachmentDialog usa portal no body, mede a área visível com VisualViewport e acompanha resize/scroll do teclado e rotação sem atualizar o histórico React. A prévia, identificação e ferramentas têm rolagem própria; cabeçalho e campo de legenda/envio ficam fora dessa rolagem. Imagens e vídeos mantêm proporções, vídeos usam playsInline, nomes longos quebram linha e os controles têm área de toque de 44 px. A legenda usa fonte de 16 px e não abre o teclado automaticamente. Foram tratados os limites globais de role=dialog para evitar novo corte no contêiner externo.

O diálogo usa foco contido e cancelamento por X, fundo ou Escape, preserva as menções e impede cancelamento ou novo envio enquanto aguarda a confirmação. Ampliar e editar continuam abrindo os visualizadores já existentes, acima do diálogo de envio. Não há alteração de API, banco ou arquivos enviados anteriormente.

Validação: 15 testes existentes de envio, mídia, menções e leitura aprovados; TypeScript e build aprovados. Os componentes alterados passaram no ESLint; Chat.tsx permanece com os mesmos 14 erros e 4 avisos anteriores, sem novos problemas. A conferência visual em navegador/celular permanece pendente: o host do navegador e a conexão de captura nativa estavam indisponíveis nesta sessão. Alteração local, sem publicação.
