// Static content extracted from the user-supplied HTML. No source scripts are executed.
export const BEHAVIORAL_SOURCE = {
  "file": "NEX_Avatares_v22_quiz_fix_REVISADO-v3.html",
  "sha256": "v22-quiz-fix-revisado-v3",
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
    "text": "Você recebe uma tarefa com objetivo claro, mas sem todos os passos detalhados. O que você faria?",
    "options": [
      {
        "key": "T",
        "text": "Começo pela ação. Se o objetivo está claro, decido como executar e parto direto."
      },
      {
        "key": "A",
        "text": "Levanto as informações que faltam antes de qualquer passo. Preciso entender o contexto para definir o plano de ação."
      },
      {
        "key": "L",
        "text": "Busco um processo existente ou peço orientação antes de começar. Prefiro ter um caminho definido antes de dar o primeiro passo."
      },
      {
        "key": "G",
        "text": "Converso com alguém que já passou por algo parecido. Trabalhar com referência de quem viveu algo semelhante torna a execução mais sólida."
      },
      {
        "key": "F",
        "text": "Monto minha abordagem com base no que já domino sobre o problema. Se o objetivo está claro, não preciso de um roteiro para começar."
      }
    ]
  },
  {
    "id": 2,
    "weight": 2,
    "dimension": "autonomia",
    "text": "Seu gestor está inacessível por 2 horas e você tem uma decisão para tomar dentro da sua área. O que você faria?",
    "options": [
      {
        "key": "T",
        "text": "Decido e executo. Dentro da minha área, tenho autonomia para isso e uso direto."
      },
      {
        "key": "A",
        "text": "Mapeio as variáveis disponíveis e decido quando tiver clareza suficiente do cenário."
      },
      {
        "key": "L",
        "text": "Aguardo o gestor. Prefiro garantir o alinhamento a tomar uma decisão fora do acordado."
      },
      {
        "key": "G",
        "text": "Consulto alguém de confiança antes de agir. Tomar decisões com respaldo de quem eu confio faz parte do meu jeito de trabalhar."
      },
      {
        "key": "F",
        "text": "Avalio os impactos técnicos e decido por conta própria. A lógica do problema me diz o que fazer."
      }
    ]
  },
  {
    "id": 3,
    "weight": 1.5,
    "dimension": "proatividade",
    "text": "Você termina uma tarefa atribuída a você 2 horas antes do prazo. O que você faria?",
    "options": [
      {
        "key": "T",
        "text": "Já começo a próxima prioridade. Tempo parado é tempo que poderia estar sendo usado."
      },
      {
        "key": "A",
        "text": "Uso o tempo para verificar se o resultado está dentro do escopo e se tem algum risco que não foi considerado."
      },
      {
        "key": "L",
        "text": "Comunico ao gestor e aguardo a próxima tarefa. Prefiro que a demanda venha pelo canal correto."
      },
      {
        "key": "G",
        "text": "Ofereço ajuda ao time. Se tem alguém sobrecarregado, faz mais sentido ajudar do que ficar parado."
      },
      {
        "key": "F",
        "text": "Reviso o que fiz antes de fechar. Preciso que o trabalho passe pelo meu crivo antes de considerar concluído."
      }
    ]
  },
  {
    "id": 4,
    "weight": 2,
    "dimension": "responsabilidade",
    "text": "Você identifica um erro seu que pode afetar o resultado de uma entrega. O que você faria?",
    "options": [
      {
        "key": "T",
        "text": "Corrijo imediatamente e sigo. O que importa é resolver e retomar o quanto antes."
      },
      {
        "key": "A",
        "text": "Mapeio o impacto antes de agir. Preciso entender exatamente o que foi afetado antes de tomar qualquer passo."
      },
      {
        "key": "L",
        "text": "Corrijo dentro do processo e comunico ao gestor. Registrar formalmente o que aconteceu é parte da correção para mim."
      },
      {
        "key": "G",
        "text": "Aviso o time antes de qualquer ação. Checar o impacto no time antes de agir é o ponto de partida."
      },
      {
        "key": "F",
        "text": "Analiso o que foi feito e onde a lógica falhou. Preciso entender meu próprio raciocínio antes de propor a correção."
      }
    ]
  },
  {
    "id": 5,
    "weight": 1.5,
    "dimension": "resolucao",
    "text": "No meio de uma atividade você encontra um problema que não estava previsto e não tem no manual. O que você faria?",
    "options": [
      {
        "key": "T",
        "text": "Improviso com o que tenho. Quando o resultado está em jogo, adapto com o que está disponível e sigo."
      },
      {
        "key": "A",
        "text": "Mapeio o cenário antes de qualquer ação. Entender o problema por inteiro é o pré-requisito para qualquer passo."
      },
      {
        "key": "L",
        "text": "Aciono o processo de escalonamento. Quando existe alguém responsável por esse tipo de decisão, acionar é o caminho correto."
      },
      {
        "key": "G",
        "text": "Chamo alguém com experiência. Decisão desse tipo fica mais segura com quem já viveu algo parecido."
      },
      {
        "key": "F",
        "text": "Estudo o problema e resolvo do zero. Situações sem manual são exatamente onde me sinto mais útil."
      }
    ]
  },
  {
    "id": 6,
    "weight": 1,
    "dimension": "comunicacao",
    "text": "Você está executando uma tarefa longa. Como você comunica o andamento?",
    "options": [
      {
        "key": "T",
        "text": "Aviso quando tenho resultado para mostrar. Se não tem entrega concreta, não tem o que reportar."
      },
      {
        "key": "A",
        "text": "Reporto quando tenho um retrato claro: o que avançou, o que falta e se tem algo que pode impactar o prazo."
      },
      {
        "key": "L",
        "text": "Sigo o padrão de comunicação definido. Se há um protocolo, é ele que vale."
      },
      {
        "key": "G",
        "text": "Mando atualizações com frequência. Quem está ao redor precisa saber como está andando."
      },
      {
        "key": "F",
        "text": "Compartilho o que precisa ser compartilhado. Nem tudo precisa ser repassado no momento que acontece."
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
        "text": "Ouço com atenção e argumento quando discordo. Preciso entender se a crítica se sustenta antes de ajustar."
      },
      {
        "key": "A",
        "text": "Peço detalhes para entender onde errei. Preciso saber exatamente o que foi diferente do esperado."
      },
      {
        "key": "L",
        "text": "Aceito, anoto e ajusto. Faz sentido ouvir e corrigir quando vem do gestor."
      },
      {
        "key": "G",
        "text": "Fico atento ao tom da conversa e cuido da relação. Me sinto bem quando saio do feedback sem ruído aberto."
      },
      {
        "key": "F",
        "text": "Apresento o embasamento da minha decisão técnica. Preciso de um argumento técnico mais sólido que o meu para revisar a abordagem."
      }
    ]
  },
  {
    "id": 8,
    "weight": 2,
    "dimension": "priorizacao",
    "text": "Você recebe duas demandas urgentes ao mesmo tempo, de origens diferentes. O que você faria?",
    "options": [
      {
        "key": "T",
        "text": "Avalio e priorizo a de maior resultado. Começo pela que mais impacta, sem esperar validação."
      },
      {
        "key": "A",
        "text": "Mapeio o impacto das duas antes de qualquer passo. Com os dados em mãos, a decisão de prioridade fica clara."
      },
      {
        "key": "L",
        "text": "Levo ao gestor. Ele tem a visão completa para definir o que é mais urgente nesse caso."
      },
      {
        "key": "G",
        "text": "Aviso os dois solicitantes antes de agir. Garantir que ninguém ficará sem resposta é o ponto de partida para mim."
      },
      {
        "key": "F",
        "text": "Defino sozinho pela criticidade técnica. O que mais impacta o serviço vai primeiro."
      }
    ]
  },
  {
    "id": 9,
    "weight": 1.5,
    "dimension": "processo",
    "text": "Um procedimento que você conhece bem deixa de funcionar numa situação real. O que você faria?",
    "options": [
      {
        "key": "T",
        "text": "Faço o que é necessário para entregar. O objetivo importa mais que o processo quando o processo falhou."
      },
      {
        "key": "A",
        "text": "Verifico se é uma falha isolada ou se tem impacto em outras partes do processo. Preciso documentar o que encontrei antes de sugerir qualquer ajuste."
      },
      {
        "key": "L",
        "text": "Escalo para o responsável. Alterar um processo requer aprovação, e esse caminho formal existe por um motivo."
      },
      {
        "key": "G",
        "text": "Verifico com colegas se o problema é só comigo. Saber se mais alguém está na mesma situação muda a forma de agir."
      },
      {
        "key": "F",
        "text": "Diagnostico e improviso uma solução técnica. Enquanto o processo formal é revisado, prefiro ter algo funcionando."
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
        "text": "Começar logo. Cada minuto analisando é um minuto a menos executando."
      },
      {
        "key": "A",
        "text": "Analisar antes de agir. Prefiro fazer certo do que ter que refazer."
      },
      {
        "key": "L",
        "text": "Verificar se existe processo ou instrução. Se há um padrão estabelecido, começo por ele."
      },
      {
        "key": "G",
        "text": "Perguntar ao time como foi feito antes. Prefiro ter uma referência de quem já passou por isso."
      },
      {
        "key": "F",
        "text": "Ir atrás da informação técnica e resolver do meu jeito. Me sinto à vontade construindo minha própria abordagem."
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
        "text": "Vou direto ao ponto e pressiono por decisão. Reunião que não termina com ação definida é tempo perdido."
      },
      {
        "key": "A",
        "text": "Questiono dados e peço detalhes. Preciso entender o que está sendo discutido por completo antes de concordar."
      },
      {
        "key": "L",
        "text": "Escuto, anoto e sigo o que for decidido. Decisão coletiva tomada é decisão que vale."
      },
      {
        "key": "G",
        "text": "Fico atento ao clima do grupo. Quando o tom esquenta, prefiro ajudar a destravar."
      },
      {
        "key": "F",
        "text": "Engajo quando o assunto é técnico. No restante, prefiro que seja objetivo e breve."
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
        "text": "Ouço o suficiente para entender o problema e apresento a solução. Meu foco é resolver com objetividade."
      },
      {
        "key": "A",
        "text": "Entendo o problema por completo antes de qualquer passo. Mapear o que está acontecendo de verdade é o pré-requisito para qualquer solução."
      },
      {
        "key": "L",
        "text": "Sigo o protocolo de atendimento. O processo existe para esse tipo de situação."
      },
      {
        "key": "G",
        "text": "Escuto com atenção e cuido do tom da conversa primeiro. É difícil resolver qualquer coisa com alguém ainda no pico emocional."
      },
      {
        "key": "F",
        "text": "Foco em diagnosticar e resolver o problema técnico. É onde consigo contribuir melhor."
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
        "text": "Foco em resolver e retomar. Análise do que deu errado vem depois, quando o problema já estiver resolvido."
      },
      {
        "key": "A",
        "text": "Primeiro preciso entender se foi pontual ou sistêmico. Essa resposta é o que define o tamanho da solução necessária."
      },
      {
        "key": "L",
        "text": "Verifico onde o processo falhou e corrijo dentro dele. Se existe passo de correção definido, é por ele que vou."
      },
      {
        "key": "G",
        "text": "Me preocupo com o impacto nas pessoas. Preciso saber se alguém foi afetado de forma que preciso abordar diretamente."
      },
      {
        "key": "F",
        "text": "Diagnostico a causa técnica e corrijo na raiz. Resolver sem entender o que originou o problema só adia a próxima ocorrência."
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
        "text": "Sigo quando faz sentido para o objetivo. Quando processo e resultado apontam na mesma direção, sigo. Quando conflitam, priorizo o resultado."
      },
      {
        "key": "A",
        "text": "Valorizo processos bem estruturados, mas questiono quando são ineficientes. Processo ruim também precisa ser revisado."
      },
      {
        "key": "L",
        "text": "Sigo com rigor. Processo existe por um motivo e é o que vale até que seja formalmente revisado."
      },
      {
        "key": "G",
        "text": "Sigo, mas considero o impacto nas pessoas. Regra aplicada de forma que destroça um relacionamento desnecessariamente perde o ponto."
      },
      {
        "key": "F",
        "text": "Conheço os processos, mas improviso quando o campo pede. O manual nem sempre cobre o que está na sua frente."
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
        "text": "Apresento logo e começo a executar. Se a ideia faz sentido, o próximo passo natural é testar."
      },
      {
        "key": "A",
        "text": "Verifico o embasamento antes de apresentar. Uma ideia sustentada por dados tem muito mais força na hora de defender."
      },
      {
        "key": "L",
        "text": "Espero o momento certo para apresentar. Uma boa ideia no contexto errado não anda."
      },
      {
        "key": "G",
        "text": "Converso com o time antes. Saber o que as pessoas ao redor pensam faz a ideia chegar mais forte."
      },
      {
        "key": "F",
        "text": "Testo na prática antes de apresentar. Só me sinto confortável defendendo algo que já comprovei por conta própria."
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
        "text": "Defino o que precisa ser feito e cobro execução. Em pressão alta, o papel que assumo naturalmente é mobilizar o time para agir."
      },
      {
        "key": "A",
        "text": "Mantenho a calma e analiso. Mesmo sob pressão, agir sem clareza do que está acontecendo aumenta o problema."
      },
      {
        "key": "L",
        "text": "Sigo o procedimento de emergência. Se há um protocolo definido para crise, é ele que vale."
      },
      {
        "key": "G",
        "text": "Garanto que todas as pessoas envolvidas estejam informadas. Numa crise, ninguém pode estar no escuro."
      },
      {
        "key": "F",
        "text": "Localizo a falha e resolvo com as próprias mãos. Em pressão alta, ir direto ao problema é o que faz sentido para mim."
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
        "text": "Aprendo fazendo. O erro faz parte do processo e é a partir dele que o aprendizado de verdade acontece."
      },
      {
        "key": "A",
        "text": "Busco o contexto geral antes de mergulhar. Preciso entender como esse novo assunto se conecta ao que já sei."
      },
      {
        "key": "L",
        "text": "Prefiro treinamento estruturado. Um caminho definido de capacitação me dá segurança para aprender algo importante."
      },
      {
        "key": "G",
        "text": "Aprendo trocando com alguém que já domina. Discutir o assunto com quem tem experiência acelera muito meu entendimento."
      },
      {
        "key": "F",
        "text": "Abro e descubro por conta própria. Ir fundo nos detalhes sem intermediário é o jeito que funciona melhor para mim."
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
        "text": "Mapeio as oportunidades e começo a contribuir logo. Prefiro agir a ficar em modo de observação quando já dá para ajudar."
      },
      {
        "key": "A",
        "text": "Entendo o sistema e as pessoas-chave antes de propor qualquer coisa. Sugestão com contexto tem muito mais chance de ser bem recebida."
      },
      {
        "key": "L",
        "text": "Entendo os processos e me adapto a eles. Chegar querendo mudar tudo antes de entender como o time funciona não faz sentido."
      },
      {
        "key": "G",
        "text": "Primeiro conheço as pessoas. Me sentir integrado começa pela confiança com o time, não pelas tarefas."
      },
      {
        "key": "F",
        "text": "Mapeio os problemas técnicos. É por onde começo a entender onde posso contribuir de verdade."
      }
    ]
  },
  {
    "id": 19,
    "weight": 2,
    "dimension": "erro_impacto",
    "text": "Você cometeu um erro que causou impacto direto no cliente ou no serviço. O que você faria?",
    "options": [
      {
        "key": "T",
        "text": "Assumo, corrijo e sigo. O que importa é retomar o quanto antes."
      },
      {
        "key": "A",
        "text": "Mapeio quem foi afetado antes de qualquer ação. Entender o tamanho real do impacto define o que a correção precisa alcançar."
      },
      {
        "key": "L",
        "text": "Comunico ao gestor e corrijo dentro do processo. Correção de impacto sem o rastro formal não é a forma que trabalho."
      },
      {
        "key": "G",
        "text": "Me preocupo com quem foi afetado. Cuidar do cliente e do time é o que vem primeiro para mim antes de qualquer ação técnica."
      },
      {
        "key": "F",
        "text": "Vou fundo na parte técnica do que falhou. É onde consigo apurar com mais precisão e garantir que o problema não se repete."
      }
    ]
  },
  {
    "id": 20,
    "weight": 1.5,
    "dimension": "autoridade",
    "text": "Você identifica uma solução para um problema recorrente, mas implementá-la depende de uma autorização que você não tem. O que você faria?",
    "options": [
      {
        "key": "T",
        "text": "Apresento a solução e pressiono por decisão. Uma boa ideia não pode ficar parada na fila de aprovações."
      },
      {
        "key": "A",
        "text": "Estruturo riscos e benefícios antes de escalar. Uma proposta bem embasada tem muito mais chance de ser aprovada."
      },
      {
        "key": "L",
        "text": "Comunico ao gestor e aguardo. Implementar sem aprovação, mesmo com a melhor solução, não é o caminho correto."
      },
      {
        "key": "G",
        "text": "Converso com quem é afetado antes de escalar. Chegar com apoio de quem vai viver com a solução faz toda a diferença."
      },
      {
        "key": "F",
        "text": "Verifico o que está na minha autonomia técnica e resolvo o que posso. Só escalo o que realmente não posso fazer sozinho."
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
