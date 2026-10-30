# Revisão do front-end — 16/10/2026

## Escopo

Revisão da estrutura de rotas, componentes de navegação, estilos compartilhados e famílias de páginas do REDE NEX. Implementação concentrada em Chat e Projetos, conforme a prioridade indicada durante a revisão.

## Melhorias aplicadas

- Chat: colunas com larguras adequadas, painel de pessoas sob demanda em telas menores, rolagem independente e compositor sem sobreposição com a navegação inferior.
- Tipografia do chat: nomes de conversas de 17 px, mensagens e campo de digitação de 18 px, textos auxiliares maiores e ícones principais de 22 px.
- Bordas arredondadas no contêiner do chat, conversas, painéis, mensagens, campos e botões.
- Filtros de conversas por Todas, Não lidas e Grupos; busca por nome e conteúdo, com opção para limpar filtros.
- Ferramentas do compositor abrem acima da digitação em telas compactas; emojis reorganizados para caber no celular.
- Menu de mensagens em popover com ajuste automático de posição e fechamento por Escape, evitando recortes pela área de rolagem.
- Botão de criar story separado do botão de visualizar, corrigindo o aninhamento inválido de botões e preservando o acesso por teclado.
- O atalho flutuante do Copiloto deixa de cobrir o botão de envio do chat; o módulo continua acessível pela navegação.
- Projetos: cabeçalho, métricas, cartões, prazos, responsáveis, detalhes e formulários com hierarquia visual e tipografia mais legíveis.
- Portfólio: busca, contagem dos resultados, filtro de Atenção, ordenação por prazo/progresso/nome e abertura de cartões por botão acessível ao teclado.
- Visão geral: projetos ativos separados dos concluídos, próximos marcos ordenados por data futura e identificação de prazos vencidos na contagem de atenção.
- Estilos de Projetos limitados ao módulo e aos seus modais; variáveis CSS locais renomeadas para preservar os tokens globais.
- Navegação: entrada para a Central de trabalho, remoção da duplicidade de Conexão RH e fallback visual para o logo ausente no checkout local.
- Contraste dos textos auxiliares aumentado no tema compartilhado.

## Verificação

Navegação autenticada no ambiente local com dados remotos em modo somente leitura. Foram conferidos o chat em desktop/notebook e celular, filtros, buscas, ferramentas e emojis; o portfólio, a ordenação, abertura de detalhes, modal de nova etapa e responsividade. Nenhum formulário foi enviado durante a conferência.

O empacotamento direto do Vite passou. A checagem TypeScript completa ainda encontra problemas anteriores em outros módulos, como Chat_v2, Prestação de Contas, Departments e Users. A revisão ESLint também identifica dívida técnica anterior no chat (blocos catch vazios, tipos any e dependências de hooks); esses diagnósticos não equivalem a falha do empacotamento.

## Pontos identificados para uma próxima revisão

- Consolidar gradualmente as famílias visuais das páginas com cabeçalhos de tamanhos diferentes e estilos próprios.
- Corrigir os erros TypeScript e ESLint anteriores antes de considerar o pipeline completo de produção aprovado.
- Revisar os bundles maiores, especialmente Wiki, mantendo o carregamento por rota já utilizado pelo aplicativo.
- Centralizar os assets de marca ausentes no checkout e os padrões de modais acessíveis.

As alterações são locais. A API e o banco de produção não foram alterados e não houve publicação.

## Capturas da conferência

- [Chat em notebook](frontend-review/chat-desktop.png)
- [Chat no celular](frontend-review/chat-mobile.png)
