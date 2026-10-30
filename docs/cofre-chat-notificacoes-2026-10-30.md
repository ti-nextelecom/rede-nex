# Notificações, áudio, leitura no chat e cofre pessoal

Implementado localmente em 30/10/2026, sem publicar ou migrar o banco de produção.

## Comportamento

- Avisos de chat, tarefas, projetos e demais notificações internas desaparecem após 3 segundos. A saída desliza para a direita; a preferência por movimento reduzido é respeitada. O aviso expirar não marca o registro como lido na central de notificações.
- O alerta sonoro é um único toque de aproximadamente 850 ms, com ataque suave, volume reforçado e decaimento. Navbar, avisos globais e chat usam a mesma implementação, com bloqueio de sobreposição. O controle de som é separado por conta no navegador e mantém compatibilidade com a preferência anterior.
- Áudios usam player próprio com ícones de reproduzir/pausar, posição, tempo e velocidade. A gravação tem microfone, relógio e onda de voz, com botões explícitos de enviar e cancelar. Trocar de conversa cancela a captura e libera microfone, animação e contexto de áudio. A captura pendente de permissão não pode iniciar em outro chat.
- Mensagens próprias na lista lateral exibem confirmação de leitura: marca cinza antes de ler, dupla marca colorida após leitura; grupos informam leitura parcial ou por todos no rótulo acessível e tooltip. O servidor calcula os números com base em `last_read_at`, sem nova migração para esse indicador.
- Há transições curtas nos controles da plataforma, destaque ao passar o mouse por conversas e mensagens e entrada suave ao trocar de chat. As áreas de clique permanecem na posição original.

## Cofre de senhas

Acesso pelo menu **Cofre de senhas**, rota `/senhas`. Inclui cadastro, busca, edição e exclusão confirmada de acessos; nome, usuário, senha, link HTTP/HTTPS e observações; gerador de senhas; cópia e revelação temporária; abertura do site em nova aba.

- Cada conta possui um cofre privado. Não há acesso administrativo ao conteúdo descriptografado via API.
- O navegador deriva uma chave AES-256 não extraível com PBKDF2-HMAC-SHA-256, 600.000 iterações e salt aleatório de 128 bits. AES-GCM usa IV novo de 96 bits a cada salvamento, tag de 128 bits e dados autenticados vinculados ao ID da conta.
- Todos os campos são criptografados juntos antes de sair do navegador. A senha mestra, a chave, títulos, logins, senhas, URLs e notas não são enviados em texto aberto, salvos em localStorage/sessionStorage ou registrados em logs por este módulo.
- A senha mestra tem de 12 a 256 caracteres, é apagada do formulário após o desbloqueio e **não pode ser recuperada pela equipe**. O navegador precisa oferecer Web Crypto em contexto seguro, como HTTPS ou localhost.
- Bloqueio manual, ao sair da aba e após 5 minutos sem atividade. Ao bloquear ou sair da rota/conta, chave e conteúdo deixam o estado acessível da interface; operações assíncronas antigas não reabrem o cofre.
- O banco armazena somente envelope criptografado, revisão e data. RLS está habilitada e forçada, com titular definido em transação pelo usuário autenticado; a API também filtra pelo titular. Campos extras e IDs de outra conta no corpo são recusados. O cabeçalho de titular precisa coincidir com a sessão ao salvar.
- Revisões impedem sobrescrever silenciosamente um cofre atualizado em outro dispositivo/aba. Em conflito, o usuário deve bloquear e abrir novamente. O formulário é mantido se o salvamento falhar.
- Não existe recuperação automática da senha mestra. Backups do banco preservam o envelope criptografado e continuam dependendo da senha mestra para abrir o conteúdo.

Referências dos mecanismos utilizados: [Web Cryptography API](https://www.w3.org/TR/webcrypto-1/), [OWASP Cryptographic Storage](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html) e [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

## Atualização do servidor

Nova migração: `server/migrations/20261103_password_vault.sql`. Aplicar frontend e API juntos, com backup antes das migrações. O migrador concede acesso à nova tabela à role da API e o verificador de implantação exige RLS habilitada e forçada. Nenhuma migração existente foi editada. Fotos, fundos e uploads dos usuários foram preservados.

## Evidências e limites

- TypeScript, ESLint dos componentes novos e compilação Vite aprovados.
- Testes de criptografia verificam ida e volta, chave não extraível, IV novo, recusa de senha errada, titular errado, adulteração, formato inválido, redução do KDF e links inseguros. Há testes de gerador de senhas, leitura de mensagens e agendamento de um único toque.
- Teste HTTP → repositório → PostgreSQL foi executado em banco descartável de loopback, com role sem SUPERUSER/BYPASSRLS. Cobriu autenticação ausente, outra conta, corpo inválido, cabeçalho incorreto, RLS direta e duas escritas concorrentes. Não carregou as configurações de produção. O banco descartável foi removido e o cluster de teste foi desligado.
- O inventário de migrações do teste de hosting estava limitado a duas migrações antigas e foi atualizado para refletir os arquivos atuais.
- O teste preexistente que exige recusa de SUPERUSER/BYPASSRLS continua falhando: `server/scripts/deploy-common.mjs` veio do GitHub com `requireSafeRole` vazio. Essa decisão de implantação não foi alterada nesta entrega. Os testes específicos do cofre usam uma role efetivamente restrita e passaram.
- Inspeção visual interrompida pelo Computer Use, que não conseguiu determinar a URL atual do Chrome com confiança. Não houve ação no navegador. A aparência desktop/mobile, microfone e reprodução no hardware real permanecem sem validação visual/auditiva; a duração/quantidade de toques foi validada por agendamento de nós de áudio.
