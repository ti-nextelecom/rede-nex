# Ajustes de chat e tarefas — 10/11/2026

## Comprovantes no chat do aplicativo

O clipe de anexar arquivo ou comprovante fica diretamente na barra de mensagem, fora do menu recolhido de ferramentas. O seletor aceita PDF, imagens e os demais formatos já disponíveis. Ao selecionar o arquivo, o fluxo mantém a prévia responsiva, legenda, edição de imagem, confirmação de envio e tratamento de falha existentes. Nenhum arquivo ou mensagem anterior é removido.

## Tarefas e plantões em lista

A visualização Lista usa uma sequência vertical única, com uma tarefa por linha em desktop e celular. Cada linha mostra título, status, prioridade, prazo, participantes e progresso quando disponíveis. O Planejador usa a mesma disposição por colaborador. Abrir uma lista personalizada, como Plantões, seleciona a visualização Lista; os outros modos continuam disponíveis por escolha do usuário.

## Participantes e progresso da checklist

A regra canToggleTaskChecklist permite que os participantes da tarefa, além de criador, responsável e administradores já autorizados, marquem ou desmarquem qualquer etapa. Um participante não precisa ser o responsável individual daquela etapa. Observadores e usuários externos continuam sem permissão de execução.

A rota PATCH de etapa verifica sessão, permissão e vínculo tarefa/checklist/etapa. Requisições de participantes aceitam exclusivamente completed booleano; texto, responsável, participantes e observadores não podem ser alterados junto com o progresso. A edição da estrutura mantém a permissão anterior de gestão. A interface usa a mesma regra e mantém desabilitados os controles de estrutura.

## Verificação e publicação

- 25 testes relacionados passaram, incluindo cinco cenários HTTP novos de autorização, isolamento entre tarefas e validação de campos.
- Uma integração adicional com HTTP, repositório real e PostgreSQL descartável local passou, confirmando persistência após marcar e desmarcar. A base fictícia foi removida e o processo PostgreSQL iniciado para o teste foi encerrado.
- TypeScript e build de produção aprovados. Tarefas, a nova rota e o helper passaram no ESLint. Chat.tsx mantém 14 erros e quatro avisos anteriores, fora do trecho alterado.
- A conferência visual e o teste em aparelho Android permanecem pendentes. A ferramenta de interface interrompeu a operação por não conseguir determinar a URL atual da janela com confiança. Não houve envio de comprovantes reais.
- Sem nova migração de banco e sem alterações remotas. É necessário publicar frontend e API juntos. O aplicativo Android está configurado para carregar o domínio da plataforma; esta alteração não modifica código nativo nem gera APK.
