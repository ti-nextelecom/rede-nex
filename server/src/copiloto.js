// Copiloto NEX Telecom — Knowledge Base com busca por relevância
// Base: NEX_Telecom_Base_Conhecimento_IA_Cognitiva.md v2026-09-17

const STOPWORDS = new Set([
  'a','o','e','de','do','da','dos','das','em','no','na','nos','nas','que','eh',
  'um','uma','uns','umas','para','por','com','se','ao','às','aos','eu','tu','ele',
  'ela','nos','vos','lhe','lhes','meu','minha','seu','sua','seus','suas','este',
  'esta','isso','esse','essa','isto','mais','nao','mas','como','quando','onde',
  'qual','quais','quanto','qualquer','nenhum','ja','ainda','tambem','so','bem',
  'muito','pouco','hoje','aqui','la','assim','ser','ter','estar','ir','fazer',
  'ver','poder','dever','querer','precisar','saber','vai','pode','tem','sao',
  'foi','has','ou','nem','pois','logo','portanto','entao','alem','sobre','entre',
  'meu','minha','voce','vc','isso','esta','esse','isso','aqui','ali','la',
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
}

function score(queryTokens, keywords) {
  if (!queryTokens.length) return 0;
  let hits = 0;
  for (const qt of queryTokens) {
    for (const kw of keywords) {
      if (kw === qt || kw.startsWith(qt) || qt.startsWith(kw)) {
        hits++;
        break;
      }
    }
  }
  return hits / queryTokens.length;
}

const SECTIONS = [
  // ── SAUDAÇÃO ──────────────────────────────────────────────────────────
  {
    id: 'saudacao',
    keywords: ['oi','ola','bom','dia','tarde','noite','tudo','bem','boa','opa','alo','hey','hello','salve'],
    response: () => `Olá! Sou o **Copiloto da Rede Nex** 👋

Posso te ajudar com dúvidas sobre a plataforma e os serviços da NexTelecom:

**Plataforma Rede Nex**
Feed, Wiki, Tarefas, Bate-papo, Calendário, Gamificação, Treinamentos

**Conectividade e serviços NexTelecom**
Fibra óptica, Wi-Fi, planos de internet, IP fixo/CGNAT, Telefonia IP, portabilidade e diagnóstico

O que você gostaria de saber?`,
  },

  // ── PLATAFORMA ─────────────────────────────────────────────────────────
  {
    id: 'wiki',
    keywords: ['wiki','artigo','criar','editar','publicar','categoria','conhecimento','documentacao','documento','conteudo'],
    response: () => `Para criar um artigo na **Wiki**, acesse o menu Wiki no lateral, clique em **Novo artigo**, escolha a categoria e preencha o título e o conteúdo. Após salvar, o artigo fica disponível para todos os colaboradores.

Para **editar**, abra o artigo e clique em Editar. Você pode formatar texto, adicionar imagens e criar links entre artigos.

Dica: use categorias para organizar por área (TI, Comercial, Suporte, etc.).`,
  },
  {
    id: 'tarefa',
    keywords: ['tarefa','task','checklist','lista','prazo','prioridade','responsavel','subtarefa','andamento','criar','nova','backlog','concluir'],
    response: () => `Para criar uma **tarefa**, vá em Tarefas no menu lateral e clique em **Nova Tarefa**. Você pode definir:

• Título e descrição
• Prazo e prioridade (Baixa, Média, Alta, Crítica)
• Responsável e requisitante
• Checklists com subtarefas
• Observações e resultado

Use **Minhas Listas** para criar grupos personalizados. Status disponíveis: Backlog, A Fazer, Em Andamento, Aguardando, Bloqueado ou Concluído.`,
  },
  {
    id: 'gamificacao',
    keywords: ['xp','pontos','rank','ranking','gamificacao','conquista','missao','nivel','badge','recompensa','ganhar','ganho'],
    response: () => `Você ganha **XP** realizando ações na plataforma:

• Criar posts no Feed
• Completar tarefas
• Adicionar artigos na Wiki
• Participar de treinamentos
• Interagir com publicações (curtidas, comentários)

Acompanhe seu rank no **Perfil** → seção de gamificação. Veja o ranking geral no menu Ranking.`,
  },
  {
    id: 'chat',
    keywords: ['chat','grupo','mensagem','batepapo','conversa','mencao','contato','enviar','arquivo','conversas'],
    response: () => `No **Bate-papo** você pode trocar mensagens individuais ou em grupos:

• Para criar um **grupo**: clique em Novo grupo, adicione participantes e confirme
• Use **@nome** para mencionar alguém
• Você pode enviar arquivos, imagens e adicionar reações
• Mensagens recentes podem ser editadas ou apagadas

As conversas ficam salvas e você pode pesquisar mensagens antigas.`,
  },
  {
    id: 'feed',
    keywords: ['feed','post','publicar','publicacao','comunicado','evento','enquete','noticia','anuncio','postar'],
    response: () => `No **Feed** você pode criar diferentes tipos de publicação:

• **Publicação**: texto, imagens e links para compartilhar com todos
• **Comunicado**: destaque para avisos importantes
• **Evento**: programação com data, hora e local
• **Enquete**: votação com opções para a equipe

Clique no campo de texto no topo, escolha o tipo e adicione o conteúdo. Você pode curtir, comentar e reagir às publicações dos colegas.`,
  },
  {
    id: 'calendario',
    keywords: ['calendario','evento','agenda','reuniao','data','horario','compromisso','programacao','marcar'],
    response: () => `O **Calendário** mostra todos os eventos da empresa:

• Alterne entre visualização **mensal** e **semanal**
• Para criar um evento: clique em qualquer dia ou no botão Novo Evento
• Preencha título, data, hora, descrição e participantes
• Eventos criados no Feed com data aparecem automaticamente no calendário`,
  },
  {
    id: 'treinamento',
    keywords: ['treinamento','curso','modulo','aprendizado','capacitacao','aula','video','material','estudo'],
    response: () => `Os **Treinamentos** ficam disponíveis no menu lateral:

• Escolha um módulo e clique em Iniciar
• Seu progresso é salvo automaticamente
• Você ganha XP ao completar módulos
• Os conteúdos cobrem processos, produtos e habilidades da NexTelecom`,
  },
  {
    id: 'nota',
    keywords: ['nota','anotacao','bloco','lembrete','pessoal','rascunho'],
    response: () => `As **Notas** são seu bloco de notas pessoal na plataforma:

• Acesse pelo menu Notas (ou Mais no mobile)
• Crie notas com título e conteúdo formatado
• As notas são pessoais e ficam salvas no seu perfil`,
  },
  {
    id: 'perfil',
    keywords: ['perfil','foto','senha','nome','cargo','departamento','avatar','seguranca','dados','conta','atualizar'],
    response: () => `No **Perfil** você pode:

• Atualizar foto, nome, cargo e departamento
• Alterar a senha em Perfil → Segurança
• Ver suas missões e conquistas (gamificação)
• Acompanhar seu progresso de XP e ranking

Para atualizar a foto, clique na imagem de perfil e faça upload da nova foto.`,
  },
  {
    id: 'drive',
    keywords: ['drive','arquivo','documento','pasta','upload','armazenamento','repositorio','salvar','baixar'],
    response: () => `O **Drive** é o repositório de arquivos da empresa:

• Faça upload de documentos, imagens e outros arquivos
• Organize em pastas por área ou projeto
• Colaboradores com permissão podem acessar e baixar
• Use a busca para localizar arquivos rapidamente`,
  },
  {
    id: 'ajuda-suporte',
    keywords: ['ajuda','suporte','problema','chamado','solicitacao','atendimento','erro','bug','dificuldade','ti'],
    response: () => `Para suporte técnico na plataforma:

1. Consulte a **Central de Ajuda** (menu lateral → Ajuda)
2. Abra um **chamado de TI** descrevendo o problema
3. Entre em contato pelo Bate-papo com o time de TI

O time de TI está disponível em horário comercial e responde via chamado ou chat.`,
  },

  // ── NEX TELECOM — CONHECIMENTO TÉCNICO ────────────────────────────────
  {
    id: 'fibra',
    keywords: ['fibra','optica','ftth','olt','cto','splitter','luz','rede','instalacao','cabo','sinal','fio','passagem','cabeamento','infraestrutura'],
    response: () => `## Fibra óptica e FTTH

A **fibra óptica** transmite dados por pulsos de luz, oferecendo alta capacidade e baixa interferência.

**Caminho do sinal (FTTH):**
OLT → fibra → splitter/CTO → cabo drop → ONT/ONU → roteador → dispositivos

**Componentes principais:**
• **OLT**: equipamento da NexTelecom que concentra e entrega o serviço óptico
• **CTO**: caixa de distribuição óptica no acesso (poste/calçada)
• **Splitter**: divisor passivo — distribui o sinal para vários clientes (não aumenta velocidade)
• **ONT/ONU**: equipamento na casa/empresa que converte o sinal óptico para Ethernet e Wi-Fi

A fibra oferece alta capacidade — a experiência final depende também do plano, equipamentos e rede local.`,
  },
  {
    id: 'planos',
    keywords: ['plano','banda','semidedicado','dedicado','sla','corporativo','empresarial','residencial','compartilhado','contrato','servico','tipo','opcao','assinar'],
    response: () => `## Tipos de plano de internet NexTelecom

**Banda Larga** — uso geral
Residências e negócios menos críticos. Boa relação custo-benefício para navegação, streaming, home office e uso cotidiano.

**Link Semidedicado** — necessidade intermediária
Para empresas que precisam de mais previsibilidade. As condições exatas (simetria, SLA, suporte, banda mínima) devem ser confirmadas na oferta vigente da Nex — o termo é comercial, não universal.

**Link Dedicado** — operação crítica
Para empresas com alta dependência: sistemas, VPN, servidores publicados, filiais, voz crítica. Pode incluir banda comprometida, SLA, suporte diferenciado e IP fixo. Requer levantamento técnico antes da proposta.

**Pergunta-chave:** O que acontece com o negócio quando a internet para?`,
  },
  {
    id: 'velocidade',
    keywords: ['download','upload','velocidade','lento','mbps','gbps','largura','rapido','lentidao','teste','medir','speed','streaming','travando'],
    response: () => `## Download, upload e velocidade

**Download**: dados que chegam ao cliente — streaming, abrir sites, receber arquivos, atualizações.

**Upload**: dados que saem do cliente — videochamadas, backup em nuvem, câmeras transmitindo, envio de arquivos, lives.

**1 Gbps = 1000 Mbps** (notação decimal de rede).

**Diagnóstico rápido para "internet lenta":**
1. Teste **por cabo** (Ethernet direto na ONT/roteador) — separa link do Wi-Fi
2. Por cabo também está ruim → verificar velocidade, perda de pacotes, latência e rede da operadora
3. Por cabo ok, Wi-Fi ruim → investigar cobertura, canal, interferência e posicionamento

Clientes com câmeras, backup em nuvem ou envio constante de arquivos grandes merecem atenção especial ao **upload**.`,
  },
  {
    id: 'equipamentos',
    keywords: ['ont','onu','roteador','repetidor','mesh','equipamento','modem','aparelho','patchcord','patch','porta','ethernet','modelo','configurar'],
    response: () => `## Equipamentos de rede

**ONT** (NexTelecom fornece com Wi-Fi integrado)
Recebe a fibra e converte o sinal óptico. Possui Wi-Fi integrado e conexão por cabo.

**ONU** (sem Wi-Fi integrado)
Converte o sinal da fibra, mas precisa de roteador externo para distribuir o Wi-Fi.

**Roteador**
Organiza a rede local, distribui Wi-Fi e executa DHCP, NAT e firewall. Não cria internet — apenas distribui o que recebe da ONT/ONU.

**Repetidor**
Retransmite um Wi-Fi existente. Não aumenta velocidade. Deve ser instalado onde ainda há sinal adequado — colocar no ponto sem sinal não resolve.

**Rede Mesh**
Vários nós coordenados funcionando como uma única rede Wi-Fi. Backhaul por cabo (quando possível) oferece mais previsibilidade.

**Patch cord**
Cabo curto entre equipamentos (ONT ↔ roteador, roteador ↔ PC). Cabo danificado ou conector frouxo interrompe a conexão.`,
  },
  {
    id: 'wifi',
    keywords: ['wifi','wi-fi','sinal','cobertura','frequencia','ghz','barra','intensidade','qualidade','interferencia','canal','parede','distancia','comodo','quarto','ambiente','fraco','ruim','alcance'],
    response: () => `## Wi-Fi: cobertura, intensidade e qualidade

**Internet ≠ Wi-Fi.** O link pode estar ok e o Wi-Fi estar ruim por cobertura, distância ou interferência.

**Frequências disponíveis:**
• **2,4 GHz** — maior alcance, atravessa obstáculos melhor, mas mais sujeito a interferência. Bom para distâncias maiores e IoT.
• **5 GHz** — mais canais e capacidade próximo ao roteador, menor alcance através de paredes.
• **6 GHz** (Wi-Fi 6E/7) — espectro adicional, alta capacidade, alcance mais limitado.

**Causas frequentes de Wi-Fi ruim:**
• Paredes, lajes, concreto, metal e espelhos atenuando o sinal
• Roteador dentro de armário, no chão ou em uma ponta do imóvel
• Redes vizinhas e equipamentos causando interferência no canal
• Distância excessiva do ponto de acesso
• Muitos dispositivos simultâneos

**Intensidade (RSSI em dBm):**
-30 a -50 = ótimo | -51 a -67 = bom | -68 a -75 = atenção | abaixo de -75 = fraco/instável

"Barrinhas cheias" não garantem boa experiência — considere cobertura + intensidade + qualidade.`,
  },
  {
    id: 'telefonia',
    keywords: ['telefonia','voip','voz','ramal','pabx','sip','tronco','chamada','ligacao','numero','fixo','analogico','rtp','latencia','jitter','picotado','robotizan','cortando','central'],
    response: () => `## Telefonia fixa por IP (VoIP)

A voz é digitalizada e transportada em pacotes pela rede. O número pode ser fixo tradicional com transporte por IP.

**Fluxo de uma chamada:**
Telefone → ONT/ATA ou telefone IP → PABX/SIP → operadora → destino

**Ramal**: extensão interna do PABX (usuário, setor ou aparelho). Permite chamadas internas e encaminhamento.

**Tronco SIP**: conexão IP entre o PABX e a operadora. Um tronco transporta múltiplas chamadas simultâneas.

⚠️ **Ramais ≠ chamadas simultâneas.** Você pode ter 10 ramais mas apenas 2 canais. Dimensionar pelo número de chamadas simultâneas necessárias.

**Qualidade da voz IP:**
• **Latência**: atraso → eco ou voz atrasada
• **Jitter**: variação de atraso entre pacotes → voz picotada
• **Perda de pacotes**: cortes, silêncio ou voz robotizada
Boa voz exige rede estável, baixa perda e atraso controlado — não depende apenas de muitos Mbps.`,
  },
  {
    id: 'portabilidade',
    keywords: ['portabilidade','portar','manter','numero','mudar','transferir','linha','operadora','trocar','conservar'],
    response: () => `## Portabilidade numérica

Permite ao cliente trocar de operadora mantendo o mesmo número, quando elegível.

**Processo:**
1. Confirmar titularidade — dados do titular e do número devem estar corretos
2. Identificar quais linhas entram no processo
3. Validar documentação conforme procedimento vigente da NexTelecom
4. Acompanhar o andamento e orientar o cliente sobre prazos e pendências

⚠️ Não confirmar prazo ou conclusão antes de verificar critérios e andamento do processo. Dados incorretos de cadastro ou documentação geram pendências.`,
  },
  {
    id: 'ip',
    keywords: ['ip','dhcp','nat','cgnat','fixo','dinamico','privado','publico','endereco','bloco','ipv4','ipv6','ddns','gateway','mascara','prefixo','192','168','10.','172','100.64','roteamento'],
    response: () => `## Endereçamento IP

**IP privado**: usado na rede local (192.168.x.x, 10.x.x.x, 172.16-31.x.x). Não é roteável diretamente na internet.

**IP público dinâmico**: pode mudar em reconexões. Suficiente para navegação e streaming. Serviços com acesso externo previsível podem precisar de DDNS ou IP fixo.

**IP público fixo**: permanece associado ao serviço. Facilita VPNs, câmeras/NVR, servidores publicados e allowlists.
⚠️ **IP fixo não aumenta a velocidade** — trata de previsibilidade de endereço, não desempenho.

**CGNAT**: vários clientes compartilham IPs públicos (bloco 100.64.0.0/10). Navegação funciona normalmente. Publicação de servidores, câmeras externas, P2P e acesso remoto podem exigir IP público.
⚠️ **CGNAT não significa internet lenta** — o impacto está na alcançabilidade de entrada.

**DHCP**: atribui automaticamente IP, máscara, gateway e DNS aos dispositivos.

**Blocos IPv4:**
• **/32** — 1 endereço (uso pontual)
• **/31** — 2 endereços (enlaces ponto a ponto)
• **/30** — 4 endereços no bloco (tradicional: rede + broadcast + 2 hosts)`,
  },
  {
    id: 'diagnostico',
    keywords: ['diagnostico','problema','instavel','caiu','caindo','queda','perda','pacotes','ping','camera','vpn','servidor','acesso','remoto','funciona','conectar','conexao','queda','oscilando','cai','cair'],
    response: () => `## Diagnóstico prático

**Separe as 5 camadas antes de diagnosticar:**
Meio físico → Tipo de acesso → Wi-Fi/rede local → Telefonia IP → Endereçamento IP

**"Internet lenta" — siga esta ordem:**
1. Teste **por cabo** (Ethernet direto na ONT/roteador)
2. Por cabo também ruim → medir velocidade, perda de pacotes, latência; verificar ONT/roteador e rede da operadora
3. Por cabo ok, Wi-Fi ruim → cobertura, canal, interferência, posicionamento

**Cenários comuns:**
• *"Perto da ONT funciona, no quarto cai"* → Wi-Fi fraco/obstáculos, não falha no link
• *"Backup demora muito"* → investigar **upload** e capacidade do destino
• *"Telefone IP fica picotado"* → verificar perda de pacotes, jitter e latência
• *"Câmera funciona dentro, mas não abre de fora"* → verificar CGNAT, IP público, firewall, NAT e portas
• *"Servidor precisa sempre do mesmo endereço"* → avaliar IP público fixo
• *"Notebook recebeu 192.168.x.x automaticamente"* → DHCP local atribuiu IP privado (comportamento normal)`,
  },

  // ── NEX TELECOM — ATENDIMENTO COMERCIAL ───────────────────────────────
  {
    id: 'atendimento-consultivo',
    keywords: ['atendimento','consultivo','venda','vender','cliente','proposta','necessidade','oferta','perfil','perguntar','diagnosticar','indicar','abordagem','metodologia'],
    response: () => `## Atendimento consultivo NexTelecom

**Regra fundamental:** Diagnóstico antes da proposta.

**6 etapas do atendimento consultivo:**
1. **Receber** — atenção e contexto
2. **Explorar** — perguntas abertas
3. **Aprofundar** — impacto e prioridade
4. **Indicar** — solução compatível
5. **Confirmar** — escopo e preço separados
6. **Registrar** — histórico e retorno no Fluctus

**Para cliente residencial:** Quantas pessoas? Quais aparelhos? Trabalho remoto/câmeras? Metragem e pavimentos? Onde o sinal precisa chegar?

**Para cliente empresarial:** O que para quando a internet cai? Quais sistemas/VPN/câmeras dependem? SLA necessário? Exigência de IP?

**Quando validar com técnico/comercial:**
• Cliente pede IP ou bloco sem explicar a aplicação
• Câmeras com requisitos especiais de acesso remoto
• Empresa crítica (24h, VPN, servidor, filiais)
• Wi-Fi em ambiente complexo (vários pavimentos, muitas barreiras)
• Telefonia com muitos ramais, chamadas simultâneas ou portabilidade`,
  },
  {
    id: 'objecoes',
    keywords: ['objecao','caro','preco','taxa','instalacao','concorrencia','desconto','negociar','comparar','barato','pensar','decidir','quero','valor'],
    response: () => `## Lidando com objeções de venda

**"A taxa de instalação está cara":**
1. Acolher: *"Entendo que o custo inicial pesa na decisão."*
2. Explicar: *"A instalação é a etapa técnica para ativar e configurar o serviço."*
3. Confirmar: *"Vou verificar a condição comercial vigente para o seu caso."*
4. Comparar valor: serviço + suporte + instalação sem surpresas

**Respostas para objeções comuns:**
• *"Está caro."* → "Além do preço, o que pesa mais: estabilidade, cobertura, suporte ou prazo?"
• *"Vou pensar."* → "Qual ponto você gostaria de comparar antes de decidir?"
• *"Já tenho internet."* → "O serviço atual atende completamente ou há algo a melhorar?"
• *"Só quero o valor."* → "Eu informo. Antes, duas perguntas rápidas para não indicar opção inadequada."
• *"Concorrência é mais barata."* → "Vamos comparar tipo de serviço, condições e o que está incluído."

Evite: esconder taxa, prometer isenção sem autorização, criticar o concorrente diretamente.`,
  },
  {
    id: 'proposta-preco',
    keywords: ['proposta','preco','valor','custo','cobrar','margem','componente','separar','apresentar','orcamento','composicao'],
    response: () => `## Como apresentar proposta e preço

**Estrutura de uma proposta:**
1. **Retome a necessidade** — "Você precisa manter o sistema e as câmeras funcionando..."
2. **Explique a solução** — por que aquele serviço atende o cenário
3. **Separe os componentes** — plano, instalação, equipamento, IP, bloco e adicionais devem ficar claros
4. **Informe condições** — prazo, validade, viabilidade e regras comerciais vigentes
5. **Confirme entendimento** — peça ao cliente que valide se a proposta cobre o que ele precisa

⚠️ Não transforme serviços diferentes em um único preço genérico. Preço justo depende de escopo correto; escopo correto depende de diagnóstico.`,
  },
];

export function searchKnowledge(query, history = []) {
  const tokens = tokenize(query);
  const rawLower = query.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // Greeting shortcut
  if (tokens.length <= 3 && SECTIONS[0].keywords.some(k => rawLower.includes(k))) {
    return SECTIONS[0].response();
  }

  // Score all sections
  const scored = SECTIONS.map(s => ({ s, score: score(tokens, s.keywords) }))
    .sort((a, b) => b.score - a.score);

  const top = scored[0];

  // Low confidence fallback
  if (top.score < 0.15) {
    return `Posso te ajudar com dúvidas sobre a **plataforma Rede Nex** e os **serviços NexTelecom**!

Experimente perguntar sobre:

**Plataforma:**
Feed, Wiki, Tarefas, Bate-papo, Calendário, Gamificação, Treinamentos

**Conectividade NexTelecom:**
Fibra óptica, Wi-Fi, planos de internet, IP fixo/CGNAT, Telefonia IP, diagnóstico, portabilidade, atendimento consultivo

O que você gostaria de saber?`;
  }

  return top.s.response();
}
