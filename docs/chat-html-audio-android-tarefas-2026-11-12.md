# Chat, notificações Android e tarefas — 12/11/2026

## Mudanças

O chat aceita arquivos `.html` e `.htm`, até 20 MB, e amplia a compatibilidade de áudio para MP3, M4A, WAV, WebM, OGG/Opus, AAC, FLAC e AMR, incluindo os nomes de MIME usados por provedores Android. O servidor e o seletor usam a mesma normalização. A reprodução depende do suporte do dispositivo ao codec; o arquivo original pode ser baixado.

HTML é entregue como download, com `Content-Disposition: attachment`, `application/octet-stream`, `nosniff` e CSP sandbox. O visualizador não executa HTML nem abre o blob HTML como página da plataforma. Imagens, vídeos, PDFs e áudios mantêm os visualizadores existentes.

Em tarefas, o padrão passa a ser Todas as tarefas. Todos os estados são incluídos, inclusive concluídas e canceladas, para as tarefas já autorizadas pela API: criadas pelo usuário, sob sua responsabilidade, com sua participação ou observação. O filtro de pendências é explícito. Voltar a Todos ou Todas as listas limpa o filtro implícito de pendências/concluídas, sem ampliar acesso a tarefas de terceiros.

## Causas corrigidas no Android

O componente de registro de push não estava montado na aplicação. Agora ele instala os callbacks antes de registrar o aparelho, trata a permissão do Android, refaz o cadastro após falhas e remove somente os próprios listeners na troca de conta. Em Perfil > Configurações, o aplicativo oferece Ativar notificações do Android para repetir o registro.

O serviço customizado agora preserva a ponte de renovação de tokens do Capacitor, e o manifesto mantém um único serviço responsável por FCM. Há canal, ícone de status e abertura da conversa/mensagem ao tocar. Mensagens de dados com prioridade alta são exibidas pelo serviço nativo, inclusive quando a interface web não está aberta. O canal e a permissão também precisam estar habilitados nas configurações do aparelho.

A API registra o token na sessão autenticada. A migração `20261112_android_push.sql` cria/adapta a tabela legada de tokens e adiciona uma fila durável. Novas notificações entram nessa fila pelo banco. O worker respeita conversas silenciadas, leitura, conta ativa, expiração/revogação da sessão e remoção do participante; repete falhas temporárias e remove tokens inválidos. Trocar o token de conta não entrega mensagens antigas à conta nova. O envio FCM anterior foi substituído para evitar duplicação.

O compartilhamento Android aceita áudio e HTML, preserva o nome real informado pelo provedor de arquivos e limita o tamanho a 20 MB. Áudios compartilhados usam o formato de mensagem de áudio do chat. O APK usa versão 1.0.1 / versionCode 3.

## Atualização da API na VM

O código foi preparado localmente; o banco de produção e a VM não foram alterados. Aplique a API e a migração nova pelo fluxo de backup/atualização de [README_DEPLOY_VM.md](../README_DEPLOY_VM.md). A versão antiga da API, sem a nova migração e o worker, não entrega este fluxo de push.

A conta de serviço Firebase da API é privada e diferente do `google-services.json` do Android. Use o mesmo projeto Firebase do APK. Preserve o arquivo privado já existente, se configurado. O caminho legado `server/firebase-service-account.json` continua aceito. Para guardar a chave fora da aplicação, configure no ambiente privado da API:

```dotenv
FIREBASE_SERVICE_ACCOUNT_PATH=/opt/rede-nex/private/firebase-service-account.json
# Opcional: deve corresponder ao project_id da conta de serviço e do APK.
FIREBASE_PROJECT_ID=SEU_PROJETO_FIREBASE
```

Também são aceitos `GOOGLE_APPLICATION_CREDENTIALS` ou ADC explicitamente habilitado por `FIREBASE_USE_ADC=true`. A conta de serviço precisa de autorização para enviar mensagens FCM nesse projeto. A configuração PM2 inclui essas variáveis; reinicie a API pelo fluxo de atualização depois de configurá-las.

Valide a presença e a estrutura da credencial sem imprimir chaves:

```bash
NODE_ENV=production REDE_NEX_ENV_FILE=/caminho/real/.env node server/src/fcm.mjs --check
```

O comando não envia notificações, não modifica o banco e não comprova a entrega a um aparelho. A chave privada não deve ser colocada no APK, em `public/` ou no GitHub. O diagnóstico desta máquina indicou ausência da conta de serviço local; a configuração real da VM ainda precisa ser conferida.

## Gerar o APK no outro computador

1. Atualize o checkout com as alterações desta entrega, preservando `google-services.json`, o SDK local e a chave usada para assinar o aplicativo.
2. Instale as dependências com `npm.cmd ci` e execute `npm.cmd run apk:sync`. Esse comando compila o frontend com `/api` e sem o modo de leitura do ambiente de desenvolvimento, e sincroniza os plugins Android.
3. Abra a pasta `android` no Android Studio, sincronize o Gradle e gere o APK com a mesma assinatura da versão instalada.
4. Atualize o aplicativo, abra-o, entre na conta e permita notificações. Se a permissão já foi negada, habilite-a nas configurações do Android e repita Ativar notificações do Android no perfil.

O SDK Android fica no outro computador. Nenhum APK foi compilado, instalado ou testado em aparelho nesta máquina. As mudanças nativas exigem um APK novo; apenas recarregar o site não atualiza o serviço Android.

## Conferência no aparelho

Com API/migração/Firebase e APK atualizados, envie uma mensagem nova de outra conta em conversa não silenciada. Confira o alerta com o aplicativo em segundo plano e com a tela apagada, e se o toque abre a mensagem correta. Confira também silêncio, logout e troca de conta. Forçar a parada do aplicativo nas configurações do Android pode impedir entregas até que ele seja aberto novamente.

Referências: [Capacitor Push Notifications v8](https://capacitorjs.com/docs/apis/push-notifications), [recebimento FCM no Android](https://firebase.google.com/docs/cloud-messaging/android/receive-messages).

## Validacao local

A suite completa passou com 97 testes, sem falhas nem testes ignorados, incluindo PostgreSQL local isolado e requisicoes reais de upload/download na API. A verificacao de tipos e a compilacao web passaram; 110 arquivos de backend, shared e deploy tiveram a sintaxe validada. Os componentes React alterados foram revisados com ESLint. O pacote de VM tem manifesto e SHA256. Nenhum teste enviou push real ou alterou o banco remoto.

A compilacao Vite ainda sinaliza avisos preexistentes de CSS e carregamento de modulos; eles nao impediram a geracao. A compilacao Java/Gradle e a entrega fisica no Android permanecem para o computador com SDK e um aparelho, conforme acima.
