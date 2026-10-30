import { useRef, useState } from 'react';
import { Loader2, Paperclip, Upload } from 'lucide-react';
import { TASK_UPLOAD_ACCEPT, type TaskMediaFile } from '../../shared/taskMedia.mjs';
import { reviewImageUploads } from '../lib/mediaTools';
import { TaskFileCard } from './TaskFileCard';

export function ChecklistItemMedia({ title, files, editable, disabled, onUpload, onRemove }: {
  title: string; files: TaskMediaFile[]; editable: boolean; disabled: boolean;
  onUpload: (files: File[]) => Promise<void>; onRemove: (file: TaskMediaFile) => void;
}) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null), uploading = useRef(false);
  async function upload(items: File[]) {
    if (!items.length || !editable || disabled || uploading.current) return;
    uploading.current = true; setOpen(true); setBusy(true); setError('');
    try { const reviewed = await reviewImageUploads(items); if (reviewed.length) await onUpload(reviewed); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível anexar a mídia. Tente novamente.'); }
    finally { uploading.current = false; setBusy(false); if (input.current) input.current.value = ''; }
  }
  if (!editable && !files.length) return null;
  return <div className="checklist-media" onDragOver={event => { if (editable) event.preventDefault(); }}
    onDrop={event => { if (!editable) return; event.preventDefault(); void upload(Array.from(event.dataTransfer.files)); }}>
    <button type="button" className="checklist-media-toggle" aria-expanded={open} aria-label={`Mídias da etapa ${title}`} onClick={() => setOpen(value => !value)}>
      <Paperclip size={14} />{files.length ? `${files.length} anexo${files.length === 1 ? '' : 's'}` : 'Adicionar mídia'}
    </button>
    {(open || files.length > 0) && <div className="checklist-media-content">
      {files.map(file => <TaskFileCard key={file.id} file={file} onRemove={editable && !disabled && !busy ? () => onRemove(file) : undefined} />)}
      {open && editable && <div className="checklist-media-upload">
        <input hidden ref={input} type="file" multiple accept={TASK_UPLOAD_ACCEPT} aria-label={`Selecionar mídias para ${title}`} onChange={event => { void upload(Array.from(event.target.files || [])); }} />
        <button type="button" disabled={busy || disabled} onClick={() => input.current?.click()}><Upload size={15} />Selecionar arquivos</button>
        <textarea rows={2} value="" onChange={() => {}} disabled={busy || disabled} aria-label={`Colar imagem na etapa ${title}`} placeholder="Cole um print aqui (Ctrl + V) ou arraste arquivos"
          onPaste={event => { const items = Array.from(event.clipboardData.files); if (items.length) { event.preventDefault(); void upload(items); } }} />
        <small>Imagens, vídeos, áudio e documentos · até 20 MB por arquivo · também disponíveis em Arquivos.</small>
      </div>}
      {busy && <p role="status"><Loader2 size={14} className="animate-spin" />Salvando anexos da etapa…</p>}
      {error && <p className="task-chat-error" role="alert">{error}</p>}
    </div>}
  </div>;
}
