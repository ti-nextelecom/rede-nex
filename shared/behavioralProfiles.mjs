import { BEHAVIORAL_PROFILES, BEHAVIORAL_QUESTIONS, BEHAVIORAL_SOURCE } from './behavioralProfileContent.mjs';
export { BEHAVIORAL_PROFILES, BEHAVIORAL_QUESTIONS, BEHAVIORAL_SOURCE };
export const BEHAVIORAL_VERSION='nex-v22-quiz-fix-v1.0';
export const BEHAVIORAL_KEYS=['T','A','L','G','F'];
export const BEHAVIORAL_MODES=['pure','traits','hybrid','blend','balanced'];
export const BEHAVIORAL_HYBRIDS={A_L:'orca',L_A:'orca',G_L:'cisne',L_G:'cisne',T_G:'leao',G_T:'leao',A_T:'onca',T_A:'onca',T_F:'puma',F_T:'puma'};
export const DIMENSION_LABELS={autonomia:'Autonomia',proatividade:'Proatividade',responsabilidade:'Responsabilidade',resolucao:'Resolução de problemas',comunicacao:'Comunicação',feedback:'Feedback',priorizacao:'Priorização',processo:'Processos',instinto:'Primeira reação',reuniao:'Trabalho em equipe',cliente:'Relacionamento com o cliente',erro:'Diante de imprevistos',ideias:'Novas ideias',pressao:'Situações de pressão',aprendizado:'Aprendizado',time:'Integração no time',erro_impacto:'Erro de alto impacto',autoridade:'Limites de autoridade'};
const invalid=message=>{throw Object.assign(new Error(message),{statusCode:400,code:'INVALID_BEHAVIORAL_ASSESSMENT'});};
export function behavioralAnswers(input,{complete=false}={}) {
  if(!input||typeof input!=='object'||Array.isArray(input))invalid('Respostas inválidas.');
  if(Object.keys(input).some(key=>!BEHAVIORAL_QUESTIONS.some(question=>String(question.id)===key)))invalid('Há uma pergunta desconhecida nas respostas.');
  const answers={};for(const question of BEHAVIORAL_QUESTIONS){const value=input[question.id];if(value===undefined||value===null){if(complete)invalid(`Responda a pergunta ${question.id} antes de concluir.`);continue;}if(!question.options.some(option=>option.key===value))invalid(`Opção inválida na pergunta ${question.id}.`);answers[question.id]=value;}
  return answers;
}
export function behavioralQuestionnaireSnapshot(){return {version:BEHAVIORAL_VERSION,source_sha256:BEHAVIORAL_SOURCE.sha256,questions:structuredClone(BEHAVIORAL_QUESTIONS),hybrid_threshold:.82,traits_threshold:.65,tie_order:[...BEHAVIORAL_KEYS]};}
const ranked=scores=>BEHAVIORAL_KEYS.map(key=>[key,scores[key]]).sort((a,b)=>b[1]-a[1]);
function subScores(answers,ids){const scores=Object.fromEntries(BEHAVIORAL_KEYS.map(key=>[key,0]));for(const question of BEHAVIORAL_QUESTIONS)if(ids.includes(question.id))scores[answers[question.id]]+=question.weight;return scores;}
export function scoreBehavioralProfile(input) {
  const answers=behavioralAnswers(input,{complete:true}),scores=subScores(answers,BEHAVIORAL_QUESTIONS.map(question=>question.id));
  const ranking=ranked(scores),dominant=ranking[0][0],secondary=ranking[1][1]>0?ranking[1][0]:null,max=ranking[0][1],ratio=secondary?scores[secondary]/max:0;
  const ties=ranking.filter(([,score])=>score===max).map(([key])=>key);
  let mode='pure',profileKey=dominant,components=[dominant];
  if(ties.length>2){mode='balanced';profileKey='combined';components=ties;}
  else if(secondary&&ratio>=.82){components=[dominant,secondary];const hybrid=BEHAVIORAL_HYBRIDS[dominant+'_'+secondary];mode=hybrid?'hybrid':'blend';profileKey=hybrid||'combined';}
  else if(secondary&&ratio>=.65){mode='traits';components=[dominant,secondary];}
  const primary=BEHAVIORAL_PROFILES[dominant],profile=structuredClone(BEHAVIORAL_PROFILES[profileKey]||primary);
  const displayName=mode==='balanced'||mode==='blend'?components.map(key=>BEHAVIORAL_PROFILES[key].name).join(' + '):mode==='traits'?`${primary.name} com traços de ${BEHAVIORAL_PROFILES[secondary].name}`:profile.name;
  const autonomyScores=subScores(answers,[1,2,5,8,20]),autonomyWinner=ranked(autonomyScores)[0][0];
  const autonomyMessage=autonomyScores.L===Math.max(...Object.values(autonomyScores))?'As escolhas indicam preferência por validação antes de agir em situações novas. A rotina e o diálogo com o gestor ajudam a contextualizar essa preferência.':['T','F'].includes(autonomyWinner)?'As escolhas sugerem independência de ação, com preferência por decidir e avançar. O alinhamento sobre limites de autoridade ajuda a equilibrar essa preferência.':'As escolhas combinam iniciativa e busca de alinhamento conforme a situação.';
  const responsibilityScores=subScores(answers,[4,19]),responsibilityWinner=ranked(responsibilityScores)[0][0];
  const responsibilityMessages={T:'Diante do erro, as escolhas priorizam correção rápida e continuidade da entrega.',A:'Diante do erro, as escolhas priorizam análise, documentação e aprendizado estruturado.',L:'Diante do erro, as escolhas priorizam os processos de comunicação, correção e registro.',G:'Diante do erro, as escolhas priorizam comunicação e cuidado com as pessoas afetadas.',F:'Diante do erro, as escolhas priorizam o diagnóstico da causa técnica e a prevenção de recorrência.'};
  const total=BEHAVIORAL_QUESTIONS.reduce((sum,question)=>sum+question.weight,0);
  return {version:BEHAVIORAL_VERSION,profile_key:profileKey,mode,dominant_key:dominant,secondary_key:secondary,components,display_name:displayName,icon:mode==='blend'||mode==='balanced'?'🧩':profile.icon,color:profile.color,scores,percentages:Object.fromEntries(BEHAVIORAL_KEYS.map(key=>[key,Math.round(scores[key]/total*1000)/10])),total_weight:total,ratio:Math.round(ratio*1000)/10,ties,profile,component_profiles:components.map(key=>structuredClone(BEHAVIORAL_PROFILES[key])),autonomy:{scores:autonomyScores,key:autonomyWinner,message:autonomyMessage},responsibility:{scores:responsibilityScores,key:responsibilityWinner,message:responsibilityMessages[responsibilityWinner]}};
}
export function behavioralBadge(result){return {profile_key:result.profile_key,mode:result.mode,dominant_key:result.dominant_key,secondary_key:result.secondary_key,components:result.components};}
export function behavioralIdentity(value) {
  if(!value||!BEHAVIORAL_KEYS.includes(value.dominant_key)||!BEHAVIORAL_MODES.includes(value.mode))return null;
  const primary=BEHAVIORAL_PROFILES[value.dominant_key],secondary=BEHAVIORAL_PROFILES[value.secondary_key],profile=BEHAVIORAL_PROFILES[value.profile_key];
  const components=(Array.isArray(value.components)?value.components:[]).filter(key=>BEHAVIORAL_KEYS.includes(key));
  const name=['blend','balanced'].includes(value.mode)?components.map(key=>BEHAVIORAL_PROFILES[key].name).join(' + '):value.mode==='traits'&&secondary?`${primary.name} com traços de ${secondary.name}`:profile?.name||primary.name;
  return {name:name||primary.name,icon:['blend','balanced'].includes(value.mode)?'🧩':profile?.icon||primary.icon,color:profile?.color||primary.color,image:profile?.image||primary.image,combination:components.map(key=>BEHAVIORAL_PROFILES[key].name).join(' + ')};
}
