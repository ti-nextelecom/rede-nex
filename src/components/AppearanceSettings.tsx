import { useEffect, useId, useRef, useState } from 'react';
import { Check, CheckCheck, ImagePlus, Monitor, Moon, Palette, RotateCcw, Sun, X } from 'lucide-react';
import { DEFAULT_APPEARANCE, type Appearance } from '../../shared/appearance.mjs';
import { useAppearance } from '../lib/appearance';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';

const PRESETS = [
  { name: 'NEX', accent: '#ff7a00', surface: '#182536' },
  { name: 'Atlântico', accent: '#2563eb', surface: '#18344a' },
  { name: 'Floresta', accent: '#16865f', surface: '#1c362c' },
  { name: 'Ametista', accent: '#8854dc', surface: '#30213e' },
  { name: 'Rosa', accent: '#cd3975', surface: '#392330' },
];
function ColorField({ label, value, custom, onChange, onReset }: { label: string; value: string; custom?: boolean; onChange: (value: string) => void; onReset?: () => void }) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const valid = /^#[0-9a-f]{6}$/i.test(draft);
  return <div className="appearance-color-field">
    <label htmlFor={id}>{label}</label>
    <div><input type="color" aria-label={label} value={value} onChange={event => onChange(event.target.value)} />
      <input id={id} aria-label={`Código: ${label}`} value={draft} maxLength={7} spellCheck={false} aria-invalid={!valid}
        onChange={event => { setDraft(event.target.value); if (/^#[0-9a-f]{6}$/i.test(event.target.value)) onChange(event.target.value); }} />
      {onReset && <button type="button" onClick={onReset} disabled={!custom} title={`Usar cor automática: ${label}`} aria-label={`Usar cor automática: ${label}`}><RotateCcw size={14} /></button>}
    </div>
    {!valid && <small role="alert">Use # seguido de seis dígitos.</small>}
  </div>;
}
async function preparePhoto(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) throw new Error('Escolha uma foto JPG, PNG, WebP ou GIF.');
  if (file.size > 10 * 1024 * 1024) throw new Error('A foto deve ter até 10 MB.');
  let localUrl = '';
  const bitmap = typeof createImageBitmap === 'function' ? await createImageBitmap(file) : await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    localUrl = URL.createObjectURL(file);
    image.onload = () => resolve(image);
    image.onerror = () => { URL.revokeObjectURL(localUrl); reject(new Error('Não foi possível abrir a foto.')); };
    image.src = localUrl;
  });
  try {
    const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível preparar a foto.');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL('image/webp', .8);
    if (result.length > 1_500_000) throw new Error('Escolha uma foto menor para usar como fundo.');
    return result;
  } finally { if ('close' in bitmap) bitmap.close(); if (localUrl) URL.revokeObjectURL(localUrl); }
}
function BackgroundPhoto({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => () => { request.current = -1; }, []);
  async function upload(file: File) {
    const version = ++request.current; setBusy(true); setError('');
    try { const photo = await preparePhoto(file); if (request.current === version) onChange(photo); }
    catch (cause) { if (request.current === version) setError(cause instanceof Error ? cause.message : 'Não foi possível abrir a foto.'); }
    finally { if (request.current === version) setBusy(false); }
  }
  return <div className="appearance-photo">
    {value && <img src={value} alt={label} />}
    <div><strong>{label}</strong><p>Use uma foto sua. Ela aparece apenas no seu REDE NEX.</p>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden aria-label={`Arquivo: ${label}`} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ''; }} />
      <div className="appearance-photo__actions"><button type="button" onClick={() => input.current?.click()} disabled={busy}><ImagePlus size={15} />{busy ? 'Preparando foto…' : value ? 'Trocar foto' : 'Escolher foto'}</button>
        {value && <button type="button" onClick={() => { request.current++; setBusy(false); onChange(''); }} aria-label={`Remover: ${label}`}><X size={14} />Remover</button>}</div>
      <small>JPG, PNG, WebP ou GIF · até 10 MB · ajustada para o fundo</small>
      {error && <p role="alert">{error}</p>}
    </div>
  </div>;
}

