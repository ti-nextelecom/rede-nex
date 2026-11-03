import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, MessageSquare, Paperclip, RefreshCw, Send, Trash2, X } from 'lucide-react';
import { EmployeeAvatar } from './EmployeeAvatar';
import { TaskFileCard } from './TaskFileCard';
import { LinkText } from './LinkText';
import { parseTaskMessage, taskMessageContent, TASK_UPLOAD_ACCEPT, type TaskMediaFile } from '../../shared/taskMedia.mjs';

interface Person { id: string; name: string; photo_url?: string }
interface Comment { id: string; content: string; created_at: string; user: Person }
export function TaskConversation({ comments, files, people, currentUserId, busy, onSend, onUpload, onDeleteComment, canDeleteAny, onClose, onBack, onRefresh, refreshError, active }: {
  comments: Comment[]; files: TaskMediaFile[]; people: Person[]; currentUserId?: string; busy: boolean;
  onSend: (content: string) => Promise<boolean>; onUpload: (file: File) => Promise<TaskMediaFile>;
  onDeleteComment?: (commentId: string) => void; canDeleteAny?: boolean;
  onClose: () => void; onBack: () => void; onRefresh: () => void; refreshError: string; active: boolean;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [text, setText] = useState(''), [attached, setAttached] = useState<TaskMediaFile[]>([]);
  const [uploading, setUploading] = useState(false), [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null), scroll = useRef<HTMLDivElement>(null), nearBottom = useRef(true);
  const uploadBusy = useRef(false), submitBusy = useRef(false);
  const ordered = [...comments].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const lastId = ordered.at(-1)?.id;
  useEffect(() => { if (nearBottom.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; }, [lastId]);
  async function upload(selected: File[]) {
    if (uploadBusy.current || busy) return;
    uploadBusy.current = true; setUploading(true); setError('');
    try { for (const file of selected) { const saved = await onUpload(file); setAttached(items => [...items, saved]); } }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível anexar o arquivo.'); }
    finally { uploadBusy.current = false; setUploading(false); if (fileInput.current) fileInput.current.value = ''; }
  }
  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const images = Array.from(e.clipboardData.items)
      .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
      .map(item => item.getAsFile())
      .filter((f): f is File => f !== null);
    if (images.length) { e.preventDefault(); void upload(images); }
  }
  async function send(event: FormEvent) {
    event.preventDefault(); if (submitBusy.current || busy || uploading || (!text.trim() && !attached.length)) return;
    setError(''); submitBusy.current = true;
    try { if (await onSend(taskMessageContent(text, attached))) { setText(''); setAttached([]); nearBottom.current = true; } else setError('Não foi possível enviar. Seu texto e seus anexos foram preservados.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível enviar a mensagem.'); }
    finally { submitBusy.current = false; }
  }
  return <section className="task-conversation" data-mobile-active={active} aria-label="Bate-papo da tarefa">
    <header><button type="button" className="task-chat-back" aria-label="Voltar aos detalhes da tarefa" onClick={onBack}><ArrowLeft size={19} /></button><span className="task-chat-symbol"><MessageSquare size={20} /></span><div><h3>Bate-papo da tarefa</h3><p>{people.length} pessoa(s) vinculada(s) · comentários</p></div><button type="button" onClick={onRefresh} aria-label="Atualizar conversa"><RefreshCw size={17} /></button><button type="button" onClick={onClose} aria-label="Fechar tarefa pelo bate-papo"><X size={19} /></button></header>
    {refreshError && <p className="task-chat-error" role="status">{refreshError}</p>}
    <div className="task-chat-history" ref={scroll} role="log" aria-label="Mensagens da tarefa" onScroll={() => { if (scroll.current) nearBottom.current = scroll.current.scrollHeight - scroll.current.scrollTop - scroll.current.clientHeight < 100; }}>
      <p className="task-chat-intro">Decisões, arquivos e alinhamentos ficam registrados nesta tarefa.</p>
      {!ordered.length && <div className="task-chat-empty"><MessageSquare size={30} /><h4>Comece a conversa</h4><p>Compartilhe uma atualização ou envie os materiais da entrega.</p></div>}
      {ordered.map((comment, index) => {
        const parsed = parseTaskMessage(comment.content, files), day = new Date(comment.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Bahia' });
        const previousDay = index ? new Date(ordered[index - 1].created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Bahia' }) : null;
        return <div key={comment.id}>{day !== previousDay && <div className="task-chat-day">{day}</div>}<article className="task-chat-message" data-mine={comment.user?.id === currentUserId}><EmployeeAvatar name={comment.user?.name || 'Usuário'} photo={comment.user?.photo_url} className="employee-avatar-small" /><div><header><strong>{comment.user?.name || 'Usuário'}</strong><time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleTimeString('pt-BR', { timeZone: 'America/Bahia', hour: '2-digit', minute: '2-digit' })}</time></header>{parsed.text && <p><LinkText text={parsed.text} /></p>}{parsed.attachments.map(file => <TaskFileCard key={file.id} file={file} compact />)}</div>{onDeleteComment && (comment.user?.id === currentUserId || canDeleteAny) && <button type="button" className="task-chat-delete" aria-label="Apagar comentário" disabled={deletingId === comment.id} onClick={async () => { if (!confirm('Apagar este comentário?')) return; setDeletingId(comment.id); onDeleteComment(comment.id); setDeletingId(null); }}><Trash2 size={13} /></button>}</article></div>;
      })}
    </div>
    <form className="task-chat-composer" onSubmit={send} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void upload(Array.from(e.dataTransfer.files)); }}>
      {(error || uploading) && <p role={error ? 'alert' : 'status'} className="task-chat-error">{error || 'Enviando e salvando arquivo…'}</p>}
      {attached.length > 0 && <div className="task-chat-pending">{attached.map(file => <span key={file.id}><Paperclip size={13} />{file.name}<button type="button" aria-label={`Retirar ${file.name} da mensagem`} onClick={() => setAttached(items => items.filter(item => item.id !== file.id))}><X size={14} /></button></span>)}<small>Arquivos já salvos na tarefa; serão vinculados ao próximo comentário.</small></div>}
      <textarea aria-label="Mensagem no bate-papo da tarefa" placeholder="Escreva um comentário para a equipe…" value={text} onChange={e => setText(e.target.value)} maxLength={3800} rows={3} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} onPaste={handlePaste} />
      <input ref={fileInput} type="file" multiple accept={TASK_UPLOAD_ACCEPT} hidden aria-label="Selecionar anexos da conversa" onChange={e => { void upload(Array.from(e.target.files || [])); }} />
      <footer><button type="button" disabled={busy || uploading} onClick={() => fileInput.current?.click()}><Paperclip size={18} />Anexar</button><small>Até 20 MB · Ctrl + Enter envia</small><button type="submit" disabled={busy || uploading || (!text.trim() && !attached.length)} aria-label="Enviar comentário da tarefa"><Send size={18} /></button></footer>
    </form>
  </section>;
}
