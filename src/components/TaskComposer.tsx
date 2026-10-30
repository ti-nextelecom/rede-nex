import { useRef, useState } from 'react';
import { CheckSquare, FileText, Images, Plus, Save, Trash2, X } from 'lucide-react';
import { AccessibleModal } from './AccessibleModal';
import { TaskPeoplePicker, ChecklistPeopleFields } from './TaskPeoplePicker';
import { TaskSharingFields } from './TaskModelSharing';
import { TaskDescription } from './TaskDescription';
import { TaskFileCard } from './TaskFileCard';
import type { User } from '../types';
import { normalizeTaskBlueprint, type TaskBlueprint } from '../../shared/taskBlueprint.mjs';
import { descriptionImageMarkdown, taskUploadType } from '../../shared/taskMedia.mjs';
import { taskDeadlineInput, taskDeadlineValue } from '../../shared/taskDates.mjs';
import { uploadChatMedia } from '../lib/chatApi';
import './task-composer.css';

export function TaskComposer({ users, initial, mode = 'task', modelName = '', lists = [], defaultListId = '', currentUserId, onSubmit, onClose }: {
  users: User[]; initial?: Partial<TaskBlueprint>; mode?: 'task' | 'template'; modelName?: string; lists?: {id: string; name: string}[]; defaultListId?: string;
  currentUserId?: string; onSubmit: (draft: TaskBlueprint, options: {modelName: string; category: string; is_shared: boolean; shared_user_ids: string[]; custom_list_id: string | null}) => Promise<void>; onClose: () => void;
}) {
  const [draft, setDraft] = useState<TaskBlueprint>(() => normalizeTaskBlueprint({ owner_id: currentUserId, ...initial }));
  const [name, setName] = useState(modelName), [category, setCategory] = useState('Geral');
  const [shared, setShared] = useState(false), [recipients, setRecipients] = useState<string[]>([]), [listId, setListId] = useState(defaultListId);
  const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false), [error, setError] = useState(''), [preview, setPreview] = useState(false);
  const savingRef = useRef(false), uploadingRef = useRef(false), imageInput = useRef<HTMLInputElement>(null), descriptionInput = useRef<HTMLTextAreaElement>(null);
  function patch(input: Partial<TaskBlueprint>) { setDraft(value => ({ ...value, ...input })); }
  async function addImages(files: File[]) {
    if (uploadingRef.current || savingRef.current) return;
    const images = files.filter(file => file.type.startsWith('image/'));
    if (!images.length) return;
    uploadingRef.current = true; setUploading(true); setError('');
    try {
      for (const file of images) {
        const type = taskUploadType(file);
        const url = await uploadChatMedia(file);
        const markdown = descriptionImageMarkdown({ id: crypto.randomUUID(), name: file.name, file_url: url, file_type: type });
        const caret = descriptionInput.current?.selectionStart;
        setDraft(previous => ({ ...previous, description: caret === undefined ? `${previous.description}\n${markdown}\n` : `${previous.description.slice(0, caret)}\n${markdown}\n${previous.description.slice(caret)}`,
          files: [...previous.files, { name: file.name, file_url: url, file_type: type, file_size: file.size }] }));
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível inserir a imagem.'); }
    finally { uploadingRef.current = false; setUploading(false); }
  }
  return <AccessibleModal title={mode === 'template' ? 'Editar novo modelo de tarefa' : 'Nova tarefa'} onClose={() => { if (!savingRef.current && !uploadingRef.current) onClose(); }} className='nex-task-create task-composer-dialog'>
    <form onSubmit={async e => {
      e.preventDefault(); if (savingRef.current || uploadingRef.current) return;
      savingRef.current = true; setBusy(true); setError('');
      try { await onSubmit(normalizeTaskBlueprint(draft), { modelName: name.trim(), category, is_shared: shared, shared_user_ids: recipients, custom_list_id: listId || null }); }
      catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar. Os dados foram mantidos.'); }
      finally { savingRef.current = false; setBusy(false); }
    }}>
      <header className='task-composer-header'><div><span>REDE NEX / TAREFAS</span><h2>{mode === 'template' ? 'Novo modelo de tarefa' : 'Nova tarefa'}</h2><p>Planeje a entrega e organize as pessoas em cada etapa.</p></div><button type='button' disabled={busy || uploading} aria-label='Fechar formulário de tarefa' onClick={onClose}><X size={22} /></button></header>
      {error && <p role='alert' className='task-form-error'>{error}</p>}
      <fieldset disabled={busy || uploading} className='task-composer-grid'>
        <div className='task-composer-main'>
          {mode === 'template' && <label>Nome do modelo<input autoFocus required maxLength={200} value={name} onChange={e => setName(e.target.value)} placeholder='Ex.: Instalação corporativa' /></label>}
          <label>Título da tarefa<input autoFocus={mode === 'task'} required aria-label='Título da tarefa' maxLength={500} value={draft.title} onChange={e => patch({title: e.target.value})} placeholder='O que precisa ser feito?' /></label>
          <section className='task-composer-section'><div className='task-composer-section-heading'><h3><FileText size={18} /> Descrição</h3><div><button type='button' onClick={() => setPreview(value => !value)}>{preview ? 'Editar texto' : 'Visualizar'}</button><button type='button' onClick={() => imageInput.current?.click()}><Images size={16} /> Inserir imagem</button></div></div>
            {preview ? <TaskDescription value={draft.description || 'Descreva a entrega…'} /> : <textarea ref={descriptionInput} aria-label='Descrição da tarefa' rows={7} maxLength={10000} value={draft.description} onChange={e => patch({description: e.target.value})} onPaste={e => { const files = [...e.clipboardData.files]; if (files.some(file => file.type.startsWith('image/'))) { e.preventDefault(); void addImages(files); } }} placeholder='Contexto, instruções, links… Cole uma imagem com Ctrl+V.' />}
            <input ref={imageInput} hidden type='file' accept='image/*' multiple onChange={e => { void addImages([...(e.target.files || [])]); e.target.value = ''; }} />
          </section>
          <section className='task-composer-section'><div className='task-composer-section-heading'><h3><CheckSquare size={18} /> Checklists</h3><button type='button' onClick={() => patch({checklists: [...draft.checklists, {title:'Checklist',items:[]}]})}><Plus size={16} /> Nova checklist</button></div>
            {!draft.checklists.length && <div className='task-composer-empty'>Divida a entrega em etapas e defina quem participa de cada uma.</div>}
            {draft.checklists.map((group, groupIndex) => <div className='task-draft-checklist' key={groupIndex}>
              <header><input aria-label={`Nome da checklist ${groupIndex + 1}`} value={group.title} onChange={e => patch({checklists: draft.checklists.map((g,i) => i===groupIndex ? {...g,title:e.target.value} : g)})} /><button type='button' aria-label={`Excluir checklist ${groupIndex+1}`} onClick={() => patch({checklists:draft.checklists.filter((_,i)=>i!==groupIndex)})}><Trash2 size={18} /></button></header>
              {group.items.map((item,index) => <div className='task-draft-step' key={item.key || index}>
                <div><span>{index+1}</span><input aria-label={`Etapa ${index+1} da checklist ${groupIndex+1}`} maxLength={500} value={item.content} placeholder='Descreva esta etapa' onChange={e => patch({checklists:draft.checklists.map((g,i)=>i===groupIndex ? {...g,items:g.items.map((it,j)=>j===index ? {...it,content:e.target.value}:it)}:g)})} /><button type='button' aria-label={`Excluir etapa ${index+1}`} onClick={() => patch({checklists:draft.checklists.map((g,i)=>i===groupIndex ? {...g,items:g.items.filter((_,j)=>j!==index)}:g)})}><X size={18} /></button></div>
                <ChecklistPeopleFields users={users} item={item} onChange={input=>patch({checklists:draft.checklists.map((g,i)=>i===groupIndex ? {...g,items:g.items.map((it,j)=>j===index ? {...it,...input}:it)}:g)})} />
              </div>)}
              <button type='button' className='task-draft-add' onClick={()=>patch({checklists:draft.checklists.map((g,i)=>i===groupIndex ? {...g,items:[...g.items,{key:crypto.randomUUID(),content:'',assignee_id:null,participant_ids:[],observer_ids:[]}]}:g)})}><Plus size={16} /> Adicionar etapa</button>
            </div>)}
          </section>
          {!!draft.files.length && <section className='task-composer-section'><h3>Anexos do modelo ({draft.files.length})</h3><div className='task-composer-files'>{draft.files.map((file,index)=><TaskFileCard key={`${file.file_url}-${index}`} file={{...file,id:String(index)}} />)}</div><p>Arquivos de etapas excluídas não serão copiados. Comentários e histórico não fazem parte do modelo.</p></section>}
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
      <footer className='task-composer-footer'><span>{uploading?'Enviando imagens…':`${draft.checklists.reduce((sum,group)=>sum+group.items.filter(item=>item.content.trim()).length,0)} etapa(s) planejada(s)`}</span><button type='button' disabled={busy||uploading} onClick={onClose}>Cancelar</button><button type='submit' disabled={busy||uploading||!draft.title.trim()||(mode==='template'&&!name.trim())}><Save size={18} />{busy?'Salvando…':mode==='template'?'Salvar modelo':'Criar tarefa'}</button></footer>
    </form>
  </AccessibleModal>;
}
