# Organização mobile — chat e tarefas — 10/11/2026

Ajustes locais para larguras de até 767 px, preservando os fluxos e as permissões existentes.

## Tarefas e plantões

- Cabeçalho e indicadores mais compactos para reservar espaço à lista vertical.
- Busca sempre visível. Envolvimento, ordenação e status ficam no botão Filtros, com indicação de opções ativas; os valores são mantidos ao recolher.
- Seletor de listas e criação de lista acessíveis também entre 640 e 767 px, sem a coluna lateral.
- Abas com rolagem horizontal e área de toque de 44 px.
- Lista com rolagem própria em telas altas. Em telas curtas, a área completa pode ser rolada para alcançar os controles e as tarefas.

## Tarefa, checklist e anexos

- Cabeçalho menor, fechar separado das ações, ações acessíveis por rolagem horizontal e configurações disponíveis até 767 px.
- Checklist com alvo de toque de 44 px para marcar a etapa. Texto em largura maior; responsável e exclusão em linha separada para gestores. Os controles de gestão indisponíveis não ocupam a linha do participante.
- Nova checklist, seleção de pessoas, anexos e formulário de tarefa organizados em uma coluna, com campos de 16 px e botões maiores.
- Rodapé de criação com Cancelar e Criar/Salvar em duas colunas e indicação das etapas acima.

## Chat

- Campo de texto em largura total. Clipe, ferramentas, áudio e envio em uma linha própria de ações.
- Ferramentas e menções posicionadas acima do campo; painéis de sugestões com limites de altura e rolagem.
- Ações superiores com rolagem horizontal e botões de 44 px; filtros da lista de conversas alinhados e com texto que pode quebrar linha.

## Verificação

TypeScript, lint de Tasks.tsx, análise PostCSS e build de produção verificados. O lint de Chat.tsx foi comparado ao arquivo anterior: não foram acrescentados problemas aos 14 erros e quatro avisos preexistentes.

A conferência visual e os testes de toque em aparelho continuam pendentes: a tentativa de abrir a prévia retornou “The browser access host is unavailable”. Não foram realizados envios nem alterações em dados reais. A API remota permanece em modo leitura. Nenhuma migração, publicação ou atualização de APK foi executada.
