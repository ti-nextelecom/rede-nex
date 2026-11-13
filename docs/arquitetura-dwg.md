# Importação DWG no módulo Arquitetura

Use **Importar projeto / DWG** na galeria ou **Importar referência** no editor. O leitor verifica a assinatura binária, aceita versões reconhecidas entre R11/R12 e 2018, até 20 MB, e processa em Web Worker com limite de dois minutos. A compatibilidade efetiva depende das entidades de cada arquivo. Arquivos inválidos são recusados sem alteração do original.

O DWG vira uma base visual 2D rasterizada para os equipamentos e desenhos editáveis do NEX. A geometria original deve ser editada em um aplicativo CAD. Desenhos com objetos distantes recebem vistas regionais e uma visão geral. Hachuras, objetos incorporados e algumas entidades CAD podem não aparecer. O painel indica a visualização parcial. Confira os detalhes técnicos no CAD original.

Cada vista começa com **escala pendente**, sem supor metros, centímetros ou milímetros. Clique em **Calibrar**, marque dois pontos e informe a distância real em metros. Calibre cada vista usada no projeto. Os objetos NEX já desenhados mantêm suas medidas.

Uma cópia binária exata é guardada em IndexedDB, vinculada ao usuário e ao SHA-256. **Baixar original DWG** verifica novamente o hash. O arquivo escolhido permanece intocado. O original fica somente neste navegador/dispositivo. A base visual e a identificação acompanham o documento salvo no servidor ou exportado em JSON. Limpar os dados do navegador remove a cópia local, portanto mantenha seu arquivo original. Este recurso usa o documento JSON existente no banco.

O leitor `@mlightcad/libredwg-web` 0.8.8 usa GNU GPL v3. A licença acompanha a aplicação em `public/licenses/libredwg-web/COPYING`. [Código-fonte](https://github.com/mlightcad/libredwg-web).

O arquivo particular do cliente e os artefatos de análise ficam em `.cache/architecture-imports`, ignorados pelo Git e excluídos dos pacotes de distribuição.
