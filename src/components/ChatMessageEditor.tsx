import { useMemo, useRef, useState } from 'react';
import { Loader2, Pencil, X } from 'lucide-react';
import { applyChatMessageEdit, chatMessageEditParts } from '../../shared/chatMessageEdit.mjs';
import './chat-message-editor.css';

interface Props {
  content: string;
  onSave(content: string): Promise<void>;
  onCancel(): void;
}

export function ChatMessageEditor({ content, onSave, onCancel }: Props) {
  const parts = useMemo(() => chatMessageEditParts(content), [content]);
  const [text, setText] = useState(parts.text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false);
  const canSave = parts.kind === 'attachment' || !!text.trim();

  async function save() {
    if (saving.current || !canSave) return;
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      await onSave(applyChatMessageEdit(content, text));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar. Tente novamente.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return <section className="chat-message-editor" aria-label="Edição de mensagem" aria-busy={busy}>
    <header>
      <Pencil size={15} aria-hidden="true" />
      <strong>{parts.kind === 'attachment' ? 'Editando legenda' : 'Editando mensagem'}</strong>
      <button type="button" disabled={busy} aria-label="Cancelar edição" onClick={onCancel}><X size={17} /></button>
    </header>
    <textarea autoFocus value={text} rows={4} maxLength={8000}
      spellCheck lang="pt-BR" autoCorrect="on" autoCapitalize="sentences"
      aria-label={parts.kind === 'attachment' ? 'Editar legenda da mensagem' : 'Editar mensagem'}
      placeholder={parts.kind === 'attachment' ? 'Legenda da mídia…' : 'Mensagem…'} disabled={busy}
      onChange={event => setText(event.target.value)}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Escape' && !busy) { event.preventDefault(); onCancel(); }
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void save(); }
      }} />
    {error && <p className="chat-message-edit-error" role="alert">{error}</p>}
    <footer>
      <small>Enter quebra a linha · Ctrl + Enter salva</small>
      <button type="button" disabled={busy || !canSave} onClick={() => void save()}>
        {busy && <Loader2 size={15} className="animate-spin" />}{busy ? 'Salvando…' : 'Salvar alterações'}
      </button>
    </footer>
  </section>;
}
