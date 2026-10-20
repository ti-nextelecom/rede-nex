// Explicit, local command catalogue. No arbitrary URLs, remote model output,
// dynamic code execution or writes. Draft commands only open native forms.
const normalize=value=>String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const routes={
  '/tarefas':new Set(['tarefa','protocolo','acao','titulo','busca','dia','hora','escopo']),
  '/projetos':new Set(['projeto','acao','titulo','busca']),
  '/calendario':new Set(['acao','titulo','dia','hora','visao']),
  '/bate-papo':new Set(),'/drive':new Set(),'/notas':new Set(),
};
export function isDashboardDestination(value) {
  if(typeof value!=='string' || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x1f]/.test(value) || value.length>2000)return false;
  const url=new URL(value,'https://nex.invalid');
  return url.origin==='https://nex.invalid' && !url.hash && !!routes[url.pathname] && [...url.searchParams.keys()].every(key=>routes[url.pathname].has(key));
}
const destination=(path,params)=>path+'?'+new URLSearchParams(Object.entries(params).filter(([,v])=>v)).toString();
function dateAfter(date,days){const value=new Date(date+'T12:00:00Z');value.setUTCDate(value.getUTCDate()+days);return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0,10);}
export function commandDraft(message,today) {
  const text=normalize(message.replace(/[“"][^”"]*[”"]/g,''));
  const issues=[];
  let day=/\bamanha\b/.test(text) ? dateAfter(today,1) : /\bhoje\b/.test(text) ? today : '';
  const explicit=/\b(\d{2})\/(\d{2})\/(\d{4})\b/.exec(text);
  if(explicit){const candidate=`${explicit[3]}-${explicit[2]}-${explicit[1]}`;const date=new Date(candidate+'T12:00:00Z');day=Number(explicit[3])>=1900&&Number(explicit[3])<=2200&&!Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===candidate ? candidate : '';if(!day)issues.push('Informe uma data válida no formato DD/MM/AAAA.');}
  const clock=/\bas\s+(\d{1,2})(?::(\d{1,2})|h(\d{1,2})?)?\b|\b(\d{1,2})h(\d{1,2})?\b/.exec(text);
  const hour=clock ? Number(clock[1]??clock[4]) : -1;
  const minute=Number(clock?.[2] || clock?.[3] || clock?.[5] || '0');
  const time=clock&&hour>=0&&hour<=23&&minute<=59 ? `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}` : '';
  if(clock&&!time)issues.push('Informe um horário válido entre 00:00 e 23:59.');
  const quoted=/[“"]([^”"]{2,200})[”"]/.exec(message);
  const tail=message.replace(/^.*?\b(?:tarefa|projeto|lembrete)\b\s*/i,'').replace(/^(?:me\s+lembre|lembre-me)\s*/i,'').replace(/^(?:chamad[ao]|com\s+(?:o\s+)?nome|para|de)\s*/i,'').replace(/^[:\s]+/,'');
  const title=quoted?.[1] || tail.replace(/\s+(?:amanh[ãa]|hoje|(?:dia\s+)?\d{2}\/\d{2}\/\d{4}|[àa]s\s+\d{1,2}(?::\d{2}|h\d{0,2})?)(?=\s|$|[,.!?]).*$/i,'').trim();
  return {title:title.slice(0,200),day,time,issues};
}
const generic=new Set(['abrir','abra','abre','acesse','acessar','ir','para','va','quero','meus','minhas','minha','meu','o','a','os','as','um','uma','de','do','da','por','favor','projeto','projetos','tarefa','tarefas']);
function matching(rows,target,field){
  const words=normalize(target).split(/[^a-z0-9]+/).filter(word=>word.length>1&&!generic.has(word));
  if(!words.length)return [];
  return rows.filter(row=>words.every(word=>normalize(row[field]).includes(word)));
}
export function resolveDashboardCommand(message,briefing,previous={}) {
  const text=normalize(message);
  const reply=(content,actions=[],command,topic='commands',projectId)=>({content,actions,...(command?{command}:{}),context:{topic,...(projectId?{projectId}:{})}});
  if(/\b(?:nao|nunca)\b.{0,30}\b(?:abra|abrir|acesse|crie|criar|prepare)\b/.test(text))return reply('Certo. Não executei nenhuma ação.');
  const opening=/\b(?:abrir|abra|abre|acesse|acessar|va para|ir para)\b/.test(text);
  const creating=/\b(?:crie|criar|nova|novo|cadastre|cadastrar|prepare|preparar)\b/.test(text)||/\bme lembre\b|\blembre-me\b/.test(text);
  if(!opening&&!creating)return null;
  const project=/\bprojetos?\b/.test(text),task=/\btarefas?\b/.test(text),reminder=/\blembretes?\b|\bme lembre\b|\blembre-me\b/.test(text),calendar=/\bagenda\b|\bcalendario\b|\beventos?\b/.test(text);
  if([project,task,reminder||calendar].filter(Boolean).length>1)return reply('Qual ação você quer executar primeiro? Abro um módulo de cada vez.',[{label:'Projetos',to:'/projetos'},{label:'Tarefas',to:'/tarefas'},{label:'Agenda',to:'/calendario'}]);
  if(creating&&(project||task||reminder||calendar)){
    const draft=commandDraft(message,briefing.date);
    if(draft.issues.length)return reply(draft.issues.join(' ')+' Não preparei nenhum formulário.');
    const path=project?'/projetos':task?'/tarefas':'/calendario';
    const type=project?'projeto':task?'tarefa':reminder?'lembrete na agenda':'evento';
    const empty=/^(?:novo|nova|crie|criar)?\s*$/.test(normalize(draft.title));
    const to=destination(path,{acao:'novo',titulo:empty?'':draft.title,...(!project?{dia:draft.day,hora:draft.time}:{})});
    return reply(`Posso abrir o formulário de ${type}${!empty?` com o título “${draft.title}”`:''}. Revise os dados e confirme o salvamento na tela. Nada foi criado ainda.${reminder?' O lembrete será um registro na sua agenda, sem promessa de alarme ou notificação automática.':''}` ,[],{kind:'prepare',to,label:`Revisar ${type}`});
  }
  if(project){
    const rows=briefing.projects||[];
    const target=message.replace(/^.*?\bprojetos?\b\s*/i,'').trim();
    const matches=/\b(?:esse|este|ultimo|dele)\b/.test(text)&&previous.projectId?rows.filter(row=>row.id===previous.projectId):matching(rows,target,'name');
    if(matches.length===1){const item=matches[0];return reply(`Abrindo ${item.name}.`,[],{kind:'navigate',to:`/projetos?projeto=${encodeURIComponent(item.id)}`,label:item.name},'projects',item.id);}
    if(matches.length>1)return reply('Encontrei mais de um projeto. Qual deles você quer abrir?',matches.map(item=>({label:item.name,to:`/projetos?projeto=${encodeURIComponent(item.id)}`})),undefined,'projects');
    if(/\bmeus\b/.test(text)&&!target)return reply('Escolha um dos projetos em que você está envolvido.',rows.map(item=>({label:item.name,to:`/projetos?projeto=${encodeURIComponent(item.id)}`})),undefined,'projects');
    const to=target?destination('/projetos',{busca:target}):'/projetos';
    return reply(target?'Vou abrir a busca de projetos. Não confirmei uma correspondência no resumo atual.':'Abrindo Projetos.',[],{kind:'navigate',to,label:'Projetos'});
  }
  if(task){
    const target=message.replace(/^.*?\btarefas?\b\s*/i,'').trim();
    const matches=matching(briefing.focus||[],target,'title');
    if(matches.length===1){const item=matches[0];return reply(`Abrindo ${item.title}.`,[],{kind:'navigate',to:`/tarefas?tarefa=${encodeURIComponent(item.id)}`,label:item.title});}
    if(matches.length>1)return reply('Qual destas tarefas você quer abrir?',matches.map(item=>({label:item.title,to:`/tarefas?tarefa=${encodeURIComponent(item.id)}`})));
    const scope=/vencid|atrasad/.test(text)?'overdue':/hoje/.test(text)?'today':'';
    const to=scope?destination('/tarefas',{escopo:scope}):target?destination('/tarefas',{busca:target}):'/tarefas';
    return reply('Abrindo suas tarefas'+(target&&!scope?' com a busca solicitada.':'.'),[],{kind:'navigate',to,label:'Tarefas'});
  }
  if(reminder||calendar)return reply(reminder?'Abrindo sua agenda, onde você pode consultar e agendar os lembretes. Não existe uma central de alarmes separada.':'Abrindo sua agenda.',[],{kind:'navigate',to:'/calendario?visao=agenda',label:'Agenda'});
  const simple=[[/\bchat\b|\bconversas\b/,'/bate-papo','Chat'],[/\bdrive\b|\barquivos\b/,'/drive','Drive'],[/\bnotas\b|\banotacoes\b/,'/notas','Notas']].find(([pattern])=>pattern.test(text));
  if(simple&&!creating)return reply(`Abrindo ${simple[2]}.`,[],{kind:'navigate',to:simple[1],label:simple[2]});
  return reply('Posso abrir Projetos, Tarefas, Agenda, Chat, Drive e Notas. Também preparo os formulários de nova tarefa, novo projeto e lembrete na agenda para você revisar. Não executo links externos nem comandos arbitrários.');
}
