# Fonte global do Rede NEX — 10/11/2026

A família configurada no chat, Nex Chat Open Sans (Open Sans), passou a ser o padrão global da interface. A definição está centralizada em src/styles/typography.css, importada pelo CSS principal e usada também pelo font-sans do Tailwind.

Feed, Wiki, JRH, Projetos e os menus do próprio chat passam a usar a mesma variável de família. Os tamanhos e espaçamentos de cada tela são preservados, assim como os trechos técnicos monoespaçados, o texto de marca e as imagens dos usuários.

Os dois arquivos TTF antes referenciados pelo chat não existiam no checkout. Foram incluídas as versões variáveis normal e itálica oficiais, com pesos 300–800 e os caracteres portugueses. A fonte normal é pré-carregada. Os arquivos e a licença acompanham a aplicação, dispensando carregamento de fontes pelo Google Fonts.

Fonte original: https://github.com/googlefonts/opensans
Revisão: bd7e37632246368c60fdcbd374dbf9bad11969b6
Licença incluída: public/fonts/OFL-OpenSans.txt

- Normal: 532636 bytes; SHA256 36643644f318a812aab2d2ed3bb98f8cf0872527f835fe9398d95fe6b9adb878.
- Itálico: 583992 bytes; SHA256 fe269381e992f32e135801740998544d6235061e37c93ec067ad2be3edd5b17b.

Validação: TypeScript e build aprovados; CSS analisado com PostCSS; todas as declarações CSS de família de interface usam a variável comum. Os nomes internos, eixos de peso e glifos portugueses dos TTF foram conferidos. A prévia da compilação entregou os dois arquivos e a licença por HTTP 200, com tipo e hashes corretos; HTML e CSS contêm o carregamento global e não apontam para os arquivos ausentes anteriores.

Conferência visual pendente: o navegador retornou “The browser access host is unavailable”. Alteração local, sem publicação e sem modificações no banco de dados. A API real continua protegida em modo leitura.
