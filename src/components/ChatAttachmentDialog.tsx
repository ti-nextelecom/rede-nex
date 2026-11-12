import { useLayoutEffect, useRef, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { FileText, Loader2, Pencil, Send, X } from 'lucide-react';
import './chat-attachment-dialog.css';

type Attachment = { raw: File; src: string; type: 'image' | 'video' | 'audio' | 'document' };

export function ChatAttachmentDialog({ file, busy, error, children, onClose, onPreview, onEdit, onSend }: {
  file: Attachment;
  busy: boolean;
  error?: string;
  children: ReactNode;
  onClose(): void;
  onPreview(): void;
  onEdit(): void;
  onSend(): void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    // Mobile keyboards shrink the visual viewport, not always the layout viewport.
    // Update only this dialog; keyboard movement must not rerender the chat history.
    const visible = window.visualViewport;
    let frame = 0;
    function update() {
      frame = 0;
      const element = viewport.current;
      if (!element) return;
      element.style.setProperty('--attachment-top', `${visible?.offsetTop ?? 0}px`);
      element.style.setProperty('--attachment-left', `${visible?.offsetLeft ?? 0}px`);
      element.style.setProperty('--attachment-width', `${visible?.width ?? window.innerWidth}px`);
      element.style.setProperty('--attachment-height', `${visible?.height ?? window.innerHeight}px`);
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(update); }
    update();
    visible?.addEventListener('resize', schedule);
    visible?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      visible?.removeEventListener('resize', schedule);
      visible?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return <Dialog.Root open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <Dialog.Portal container={typeof document === 'undefined' ? undefined : document.body}>
      <Dialog.Overlay className="chat-attachment-backdrop" />
      <Dialog.Content ref={viewport} className="chat-attachment-viewport" aria-describedby={undefined}
        onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}
        onOpenAutoFocus={event => { event.preventDefault(); close.current?.focus({ preventScroll: true }); }}
        onEscapeKeyDown={event => { if (busy || (event.target instanceof Element && event.target.closest('.chat-caption-input')?.querySelector('[role=listbox]'))) event.preventDefault(); }}
        onPointerDownOutside={event => { if (busy) event.preventDefault(); }}>
        <section className="chat-attachment-dialog">
          <header className="chat-attachment-header">
            <Dialog.Title>Enviar arquivo</Dialog.Title>
            <Dialog.Close ref={close} disabled={busy} aria-label="Cancelar envio do arquivo"><X size={20} /></Dialog.Close>
          </header>
          <div className="chat-attachment-scroll">
            <div className="chat-attachment-preview">
              {file.type === 'image' ? <img src={file.src} alt={file.raw.name} />
                : file.type === 'video' ? <video src={file.src} controls playsInline />
                  : file.type === 'audio' ? <audio src={file.src} controls preload="metadata" aria-label={file.raw.name} />
                  : <div className="chat-attachment-document"><FileText size={48} /><span>{file.raw.name}</span></div>}
            </div>
            <div className="chat-attachment-details">
              <p>{file.raw.name} · {(file.raw.size / 1024 / 1024).toFixed(1)} MB</p>
              <div className="chat-attachment-actions">
                <button type="button" disabled={busy} onClick={onPreview}>Ampliar anexo</button>
                {file.type === 'image' && <button type="button" disabled={busy} onClick={onEdit}><Pencil size={16} />Cortar e marcar imagem</button>}
              </div>
            </div>
          </div>
          <footer className="chat-attachment-footer">
            {error && <p className="chat-send-error" role="alert">{error}</p>}
            <div className="chat-attachment-composer">
              {children}
              <button type="button" className="chat-attachment-send" disabled={busy} aria-label={busy ? 'Enviando anexo' : 'Enviar anexo'} onClick={onSend}>
                {busy ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              </button>
            </div>
          </footer>
        </section>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
