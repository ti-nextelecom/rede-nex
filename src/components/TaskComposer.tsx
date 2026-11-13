import { reviewImageUploads } from '../lib/mediaTools';
import { useRef, useState } from 'react';
import { CheckSquare, FileText, Images, Paperclip, Plus, Save, Trash2, X } from 'lucide-react';
import { AccessibleModal } from './AccessibleModal';
import { TaskPeoplePicker, ChecklistPeopleFields } from './TaskPeoplePicker';
import { TaskSharingFields } from './TaskModelSharing';
import { TaskDescription } from './TaskDescription';
import { TaskFileCard } from './TaskFileCard';
import { ChecklistItemMedia } from './ChecklistItemMedia';
import type { User } from '../types';
import { normalizeTaskBlueprint, taskTemplateBlueprint, type TaskBlueprint } from '../../shared/taskBlueprint.mjs';
import { descriptionImageMarkdown, taskUploadType, TASK_UPLOAD_ACCEPT } from '../../shared/taskMedia.mjs';
import { taskDeadlineInput, taskDeadlineValue } from '../../shared/taskDates.mjs';
import { uploadChatMedia } from '../lib/chatApi';
import './task-composer.css';

export function TaskComposer({ users, initial, mode = 'task', modelName = '', lists = [], defaultListId = '', currentUserId, isClone = false, onSubmit, onClose }: {
  users: User[]; initial?: Partial<TaskBlueprint>; mode?: 'task' | 'template'; modelName?: string; lists?: {id: string; name: string}[]; defaultListId?: string;
  currentUserId?: string; isClone?: boolean; onSubmit: (draft: TaskBlueprint, options: {modelName: string; category: string; is_shared: boolean; shared_user_ids: string[]; custom_list_id: string | null}) => Promise<void>; onClose: () => void;
}) {
  const [draft, setDraft] = useState<TaskBlueprint>(() => {const value=(mode==='template'?taskTemplateBlueprint:normalizeTaskBlueprint)({ owner_id: currentUserId, ...initial });return {...value,checklists:value.checklists.map(group=>({...group,items:group.items.map(item=>({...item,key:item.key||crypto.randomUUID()}))}))};});
  const [name, setName] = useState(modelName), [category, setCategory] = useState('Geral');
  const [shared, setShared] = useState(false), [recipients, setRecipients] = useState<string[]>([]), [listId, setListId] = useState(defaultListId);
  const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false), [error, setError] = useState(''), [preview, setPreview] = useState(false), [uploadLabel, setUploadLabel] = useState('');
  const savingRef = useRef(false), uploadingRef = useRef(false), imageInput = useRef<HTMLInputElement>(null), fileInput = useRef<HTMLInputElement>(null), descriptionInput = useRef<HTMLTextAreaElement>(null);
  function patch(input: Partial<TaskBlueprint>) { setDraft(value => ({ ...value, ...input })); }
  async function addFiles(selected: File[], inline = false, stepKey?: string) {
    if (uploadingRef.current || savingRef.current || !selected.length) return;
    if(mode==='template'){setError('Modelos guardam a estrutura e os textos. Adicione as mídias ao criar a tarefa.');return;}
    const candidates=inline?selected.filter(file=>file.type.startsWith('image/')):selected;
    if(!candidates.length)return;
    if(draft.files.length+candidates.length>100){const message='Use até 100 anexos por tarefa.';setError(message);if(stepKey)throw new Error(message);return;}
    try{candidates.forEach(taskUploadType);}catch(cause){setError(cause instanceof Error?cause.message:'Arquivo inválido.');if(stepKey)throw cause;return;}
    uploadingRef.current=true;setUploading(true);setError('');
    let position=descriptionInput.current?.selectionStart??draft.description.length;
    let selectionEnd=descriptionInput.current?.selectionEnd??position;
    let descriptionLength=draft.description.length;
    try{
      const reviewed=await reviewImageUploads(candidates);
      for(const [index,file] of reviewed.entries()){
        setUploadLabel('Enviando '+(index+1)+' de '+reviewed.length+': '+file.name);
        const type=taskUploadType(file),typed=file.type===type?file:new File([file],file.name,{type});
        const url=await uploadChatMedia(typed);if(!url)throw new Error('O envio não retornou o endereço do arquivo.');
        const attachment={name:file.name,file_url:url,file_type:type,file_size:file.size,checklist_item_key:stepKey||null};
        if(inline){
          const markdown=descriptionImageMarkdown({...attachment,id:crypto.randomUUID()});
          const length=descriptionLength-(selectionEnd-position)+markdown.length;
          if(length>10000){setDraft(previous=>({...previous,files:[...previous.files,attachment]}));throw new Error('Imagem anexada, mas a descrição atingiu 10.000 caracteres. Ela continua disponível em Anexos.');}
          const at=position,end=selectionEnd;descriptionLength=length;position+=markdown.length;selectionEnd=position;
          setDraft(previous=>({...previous,description:previous.description.slice(0,at)+markdown+previous.description.slice(end),files:[...previous.files,attachment]}));
        }else setDraft(previous=>({...previous,files:[...previous.files,attachment]}));
      }
    }catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível enviar o anexo. Os arquivos já enviados foram mantidos.');if(stepKey)throw cause;}
    finally{uploadingRef.current=false;setUploading(false);setUploadLabel('');}
  }
  function removeFile(index:number){
    setDraft(previous=>{const file=previous.files[index],url=file.file_url.replace(/\(/g,'%28').replace(/\)/g,'%29');return {...previous,files:previous.files.filter((_,i)=>i!==index),description:previous.description.replace(/!\[[^\]\r\n]*\]\(([^)\r\n]+)\)/g,(reference,source)=>source===url?'':reference)};});
  }
  function removeChecklistEntries(groupIndex:number,itemIndex?:number){
    setDraft(previous=>{const group=previous.checklists[groupIndex];if(!group)return previous;
      const removed=new Set((itemIndex===undefined?group.items:group.items.filter((_,index)=>index===itemIndex)).map(item=>item.key));
      const urls=new Set(previous.files.filter(file=>file.checklist_item_key&&removed.has(file.checklist_item_key)).map(file=>file.file_url.replace(/\(/g,'%28').replace(/\)/g,'%29')));
      return {...previous,checklists:itemIndex===undefined?previous.checklists.filter((_,index)=>index!==groupIndex):previous.checklists.map((entry,index)=>index===groupIndex?{...entry,items:entry.items.filter((_,index)=>index!==itemIndex)}:entry),files:previous.files.filter(file=>!file.checklist_item_key||!removed.has(file.checklist_item_key)),description:previous.description.replace(/!\[[^\]\r\n]*\]\(([^)\r\n]+)\)/g,(reference,url)=>urls.has(url)?'':reference)};
    });
  }
  const generalFiles=draft.files.map((file,index)=>({...file,id:String(index)+':'+file.file_url})).filter(file=>!file.checklist_item_key);
  return <AccessibleModal title={mode === 'template' ? 'Editar novo modelo de tarefa' : isClone ? 'Clonar tarefa' : 'Nova tarefa'} onClose={() => { if (!savingRef.current && !uploadingRef.current) onClose(); }} className='nex-task-create task-composer-dialog'>
    <form onSubmit={async e => {
      e.preventDefault(); if (savingRef.current || uploadingRef.current) return;
      savingRef.current = true; setBusy(true); setError('');
      try { if(mode==='task'&&draft.checklists.some(group=>group.items.some(item=>!item.content.trim()&&draft.files.some(file=>file.checklist_item_key===item.key))))throw new Error('Descreva a etapa que possui anexos ou remova seus arquivos antes de criar a tarefa.'); await onSubmit((mode==='template'?taskTemplateBlueprint:normalizeTaskBlueprint)(draft), { modelName: name.trim(), category, is_shared: shared, shared_user_ids: recipients, custom_list_id: listId || null }); }
      catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar. Os dados foram mantidos.'); }
      finally { savingRef.current = false; setBusy(false); }
    }}>
      <header className='task-composer-header'><div><span>REDE NEX / TAREFAS</span><h2>{mode === 'template' ? 'Novo modelo de tarefa' : isClone ? 'Clonar tarefa' : 'Nova tarefa'}</h2><p>{isClone?'Revise a cópia, ajuste os dados e os anexos antes de criar a tarefa.':'Planeje a entrega e organize as pessoas em cada etapa.'}</p></div><button type='button' disabled={busy || uploading} aria-label='Fechar formulário de tarefa' onClick={onClose}><X size={22} /></button></header>
      {error && <p role='alert' className='task-form-error'>{error}</p>}
      <fieldset disabled={busy || uploading} className='task-composer-grid'>
        <div className='task-composer-main'>
          {mode === 'template' && <label>Nome do modelo<input autoFocus required maxLength={200} value={name} onChange={e => setName(e.target.value)} placeholder='Ex.: Instalação corporativa' /></label>}
          <label>Título da tarefa<input autoFocus={mode === 'task'} required aria-label='Título da tarefa' maxLength={500} value={draft.title} onChange={e => patch({title: e.target.value})} placeholder='O que precisa ser feito?' /></label>
          <section className='task-composer-section'><div className='task-composer-section-heading'><h3><FileText size={18} /> Descrição</h3><div><button type='button' onClick={() => setPreview(value => !value)}>{preview ? 'Editar texto' : 'Visualizar'}</button>{mode==='task'&&<button type='button' onClick={() => imageInput.current?.click()}><Images size={16} /> Inserir imagem</button>}</div></div>
            {preview ? <TaskDescription value={draft.description || 'Descreva a entrega…'} /> : <textarea ref={descriptionInput} aria-label='Descrição da tarefa' rows={7} maxLength={10000} value={draft.description} onChange={e => patch({description: e.target.value})} onPaste={e => { const files = [...e.clipboardData.files]; if (files.some(file => file.type.startsWith('image/'))) { e.preventDefault(); void addFiles(files,true); } }} placeholder={mode==='template'?'Instruções e links para reutilizar nas tarefas.':'Contexto, instruções, links… Cole uma imagem com Ctrl+V.'} />}
            <input ref={imageInput} hidden type='file' accept='image/*' multiple onChange={e => { void addFiles([...(e.target.files || [])],true); e.target.value = ''; }} />
          </section>
          <section className='task-composer-section'><div className='task-composer-section-heading'><h3><CheckSquare size={18} /> Checklists</h3><button type='button' onClick={() => patch({checklists: [...draft.checklists, {title:'Checklist',items:[]}]})}><Plus size={16} /> Nova checklist</button></div>
            {!draft.checklists.length && <div className='task-composer-empty'>Divida a entrega em etapas e defina quem participa de cada uma.</div>}
            {draft.checklists.map((group, groupIndex) => <div className='task-draft-checklist' key={groupIndex}>
              <header><input aria-label={`Nome da checklist ${groupIndex + 1}`} value={group.title} onChange={e => patch({checklists: draft.checklists.map((g,i) => i===groupIndex ? {...g,title:e.target.value} : g)})} /><button type='button' aria-label={`Excluir checklist ${groupIndex+1}`} onClick={() => removeChecklistEntries(groupIndex)}><Trash2 size={18} /></button></header>
              {group.items.map((item,index) => <div className='task-draft-step' key={item.key || index}>
                <div><span>{index+1}</span><textarea aria-label={`Etapa ${index+1} da checklist ${groupIndex+1}`} rows={2} maxLength={500} value={item.content} placeholder='Descreva esta etapa' onChange={e => patch({checklists:draft.checklists.map((g,i)=>i===groupIndex ? {...g,items:g.items.map((it,j)=>j===index ? {...it,content:e.target.value}:it)}:g)})} /><button type='button' aria-label={`Excluir etapa ${index+1}`} onClick={() => removeChecklistEntries(groupIndex,index)}><X size={18} /></button></div>
                <ChecklistPeopleFields users={users} item={item} onChange={input=>patch({checklists:draft.checklists.map((g,i)=>i===groupIndex ? {...g,items:g.items.map((it,j)=>j===index ? {...it,...input}:it)}:g)})} />
                {mode==='task'&&<ChecklistItemMedia title={item.content||`Etapa ${index+1} da checklist ${groupIndex+1}`} emptyLabel="Adicionar anexos" reviewImages={false} editable disabled={busy||uploading} files={draft.files.flatMap((file,fileIndex)=>file.checklist_item_key===item.key?[{...file,id:String(fileIndex)+':'+file.file_url}]:[])} onUpload={files=>addFiles(files,false,item.key)} onRemove={file=>removeFile(Number(file.id.slice(0,file.id.indexOf(':'))))}/>}
              </div>)}
              <button type='button' className='task-draft-add' onClick={()=>patch({checklists:draft.checklists.map((g,i)=>i===groupIndex ? {...g,items:[...g.items,{key:crypto.randomUUID(),content:'',assignee_id:null,participant_ids:[],observer_ids:[]}]}:g)})}><Plus size={16} /> Adicionar etapa</button>
            </div>)}
          </section>
          {mode==='task'?<section className='task-composer-section' aria-label='Anexos da tarefa'>
            <div className='task-composer-section-heading'><h3><Paperclip size={18}/>Anexos gerais ({generalFiles.length})</h3><button type='button' onClick={()=>fileInput.current?.click()}><Plus size={16}/>Adicionar arquivos</button></div>
            <input ref={fileInput} type='file' hidden multiple accept={TASK_UPLOAD_ACCEPT} onChange={event=>{void addFiles([...(event.target.files||[])]);event.target.value='';}}/>
            <div className='task-composer-dropzone' onDragOver={event=>{event.preventDefault();}} onDrop={event=>{event.preventDefault();void addFiles([...event.dataTransfer.files]);}}>
              <Paperclip size={22}/><p>Arraste arquivos aqui ou use Adicionar arquivos.</p><small>Imagens, PDF, Word, Excel, vídeo e áudio. Até 20 MB por arquivo.</small>
            </div>
            {!!generalFiles.length&&<div className='task-composer-files'>{generalFiles.map(file=><TaskFileCard key={file.id} file={file} onRemove={()=>removeFile(Number(file.id.slice(0,file.id.indexOf(':'))))}/>)}</div>}
            <p className='task-composer-hint'>Os anexos serão vinculados ao salvar a tarefa. Arquivos de etapas removidas da cópia não serão reaproveitados.</p>
          </section>:<p className='task-composer-hint'>O modelo salva a estrutura e os textos. Imagens e anexos podem ser adicionados ao criar uma tarefa a partir dele.</p>}
        </div>
        <aside className='task-composer-properties'><div><span>ORGANIZAÇÃO</span><h3>Pessoas e planejamento</h3></div>
          <label>Responsável<TaskPeoplePicker users={users} value={draft.owner_id?[draft.owner_id]:[]} onChange={ids=>patch({owner_id:ids[0]||null})} label='responsável da tarefa' single /></label>
          <label>Participantes<TaskPeoplePicker users={users} value={draft.assignee_ids} onChange={ids=>patch({assignee_ids:ids})} label='participantes da tarefa' /></label>
          <label>Observadores<TaskPeoplePicker users={users} value={draft.observer_ids} onChange={ids=>patch({observer_ids:ids})} label='observadores da tarefa' /></label>
          <label>Prioridade<select value={draft.priority} onChange={e=>patch({priority:e.target.value})}><option value='low'>Baixa</option><option value='normal'>Normal</option><option value='high'>Alta</option><option value='urgent'>Urgente</option></select></label>
          <label>Prazo<input type='datetime-local' value={taskDeadlineInput(draft.deadline)} onChange={e=>patch({deadline:taskDeadlineValue(e.target.value)})} /></label>
          {mode==='task' && !!lists.length && <label>Lista<select value={listId} onChange={e=>setListId(e.target.value)}><option value=''>Sem lista</option>{lists.map(list=><option key={list.id} value={list.id}>{list.name}</option>)}</select></label>}
          {mode==='template' && <><label>Categoria<input value={category} onChange={e=>setCategory(e.target.value)} maxLength={100} /></label><TaskSharingFields users={users.filter(user=>user.id!==currentUserId)} shared={shared} recipients={recipients} onSharedChange={setShared} onRecipientsChange={setRecipients} /></>}
          <p className='task-composer-hint'>Responsáveis e participantes das etapas também serão envolvidos na tarefa. Observadores acompanham sem serem responsáveis pela execução.</p>
        </aside>
      </fieldset>
      <footer className='task-composer-footer'><span>{uploading?uploadLabel||'Preparando anexos…':`${draft.checklists.reduce((sum,group)=>sum+group.items.filter(item=>item.content.trim()).length,0)} etapa(s) planejada(s)`}</span><button type='button' disabled={busy||uploading} onClick={onClose}>Cancelar</button><button type='submit' disabled={busy||uploading||!draft.title.trim()||(mode==='template'&&!name.trim())}><Save size={18} />{busy?'Salvando…':mode==='template'?'Salvar modelo':isClone?'Criar cópia':'Criar tarefa'}</button></footer>
    </form>
  </AccessibleModal>;
}
