# Contornos e preparação do APK Android — 10/11/2026

## Campo de comentário e contornos

O campo de comentário do Feed combinava a superfície arredondada externa com o fundo do input interno, que era forçado no modo escuro. O foco global também podia desenhar um segundo contorno dentro do conjunto.

O conjunto agora usa data-field-shell/data-field-part: há uma única superfície arredondada e o foco visível fica no contêiner. O input mantém fundo transparente, sem borda ou sombra própria. O tema escuro respeita inputs declarados transparentes. O campo e o botão de enviar possuem áreas de toque maiores em telas móveis; Enter respeita a composição do teclado.

## Integração Android

- Plugins oficiais adicionados: @capacitor/app 8.1.2 e @capacitor/keyboard 8.0.6, compatíveis com o core 8.6 instalado.
- Botão Voltar: esconde o teclado, tenta fechar o diálogo/menu ativo, volta para a lista de conversas ou navega na aplicação. Na tela inicial/login, minimiza o aplicativo.
- Teclado completo padrão: captureInput foi desativado. O modo anterior usava um InputConnection simplificado com limitações de entrada. O manifesto usa adjustResize.
- A altura visível acompanha a WebView, a navegação inferior é recolhida durante a digitação e o campo ativo é mantido na área rolável.
- SystemBars usa insetsHandling=css e viewport-fit=cover. O layout consome os recuos fornecidos pelo Capacitor para barras, recorte de câmera e botões de navegação, incluindo os casos em que o core já aplica padding nativo.
- Manifesto com CAMERA, RECORD_AUDIO e MODIFY_AUDIO_SETTINGS. O bridge existente solicita as permissões quando a câmera ou o microfone são usados. Não foi criado pedido de acesso indiscriminado aos arquivos do aparelho.
- Falhas de conexão têm uma página local com opção de tentar novamente.
- Anexos selecionados no Android sem MIME são normalizados por extensão compatível; arquivos vazios, incompatíveis ou maiores que 20 MB são rejeitados antes da leitura. O servidor continua responsável por validar o conteúdo recebido.

## Gerar o APK

`npm run apk:sync` executa TypeScript, build de produção e sincronização Capacitor. Foi executado com sucesso, incluindo os novos plugins e os recursos web.

`npm run apk:debug` executa o mesmo preparo e assembleDebug. Requer Android SDK configurado em ANDROID_HOME, ANDROID_SDK_ROOT ou android/local.properties, plataforma Android 36 e JDK 21. O script reconhece o JDK do Android Studio instalado no caminho padrão do Windows.

Saída esperada do APK de teste: `android/app/build/outputs/apk/debug/app-debug.apk`. Para a distribuição assinada, utilize a configuração de assinatura do projeto no Android Studio.

Nesta máquina, o JDK do Android Studio foi localizado, mas o Android SDK não foi encontrado nas variáveis, configurações locais ou caminhos usuais. O comando apk:debug foi executado e interrompido com esse diagnóstico. Portanto, nenhum APK novo foi gerado ou instalado nesta sessão e o código Java não foi compilado.

## Publicação e dependências da plataforma

O projeto está configurado para abrir `https://rede.nextelecom.net.br`. As correções web precisam ser publicadas nesse domínio para aparecer no APK; a sincronização local não atualiza o servidor. As mudanças de plugins, manifesto e configuração nativa também exigem gerar e instalar o APK atualizado.

O plugin de push que já existia foi preservado. Notificações em segundo plano e a configuração Firebase não foram validadas nesta alteração.

## Verificação

- 16 testes relacionados aprovados, incluindo três cenários novos de anexos Android e navegação.
- TypeScript e build de produção aprovados; novos módulos passaram no ESLint. Feed, App, main e chatApi sem novos problemas; Chat.tsx mantém os 14 erros anteriores, sem acréscimos.
- CSS analisado com PostCSS e manifesto validado como XML, com verificação das permissões e do modo de teclado.
- Capacitor sync concluído; configuração, registro dos plugins e cópias de HTML, página de conexão e fonte conferidos por conteúdo/hash.
- Conferência visual e testes no aparelho pendentes. O navegador de validação retornou “The browser access host is unavailable”.
- Alterações locais, sem publicação, envio de mensagens ou mudanças no banco remoto. VITE_REMOTE_READ_ONLY permanece true no ambiente de desenvolvimento.

Referências consultadas: https://capacitorjs.com/docs/apis/system-bars e código-fonte das versões instaladas em node_modules/@capacitor.
