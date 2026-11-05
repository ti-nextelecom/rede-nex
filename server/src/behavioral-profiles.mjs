import { randomUUID } from 'node:crypto';
import { behavioralAnswers, behavioralBadge, behavioralQuestionnaireSnapshot, BEHAVIORAL_VERSION, scoreBehavioralProfile } from '../../shared/behavioralProfiles.mjs';
const fail=(statusCode,message)=>Object.assign(new Error(message),{statusCode,code:'BEHAVIORAL_PROFILE_ERROR'});
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const allowed=(payload,fields)=>{if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.keys(payload).some(key=>!fields.includes(key)))throw fail(400,'Solicitação de avaliação inválida.');};
const revision=value=>Number.isInteger(value)&&value>0&&value<2147483647;
const version=value=>{if(value!==BEHAVIORAL_VERSION)throw fail(409,'O questionário foi atualizado. Atualize a página antes de continuar.');};
const cleanSummary=row=>({id:row.id,attempt_id:row.attempt_id,questionnaire_version:row.questionnaire_version,submitted_at:row.submitted_at,display_name:row.result.display_name,...behavioralBadge(row.result)});
export function behavioralRepository(pool){
  async function transaction(userId,work,{write=false}={}){
    const client=await pool.connect();try{await client.query('BEGIN');await client.query("SELECT set_config('app.behavioral_user_id',$1,true)",[userId]);
      const actor=(await client.query("SELECT u.id,u.name,u.position,u.department_id,d.name AS department_name,public.behavioral_is_admin() AS is_admin FROM public.users u LEFT JOIN public.departments d ON d.id=u.department_id WHERE u.id=$1 AND u.status='active'",[userId])).rows[0];
      if(!actor)throw fail(403,'Usuário inativo ou sem acesso.');
      if(write)await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['behavioral-profile:'+userId]);
      const result=await work(client,actor);await client.query('COMMIT');return result;
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  async function subject(client,id){const row=(await client.query(`SELECT u.id,u.name,u.position,u.department_id,u.photo_url,d.name AS department_name,m.name AS manager_name FROM public.users u LEFT JOIN public.departments d ON d.id=u.department_id LEFT JOIN public.users m ON m.id=d.manager_id WHERE u.id=$1 AND public.behavioral_can_read(u.id)`,[id])).rows[0];if(!row)throw fail(404,'Colaborador não encontrado ou fora da sua hierarquia.');return row;}
  async function details(client,id){const user=await subject(client,id);const history=(await client.query('SELECT * FROM public.behavioral_assessments WHERE user_id=$1 AND public.behavioral_can_read(user_id) ORDER BY submitted_at DESC,id DESC LIMIT 21',[id])).rows;return {user,latest:history[0]||null,history:history.slice(0,20).map(cleanSummary),has_more:history.length>20};}
  const draft=(client,userId)=>client.query('SELECT * FROM public.behavioral_drafts WHERE user_id=$1 AND user_id=public.behavioral_actor_id()',[userId]).then(result=>result.rows[0]||null);
  const latestId=(client,userId)=>client.query('SELECT id FROM public.behavioral_assessments WHERE user_id=$1 AND public.behavioral_can_read(user_id) ORDER BY submitted_at DESC,id DESC LIMIT 1',[userId]).then(result=>result.rows[0]?.id||null);
  return {
    me:userId=>transaction(userId,async(client,actor)=>{const departments=(await client.query('SELECT id,name,parent_id FROM public.departments WHERE manager_id=$1 ORDER BY name',[userId])).rows;return {...await details(client,userId),draft:await draft(client,userId),version:BEHAVIORAL_VERSION,can_manage:actor.is_admin||departments.length>0,is_admin:actor.is_admin,managed_departments:departments};}),
    start:(userId,payload)=>{
      allowed(payload,['expected_latest_id','restart','expected_draft_revision']);if(payload.expected_latest_id!==null&&!uuid(payload.expected_latest_id))throw fail(400,'Referência da última avaliação inválida.');
      return transaction(userId,async client=>{const latest=await latestId(client,userId);if(latest!==payload.expected_latest_id)throw fail(409,'Seu perfil foi atualizado em outra sessão. Atualize antes de iniciar uma avaliação.');const current=await draft(client,userId);
        if(current&&payload.restart!==true)return current;
        if(current){if(current.revision!==payload.expected_draft_revision)throw fail(409,'O rascunho mudou em outra sessão. Atualize antes de reiniciar.');return (await client.query("UPDATE public.behavioral_drafts SET attempt_id=$2,questionnaire_version=$3,answers='{}',revision=revision+1,started_at=now(),updated_at=now() WHERE user_id=$1 RETURNING *",[userId,randomUUID(),BEHAVIORAL_VERSION])).rows[0];}
        return (await client.query('INSERT INTO public.behavioral_drafts(user_id,questionnaire_version) VALUES($1,$2) RETURNING *',[userId,BEHAVIORAL_VERSION])).rows[0];
      },{write:true});
    },
    saveDraft:(userId,payload)=>{
      allowed(payload,['attempt_id','questionnaire_version','expected_revision','answers']);version(payload.questionnaire_version);if(!uuid(payload.attempt_id)||!revision(payload.expected_revision))throw fail(400,'Identificação do rascunho inválida.');const answers=behavioralAnswers(payload.answers);
      return transaction(userId,async client=>{const current=await draft(client,userId);if(!current||current.attempt_id!==payload.attempt_id||current.questionnaire_version!==BEHAVIORAL_VERSION||current.revision!==payload.expected_revision)throw fail(409,'O rascunho mudou ou já foi concluído. Atualize a página para continuar.');if(JSON.stringify(current.answers)===JSON.stringify(answers))return current;
        return (await client.query('UPDATE public.behavioral_drafts SET answers=$2,revision=revision+1,updated_at=now() WHERE user_id=$1 RETURNING *',[userId,answers])).rows[0];
      },{write:true});
    },
    submit:(userId,payload)=>{
      allowed(payload,['attempt_id','questionnaire_version','expected_revision','answers']);version(payload.questionnaire_version);if(!uuid(payload.attempt_id)||!revision(payload.expected_revision))throw fail(400,'Identificação da avaliação inválida.');const answers=behavioralAnswers(payload.answers,{complete:true});
      return transaction(userId,async(client,actor)=>{
        const existing=(await client.query('SELECT * FROM public.behavioral_assessments WHERE user_id=$1 AND attempt_id=$2 AND public.behavioral_can_read(user_id)',[userId,payload.attempt_id])).rows[0];
        if(existing){if(existing.questionnaire_version!==payload.questionnaire_version||JSON.stringify(existing.answers)!==JSON.stringify(answers))throw fail(409,'Esta avaliação já foi concluída com outras respostas.');return existing;}
        const current=await draft(client,userId);if(!current||current.attempt_id!==payload.attempt_id||current.questionnaire_version!==BEHAVIORAL_VERSION||current.revision!==payload.expected_revision||JSON.stringify(current.answers)!==JSON.stringify(answers))throw fail(409,'Suas respostas foram alteradas em outra sessão. Atualize e revise antes de concluir.');
        const result=scoreBehavioralProfile(answers),snapshot={name:String(actor.name||'').slice(0,160),position:String(actor.position||'').slice(0,500),department_id:actor.department_id,department_name:String(actor.department_name||'').slice(0,160)};
        const row=(await client.query('INSERT INTO public.behavioral_assessments(user_id,attempt_id,questionnaire_version,answers,questionnaire,result,subject_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[userId,payload.attempt_id,BEHAVIORAL_VERSION,answers,behavioralQuestionnaireSnapshot(),result,snapshot])).rows[0];
        await client.query(`INSERT INTO public.behavioral_badges(user_id,assessment_id,profile_key,mode,dominant_key,secondary_key,components,questionnaire_version,submitted_at)
          SELECT user_id,id,result->>'profile_key',result->>'mode',result->>'dominant_key',result->>'secondary_key',result->'components',questionnaire_version,submitted_at FROM public.behavioral_assessments WHERE id=$1 AND user_id=$2
          ON CONFLICT(user_id) DO UPDATE SET assessment_id=EXCLUDED.assessment_id,profile_key=EXCLUDED.profile_key,mode=EXCLUDED.mode,dominant_key=EXCLUDED.dominant_key,secondary_key=EXCLUDED.secondary_key,components=EXCLUDED.components,questionnaire_version=EXCLUDED.questionnaire_version,submitted_at=EXCLUDED.submitted_at`,[row.id,userId]);
        await client.query('DELETE FROM public.behavioral_drafts WHERE user_id=$1 AND attempt_id=$2',[userId,payload.attempt_id]);return row;
      },{write:true});
    },
    badges:userId=>transaction(userId,async client=>(await client.query(`SELECT b.user_id,b.profile_key,b.mode,b.dominant_key,b.secondary_key,b.components,b.submitted_at FROM public.behavioral_badges b JOIN public.users u ON u.id=b.user_id WHERE u.status='active' ORDER BY b.user_id`)).rows),
    user:(userId,targetId)=>transaction(userId,client=>details(client,targetId)),
    assessment:(userId,id)=>transaction(userId,async client=>{const row=(await client.query('SELECT * FROM public.behavioral_assessments WHERE id=$1 AND public.behavioral_can_read(user_id)',[id])).rows[0];if(!row)throw fail(404,'Avaliação não encontrada ou sem acesso.');return row;}),
    history:(userId,targetId,offset=0)=>transaction(userId,async client=>{await subject(client,targetId);const rows=(await client.query('SELECT * FROM public.behavioral_assessments WHERE user_id=$1 AND public.behavioral_can_read(user_id) ORDER BY submitted_at DESC,id DESC LIMIT 21 OFFSET $2',[targetId,offset])).rows;return {history:rows.slice(0,20).map(cleanSummary),has_more:rows.length>20};}),
    team:(userId,{search='',status='all',profile='',offset=0}={})=>transaction(userId,async(client,actor)=>{
      if(!actor.is_admin&&!(await client.query('SELECT 1 FROM public.departments WHERE manager_id=$1 LIMIT 1',[userId])).rowCount)throw fail(403,'A área de gestão exige uma equipe vinculada no organograma.');
      const filter=`($5::boolean OR (u.status='active' AND u.id<>$1::uuid)) AND public.behavioral_can_read(u.id) AND ($2='' OR u.name ILIKE '%'||$2||'%' OR d.name ILIKE '%'||$2||'%') AND ($3='all' OR ($3='completed' AND b.user_id IS NOT NULL) OR ($3='pending' AND b.user_id IS NULL)) AND ($4='' OR b.profile_key=$4)`;
      const values=[userId,String(search).slice(0,160),status,profile,actor.is_admin];
      const badgeSource=actor.is_admin?`LEFT JOIN LATERAL (SELECT a.user_id,a.id AS assessment_id,a.result->>'profile_key' AS profile_key,a.result->>'mode' AS mode,a.result->>'dominant_key' AS dominant_key,a.result->>'secondary_key' AS secondary_key,a.result->'components' AS components,a.submitted_at FROM public.behavioral_assessments a WHERE a.user_id=u.id AND public.behavioral_can_read(a.user_id) ORDER BY a.submitted_at DESC,a.id DESC LIMIT 1) b ON true`:'LEFT JOIN public.behavioral_badges b ON b.user_id=u.id';
      const base='FROM public.users u LEFT JOIN public.departments d ON d.id=u.department_id LEFT JOIN public.users m ON m.id=d.manager_id '+badgeSource+' WHERE '+filter;
      const stats=(await client.query(`SELECT count(*)::int AS total,count(b.user_id)::int AS completed,count(*) FILTER(WHERE b.user_id IS NULL)::int AS pending ${base}`,values)).rows[0];
      const rows=(await client.query(`SELECT u.id,u.name,u.position,u.photo_url,u.status AS user_status,u.department_id,d.name AS department_name,m.name AS manager_name,b.assessment_id,b.profile_key,b.mode,b.dominant_key,b.secondary_key,b.components,b.submitted_at ${base} ORDER BY u.name,u.id LIMIT 101 OFFSET $6`,[...values,offset])).rows;
      return {members:rows.slice(0,100),has_more:rows.length>100,stats};
    }),
  };
}
export function createBehavioralRouter({pool,requireUser,readJson,sendJson,sendError}){
  const repo=behavioralRepository(pool);
  return async(req,res,path)=>{
    const prefix='/api/behavioral-profiles';if(path!==prefix&&!path.startsWith(prefix+'/'))return false;
    const user=await requireUser(req,res);if(!user)return true;res.setHeader('Cache-Control','no-store');
    if(!['GET','HEAD'].includes(req.method)&&req.headers['x-nex-user-id']!==user.id){sendError(req,res,409,'ACCOUNT_CHANGED','A conta mudou. Reabra o módulo antes de responder.');return true;}
    const route=path.slice(prefix.length),params=new URL(req.url,'http://local').searchParams;
    const page=()=>{const value=Number(params.get('offset')||0);if(!Number.isInteger(value)||value<0||value>100000)throw fail(400,'Página inválida.');return value;};
    try{
      let data;
      if(route==='/me'&&req.method==='GET')data=await repo.me(user.id);
      else if(route==='/me/start'&&req.method==='POST')data=await repo.start(user.id,await readJson(req));
      else if(route==='/me/draft'&&req.method==='PUT')data=await repo.saveDraft(user.id,await readJson(req));
      else if(route==='/me/submit'&&req.method==='POST')data=await repo.submit(user.id,await readJson(req));
      else if(route==='/badges'&&req.method==='GET')data=await repo.badges(user.id);
      else if(route==='/team'&&req.method==='GET'){
        const status=params.get('status')||'all',profile=params.get('profile')||'';
        if(!['all','completed','pending'].includes(status)||!['','T','A','L','G','F','orca','cisne','leao','onca','puma','combined'].includes(profile))throw fail(400,'Filtro inválido.');
        data=await repo.team(user.id,{search:params.get('q')||'',status,profile,offset:page()});
      }else if(/^\/users\/[^/]+(?:\/history)?$/.test(route)&&req.method==='GET'){
        const pieces=route.split('/'),id=pieces[2];if(!uuid(id))throw fail(404,'Colaborador não encontrado.');data=pieces[3]==='history'?await repo.history(user.id,id,page()):await repo.user(user.id,id);
      }else if(/^\/assessments\/[^/]+$/.test(route)&&req.method==='GET'){
        const id=route.split('/')[2];if(!uuid(id))throw fail(404,'Avaliação não encontrada.');data=await repo.assessment(user.id,id);
      }else{sendError(req,res,404,'NOT_FOUND','Rota não encontrada.');return true;}
      sendJson(req,res,200,{data});
    }catch(error){if(error.statusCode)sendError(req,res,error.statusCode,error.code||'BEHAVIORAL_PROFILE_ERROR',error.message);else if(['42P01','42883'].includes(error.code))sendError(req,res,503,'MIGRATION_REQUIRED','O módulo Perfil Comportamental aguarda atualização da API e do banco.');else throw error;}
    return true;
  };
}
