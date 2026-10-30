# Chat: leitura privada, menções, 3 segundos e desempenho

Implementado no código local, sem publicação e sem novas migrações nesta etapa.

- Conversas privadas mostram dois vistos azuis nas mensagens enviadas que o destinatário leu, tanto nas mensagens quanto na lista lateral. A conversa aberta confirma leitura de novas mensagens somente quando está visível, com foco e no final do histórico. O servidor publica a confirmação aos demais participantes. Retornos antigos de polling não podem desfazer uma confirmação mais recente.
- Avisos internos do chat, notificações globais e Navbar expiram em 3 segundos. A saída lateral começa aos 2,76 segundos e dura 240 ms. Expirar um aviso não exclui o registro da central nem o marca como lido.
- Avisos de menção contêm conversa e ID da mensagem. Ao clicar, a plataforma carrega o contexto autorizado da mensagem, centraliza e destaca a mensagem exata, inclusive se estiver fora da página atual do histórico. Não troca a conversa automaticamente enquanto a pessoa escreve em outro chat.
- A central de notificações inclui menções. Avisos internos, Web Push e ação de push nativo preservam o destino da mensagem. Conversas silenciadas continuam sem aviso sonoro interno de menção.
- As legendas de imagens, vídeos, áudios e documentos suportam menções. A legenda de mídia oferece seleção de participantes e @todos nos grupos. URLs, dados de mídia, cabeçalhos de encaminhamento e nomes de arquivo não são interpretados como menções. Somente participantes reais da conversa são notificados; nomes ambíguos não são associados à pessoa errada.
- Imagens e vídeos carregados após o salto podem ajustar o posicionamento por até 2 segundos. Rolar com mouse ou toque interrompe esse ajuste. A solicitação de contexto continua sujeita à validação de participação no servidor.

## Otimização aplicada

- Digitar altera o rascunho em memória imediatamente; a serialização e gravação de todos os rascunhos foi agrupada em uma pausa de 250 ms. Troca de chat/rota, ocultação da página e pagehide forçam a gravação pendente. Envios confirmados continuam apagando somente a versão enviada do próprio rascunho.
- Histórico, linhas de mensagem, linhas da lista lateral e avatares são memorizados. Handlers estáveis consultam o estado atual, mantendo menus, respostas, encaminhamento, reações e perfis atualizados.
- O polling reutiliza objetos e arrays sem mudanças. Uma edição substitui somente a mensagem correspondente, preservando as demais referências para que não precisem renderizar de novo.
- O redimensionamento do campo de texto foi agrupado por frame; o histórico não é medido/rolado desnecessariamente a cada tecla. Consultas de participantes para sugestões de @ compartilham a mesma solicitação/cache e respostas de outra conversa são descartadas.
- Trocar de chat não desmonta todo o painel e campo de digitação. Uma animação curta atua somente no histórico, é cancelada na troca seguinte e respeita movimento reduzido. O filtro de brilho sobre o conteúdo inteiro da mensagem foi substituído por um contorno leve ao passar o mouse.

## Evidências

- TypeScript, sintaxe do servidor e compilação Vite aprovados.
- 9 testes focados aprovados: mensagens privadas e grupos, evento de leitura e isolamento por participantes, preservação de referências em 1.000 mensagens, edição de uma única linha, 500 alterações de rascunho sem gravação síncrona, flush e isolamento entre contas, menções em mensagens/legendas, links e rejeição de redirecionamentos externos.
- Suíte ampla: 44 aprovados, 5 testes de banco não ativados e a mesma falha preexistente de implantação em `requireSafeRole`, já presente na versão recebida do GitHub.
- ESLint dos componentes novos sem erros; `PushManager` mantém o aviso anterior de dependência do efeito.
- A conferência pelo Computer Use foi interrompida porque a ferramenta não conseguiu determinar a URL atual do Chrome com segurança. Não houve ação de página nem teste em conversas reais. Não se declara medição de latência no navegador ou validação visual em dispositivos reais; as reduções de trabalho foram verificadas por testes de referências, gravações e revisão dos caminhos de renderização.

A migração de cofre de senhas da entrega anterior (`20261103_password_vault.sql`) continua sendo necessária para publicar aquele módulo; os ajustes deste documento não acrescentam outra migração.
