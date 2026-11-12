# Sincronização com GitHub — 10/11/2026

O projeto local integrou `origin/main` no commit `dd3f240f66d8ab0e458b561318e574541c3f66b4`, por meio do merge local `d32fdb5`.

## Atualizações recebidas

- `ea499a0`: questionário comportamental v22, revisão das perguntas e reinício do rascunho quando ele pertence a uma versão antiga do questionário. Avaliações concluídas continuam preservadas no histórico.
- `dd3f240`: anexos de áudio no chat, identificação como mensagem de áudio e ajustes de tema/layout Android 15+.

## Integração local

Os ajustes locais anteriores foram preservados, incluindo tarefas/checklists, aparência e fontes, Arquitetura, Perfil Comportamental, contornos, anexos mobile e preparação do APK/VM.

Houve conflitos no manifesto Android e no chat. A integração manteve as permissões de câmera e microfone, os recursos opcionais de hardware e o comportamento de teclado. O modal de anexos continua sendo o componente mobile com portal e limite pela área visível; ele passou a aceitar áudio e permite ouvir uma prévia antes de enviar. Os seletores de arquivo aceitam áudio e mantêm a validação de formato/tamanho e normalização do MIME.

Os arquivos Android recebidos do remoto foram mantidos, incluindo os estilos específicos de API 35. A compilação/instalação do APK é separada da publicação da API/frontend na VM e requer SDK Android e homologação em aparelho.

Uma cópia com hashes dos 96 arquivos locais alterados/não rastreados foi criada em `.cache/github-sync-20261110-1794342830445/`, acompanhada do patch, relatório de restauração e identificação do stash. A referência `backup/local-before-pull-20261110-1794342830445` e o stash permanecem disponíveis para recuperação. Não houve envio de commits ao GitHub, publicação na VM ou alteração no banco de produção durante a sincronização.

O pacote anterior `rede-nex-2026-11-10T19-55-08-868Z.tar.gz` antecede esses commits e não os contém. Para instalar esta revisão, utilize o novo pacote e seu checksum, conforme o roteiro de aplicação entregue após a sincronização.

## Validacao da integracao

A checagem TypeScript e a sintaxe de 112 arquivos foram aprovadas. Os 85 testes passaram, sem falhas nem testes ignorados, com banco ficticio local: o ensaio da v22 confirmou reinicio de rascunho antigo, reaproveitamento do rascunho da versao atual e preservacao dos resultados concluidos. O modal de anexos passou no ESLint e os XMLs Android foram analisados. Nao houve homologacao em aparelho Android nesta sincronizacao.
