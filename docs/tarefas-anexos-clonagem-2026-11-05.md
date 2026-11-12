# Tarefas: anexos na criação, clonagem, checklists e modelos — 05/11/2026

Implementado nos arquivos locais do Rede NEX. Frontend e API devem ser publicados juntos.

- **Nova tarefa:** seção Anexos com seleção múltipla, arrastar arquivos, prévia e remoção antes de confirmar. Imagens, PDF, Word, Excel, vídeo e áudio usam o upload existente, até 20 MB por arquivo e 100 anexos. As imagens mantêm o editor de corte e marcação já disponível. O envio bloqueia o salvamento até terminar; em falha parcial, os anexos já enviados permanecem no formulário.
- **Clonar tarefa:** botão no detalhe prepara imediatamente o formulário preenchido. É possível revisar os dados, inserir/remover anexos e confirmar em Criar cópia. Cancelar não cria outra tarefa. A cópia recebe novos IDs/protocolo, fica A fazer e reinicia as etapas; comentários e histórico da original não são copiados. Os anexos existentes podem ser reaproveitados, com novas referências em task_files e remapeamento das etapas. A tarefa original e seus arquivos não são removidos nem alterados.
- **Nova checklist em tarefa existente:** o formulário já apresenta o nome e campos para múltiplas etapas. Checklist e etapas são gravadas na mesma transação, com bloqueio da tarefa, limite de 30 checklists/500 etapas e rollback em falhas. O campo de próxima etapa continua disponível após salvar. A chamada antiga somente com nome permanece compatível.
- **Modelos:** guardam estrutura, textos, planejamento, pessoas e checklists, sem arquivos ou imagens na descrição. A regra é aplicada na API, inclusive ao copiar uma tarefa ou outro modelo. Modelos antigos também são carregados sem suas mídias herdadas. É possível adicionar anexos novos ao criar uma tarefa a partir do modelo, sem perder esses uploads.

- **Anexos nas etapas durante a abertura:** cada etapa do formulário Nova tarefa oferece Adicionar anexos, com seleção múltipla, colagem de imagens, prévia e remoção. Os arquivos ficam separados dos anexos gerais e são vinculados aos novos IDs das etapas na transação de criação. Excluir uma etapa/checklist do rascunho remove seus vínculos de arquivo. Etapas vazias com anexos precisam ser descritas antes de confirmar. A integração local também verifica três etapas em duas checklists, com PDF, imagem e áudio, e seu remapeamento ao clonar.

Não há migração adicional de banco para estas quatro alterações: utilizam as tabelas e colunas existentes de tarefas, task_files e checklists. A implantação deve ter as migrações anteriores do módulo de tarefas, incluindo 20261026_task_collaboration.sql e 20261029_task_blueprints.sql. Nenhum banco remoto foi alterado durante o desenvolvimento.

A criação de tarefas/modelos/checklists e a leitura da cópia passam pelo router task-authoring.mjs, usando a sessão e as permissões já existentes. A clonagem e a criação de modelos verificam o acesso à origem; a confirmação da cópia verifica novamente esse acesso. Compartilhamento de modelos também é conferido ao instanciar uma tarefa. As notificações da criação continuam no fluxo existente.

Validação local:

- Cinco testes focados de estrutura, clonagem, limpeza de mídias, compatibilidade de modelos antigos e validação de anexos: aprovados.
- Um teste de integração HTTP com os endpoints e repositório reais, PostgreSQL local descartável e identidade fictícia: aprovado. Cobre criação com anexos, vínculo a etapas, checklist com múltiplas etapas, rollback, autorização, cópia com novos IDs e etapas pendentes, modelos sem mídia, novos anexos ao usar modelo e preservação da origem.
- TypeScript, ESLint dos componentes alterados e build de produção: aprovados. Sintaxe de 103 arquivos JavaScript da API, scripts e código compartilhado: aprovada.
- Suíte geral: 77 testes, 67 aprovados, nove integrações opcionais ignoradas e uma falha preexistente em hosting: privileged runtime or unexpected database is rejected. Essa política de implantação não foi alterada neste trabalho.
- Inspeção visual e interação com o seletor de arquivos em navegador ainda precisam ser confirmadas: a tentativa de abrir a prévia foi bloqueada por indisponibilidade do browser access host. Os testes HTTP verificam os dados e vínculos dos anexos; o endpoint de upload existente não foi substituído.

Teste rápido: node --test tests/task-authoring.test.mjs. A integração é opcional com RUN_TASK_AUTHORING_DB_TESTS=1, exclusivamente no cluster local de testes 127.0.0.1:55482; cria/remove seu banco descartável e usa um arquivo de ambiente exclusivo para não ler as credenciais de produção.
