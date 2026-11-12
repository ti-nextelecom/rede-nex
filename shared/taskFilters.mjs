import {dayKey,isFinished,isTaskMine} from './personalWork.mjs';
// Receives only tasks already authorized by the API. This is a display filter.
export function filterTaskScope(tasks,{scope='all',userId,status='',today=dayKey()}={}) {
  return tasks.filter(task=>{
    if(!['all','observing'].includes(scope)&&!isTaskMine(task,userId))return false;
    if(scope==='observing'&&!task.observers?.some(person=>person.id===userId||person.user_id===userId))return false;
    if(scope==='pending'&&isFinished(task.status))return false;
    if(scope==='overdue'&&(isFinished(task.status)||!dayKey(task.deadline)||dayKey(task.deadline)>=today))return false;
    if(scope==='today'&&(isFinished(task.status)||dayKey(task.deadline)!==today))return false;
    if(scope==='done'&&task.status!=='done')return false;
    return !status||task.status===status;
  });
}
