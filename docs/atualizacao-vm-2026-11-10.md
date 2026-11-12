# Atualização consolidada para VM — 10/11/2026

Este pacote atualiza a instalação existente do Rede NEX. A geração é local; a aplicação na VM é uma operação posterior. O guia completo é `README_DEPLOY_VM.md`, incluído no arquivo compactado.

## Conteúdo

- Chat: envio e visualização de mídias, anexos no mobile, menções, confirmação de envio, leitura e ajustes de desempenho presentes no código atual.
- Tarefas: anexos na criação e nas etapas do checklist, clonagem com edição, modelos sem mídias, criação de checklist com etapas, marcação por participantes e listagem vertical.
- Layout mobile, correções de contorno dos campos e fonte Open Sans compartilhada com o chat, hospedada na própria plataforma.
- Arquitetura 2D, projetos e modelos compartilhados com a equipe.
- Perfil Comportamental vinculado aos usuários, avatares, acesso dos gestores pelo organograma e visão completa dos administradores.
- Preferências de aparência, bordas de conquistas, cofre e demais módulos presentes na versão atual.
- API, código compartilhado, frontend compilado, documentação, dependências de produção e 14 migrações versionadas.

## Preservação da instalação

O atualizador mantém `.env`, uploads, fotos, papéis de parede, anexos e dados existentes. Não copie o `.env.example` sobre o ambiente real. Não restaure dumps, não execute importadores e não substitua o banco para atualizar.

As quatro imagens oficiais da marca são recuperadas da instalação atual antes da parada da API. Se estiverem ausentes, o atualizador interrompe e informa quais arquivos fornecer. Ele não copia fotos privadas para dentro do frontend.

O pacote não contém credenciais, uploads particulares nem backup de dados. Guarde também uma cópia dos uploads em armazenamento separado: o dump PostgreSQL não contém esses arquivos.

## Requisitos e banco

Confirme na VM a pasta ativa, nome do processo PM2, porta, domínio HTTPS, diretórios persistentes e espaço em disco. Os caminhos de exemplo no guia não foram verificados na VM. Use Node 22.12+ ou 24 LTS e os clientes PostgreSQL compatíveis com o servidor.

O banco precisa receber apenas as migrações pendentes. O atualizador consulta o histórico e valida os checksums antes de aplicá-las em transação. As migrações de Arquitetura (`20261105_architecture.sql`) e Perfil Comportamental (`20261106_behavioral_profiles.sql`) estão incluídas; não as execute manualmente fora do fluxo de backup.

A checagem de segurança da role da API foi restaurada conforme o contrato de implantação e os testes: `DATABASE_URL` deve usar uma role `NOSUPERUSER NOBYPASSRLS`, com os acessos necessários à aplicação. Se a VM usa `postgres` ou outra role privilegiada, o pré-teste interrompe antes da parada da API. O administrador deve preparar uma role própria e verificar seus privilégios; não altere os atributos do usuário `postgres`.

Backup e migração podem usar conexões administrativas separadas, pelo ambiente protegido do operador, para o MESMO banco/servidor. O backup integral exige permissão para ler os dados protegidos por RLS. O PM2 não repassa essas conexões administrativas à API. Confira os detalhes no guia principal.

O instalador também concede às tabelas de preferências de aparência e bordas os acessos necessários quando a role de migração é diferente da role da API. Nenhuma migração antiga foi reescrita nesta preparação.

## Aplicação

Transfira o `.tar.gz` e seu `.sha256` juntos para uma pasta privada na VM, fora da instalação ativa e no mesmo filesystem. Use o mesmo usuário proprietário da aplicação e do PM2.

```bash
sha256sum -c rede-nex-<VERSAO>.tar.gz.sha256
mkdir -m 700 release-novo
tar -xzf rede-nex-<VERSAO>.tar.gz -C release-novo
cd release-novo
node deploy/verify-release.mjs .
bash deploy/update.sh /opt/rede-nex/deploy_v2 /opt/rede-nex/backups
```

Substitua `<VERSAO>` pelo nome recebido e confirme os dois caminhos antes de executar. Configure `REDE_NEX_ENV_FILE` absoluto se o ambiente estiver fora da pasta ativa e `REDE_NEX_PM2_NAME` se o processo tiver outro nome. Forneça as conexões de backup/migração pelo ambiente protegido previsto no guia.

O atualizador verifica dependências, manifesto e pré-requisitos, faz breve parada da API, cria backup validado, aplica migrações, troca código/dependências e reinicia o PM2. Só confirma sucesso quando `/api/health` apresenta o ID exato do novo release. Em falha, tenta restaurar o código anterior e conserva o backup. Não restaura o banco automaticamente.

Depois, valide saúde local e HTTPS, login, fotos e fundos antigos, chat/WebSocket, anexos no mobile, criação e clonagem de tarefas, checklists como participante, Arquitetura, Perfil Comportamental como gestor/administrador e os demais módulos usados pela equipe.

## APK Android

A VM recebe o frontend e a API. Alterações nativas de teclado, permissões, navegação e áreas seguras exigem gerar e instalar um novo APK separadamente. Os arquivos Android permanecem no projeto local; este pacote de servidor não contém um APK. O SDK Android ainda precisa ser configurado para gerar o aplicativo. Não houve validação em aparelho físico nesta preparação.

A dependência `firebase-admin`, já utilizada pelo código do servidor, agora integra o lockfile de produção da raiz. Isso não configura nem valida notificações push nativas: a conta de serviço existente, o cadastro de tokens e a integração Android precisam ser homologados separadamente. A conta de serviço privada não é incluída nem sobrescrita pelo pacote.
