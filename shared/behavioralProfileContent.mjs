// Static content extracted from the user-supplied HTML. No source scripts are executed.
export const BEHAVIORAL_SOURCE = {
  "file": "NEX_Avatares_v21_Premium_v4.html",
  "sha256": "3cdbda981991c4afa75e7e74249d49396f46cf30e9197bac02913055af6741e0",
  "questionCount": 20,
  "profileCount": 10,
  "assets": {
    "T": {
      "url": "/behavioral-profiles/tigre.png",
      "bytes": 944098,
      "sha256": "3424deafc05ebfcee7c36538b73cf3efb6379aeaa166ec67419f161a48422d19"
    },
    "A": {
      "url": "/behavioral-profiles/aguia.png",
      "bytes": 557029,
      "sha256": "e733334e64ca353765c8ad77289792b803ff01e92142e4fa2f989a6aba0126d7"
    },
    "L": {
      "url": "/behavioral-profiles/lobo.png",
      "bytes": 306249,
      "sha256": "3d6c3b3a698dd479fc35c6afc220553abd9dddfeeefdd8f4450e07faf5d63d52"
    },
    "G": {
      "url": "/behavioral-profiles/golfinho.png",
      "bytes": 267158,
      "sha256": "9a15843818a2ec36b97f7f61e3f0c33170bcf550831ad2275d8097f2998bddb2"
    },
    "F": {
      "url": "/behavioral-profiles/falcao.png",
      "bytes": 519889,
      "sha256": "9e461481abdadc326495e6300e5816b16c222bab779e64328e005e5f83cfcd41"
    },
    "orca": {
      "url": "/behavioral-profiles/orca.png",
      "bytes": 400482,
      "sha256": "0ba84b956494e95ccbd28db7c7372bb8e51e0eba7ce4b9938c7fd66285375a6c"
    },
    "cisne": {
      "url": "/behavioral-profiles/cisne.png",
      "bytes": 452593,
      "sha256": "0e90b1ee7cd8223c3a617aaebc55955f234a1f1f194bd06c9b7d4dde672c0ffd"
    },
    "leao": {
      "url": "/behavioral-profiles/leao.png",
      "bytes": 949672,
      "sha256": "479c6cab4aa80500bf3475377d4a9b1cd3caefc21da3fdf1ef4a41262308f16f"
    },
    "puma": {
      "url": "/behavioral-profiles/puma.png",
      "bytes": 493456,
      "sha256": "e0237346c895156eb109b431ba1d8587759313200a2896d60e25f7db7b247678"
    },
    "onca": {
      "url": "/behavioral-profiles/onca.png",
      "bytes": 522680,
      "sha256": "a16aa1ee31dc53e226090d85ad52bd0ba69b2e4a73c9353e5e12e838d94ccaae"
    }
  }
};
export const BEHAVIORAL_QUESTIONS = [
  {
    "id": 1,
    "weight": 2,
    "dimension": "autonomia",
    "text": "Você recebe uma tarefa com objetivo claro, mas sem todos os passos detalhados. O que faz?",
    "options": [
      {
        "key": "T",
        "text": "Defino como vai ser feito e começo, não espero orientação quando o objetivo está claro."
      },
      {
        "key": "A",
        "text": "Levanto as informações e planejo antes de agir, não me movo sem entender o contexto, mesmo que demore."
      },
      {
        "key": "L",
        "text": "Busco o processo existente e, se não houver, peço orientação antes de agir, não invento do zero."
      },
      {
        "key": "G",
        "text": "Consulto alguém que já fez isso, não avanço sem antes ter uma referência de alguém do time."
      },
      {
        "key": "F",
        "text": "Mergulho sozinho no problema e desenvolvo minha solução, não preciso saber como os outros fariam."
      }
    ]
  },
  {
    "id": 2,
    "weight": 2,
    "dimension": "autonomia",
    "text": "Seu gestor está inacessível por 2 horas e você tem uma decisão para tomar dentro da sua área de atuação. O que faz?",
    "options": [
      {
        "key": "T",
        "text": "Decido e executo, não fico travado esperando validação de cada passo dentro da minha área."
      },
      {
        "key": "A",
        "text": "Mapeio as variáveis disponíveis antes de decidir, não bato o martelo sem ter o cenário minimamente claro."
      },
      {
        "key": "L",
        "text": "Aguardo o gestor, prefiro não decidir sem alinhamento, mesmo que isso tome mais tempo."
      },
      {
        "key": "G",
        "text": "Consulto alguém de confiança antes de agir, não me sinto confortável decidindo sozinho sem checar com alguém."
      },
      {
        "key": "F",
        "text": "Avalio os impactos técnicos e decido por conta própria, a lógica do problema me diz o que fazer."
      }
    ]
  },
  {
    "id": 3,
    "weight": 1.5,
    "dimension": "proatividade",
    "text": "Você termina uma tarefa atribuída a você 2 horas antes do prazo. O que faz?",
    "options": [
      {
        "key": "T",
        "text": "Já começo a próxima prioridade, tempo parado não é opção para mim."
      },
      {
        "key": "A",
        "text": "Reviso antes de fechar, não entrego sem passar pelo que fiz, não aceito meu próprio trabalho sem revisão."
      },
      {
        "key": "L",
        "text": "Comunico ao gestor e aguardo a próxima tarefa, não me autoatribuo demandas, prefiro que venha pelo canal correto."
      },
      {
        "key": "G",
        "text": "Ofereço ajuda ao time, não consigo ficar parado enquanto um colega está sobrecarregado."
      },
      {
        "key": "F",
        "text": "Aproveito para aprofundar algo técnico, prefiro ir mais fundo no que já faço do que começar outra coisa."
      }
    ]
  },
  {
    "id": 4,
    "weight": 2,
    "dimension": "responsabilidade",
    "text": "Você identifica um erro seu que pode afetar o resultado de uma entrega. O que faz?",
    "options": [
      {
        "key": "T",
        "text": "Corrijo imediatamente, não fico fazendo análise do erro quando o que importa é resolver e seguir em frente."
      },
      {
        "key": "A",
        "text": "Mapeio o impacto antes de agir, não corrijo sem entender o que exatamente foi afetado e quem depende disso."
      },
      {
        "key": "L",
        "text": "Corrijo dentro do processo e comunico ao gestor, não faço correção sem deixar rastro formal."
      },
      {
        "key": "G",
        "text": "Comunico ao time antes de tudo, não consigo agir sozinho num erro sem avisar quem pode ser impactado."
      },
      {
        "key": "F",
        "text": "Vou direto à causa raiz, não me satisfaz corrigir o sintoma sem entender o que originou o erro."
      }
    ]
  },
  {
    "id": 5,
    "weight": 1.5,
    "dimension": "resolucao",
    "text": "Você está no meio de uma atividade e encontra um problema que não estava previsto e não tem no manual. O que faz?",
    "options": [
      {
        "key": "T",
        "text": "Improviso com o que tenho, não fico esperando processo quando o resultado está em jogo."
      },
      {
        "key": "A",
        "text": "Mapeio o cenário antes de qualquer ação, não ajo sem entender o problema por inteiro, mesmo que demore."
      },
      {
        "key": "L",
        "text": "Aciono o processo de escalonamento, não improviso quando existe alguém responsável por esse tipo de decisão."
      },
      {
        "key": "G",
        "text": "Chamo alguém com experiência, não quero tomar uma decisão assim sozinho sem ao menos checar com quem já passou por isso."
      },
      {
        "key": "F",
        "text": "Estudo o problema e resolvo do zero, esse tipo de desafio sem manual é exatamente onde trabalho melhor."
      }
    ]
  },
  {
    "id": 6,
    "weight": 1,
    "dimension": "comunicacao",
    "text": "Você está executando uma tarefa longa e demorada. Como você comunica o andamento?",
    "options": [
      {
        "key": "T",
        "text": "Comunico quando tenho resultado concreto, não mando update só para mostrar que estou trabalhando."
      },
      {
        "key": "A",
        "text": "Dou uma atualização estruturada quando há algo relevante, não mando mensagem sem dados concretos sobre o que mudou."
      },
      {
        "key": "L",
        "text": "Sigo o protocolo de update estabelecido, não improviso na comunicação, se há um padrão, é ele que vale."
      },
      {
        "key": "G",
        "text": "Mando updates regulares, não consigo avançar sabendo que as pessoas ao redor não têm ideia de como está andando."
      },
      {
        "key": "F",
        "text": "Comunico quando há algo técnico relevante para reportar, não mando update vazio só para manter contato."
      }
    ]
  },
  {
    "id": 7,
    "weight": 1,
    "dimension": "feedback",
    "text": "Seu gestor aponta uma falha na forma como você executou uma tarefa. Como você reage?",
    "options": [
      {
        "key": "T",
        "text": "Ouço e argumento se discordar, não aceito crítica sem entender se ela se sustenta."
      },
      {
        "key": "A",
        "text": "Peço detalhes para entender onde errei, não aceito feedback vago, preciso saber exatamente o que foi diferente do esperado."
      },
      {
        "key": "L",
        "text": "Aceito, anoto e ajusto, não fico questionando o feedback quando vem do gestor, faz sentido ouvir e corrigir."
      },
      {
        "key": "G",
        "text": "Fico atento ao tom da conversa, não me sinto bem enquanto não me certifico de que não ficou mal-entendido depois."
      },
      {
        "key": "F",
        "text": "Apresento o embasamento da minha decisão técnica, não mudo de abordagem porque alguém preferiu diferente, mudo quando o raciocínio falhar."
      }
    ]
  },
  {
    "id": 8,
    "weight": 2,
    "dimension": "priorizacao",
    "text": "Você recebe duas demandas urgentes ao mesmo tempo, de origens diferentes. O que faz?",
    "options": [
      {
        "key": "T",
        "text": "Avalio e priorizo a de maior resultado, não fico esperando validação, começo pela que mais impacta."
      },
      {
        "key": "A",
        "text": "Mapeio o impacto das duas antes de qualquer passo, não priorizo no chute, preciso de dados para decidir."
      },
      {
        "key": "L",
        "text": "Levo ao gestor, não defino sozinho o que é mais urgente quando vem de origens diferentes, ele tem a visão completa."
      },
      {
        "key": "G",
        "text": "Comunico os dois solicitantes antes de agir, não consigo começar sem antes garantir que ninguém ficará sem retorno."
      },
      {
        "key": "F",
        "text": "Defino sozinho pela criticidade técnica, o que mais impacta o serviço vai primeiro, sem precisar de aprovação para isso."
      }
    ]
  },
  {
    "id": 9,
    "weight": 1.5,
    "dimension": "processo",
    "text": "Um procedimento que você conhece bem para de funcionar numa situação real. O que faz?",
    "options": [
      {
        "key": "T",
        "text": "Faço o que é necessário para entregar, o objetivo importa mais que o processo quando o processo falhou."
      },
      {
        "key": "A",
        "text": "Primeiro preciso saber se é pontual ou sistêmico, não ajo sem essa resposta, ela muda completamente o que fazer."
      },
      {
        "key": "L",
        "text": "Escalo para o responsável, não altero processo por conta própria, mesmo que eu saiba como corrigir."
      },
      {
        "key": "G",
        "text": "Verifico com colegas se é só comigo, não ajo sozinho sem saber se mais alguém está no mesmo problema."
      },
      {
        "key": "F",
        "text": "Diagnostico e improviso uma solução técnica, não fico parado esperando o processo ser revisado enquanto o problema está ativo."
      }
    ]
  },
  {
    "id": 10,
    "weight": 1.5,
    "dimension": "instinto",
    "text": "Quando recebo uma nova tarefa, meu primeiro instinto é:",
    "options": [
      {
        "key": "T",
        "text": "Começar logo, cada minuto analisando é um minuto a menos produzindo."
      },
      {
        "key": "A",
        "text": "Analisar antes de agir, não começo sem entender o contexto, prefiro fazer certo do que refazer."
      },
      {
        "key": "L",
        "text": "Verificar se existe processo ou instrução, não invento forma de fazer quando pode já ter um padrão estabelecido."
      },
      {
        "key": "G",
        "text": "Perguntar ao time como foi feito antes, não avanço sem referência de alguém que já passou por isso."
      },
      {
        "key": "F",
        "text": "Ir atrás da informação técnica e resolver do meu jeito, não preciso saber como os outros fazem para encontrar minha solução."
      }
    ]
  },
  {
    "id": 11,
    "weight": 1,
    "dimension": "reuniao",
    "text": "Em uma reunião de equipe, eu normalmente:",
    "options": [
      {
        "key": "T",
        "text": "Vou direto ao ponto e pressiono por decisão, não tenho paciência para reunião que não termina com ação definida."
      },
      {
        "key": "A",
        "text": "Questiono dados e peço detalhes, não me sinto confortável concordando com algo que não entendo por completo."
      },
      {
        "key": "L",
        "text": "Escuto, anoto e sigo o que for decidido, não fico questionando a decisão coletiva depois de tomada."
      },
      {
        "key": "G",
        "text": "Fico atento ao clima do grupo, quando o tom esquenta, prefiro ajudar a destravar do que deixar o ambiente piorar."
      },
      {
        "key": "F",
        "text": "Engajo quando o assunto é técnico, se não for, prefiro que seja rápido, não é onde contribuo mais."
      }
    ]
  },
  {
    "id": 12,
    "weight": 1.5,
    "dimension": "cliente",
    "text": "Quando um cliente está bravo, minha reação instintiva é:",
    "options": [
      {
        "key": "T",
        "text": "Ouço o suficiente para entender o problema e apresento a solução, não deixo a conversa se estender mais do que precisa."
      },
      {
        "key": "A",
        "text": "Entendo o problema por completo antes de qualquer passo, não ofereço solução sem saber exatamente o que está acontecendo."
      },
      {
        "key": "L",
        "text": "Sigo o protocolo de atendimento, não improviso mesmo com cliente bravo, o processo existe para isso."
      },
      {
        "key": "G",
        "text": "Ouço com atenção e cuido do tom da conversa primeiro, não consigo resolver nada com alguém ainda no pico emocional."
      },
      {
        "key": "F",
        "text": "Foco em diagnosticar e resolver o problema técnico, a parte emocional eu deixo para quem tem mais habilidade com isso."
      }
    ]
  },
  {
    "id": 13,
    "weight": 1.5,
    "dimension": "erro",
    "text": "Quando algo dá errado no trabalho:",
    "options": [
      {
        "key": "T",
        "text": "Foco em resolver e retomar, não fico parado analisando o que deu errado, isso vem depois se vier."
      },
      {
        "key": "A",
        "text": "Primeiro preciso entender se foi pontual ou sistêmico, não vou à solução sem essa resposta."
      },
      {
        "key": "L",
        "text": "Verifico onde o processo falhou e corrijo dentro dele, não invento solução nova se existe passo de correção estabelecido."
      },
      {
        "key": "G",
        "text": "Me preocupo com o impacto nas pessoas, antes de qualquer ação, preciso saber se alguém foi afetado de forma que preciso abordar diretamente."
      },
      {
        "key": "F",
        "text": "Diagnostico a causa técnica e corrijo na raiz, não me satisfaz resolver sem entender o que originou o problema."
      }
    ]
  },
  {
    "id": 14,
    "weight": 1,
    "dimension": "processo",
    "text": "Em relação a processos e regras:",
    "options": [
      {
        "key": "T",
        "text": "Sigo quando faz sentido, não deixo um processo me travar quando o objetivo e o caminho estão claros."
      },
      {
        "key": "A",
        "text": "Valorizo processos bem estruturados, mas questiono quando são ineficientes, não sigo processo ruim só porque existe."
      },
      {
        "key": "L",
        "text": "Sigo os processos com rigor, não fico avaliando se o processo é bom ou ruim, existe por um motivo e é o que vale."
      },
      {
        "key": "G",
        "text": "Sigo os processos, mas considero o impacto nas pessoas, não aplico regra de forma que destrua o relacionamento desnecessariamente."
      },
      {
        "key": "F",
        "text": "Conheço os processos, mas improviso quando o campo pede, nem sempre o manual cobre o que está na sua frente."
      }
    ]
  },
  {
    "id": 15,
    "weight": 1,
    "dimension": "ideias",
    "text": "Quando tenho uma ideia nova:",
    "options": [
      {
        "key": "T",
        "text": "Apresento logo e começo a executar, não espero por aprovação quando a ideia faz sentido para mim."
      },
      {
        "key": "A",
        "text": "Verifico o embasamento antes de apresentar, não levo ideia sem dados, opinião sem sustentação não é proposta."
      },
      {
        "key": "L",
        "text": "Espero o momento certo para apresentar, não solto ideia no meio de qualquer conversa, ela precisa de contexto."
      },
      {
        "key": "G",
        "text": "Converso com o time antes, não apresento ideia sem antes checar o que as pessoas ao redor acham."
      },
      {
        "key": "F",
        "text": "Testo na prática antes de apresentar, não defendo ideia que ainda não comprovei por conta própria."
      }
    ]
  },
  {
    "id": 16,
    "weight": 2,
    "dimension": "pressao",
    "text": "Em situação de pressão alta (incidente, prazo apertado):",
    "options": [
      {
        "key": "T",
        "text": "Defino o que precisa ser feito e cobro, não fico esperando para ver se alguém vai se mover sozinho."
      },
      {
        "key": "A",
        "text": "Mantenho a calma e analiso, não ajo antes de ter clareza do que está acontecendo, mesmo sob pressão."
      },
      {
        "key": "L",
        "text": "Sigo o procedimento de emergência, não improviso em situação de pressão quando há um protocolo definido."
      },
      {
        "key": "G",
        "text": "Garanto que todas as pessoas envolvidas estejam informadas, não consigo avançar em crise sabendo que alguém está no escuro."
      },
      {
        "key": "F",
        "text": "Localizo a falha e resolvo com as próprias mãos, não passo por intermediário quando sei o que precisa ser feito."
      }
    ]
  },
  {
    "id": 17,
    "weight": 1,
    "dimension": "aprendizado",
    "text": "Quando preciso aprender algo novo para o trabalho:",
    "options": [
      {
        "key": "T",
        "text": "Aprendo fazendo, não fico lendo manual antes de pôr a mão na massa, o erro faz parte do processo."
      },
      {
        "key": "A",
        "text": "Busco o contexto geral antes de mergulhar, não avanço sem entender como esse novo assunto se conecta ao que já sei."
      },
      {
        "key": "L",
        "text": "Prefiro treinamento estruturado, não me sinto confortável aprendendo algo importante sem um processo definido de capacitação."
      },
      {
        "key": "G",
        "text": "Aprendo trocando com alguém que já domina, não consigo absorver bem um assunto novo sem ter com quem discutir."
      },
      {
        "key": "F",
        "text": "Abro e descubro por conta própria, prefiro entender cada detalhe sozinho do que depender da explicação de alguém."
      }
    ]
  },
  {
    "id": 18,
    "weight": 1,
    "dimension": "time",
    "text": "Quando entro em um novo time:",
    "options": [
      {
        "key": "T",
        "text": "Mapeio as oportunidades e começo a contribuir logo, não fico em modo observação quando já dá para agir."
      },
      {
        "key": "A",
        "text": "Entendo o sistema e as pessoas-chave antes de propor qualquer coisa, não faço sugestão sem entender como as coisas funcionam aqui."
      },
      {
        "key": "L",
        "text": "Entendo os processos e me adapto a eles, não chego querendo mudar tudo antes de entender como o time funciona."
      },
      {
        "key": "G",
        "text": "Primeiro conheço as pessoas, não me sinto integrado sem ter construído ao menos um mínimo de confiança com o time."
      },
      {
        "key": "F",
        "text": "Mapeio os problemas técnicos, é por onde começo, não me preocupo com as dinâmicas do time antes de entender o que está quebrado."
      }
    ]
  },
  {
    "id": 19,
    "weight": 2,
    "dimension": "erro_impacto",
    "text": "Você cometeu um erro que causou impacto direto no cliente ou no serviço. O que acontece?",
    "options": [
      {
        "key": "T",
        "text": "Assumo, corrijo e sigo, não me paraliso por erro, o que importa é retomar o quanto antes."
      },
      {
        "key": "A",
        "text": "Mapeio quem foi afetado antes de qualquer ação, não corrijo no escuro sem saber o tamanho real do impacto."
      },
      {
        "key": "L",
        "text": "Comunico ao gestor e corrijo dentro do processo, não faço correção de impacto sem o rastro formal."
      },
      {
        "key": "G",
        "text": "Me preocupo com quem foi afetado, não consigo focar na correção técnica sem antes cuidar de como o cliente e o time estão."
      },
      {
        "key": "F",
        "text": "Investigo a causa técnica para não repetir, não me satisfaz corrigir sem entender o que gerou o problema."
      }
    ]
  },
  {
    "id": 20,
    "weight": 1.5,
    "dimension": "autoridade",
    "text": "Você identifica uma solução para um problema recorrente, mas implementá-la depende de uma autorização que você não tem. O que faz?",
    "options": [
      {
        "key": "T",
        "text": "Apresento a solução e pressiono por decisão, não deixo uma boa ideia morrer na fila de aprovações."
      },
      {
        "key": "A",
        "text": "Estruturo riscos e benefícios antes de escalar, não apresento solução sem o respaldo analítico que justifica o pedido."
      },
      {
        "key": "L",
        "text": "Comunico ao gestor e aguardo, não atuo sem aprovação mesmo que a solução pareça óbvia."
      },
      {
        "key": "G",
        "text": "Converso com quem é afetado antes de escalar, não apresento proposta sem saber se tem apoio de quem vai viver com ela."
      },
      {
        "key": "F",
        "text": "Verifico o que está na minha autonomia técnica e resolvo, só escalo o que realmente não posso fazer sozinho."
      }
    ]
  }
];
export const BEHAVIORAL_PROFILES = {
  "T": {
    "key": "T",
    "name": "Tigre",
    "icon": "🐯",
    "disc": "Alto D Dominância",
    "description": "Você é movido por metas, desafios e resultados concretos. Age com urgência, não precisa de microgestão e funciona melhor com autonomia e um ranking à frente.",
    "strengths": [
      "Alta produtividade",
      "Iniciativa natural",
      "Autonomia de ação",
      "Energiza o ambiente",
      "Foco em entrega"
    ],
    "attention": [
      "Pode atropelar processos em nome da velocidade",
      "Baixa paciência com rotina",
      "Resistente a feedback corretivo"
    ],
    "color": "#E84E4E",
    "autonomy": "Alta age antes de pedir permissão. Tende a decidir sozinho mesmo quando não tem todo o contexto. Risco: atalhos que geram retrabalho.",
    "consistency": "Variável depende do interesse. Alta quando há desafio, baixa em tarefas repetitivas.",
    "motivation": "Bater meta, ser reconhecido publicamente, crescer rápido, ter autonomia, vencer desafios.",
    "managerGuide": "Seja direto e objetivo. Defina metas claras com prazo. Dê autonomia com checkpoints. Evite microgerenciamento. Reconheça publicamente.",
    "image": "/behavioral-profiles/tigre.png"
  },
  "A": {
    "key": "A",
    "name": "Águia",
    "icon": "🦅",
    "disc": "Alto C Conformidade + traços de D",
    "description": "Você voa alto para enxergar o cenário completo antes de agir. Planeja, analisa e age com precisão. Qualidade e eficiência valem mais do que velocidade bruta.",
    "strengths": [
      "Visão sistêmica",
      "Rigor técnico",
      "Documenta bem",
      "Antevê problemas",
      "Decisões fundamentadas"
    ],
    "attention": [
      "Paralisia por análise em situações de resposta imediata",
      "Lento quando o ambiente exige velocidade",
      "Crítico com soluções improvisadas"
    ],
    "color": "#4A90D9",
    "autonomy": "Alta para decidir mas tende a querer dados antes de agir. Em situações novas, analisa primeiro e age depois. Evita improvisar sem embasamento.",
    "consistency": "Alta entrega com qualidade consistente. Risco de morosidade quando há pressão de tempo.",
    "motivation": "Resolver problemas complexos, autonomia técnica, ser reconhecido pela qualidade (não em público).",
    "managerGuide": "Dê contexto e dados. Permita tempo de análise. Respeite a qualidade. Valorize o planejamento. Evite pressionar por velocidade sem razão.",
    "image": "/behavioral-profiles/aguia.png"
  },
  "L": {
    "key": "L",
    "name": "Lobo",
    "icon": "🐺",
    "disc": "Alto S Estabilidade",
    "description": "Você é o operador confiável. Não precisa de holofote, precisa de processo claro. Segue o runbook, documenta tudo, aparece consistentemente todo dia.",
    "strengths": [
      "Confiabilidade",
      "Consistência",
      "Baixo erro operacional",
      "Lealdade à equipe",
      "Seguimento de processos"
    ],
    "attention": [
      "Resistente a mudanças bruscas",
      "Tende a aguardar instrução em vez de tomar iniciativa em cenários novos",
      "Pode ser subestimado por gestores"
    ],
    "color": "#9CA3AF",
    "autonomy": "Moderada age com segurança dentro de processos conhecidos. Em situações fora do manual ou sem orientação clara, pode hesitar ou escalar ao invés de decidir.",
    "consistency": "Alta é o pilar de confiabilidade da equipe. Entrega o que promete, sem surpresas.",
    "motivation": "Segurança, clareza de função, rotina previsível, fazer parte de um time que funciona, ser reconhecido por consistência.",
    "managerGuide": "Seja claro e previsível. Explique mudanças com antecedência. Reconheça a consistência. Não confunda calma com desinteresse.",
    "image": "/behavioral-profiles/lobo.png"
  },
  "G": {
    "key": "G",
    "name": "Golfinho",
    "icon": "🐬",
    "disc": "Alto I Influência + traços de S",
    "description": "Você é o conector da equipe. Alta inteligência social, comunica com clareza, transmite confiança. Transforma reclamações em fidelização.",
    "strengths": [
      "Empatia genuína",
      "Comunicação acessível",
      "Escuta ativa",
      "Desescala conflitos",
      "Cria ambiente positivo"
    ],
    "attention": [
      "Pode ser complacente com clientes difíceis",
      "Evita conflito interno mesmo quando necessário",
      "Sensível a ambientes de alta pressão"
    ],
    "color": "#3DAB73",
    "autonomy": "Moderada prefere validar com o time ou gestor antes de agir em situações novas. Não é dependência: é estilo colaborativo. Consegue agir solo, mas prefere consenso.",
    "consistency": "Alta comprometimento com o relacionamento e a equipe é constante. Pode ser afetado por clima emocional negativo.",
    "motivation": "Ajudar pessoas, ser valorizado pelo time, ambiente positivo, ver o impacto do trabalho no cliente.",
    "managerGuide": "Crie ambiente positivo. Dê feedback com afeto. Valorize o relacionamento. Ajude-o a dizer não quando necessário.",
    "image": "/behavioral-profiles/golfinho.png"
  },
  "F": {
    "key": "F",
    "name": "Falcão",
    "icon": "🐦",
    "disc": "Alto D de campo + traços de C técnico",
    "description": "Você é o especialista independente. Age rápido, pensa no problema à frente, resolve com o que tem. Chega, diagnostica, resolve sem precisar de suporte constante.",
    "strengths": [
      "Autonomia no campo",
      "Resolução rápida",
      "Adaptabilidade técnica",
      "Domínio prático profundo",
      "Autoconfiança"
    ],
    "attention": [
      "Resiste a processos que julga desnecessários",
      "Pode tomar atalhos técnicos que geram retrabalho futuro",
      "Comunicação mais técnica que empática"
    ],
    "color": "#E89C2F",
    "autonomy": "Alta age de forma independente, especialmente em contexto técnico. Tende a resolver antes de comunicar. Risco: pode ultrapassar limites de autorização sem perceber.",
    "consistency": "Alta em situações desafiadoras; pode baixar em tarefas repetitivas que considera abaixo do seu nível.",
    "motivation": "Resolver problemas difíceis, ser o especialista chamado quando ninguém sabe, autonomia no campo, reconhecimento técnico pelos pares.",
    "managerGuide": "Dê autonomia real. Explique o \"por quê\" dos processos. Valorize a resolução, não apenas o protocolo. Envolva-o em decisões técnicas.",
    "image": "/behavioral-profiles/falcao.png"
  },
  "orca": {
    "key": "orca",
    "name": "Orca",
    "icon": "🐋",
    "disc": "Alto C + Alto S Águia + Lobo",
    "description": "Analisa com precisão e age com calma. Diagnostica problemas sem pressa mas sem hesitar quando o momento chega. A constância que mantém o NOC funcionando mesmo sem incidente.",
    "strengths": [
      "Diagnóstico preciso",
      "Execução confiável",
      "Calmo sob pressão",
      "Combina análise e constância"
    ],
    "attention": [
      "Pode parecer omisso quando está analisando",
      "Dificuldade em impor urgência ao time"
    ],
    "color": "#5B8FAA",
    "autonomy": "Moderada age com segurança quando tem dados. Escala em situações genuinamente incertas. Não é dependência: é cautela fundamentada.",
    "consistency": "Muito alta combina a confiabilidade do Lobo com o rigor da Águia.",
    "motivation": "Resolver problemas com precisão, ser o profissional mais confiável do time, ambientes previsíveis com desafios técnicos reais.",
    "managerGuide": "Confie no processo analítico dele. Defina quando a decisão precisa ser tomada. Valorize a confiabilidade acima da velocidade.",
    "image": "/behavioral-profiles/orca.png"
  },
  "cisne": {
    "key": "cisne",
    "name": "Cisne",
    "icon": "🦢",
    "disc": "Alto I + Alto S Golfinho + Lobo",
    "description": "Cria vínculos com facilidade e mantém o time coeso. Social como o Golfinho, paciente e leal como o Lobo. O termômetro de relacionamento do time.",
    "strengths": [
      "Constrói relações duradouras",
      "Resolve conflitos com leveza",
      "Lealdade + empatia"
    ],
    "attention": [
      "Pode evitar decisões difíceis para não magoar ninguém",
      "Alta sensibilidade a ambientes hostis"
    ],
    "color": "#5BAA8A",
    "autonomy": "Moderada prefere agir com respaldo do time ou gestor. Em situações novas, consulta antes de decidir.",
    "consistency": "Alta confiabilidade nos relacionamentos e nas entregas.",
    "motivation": "Harmonia no time, ser querido e confiável, ajudar as pessoas a crescerem, ambientes de colaboração e estabilidade.",
    "managerGuide": "Mantenha ambiente seguro. Dê tempo para processar mudanças. Valorize a lealdade. Proteja-o de conflitos desnecessários.",
    "image": "/behavioral-profiles/cisne.png"
  },
  "leao": {
    "key": "leao",
    "name": "Leão",
    "icon": "🦁",
    "disc": "Alto D + Alto I Tigre + Golfinho",
    "description": "Lidera pelo carisma e pela força. Convence, motiva e decide com velocidade. A combinação mais natural para liderança de times em expansão.",
    "strengths": [
      "Liderança natural",
      "Comunicação persuasiva",
      "Alta energia",
      "Mobiliza o time"
    ],
    "attention": [
      "Pode atropelar processos na pressa",
      "Dificuldade em desacelerar para ouvir"
    ],
    "color": "#D4903A",
    "autonomy": "Alta age por convicção e mobiliza outros. Pode tomar decisões sem consulta suficiente.",
    "consistency": "Boa em ambientes dinâmicos. Pode se dispersar quando falta desafio.",
    "motivation": "Liderar pessoas, ser visto como referência, crescer rápido, ter impacto visível nos resultados do time.",
    "managerGuide": "Canalize a energia para desafios reais. Dê liderança de projetos. Reconheça publicamente. Use o carisma como ativo do time.",
    "image": "/behavioral-profiles/leao.png"
  },
  "onca": {
    "key": "onca",
    "name": "Onça",
    "icon": "🐆",
    "disc": "Alto C + Alto D Águia + Tigre",
    "description": "Observa com atenção, age com força. Não age por impulso mas também não paralisa. O perfil chamado quando cai uma região inteira.",
    "strengths": [
      "Decide bem E rápido",
      "Visão sistêmica + ação",
      "Não improvisa nem procrastina"
    ],
    "attention": [
      "Excessivamente crítico com quem improvisa",
      "Alta autocrítica"
    ],
    "color": "#8B4DB8",
    "autonomy": "Alta combina análise rápida com ação decisiva. Decide bem com pouca informação disponível.",
    "consistency": "Alta entrega com qualidade e velocidade.",
    "motivation": "Resolver problemas complexos de alto impacto, ser reconhecido pela qualidade da decisão, ambientes com desafios reais e autonomia técnica.",
    "managerGuide": "Dê desafios de alto impacto. Confie nas análises. Evite decisões sem base. Reconheça pela qualidade técnica, não apenas pela velocidade.",
    "image": "/behavioral-profiles/onca.png"
  },
  "puma": {
    "key": "puma",
    "name": "Puma",
    "icon": "🐾",
    "disc": "Alto D + Alto D técnico Tigre + Falcão",
    "description": "Entrega nos dois mundos. Fecha meta no comercial e resolve no campo quando precisa. Age com velocidade tanto em reunião quanto em telhado. Raro, versátil, difícil de substituir.",
    "strengths": [
      "Alta adaptabilidade",
      "Autoconfiança",
      "Resolve em qualquer contexto",
      "Velocidade de execução",
      "Versatilidade"
    ],
    "attention": [
      "Pode se dispersar entre frentes simultâneas",
      "Dificuldade em especialização profunda"
    ],
    "color": "#B5651D",
    "autonomy": "Muito alta age em qualquer contexto sem precisar de direcionamento constante. Risco: pode ultrapassar limites sem perceber.",
    "consistency": "Boa quando foca. Tende a se espalhar entre muitas frentes simultâneas.",
    "motivation": "Ser desafiado em múltiplas frentes, ter autonomia para atuar tanto no comercial quanto no campo, ser referência por versatilidade.",
    "managerGuide": "Desafie com variedade. Dê projetos que cruzem áreas. Evite rotinas repetitivas. Valorize a adaptação como diferencial.",
    "image": "/behavioral-profiles/puma.png"
  }
};
