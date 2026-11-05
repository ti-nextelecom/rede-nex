import { validatePlan } from '../../shared/architecture.mjs';
const fail=(statusCode,message)=>Object.assign(new Error(message),{statusCode,code:'ARCHITECTURE_ERROR'});
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const clean=(value,max)=>typeof value==='string'?value.trim().replace(/\0/g,'').slice(0,max):'';
export function projectInput(payload) {
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw fail(400,'Projeto inválido.');
  const title=clean(payload.title,160);if(!title)throw fail(400,'Informe o nome do projeto.');
  const ids=value=>{if(!Array.isArray(value)||value.length>100||value.some(id=>!uuid(id)))throw fail(400,'Lista de colaboradores inválida.');return [...new Set(value.map(id=>id.toLowerCase()))];};
  if(!['house','condominium','other'].includes(payload.site_type)||!['private','team'].includes(payload.visibility))throw fail(400,'Tipo de projeto ou compartilhamento inválido.');
  return {title,description:clean(payload.description,4000),client_name:clean(payload.client_name,160),address:clean(payload.address,500),site_type:payload.site_type,is_template:payload.is_template===true,visibility:payload.visibility,editor_ids:ids(payload.editor_ids||[]),viewer_ids:ids(payload.viewer_ids||[]),document:validatePlan(payload.document)};
}
export function architectureRepository(pool) {
  async function transaction(userId,work) {
    const client=await pool.connect();
    try {await client.query('BEGIN');await client.query("SELECT set_config('app.architecture_user_id',$1,true)",[userId]);if(!(await client.query("SELECT 1 FROM public.users WHERE id=$1 AND status='active'",[userId])).rowCount)throw fail(403,'Usuário inativo ou sem acesso.');const result=await work(client);await client.query('COMMIT');return result;}
    catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  const capabilities=(row,userId)=>({...row,can_edit:row.owner_id===userId||row.editor_ids.includes(userId),can_manage:row.owner_id===userId});
  async function members(client,value) {
    const ids=[...new Set([...value.editor_ids,...value.viewer_ids])];if(!ids.length)return;
    const result=await client.query("SELECT id FROM public.users WHERE id=ANY($1::uuid[]) AND status='active'",[ids]);
    if(result.rowCount!==ids.length)throw fail(400,'Selecione apenas colaboradores ativos.');
  }
  async function getRow(client,id,userId,lock=false) {
    const row=(await client.query(`SELECT a.*,u.name AS owner_name FROM public.architecture_projects a JOIN public.users u ON u.id=a.owner_id WHERE a.id=$1 AND (a.owner_id=$2 OR $2=ANY(a.editor_ids) OR $2=ANY(a.viewer_ids) OR (a.visibility='team' AND a.archived_at IS NULL)) ${lock?'FOR UPDATE OF a':''}`,[id,userId])).rows[0];
    if(!row)throw fail(404,'Projeto não encontrado ou sem acesso.');return row;
  }
  return {
    list:(userId,{archived=false,offset=0}={})=>transaction(userId,async client=>{
      const rows=(await client.query(`SELECT a.id,a.owner_id,a.title,a.description,a.client_name,a.address,a.site_type,a.is_template,a.visibility,a.editor_ids,a.viewer_ids,a.revision,a.archived_at,a.updated_at,a.created_at,u.name AS owner_name,
        jsonb_array_length(a.document->'floors') AS floor_count,
        (SELECT coalesce(sum(jsonb_array_length(f->'elements')),0) FROM jsonb_array_elements(a.document->'floors') f) AS element_count,
        jsonb_build_object('version',1,'units','m','width',a.document->'width','height',a.document->'height','layers',a.document->'layers',
          'floors',jsonb_build_array(jsonb_build_object('id',a.document#>'{floors,0,id}','name',a.document#>'{floors,0,name}','background',null,'elements',jsonb_path_query_array(a.document,'$.floors[0].elements[0 to 149]')))) AS preview
        FROM public.architecture_projects a JOIN public.users u ON u.id=a.owner_id
        WHERE ${archived?'a.archived_at IS NOT NULL AND a.owner_id=$1':"a.archived_at IS NULL AND (a.owner_id=$1 OR $1=ANY(a.editor_ids) OR $1=ANY(a.viewer_ids) OR a.visibility='team')"} ORDER BY a.updated_at DESC,a.id LIMIT 101 OFFSET $2`,[userId,Math.max(0,offset)])).rows;
      return {projects:rows.slice(0,100).map(row=>capabilities(row,userId)),has_more:rows.length>100};
    }),
    get:(userId,id)=>transaction(userId,async client=>capabilities(await getRow(client,id,userId),userId)),
    create:(userId,payload)=>{
      const value=projectInput(payload);return transaction(userId,async client=>{await members(client,value);
        const result=await client.query(`INSERT INTO public.architecture_projects(owner_id,title,description,client_name,address,site_type,is_template,visibility,editor_ids,viewer_ids,document)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[userId,value.title,value.description,value.client_name,value.address,value.site_type,value.is_template,value.visibility,value.editor_ids,value.viewer_ids,value.document]);
        return capabilities(result.rows[0],userId);
      });
    },
    save:(userId,id,payload)=>{
      if(!Number.isInteger(payload?.expected_revision)||payload.expected_revision<1)throw fail(400,'Revisão de projeto inválida.');
      const value=projectInput(payload);return transaction(userId,async client=>{
        const accessible=await getRow(client,id,userId);
        if(accessible.owner_id!==userId&&!accessible.editor_ids.includes(userId))throw fail(403,'Você possui acesso de leitura a este projeto.');
        const old=await getRow(client,id,userId,true);
        if(old.archived_at)throw fail(409,'Restaure o projeto antes de editar.');
        if(old.owner_id!==userId&&!old.editor_ids.includes(userId))throw fail(403,'Você possui acesso de leitura a este projeto.');
        if(old.revision!==payload.expected_revision)throw fail(409,'O projeto foi atualizado em outra sessão. Exporte sua cópia antes de reabrir a versão do servidor.');
        if(old.owner_id!==userId&&(old.visibility!==value.visibility||JSON.stringify(old.editor_ids)!==JSON.stringify(value.editor_ids)||JSON.stringify(old.viewer_ids)!==JSON.stringify(value.viewer_ids)))throw fail(403,'Somente o responsável pode alterar o compartilhamento.');
        await members(client,value);
        const result=await client.query(`UPDATE public.architecture_projects SET title=$2,description=$3,client_name=$4,address=$5,site_type=$6,is_template=$7,visibility=$8,editor_ids=$9,viewer_ids=$10,document=$11 WHERE id=$1 RETURNING *`,[id,value.title,value.description,value.client_name,value.address,value.site_type,value.is_template,value.visibility,value.editor_ids,value.viewer_ids,value.document]);
        return capabilities(result.rows[0],userId);
      });
    },
    archive:(userId,id,payload)=>transaction(userId,async client=>{
      const row=await getRow(client,id,userId,true);if(row.owner_id!==userId)throw fail(403,'Somente o responsável pode arquivar ou restaurar.');
      if(typeof payload?.archived!=='boolean'||payload.expected_revision!==row.revision)throw fail(409,'O projeto mudou. Atualize a lista antes de arquivar.');
      return capabilities((await client.query('UPDATE public.architecture_projects SET archived_at=CASE WHEN $2::boolean THEN now() ELSE NULL END WHERE id=$1 RETURNING *',[id,payload.archived])).rows[0],userId);
    }),
  };
}
export function createArchitectureRouter({pool,requireUser,readJson,sendJson,sendError}) {
  const repository=architectureRepository(pool);
  return async(req,res,path)=>{
    if(path!=='/api/architecture/projects'&&!path.startsWith('/api/architecture/projects/'))return false;
    const user=await requireUser(req,res);if(!user)return true;
    res.setHeader('Cache-Control','no-store');
    if(!['GET','HEAD'].includes(req.method)&&req.headers['x-nex-user-id']!==user.id){sendError(req,res,409,'ACCOUNT_CHANGED','A conta mudou. Reabra o projeto antes de salvar.');return true;}
    const parts=path.split('/').filter(Boolean),id=parts[3];
    if(id&&!uuid(id)){sendError(req,res,404,'NOT_FOUND','Projeto não encontrado.');return true;}
    if(parts.length>5||(parts[4]&&parts[4]!=='archive')){sendError(req,res,404,'NOT_FOUND','Rota não encontrada.');return true;}
    try {
      if(!id&&req.method==='GET') {
        const params=new URL(req.url,'http://local').searchParams;const offset=Number(params.get('offset')||0);
        if(!Number.isInteger(offset)||offset<0||offset>100000)throw fail(400,'Página inválida.');
        sendJson(req,res,200,{data:await repository.list(user.id,{archived:params.get('archived')==='1',offset})});
      } else if(!id&&req.method==='POST')sendJson(req,res,201,{data:await repository.create(user.id,await readJson(req))});
      else if(id&&!parts[4]&&req.method==='GET')sendJson(req,res,200,{data:await repository.get(user.id,id)});
      else if(id&&!parts[4]&&req.method==='PUT')sendJson(req,res,200,{data:await repository.save(user.id,id,await readJson(req))});
      else if(id&&parts[4]==='archive'&&req.method==='PUT')sendJson(req,res,200,{data:await repository.archive(user.id,id,await readJson(req))});
      else sendError(req,res,405,'METHOD_NOT_ALLOWED','Método não permitido.');
    } catch(error) {if(error.statusCode)sendError(req,res,error.statusCode,error.code||'ARCHITECTURE_ERROR',error.message);else if(error.code==='42P01')sendError(req,res,503,'MIGRATION_REQUIRED','O módulo Arquitetura aguarda atualização da API e do banco.');else throw error;}
    return true;
  };
}