export function AppearanceSettings() {
  const { settings, palette, status, error, update, retry } = useAppearance();
  const disabled = status === 'loading' || status === 'load-error';
  const statusText = status === 'loading' ? 'Carregando suas preferências…' : status === 'saved' ? 'Tudo salvo na sua conta' : status === 'pending' || status === 'saving' ? 'Salvando alterações…' : 'Alterações ainda não salvas';
  return <div className="appearance-settings">
    <header className="appearance-heading"><span className="appearance-heading__icon"><Palette size={22} /></span><div><h2>Seu REDE NEX, do seu jeito</h2><p>Personalize as cores e o fundo do seu espaço. Suas escolhas acompanham você no próximo acesso.</p></div></header>
    <div className="appearance-save-status" role="status" aria-live="polite">{status === 'saved' ? <CheckCheck size={16} /> : <span className={status === 'saving' ? 'appearance-saving' : ''}>●</span>}{statusText}</div>
    {error && <div className="appearance-error" role="alert"><p>{error}</p><button type="button" onClick={retry}>Tentar novamente</button></div>}
    <fieldset disabled={disabled}>
      <section><div className="appearance-section-heading"><h3>Modo de exibição</h3><p>Escolha como prefere trabalhar.</p></div>
        <div className="appearance-modes">{([{ value: 'light', label: 'Claro', icon: Sun }, { value: 'dark', label: 'Escuro', icon: Moon }, { value: 'system', label: 'Automático', icon: Monitor }] as const).map(mode => <button type="button" key={mode.value} aria-pressed={settings.mode === mode.value} onClick={() => update({ mode: mode.value })}><mode.icon size={21} /><strong>{mode.label}</strong><small>{mode.value === 'system' ? 'Segue seu dispositivo' : mode.value === 'light' ? 'Leve e luminoso' : 'Conforto à noite'}</small>{settings.mode === mode.value && <Check size={14} />}</button>)}</div>
      </section>
      <section><div className="appearance-section-heading"><h3>Paletas para começar</h3><p>Escolha uma combinação ou crie a sua abaixo.</p></div>
        <div className="appearance-presets">{PRESETS.map(preset => <button type="button" key={preset.name} aria-pressed={settings.accent === preset.accent && settings.surface === preset.surface}
          onClick={() => update({ accent: preset.accent, surface: preset.surface })}><span style={{ background: preset.accent }} /><span style={{ background: preset.surface }} /><strong>{preset.name}</strong></button>)}</div>
        <div className="appearance-colors"><ColorField label="Destaques do sistema" value={settings.accent} onChange={accent => update({ accent })} /><ColorField label="Tonalidade dos painéis" value={settings.surface} onChange={surface => update({ surface })} /></div>
        <p className="appearance-help">A tonalidade adapta os painéis ao modo claro ou escuro. O texto recebe contraste para manter a leitura.</p>
      </section>
      <section><div className="appearance-section-heading"><h3>Foto de fundo da plataforma</h3><p>Um fundo pessoal para acompanhar você entre as telas.</p></div><BackgroundPhoto label="Fundo da plataforma" value={settings.platformWallpaper} onChange={platformWallpaper => update({ platformWallpaper })} /></section>
      <section><div className="appearance-section-heading"><h3>Cores do chat</h3><p>Mensagens e fundo independentes das cores do sistema.</p></div>
        <div className="appearance-chat-preview" style={{ backgroundColor: palette.chat.background, backgroundImage: settings.wallpaper ? `url(${JSON.stringify(settings.wallpaper)})` : undefined }}>
          <span>PRÉVIA DA CONVERSA</span><p style={{ background: palette.chat.incoming, color: palette.chat.incomingText }}>Tudo pronto para trabalhar juntos.</p><p style={{ background: palette.chat.outgoing, color: palette.chat.outgoingText }}>Do meu jeito, com a cara da NEX.</p>
        </div>
        <div className="appearance-colors appearance-colors--chat">{([
          ['chatBackground', 'Fundo da conversa', palette.chat.background], ['chatIncoming', 'Mensagens recebidas', palette.chat.incoming], ['chatOutgoing', 'Minhas mensagens', palette.chat.outgoing],
        ] as const).map(([key, label, value]) => <ColorField key={key} label={label} value={value} custom={settings[key] !== null} onChange={color => update({ [key]: color } as Partial<Appearance>)} onReset={() => update({ [key]: null } as Partial<Appearance>)} />)}</div>
        <BackgroundPhoto label="Imagem de fundo do chat" value={settings.wallpaper} onChange={wallpaper => update({ wallpaper })} />
      </section>
      <footer className="appearance-footer"><p><CheckCheck size={15} />Salvamento automático por usuário</p><button type="button" onClick={() => update({ ...DEFAULT_APPEARANCE, wallpaper: settings.wallpaper, platformWallpaper: settings.platformWallpaper })}><RotateCcw size={14} />Restaurar cores padrão</button></footer>
    </fieldset>
  </div>;
}
export function AppearanceDialog({ onClose }: { onClose: () => void }) {
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="appearance-dialog"><DialogTitle className="sr-only">Personalizar aparência</DialogTitle><DialogDescription className="sr-only">Modo de exibição, cores do sistema e do chat e fotos de fundo da sua conta.</DialogDescription><AppearanceSettings /></DialogContent></Dialog>;
}
