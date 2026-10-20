import { useCallback, useEffect, useState } from 'react';
import { LockKeyhole, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { apiGet, apiPut } from '../lib/apiClient';
import { useHrAccess } from '../lib/hrAccess';
import { HrAvatar } from './HrAvatar';
import { HR_PERMISSIONS, effectivePermissions } from '../../shared/hr.mjs';
import '../pages/hr.css';

interface Target { id: string; name: string; photo_url?: string | null; role_id?: string; role_name?: string }
interface Grant { target_kind: string; target_id: string; permission: string; allowed: boolean }
interface Config { roles: Target[]; users: Target[]; grants: Grant[]; revision: number }
export function HrPermissionsPanel() {
  const { admin, loading: accessLoading } = useHrAccess();
  const [config, setConfig] = useState<Config | null>(null);
  const [kind, setKind] = useState<'role' | 'user'>('user');
  const [targetId, setTargetId] = useState('');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Record<string, boolean | null> | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try { setConfig(await apiGet<Config>('/permissions/rh')); setDraft(null); }
    catch (error) { setError((error as Error).message); setConfig(null); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { if (admin) void load(); }, [admin, load]);
  if (accessLoading) return <section className="hr-panel p-6">Conferindo acesso ao RH…</section>;
  if (!admin) return <section className="hr-panel p-6"><h2 className="font-bold">Acesso ao Módulo RH</h2><p>Somente o Administrador pode conceder ou revogar permissões de RH.</p></section>;
  const targets = kind === 'role' ? config?.roles || [] : config?.users || [];
  const target = targets.find(t => t.id === targetId);
  const locked = target?.name === 'Administrador' && kind === 'role' || target?.role_name === 'Administrador';
  const stored = Object.fromEntries((config?.grants || []).filter(g => g.target_kind === kind && g.target_id === targetId).map(g => [g.permission,g.allowed]));
  const values = draft ?? stored;
  const inherited = Object.fromEntries((config?.grants || []).filter(g => g.target_kind === 'role' && g.target_id === target?.role_id).map(g => [g.permission,g.allowed]));
  const effective = effectivePermissions(!!locked,kind === 'role' ? values as Record<string,boolean> : inherited,kind === 'user' ? values : {});
  async function save() {
    if (!config || !target || locked) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await apiPut('/permissions/rh',{ target_kind:kind, target_id:target.id, grants:values, revision:config.revision });
      await load(); setNotice('Acesso atualizado no servidor. Sessões abertas revalidam em até 60 segundos; a API aplica a regra imediatamente.');
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="hr-space hr-panel hr-permissions" aria-label="Permissões do Módulo RH">
    <header className="hr-section-heading"><div><span className="hr-eyebrow"><ShieldCheck size={17} /> Controle de acesso real</span><h2>Permissões do Módulo RH</h2><p>Regras salvas no banco, verificadas pela API. Exceções do usuário prevalecem sobre o perfil.</p></div><button className="hr-button" onClick={load} disabled={busy}><RefreshCw size={17} />Recarregar</button></header>
    {error && <div className="hr-alert" role="alert">{error}</div>}
    {notice && <div className="hr-notice" role="status">{notice}</div>}
    {config && <>
      <div className="hr-permission-target">
        <label>Configurar por<select value={kind} disabled={busy} onChange={e => { setKind(e.target.value as 'role'|'user'); setTargetId(''); setDraft(null); setNotice(''); }}><option value="user">Usuário — exceção individual</option><option value="role">Perfil — regra padrão</option></select></label>
        <label>Buscar<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nome ou perfil…" /></label>
        <label>{kind === 'user' ? 'Usuário' : 'Perfil'}<select value={targetId} disabled={busy} onChange={e => { setTargetId(e.target.value); setDraft(null); setNotice(''); }}><option value="">Selecione…</option>{targets.filter(t => t.id === targetId || `${t.name} ${t.role_name || ''}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))).map(t => <option key={t.id} value={t.id}>{t.name}{t.role_name ? ` · ${t.role_name}` : ''}</option>)}</select></label>
      </div>
      {target && <>
        {kind==='user' && <div className="hr-linked-user mx-6"><HrAvatar name={target.name} photo={target.photo_url}/><div><strong>{target.name}</strong><p>{target.role_name} · usuário existente da REDE NEX</p></div></div>}
        {locked && <p className="hr-notice"><LockKeyhole size={17} /> O Administrador mantém acesso completo. Seu acesso não pode ser removido.</p>}
        <div className="hr-permission-list">{HR_PERMISSIONS.map(p => <label key={p.key}><span>{p.label}<small>{effective[p.key] ? 'Acesso efetivo permitido' : 'Acesso efetivo bloqueado'}</small></span><select aria-label={`${p.label} para ${target.name}`} value={locked ? 'allow' : values[p.key] === true ? 'allow' : values[p.key] === false ? 'deny' : 'inherit'} disabled={locked || busy} onChange={e => setDraft({ ...values,[p.key]:e.target.value === 'inherit' ? null : e.target.value === 'allow' })}><option value="inherit">{kind === 'user' ? 'Herdar do perfil' : 'Não conceder'}</option><option value="allow">Permitir</option><option value="deny">Negar explicitamente</option></select></label>)}</div>
        <p className="hr-help">É necessário permitir o acesso ao módulo e a visualização da área. Editar ou exportar não libera visualização automaticamente. Gestores não têm acesso automático.</p>
        <button className="hr-button hr-primary" disabled={busy || !!locked || draft === null} onClick={save}><Save size={17} />{busy ? 'Salvando…' : 'Salvar permissões de RH'}</button>
      </>}
    </>}
  </section>;
}
