// URL intents are drafts only. These helpers never submit forms or call APIs.
export function readAssistantIntent(params:URLSearchParams) {
  const day=params.get('dia') || '';
  const parsed=new Date(day+'T12:00:00Z');
  const validDay=/^\d{4}-\d{2}-\d{2}$/.test(day)&&!Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===day;
  const time=params.get('hora') || '';
  return {create:params.get('acao')==='novo',title:(params.get('titulo') || '').slice(0,200),search:(params.get('busca') || '').slice(0,200),day:validDay?day:'',time:/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)?time:'',scope:['mine','overdue','today'].includes(params.get('escopo') || '')?params.get('escopo') as 'mine'|'overdue'|'today':null};
}
export function clearAssistantIntent(params:URLSearchParams) {
  const next=new URLSearchParams(params);
  for(const key of ['acao','titulo','dia','hora','busca','escopo','visao'])next.delete(key);
  return next;
}
