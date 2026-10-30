import { Download, FileText, Trash2 } from 'lucide-react';
import { openMedia } from '../lib/mediaTools';
import { useState } from 'react';
import { safeTaskFileUrl, taskMediaKind, type TaskMediaFile } from '../../shared/taskMedia.mjs';

export function TaskFileCard({ file, onRemove, compact = false }: { file: TaskMediaFile; onRemove?: () => void; compact?: boolean }) {
  const url = safeTaskFileUrl(file.file_url), kind = taskMediaKind(file);
  const [unavailable, setUnavailable] = useState(false);
  return <div className={`task-file-card ${compact ? 'is-compact' : ''}`}>
    {url && kind === 'image' && !unavailable && <a className="task-file-preview" href={url} target="_blank" rel="noopener noreferrer" onClick={event => { event.preventDefault(); openMedia({url:url!,name:file.name,type:file.file_type}); }}><img src={url} alt={file.name} loading="lazy" onError={() => setUnavailable(true)} /></a>}
    {unavailable && <p className="task-file-missing">Não foi possível carregar esta imagem. O vínculo foi preservado; verifique o arquivo no armazenamento.</p>}
    {url && kind === 'video' && <video controls preload="metadata" src={url} aria-label={file.name} />}
    {url && kind === 'audio' && <audio controls preload="metadata" src={url} aria-label={file.name} />}
    <div className="task-file-info"><FileText size={19} /><div>{url ? <a href={url} target="_blank" rel="noopener noreferrer">{file.name}</a> : <strong>{file.name}</strong>}<small>{file.file_size ? `${(file.file_size / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} KB` : kind === 'file' ? 'Documento / link' : 'Mídia'}{file.uploader_name ? ` · ${file.uploader_name}` : ''}{!url ? ' · Link indisponível' : ''}</small></div>{url && <a className="task-file-action" href={url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${file.name}`}><Download size={17} /></a>}{onRemove && <button type="button" className="task-file-action" aria-label={`Remover arquivo ${file.name}`} onClick={onRemove}><Trash2 size={16} /></button>}</div>
  </div>;
}
