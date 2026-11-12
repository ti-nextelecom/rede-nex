# Sincronização com GitHub — 12/11/2026

O projeto local incorporou o commit `b07a466` de `origin/main`, por meio do merge local `941fe84`.

## Alterações recebidas

- Chat mobile: ajustes do painel de ferramentas e do envio de arquivos.
- Android: canal de notificações, abertura de conversa por link, serviço de mensagens, resposta por notificação e compartilhamento para o app.
- Perfil: campo AnyDesk ID e ferramenta correspondente do assistente.
- Atualização dos arquivos de API, tarefas e deploy que já tinham correções preservadas localmente.

## Preservação e integração

Foi criada uma cópia verificada dos 97 arquivos locais alterados/não rastreados em `.cache/github-sync-20261112-1794487954687/`, com manifesto, hashes e patch. A branch `backup/local-before-pull-20261112-1794487954687` e o stash foram mantidos. Os oito arquivos que passaram a ser rastreados pelo remoto conferem com as versões locais preservadas.

Conflitos de CRLF/LF foram tratados em rascunhos com comparação normalizada. Os conflitos de conteúdo foram revisados individualmente. As verificações de RLS, role restrita, checksum, trava e transação do migrador foram mantidas. O manifesto Android conserva permissões e hardware opcional, adicionando os componentes recebidos do GitHub; a atividade combina canal de notificações, tratamento de intents e EdgeToEdge.

O chat mantém o modal de anexos com portal, limites pela área visível, prévia de áudio e validação de arquivo. O seletor passou a usar label, incorporando a alteração recebida, com acesso por teclado e apenas um input, sem duplicação no painel de ferramentas.

## Banco e implantação

Não houve alteração no banco remoto, publicação na VM, push para o GitHub ou geração/instalação de APK durante esta sincronização.

O código novo utiliza `public.users.anydesk_id`. O commit não inclui migração para essa coluna. Antes de publicar esta revisão, confirme se ela já existe no banco da VM; se não existir, prepare a migração correspondente. Os testes com banco fictício não comprovam a existência dessa coluna na instalação real.

Os pacotes de VM gerados em 10/11 antecedem este commit. Para publicar as atualizações de 12/11, será necessário gerar um pacote novo após revisar os requisitos do banco. Nesta solicitação, o objetivo é a atualização e validação do checkout local.

## Validacao concluida

TypeScript aprovado, sintaxe de 107 arquivos verificada e 85 testes aprovados, sem falhas ou testes ignorados, com banco ficticio local. Build Vite de producao aprovado; XMLs Android e CSS mobile analisados. O lint do chat manteve os 14 erros e 4 avisos anteriores, sem regressao. Foram corrigidos dois erros recebidos do remoto: declaracao duplicada de anydesk_id e ausencia desse campo ao carregar o formulario de perfil. O frontend foi sincronizado ao projeto Android com os tres plugins existentes; nao houve compilacao de APK nem teste em aparelho. O PostgreSQL local descartavel foi encerrado.
