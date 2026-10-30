import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Copy, ExternalLink, Eye, EyeOff, KeyRound, LockKeyhole, Pencil, Plus, RefreshCw, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import { createVault, encryptVault, generateVaultPassword, unlockVault, validateVaultEntries, type VaultEntry, type VaultEnvelope } from '../../shared/passwordVault.mjs';
import { apiGet, apiPut } from '../lib/apiClient';
import { useAuth } from '../lib/auth';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog';
import './password-vault.css';

interface VaultRecord { owner_id: string; revision: number; envelope: VaultEnvelope | null }
interface OpenVault { key: CryptoKey; salt: string; revision: number; entries: VaultEntry[] }
const emptyEntry = (): VaultEntry => ({ id: crypto.randomUUID(), title: '', username: '', password: '', url: '', notes: '' });

export function PasswordVault() {
  const { user } = useAuth();
  return user ? <VaultWorkspace key={user.id} ownerId={user.id} /> : null;
}

function VaultWorkspace({ ownerId }: { ownerId: string }) {
  const [record, setRecord] = useState<VaultRecord | null>(null);
  const [session, setSession] = useState<OpenVault | null>(null);
  const [master, setMaster] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<VaultEntry | null>(null);
  const [deleting, setDeleting] = useState<VaultEntry | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [showEditorPassword, setShowEditorPassword] = useState(false);
  const [feedback, setFeedback] = useState('');
  const generation = useRef(0);
  const loadGeneration = useRef(0);
  const saveLock = useRef(false);
  const lock = useCallback(() => {
    generation.current++;
    setSession(null); setEditor(null); setDeleting(null); setRevealed(null); setMaster(''); setConfirmation(''); setSearch(''); setError(''); setBusy(false);
  }, []);
  const load = useCallback(async () => {
    const request = ++loadGeneration.current;
    setLoading(true); setError('');
    try {
      const response = await apiGet<{ data: VaultRecord }>('/users/me/password-vault');
      if (request !== loadGeneration.current) return;
      if (response.data.owner_id !== ownerId) throw new Error('A conta mudou. Entre novamente.');
      setRecord(response.data);
    } catch { if (request === loadGeneration.current) { setRecord(null); setError('Não foi possível carregar seu cofre. Tente novamente ou fale com o suporte.'); } }
    finally { if (request === loadGeneration.current) setLoading(false); }
  }, [ownerId]);
  useEffect(() => {
    const activeGeneration = generation, activeLoad = loadGeneration;
    void load();
    return () => { activeGeneration.current++; activeLoad.current++; };
  }, [load]);
  const unlocked = !!session;
  useEffect(() => {
    if (!unlocked) return;
    let timeout: ReturnType<typeof setTimeout>;
    const reset = () => { clearTimeout(timeout); timeout = setTimeout(lock, 5 * 60 * 1000); };
    const visibility = () => { if (document.hidden) lock(); };
    reset();
    window.addEventListener('pointerdown', reset, { passive: true }); window.addEventListener('keydown', reset);
    document.addEventListener('visibilitychange', visibility);
    return () => { clearTimeout(timeout); window.removeEventListener('pointerdown', reset); window.removeEventListener('keydown', reset); document.removeEventListener('visibilitychange', visibility); };
  }, [unlocked, lock]);
  useEffect(() => { if (!revealed) return; const timer = setTimeout(() => setRevealed(null), 15000); return () => clearTimeout(timer); }, [revealed]);
  useEffect(() => { if (!feedback) return; const timer = setTimeout(() => setFeedback(''), 2500); return () => clearTimeout(timer); }, [feedback]);

  async function open(event: FormEvent) {
    event.preventDefault();
    if (!record || busy || saveLock.current) return;
    if (!record.envelope && master !== confirmation) { setError('As senhas mestras não coincidem.'); return; }
    const request = generation.current;
    setBusy(true); setError('');
    try {
      // Re-read before unlocking, including after a lock, so an older tab cannot overwrite a newer version.
      const latest = (await apiGet<{ data: VaultRecord }>('/users/me/password-vault')).data;
      if (generation.current !== request) return;
      if (latest.owner_id !== ownerId) throw new Error('A conta mudou. Entre novamente.');
      let opened: OpenVault;
      let recordEnvelope = latest.envelope;
      if (latest.envelope) {
        const result = await unlockVault(master, ownerId, latest.envelope);
        opened = { ...result, revision: latest.revision };
      } else {
        if (record.envelope) throw new Error('O cofre mudou. Recarregue a página.');
        const result = await createVault(master, ownerId);
        if (generation.current !== request) return;
        const saved = await apiPut<{ data: { revision: number } }>('/users/me/password-vault', { expected_revision: 0, envelope: result.envelope }, { 'X-Nex-User-Id': ownerId });
        recordEnvelope = result.envelope;
        opened = { key: result.key, salt: result.salt, entries: [], revision: saved.data.revision };
      }
      if (generation.current === request) { setSession(opened); setRecord({ owner_id: ownerId, revision: opened.revision, envelope: recordEnvelope }); }
    } catch (failure) { if (generation.current === request) setError(failure instanceof Error ? failure.message : 'Não foi possível abrir o cofre.'); }
    finally { if (generation.current === request) { setBusy(false); setMaster(''); setConfirmation(''); } }
  }
  async function persist(entries: VaultEntry[]) {
    if (!session || saveLock.current) return;
    saveLock.current = true;
    const request = generation.current;
    setBusy(true); setError('');
    try {
      const valid = validateVaultEntries(entries);
      const envelope = await encryptVault(session.key, session.salt, ownerId, valid);
      if (generation.current !== request) return;
      const saved = await apiPut<{ data: { revision: number } }>('/users/me/password-vault', { expected_revision: session.revision, envelope }, { 'X-Nex-User-Id': ownerId });
      if (generation.current !== request) return;
      setSession({ ...session, entries: valid, revision: saved.data.revision });
      setRecord({ owner_id: ownerId, revision: saved.data.revision, envelope });
      setEditor(null); setDeleting(null); setRevealed(null); setFeedback('Cofre salvo.');
    } catch (failure) { if (generation.current === request) setError(failure instanceof Error ? failure.message : 'Não foi possível salvar. Seu formulário foi mantido.'); }
    finally { saveLock.current = false; if (generation.current === request) setBusy(false); }
  }
  function saveEntry(event: FormEvent) {
    event.preventDefault();
    if (!editor || !session) return;
    const entries = session.entries.some(item => item.id === editor.id) ? session.entries.map(item => item.id === editor.id ? editor : item) : [...session.entries, editor];
    void persist(entries);
  }
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setFeedback('Copiado para a área de transferência.'); } catch { setFeedback('Não foi possível copiar. Use a opção de visualizar.'); }
  }
  const creating = !record?.envelope;
  const entries = (session?.entries || []).filter(entry => `${entry.title} ${entry.username} ${entry.url}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))).sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
  return <section className="password-vault-workspace">
    <header className="vault-header"><span className="vault-brand"><LockKeyhole size={25} /></span><div><h1>Cofre de senhas</h1><p>Seus acessos organizados, protegidos por você.</p></div><span className="vault-security"><ShieldCheck size={16} />Criptografia no navegador</span>{session && <button type="button" className="vault-button" onClick={lock}><LockKeyhole size={16} />Bloquear</button>}</header>
    {feedback && <p className="vault-feedback" role="status">{feedback}</p>}
    {error && <p className="vault-error" role="alert">{error}{!record && <button type="button" onClick={() => void load()}>Tentar novamente</button>}</p>}
    {loading ? <div className="vault-lock-card" role="status">Carregando seu cofre…</div> : !session ? <form onSubmit={open} className="vault-lock-card">
      <span className="vault-lock-emblem"><LockKeyhole size={36} /></span><h2>{creating ? 'Crie seu cofre pessoal' : 'Seu cofre está bloqueado'}</h2>
      <p>{creating ? 'Escolha uma senha mestra exclusiva, com pelo menos 12 caracteres. Ela protege todos os seus acessos.' : 'Digite sua senha mestra para consultar seus acessos.'}</p>
      <label>Senha mestra<input type="password" minLength={12} maxLength={256} autoComplete="off" value={master} onChange={event => setMaster(event.target.value)} required disabled={busy || !record} /></label>
      {creating && <label>Confirme a senha mestra<input type="password" minLength={12} maxLength={256} autoComplete="off" value={confirmation} onChange={event => setConfirmation(event.target.value)} required disabled={busy || !record} /></label>}
      <button type="submit" className="vault-button is-primary" disabled={busy || !record}>{busy ? 'Protegendo seus acessos…' : creating ? 'Criar cofre' : 'Desbloquear'}</button>
      <small>Guarde sua senha mestra em um lugar seguro. Ela não é enviada à Rede NEX e não pode ser recuperada pela equipe. O cofre bloqueia ao sair da aba ou após 5 minutos sem atividade.</small>
    </form> : <>
      <div className="vault-controls"><div><h2>Meus acessos <span>{session.entries.length}</span></h2><p>Somente você pode abrir este cofre com sua senha mestra.</p></div><label className="vault-search"><Search size={18} /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar nome, usuário ou site" aria-label="Buscar acessos" /></label><button type="button" className="vault-button is-primary" onClick={() => { setEditor(emptyEntry()); setShowEditorPassword(false); }} disabled={busy}><Plus size={17} />Novo acesso</button></div>
      <div className="vault-entry-grid">{entries.map(entry => <article key={entry.id} className="vault-entry"><div className="vault-entry-heading"><span className="vault-entry-icon"><KeyRound size={22} /></span><div><h3>{entry.title}</h3><p>{entry.url ? new URL(entry.url).hostname : 'Acesso sem link'}</p></div><button type="button" aria-label={`Editar ${entry.title}`} onClick={() => { setEditor({ ...entry }); setShowEditorPassword(false); }} disabled={busy}><Pencil size={17} /></button></div>
        <label>Usuário<div className="vault-value"><span>{entry.username || 'Não informado'}</span><button type="button" onClick={() => void copy(entry.username)} disabled={!entry.username} aria-label={`Copiar usuário de ${entry.title}`}><Copy size={16} /></button></div></label>
        <label>Senha<div className="vault-value"><span>{revealed === entry.id ? entry.password : '••••••••••••'}</span><button type="button" onClick={() => setRevealed(revealed === entry.id ? null : entry.id)} aria-label={revealed === entry.id ? 'Ocultar senha' : `Mostrar senha de ${entry.title}`}>{revealed === entry.id ? <EyeOff size={16} /> : <Eye size={16} />}</button><button type="button" onClick={() => void copy(entry.password)} aria-label={`Copiar senha de ${entry.title}`}><Copy size={16} /></button></div></label>
        {entry.notes && <p className="vault-entry-notes">{entry.notes}</p>}
        <footer>{entry.url ? <a href={entry.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} />Abrir site</a> : <span />}<button type="button" onClick={() => setDeleting(entry)} disabled={busy} aria-label={`Excluir ${entry.title}`}><Trash2 size={16} /></button></footer>
      </article>)}</div>
      {!entries.length && <div className="vault-empty"><KeyRound size={38} /><h3>{search ? 'Nenhum acesso encontrado' : 'Seu primeiro acesso começa aqui'}</h3><p>{search ? 'Tente outro nome ou site.' : 'Adicione o nome do serviço, usuário, senha e link para abrir quando precisar.'}</p></div>}
    </>}
    <Dialog open={!!editor} onOpenChange={value => { if (!value && !busy) setEditor(null); }}><DialogContent className="vault-dialog"><DialogTitle>{session?.entries.some(entry => entry.id === editor?.id) ? 'Editar acesso' : 'Novo acesso'}</DialogTitle><DialogDescription>Os campos serão criptografados antes de salvar.</DialogDescription>{editor && <form onSubmit={saveEntry}>
      <label>Nome do serviço<input autoFocus value={editor.title} onChange={event => setEditor({ ...editor, title: event.target.value })} maxLength={120} required disabled={busy} /></label>
      <label>Link de acesso<input type="url" placeholder="https://" value={editor.url} onChange={event => setEditor({ ...editor, url: event.target.value })} maxLength={2048} disabled={busy} /></label>
      <label>Usuário ou e-mail<input value={editor.username} onChange={event => setEditor({ ...editor, username: event.target.value })} maxLength={320} autoComplete="off" disabled={busy} /></label>
      <label>Senha<div className="vault-password-field"><input type={showEditorPassword ? 'text' : 'password'} value={editor.password} onChange={event => setEditor({ ...editor, password: event.target.value })} maxLength={2048} autoComplete="new-password" required disabled={busy} /><button type="button" aria-label={showEditorPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowEditorPassword(value => !value)}>{showEditorPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button><button type="button" onClick={() => setEditor({ ...editor, password: generateVaultPassword() })} disabled={busy} title="Gerar senha forte" aria-label="Gerar senha forte"><RefreshCw size={17} /></button></div></label>
      <label>Observações<textarea value={editor.notes} onChange={event => setEditor({ ...editor, notes: event.target.value })} maxLength={4000} rows={3} disabled={busy} /></label>
      {error && <p className="vault-error" role="alert">{error}</p>}
      <div className="vault-dialog-actions"><button type="button" className="vault-button" disabled={busy} onClick={() => setEditor(null)}><X size={16} />Cancelar</button><button type="submit" className="vault-button is-primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar acesso'}</button></div>
    </form>}</DialogContent></Dialog>
    <Dialog open={!!deleting} onOpenChange={value => { if (!value && !busy) setDeleting(null); }}><DialogContent className="vault-dialog"><DialogTitle>Excluir acesso?</DialogTitle><DialogDescription>O acesso “{deleting?.title}” será removido do seu cofre. Esta ação não altera a senha no serviço.</DialogDescription>{error && <p role="alert" className="vault-error">{error}</p>}<div className="vault-dialog-actions"><button type="button" className="vault-button" disabled={busy} onClick={() => setDeleting(null)}>Cancelar</button><button type="button" className="vault-button is-danger" disabled={busy} onClick={() => { if (session) void persist(session.entries.filter(entry => entry.id !== deleting?.id)); }}>Excluir acesso</button></div></DialogContent></Dialog>
  </section>;
}
