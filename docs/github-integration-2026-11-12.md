# Integração das atualizações do GitHub — 12/11/2026

A branch local `main` incorporou os commits `2914050` (foto do remetente na notificação Android) e `3f4ef98` (menções nas conversas de tarefas), recebidos de `ti-nextelecom/rede-nex`. As 53 alterações locais anteriores foram preservadas em cópia com manifesto e SHA256, branch de backup e stash, antes do avanço da branch.

## Adaptações necessárias

A foto passou a usar `notifications.actor_photo_url` na fila durável Android já implementada localmente. O caminho antigo de envio FCM direto não foi reativado. O serviço nativo preserva a renovação do token pelo Capacitor, a permissão Android, o ícone adequado, o link para a mensagem e o receiver explícito de resposta. O alerta aparece imediatamente; a foto é adicionada sem um novo som. O download usa HTTPS, limite de 2 MB, redução da imagem e timeout. A sessão só é enviada ao domínio da própria plataforma, sem seguir redirecionamentos.

As menções nas tarefas agora consideram apenas pessoas vinculadas à tarefa, excluem o autor e distinguem nomes ambíguos, endereços de e-mail e links. Quem é mencionado recebe o aviso de menção em lugar de um segundo aviso genérico. Não há notificação com o título da tarefa para colaboradores externos à sua lista de acesso. `@todos` segue o mesmo público autorizado.

O seletor de menções preserva o texto após o cursor, permite seleção com setas/Enter ou toque/clique, respeita composição de texto e permite fechar com Esc. O nome fica azul e pode exibir a identificação da pessoa vinculada. Anexos e texto permanecem preservados quando um envio falha. O seletor tem altura limitada para telas pequenas.

Foram mantidas as alterações locais de HTML/áudio no chat, troca de senha no perfil, troca obrigatória para colaboradores, tema escuro dos artigos da Wiki e filtro Todos das tarefas.

## Validação e publicação

A validação usa testes de lógica e API/banco PostgreSQL descartável em localhost, sem notificar pessoas reais. O fluxo de release verifica os tipos, a sintaxe, os testes e a compilação. A conferência do Android nesta máquina é de código/XML e sincronização do projeto; o SDK e a compilação do APK ficam no outro computador. A entrega real de push/foto/resposta precisa ser conferida no aparelho com Firebase e API configurados.

As duas atualizações recebidas não acrescentam migração. O conjunto local continua incluindo a migração Android `20261112_android_push.sql`, preparada anteriormente e necessária para a fila. A integração não aplicou migrações no banco remoto nem publicou na VM ou enviou as adaptações locais ao GitHub.