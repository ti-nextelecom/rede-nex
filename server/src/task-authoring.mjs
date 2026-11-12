import { addChecklist, createTask, createTaskTemplate, getTask, getTaskTemplate, listTaskFiles } from './tasks.repository.js';
import { blueprintFromTask, blueprintFromTemplate, cloneTaskBlueprint } from '../../shared/taskBlueprint.mjs';
import { canAccessTaskFiles } from '../../shared/taskMedia.mjs';
import { canManageTask, taskPeopleInputError } from '../../shared/taskCollaboration.mjs';
const invalid=(message,statusCode=400)=>{throw Object.assign(new Error(message),{statusCode});};
const isId=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function createTaskAuthoringRouter({requireUser,readJson,sendJson,sendError,onCreated=async()=>{}}){
  return async(req,res,path)=>{
    const clone=/^\/api\/tasks\/([^/]+)\/clone$/.exec(path),checklist=/^\/api\/tasks\/([^/]+)\/checklists$/.exec(path);
    const newTask=path==='/api/tasks'&&req.method==='POST',newTemplate=path==='/api/tasks/templates'&&req.method==='POST';
    if(!newTask&&!newTemplate&&!(clone&&req.method==='GET')&&!(checklist&&req.method==='POST'))return false;
    const actor=await requireUser(req,res);if(!actor)return true;
    res.setHeader('Cache-Control','no-store');
    try{
      if(clone){
        if(!isId(clone[1]))invalid('Tarefa n\u00e3o encontrada.',404);
        const source=await getTask(clone[1]);if(!canAccessTaskFiles(source,actor))invalid('Sem acesso \u00e0 tarefa original.',403);
        const files=await listTaskFiles(source.id);
        sendJson(req,res,200,{data:{source_task_id:source.id,custom_list_id:source.custom_list_id,blueprint:cloneTaskBlueprint(source,files)}});return true;
      }
      const payload=await readJson(req);
      if(!payload||typeof payload!=='object'||Array.isArray(payload))invalid('Dados inv\u00e1lidos.');
      if(typeof payload.title!=='string'||!payload.title.trim())invalid('Informe um t\u00edtulo.');
      if(newTemplate){
        if(payload.source_task_id){
          if(!isId(payload.source_task_id))invalid('Tarefa original inv\u00e1lida.');
          const source=await getTask(payload.source_task_id);if(!canAccessTaskFiles(source,actor))invalid('Sem acesso \u00e0 tarefa original.',403);
          payload.task_snapshot=blueprintFromTask(source,await listTaskFiles(source.id));
        }else if(payload.source_template_id){
          if(!isId(payload.source_template_id))invalid('Modelo original inv\u00e1lido.');
          const source=await getTaskTemplate(payload.source_template_id,actor.id);if(!source)invalid('Sem acesso ao modelo original.',403);
          payload.task_snapshot=payload.task_snapshot||blueprintFromTemplate(source);
        }
        sendJson(req,res,201,{data:await createTaskTemplate(actor.id,payload)});return true;
      }
      if(checklist){
        if(!isId(checklist[1]))invalid('Tarefa n\u00e3o encontrada.',404);
        const source=await getTask(checklist[1]);if(!source)invalid('Tarefa n\u00e3o encontrada.',404);
        if(!canManageTask(source,actor))invalid('Sem permiss\u00e3o para alterar a checklist.',403);
        const checklistId=await addChecklist(source.id,payload.title,payload.items??[]);
        sendJson(req,res,201,{data:await getTask(source.id),checklistId});return true;
      }
      const peopleError=taskPeopleInputError(payload);if(peopleError)invalid(peopleError);
      if(payload.template_id){
        if(!isId(payload.template_id))invalid('Modelo inv\u00e1lido.');
        if(!await getTaskTemplate(payload.template_id,actor.id))invalid('Modelo indispon\u00edvel ou compartilhamento removido.',403);
        // New uploads belong to this task; never replace them with template media.
      }
      if(payload.clone_source_id){
        if(!isId(payload.clone_source_id))invalid('Tarefa original inv\u00e1lida.');
        if(!canAccessTaskFiles(await getTask(payload.clone_source_id),actor))invalid('Sem acesso \u00e0 tarefa original.',403);
        payload.status='todo';
      }
      const task=await createTask(actor.id,payload);
      await onCreated(task,actor).catch(error=>console.error('[Task notification]',error.message));
      sendJson(req,res,201,{data:task});
    }catch(error){if(!error.statusCode)throw error;sendError(req,res,error.statusCode,error.code||'VALIDATION_ERROR',error.message);}
    return true;
  };
}
