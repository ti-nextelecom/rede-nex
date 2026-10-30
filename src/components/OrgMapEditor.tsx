import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertCircle, ArrowLeft, Building2, Check, GripVertical, Loader2, Pencil, Search, Users, X } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { apiGet, apiPut } from '../lib/apiClient';
import { updateDepartment, type Department } from '../lib/appApi';
import type { User } from '../types';
import { canReparentDepartment } from '../../shared/orgTree.mjs';
import { EmployeeAvatar } from './EmployeeAvatar';
import '../pages/org-editor.css';

type DragItem = { kind: 'person' | 'department'; id: string };
type Editing = { kind: 'person'; person: User; department: string; position: string } | { kind: 'department'; dept: Department; parent: string; manager: string; name: string };
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

/** Changes use the existing authenticated API, not canvas coordinates/localStorage.
 * A drop only prepares a change: explicit confirmation is required to persist it.
 * Mobile and keyboard users have the same actions through labelled edit buttons.
 */
export function OrgMapEditor({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const allowed = ['Administrador', 'Gestor'].includes(user?.role_name || user?.roles?.name || '');
  const readOnly = import.meta.env.VITE_REMOTE_READ_ONLY === 'true';
  const [departments, setDepartments] = useState<Department[]>([]);
  const [people, setPeople] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Editing | null>(null);
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const drag = useRef<DragItem | null>(null);
  const [dragging, setDragging] = useState<DragItem | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const [d, p] = await Promise.all([apiGet<{ data: Department[] }>('/departments'), apiGet<{ data: User[] }>('/users')]);
      setDepartments(d.data || []); setPeople(p.data || []);
    } catch { setLoadError('Não foi possível carregar os vínculos. Nenhuma alteração foi realizada.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (allowed) void load(); }, [load, allowed]);
  const byId = useMemo(() => new Map(departments.map(d => [d.id, d])), [departments]);
  const term = normalize(query.trim());
  const matches = (p: User) => !term || normalize(`${p.name} ${p.position || ''}`).includes(term);
  const ordered = useMemo(() => {
    const result: { dept: Department; depth: number }[] = [], seen = new Set<string>();
    const visit = (d: Department, depth: number) => {
      if (seen.has(d.id)) return;
      seen.add(d.id); result.push({ dept: d, depth });
      departments.filter(child => child.parent_id === d.id).forEach(child => visit(child, depth + 1));
    };
    departments.filter(d => !d.parent_id || !byId.has(d.parent_id)).forEach(d => visit(d, 0));
    departments.forEach(d => visit(d, 0)); // Keep malformed legacy branches visible for repair.
    return result;
  }, [departments, byId]);

  function openPerson(person: User, target = person.department_id || '') {
    setFormError(''); setEditing({ kind: 'person', person, department: target, position: person.position || '' });
  }
  function openDepartment(dept: Department, parent = dept.parent_id || '') {
    setFormError(''); setEditing({ kind: 'department', dept, parent, manager: dept.manager_id || '', name: dept.name });
  }
  function startDrag(event: DragEvent, item: DragItem) {
    if (saving || editing) { event.preventDefault(); return; }
    event.stopPropagation(); drag.current = item; setDragging(item);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-rede-nex-org', JSON.stringify(item));
  }
  function endDrag() { drag.current = null; setDragging(null); setOver(null); }
  function canDrop(target: string) {
    const item = drag.current;
    if (!item || saving || editing) return false;
    if (item.kind === 'person') return (people.find(p => p.id === item.id)?.department_id || '') !== target;
    return (byId.get(item.id)?.parent_id || '') !== target && canReparentDepartment(departments, item.id, target || null);
  }
  function drop(event: DragEvent, target: string) {
    event.preventDefault(); event.stopPropagation();
    const item = drag.current;
    if (item && canDrop(target)) {
      if (item.kind === 'person') { const person = people.find(p => p.id === item.id); if (person) openPerson(person, target); }
      else { const dept = byId.get(item.id); if (dept) openDepartment(dept, target); }
    }
    endDrag();
  }
  const dropProps = (target: string) => ({
    onDragOver: (event: DragEvent) => { if (canDrop(target)) { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'move'; setOver(target); } },
    onDragLeave: (event: DragEvent) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOver(null); },
    onDrop: (event: DragEvent) => drop(event, target),
    'data-drop-active': over === target && Boolean(dragging),
  });
  const changed = editing?.kind === 'person'
    ? editing.department !== (editing.person.department_id || '') || editing.position.trim() !== (editing.person.position || '')
    : editing ? editing.name.trim() !== editing.dept.name || editing.parent !== (editing.dept.parent_id || '') || editing.manager !== (editing.dept.manager_id || '') : false;

  async function save() {
    if (!allowed || readOnly || !editing || saveLock.current || !changed) return;
    if (editing.kind === 'department' && (!editing.name.trim() || !canReparentDepartment(departments, editing.dept.id, editing.parent || null))) {
      setFormError('Informe o nome e um setor superior válido, sem ciclos na hierarquia.'); return;
    }
    saveLock.current = true; setSaving(true); setFormError('');
    try {
      if (editing.kind === 'person') {
        const body: { department_id?: string | null; position?: string } = {};
        if (editing.department !== (editing.person.department_id || '')) body.department_id = editing.department || null;
        if (editing.position.trim() !== (editing.person.position || '')) body.position = editing.position.trim();
        const result = await apiPut<{ data: User }>(`/users/${editing.person.id}`, body);
        if (!result.data) throw new Error('O servidor não confirmou a alteração.');
        setPeople(prev => prev.map(p => p.id === editing.person.id ? { ...p, ...result.data } : p));
        setNotice(`Vínculo de ${editing.person.name} atualizado.`);
      } else {
        const body: Partial<Pick<Department, 'name' | 'parent_id' | 'manager_id'>> = {};
        if (editing.name.trim() !== editing.dept.name) body.name = editing.name.trim();
        if (editing.parent !== (editing.dept.parent_id || '')) body.parent_id = editing.parent || null;
        if (editing.manager !== (editing.dept.manager_id || '')) body.manager_id = editing.manager || null;
        const updated = await updateDepartment(editing.dept.id, body);
        setDepartments(prev => prev.map(d => d.id === updated.id ? { ...d, ...updated } : d));
        setNotice(`Estrutura de ${updated.name} atualizada.`);
      }
      setEditing(null);
    } catch (error) { setFormError(error instanceof Error ? error.message : 'Não foi possível salvar. Tente novamente.'); }
    finally { setSaving(false); saveLock.current = false; }
  }
  if (!allowed) return null;
  const personCard = (person: User) => <div className="org-editor-person" key={person.id} draggable={!editing} onDragStart={e => startDrag(e, { kind: 'person', id: person.id })} onDragEnd={endDrag}>
    <GripVertical size={16} aria-hidden="true" /><EmployeeAvatar name={person.name} photo={person.photo_url} className="employee-avatar-small" />
    <div><strong>{person.name}</strong><span>{person.position || 'Cargo não informado'}{person.status === 'inactive' ? ' · Inativo' : ''}</span></div>
    <button className="people-button" aria-label={`Mover ou editar ${person.name}`} onClick={() => openPerson(person)}><Pencil size={16} aria-hidden="true" /></button>
  </div>;
  const unassigned = people.filter(p => (!p.department_id || !byId.has(p.department_id)) && matches(p));

  return <section className="org-editor" aria-label="Editor do mapa organizacional">
    <header className="org-editor-heading"><div><span className="people-eyebrow"><Pencil size={15} /> EDIÇÃO DA ESTRUTURA</span><h2>Organize as equipes, aqui mesmo.</h2><p>Arraste pessoas para outro setor ou arraste um setor para alterar seu superior. Use o lápis para editar pelo teclado ou celular.</p></div><button className="people-button" onClick={onClose} disabled={saving}><ArrowLeft size={17} /> Concluir edição</button></header>
    {readOnly && <p className="org-editor-readonly"><AlertCircle size={18} /> Prévia protegida: explore a edição, mas o salvamento no servidor está bloqueado neste ambiente.</p>}
    <div role="status" aria-live="polite" className="org-editor-status">{notice && <><Check size={17} />{notice}</>}</div>
    <label className="org-search"><Search size={18} /><input aria-label="Buscar pessoas ou setores para organizar" placeholder="Buscar pessoa, cargo ou setor" value={query} onChange={e => setQuery(e.target.value)} /></label>
    {loading ? <div className="org-loading"><Loader2 className="animate-spin" /> Carregando equipes…</div> : loadError ? <div className="people-empty" role="alert"><p>{loadError}</p><button className="people-button" onClick={load}>Tentar novamente</button></div> : <>
      <div className="org-editor-root" {...dropProps('')}><Building2 size={20} /><div><strong>{dragging?.kind === 'department' ? 'Solte aqui para tornar um setor raiz' : 'Pessoas sem setor'}</strong><p>{dragging?.kind === 'department' ? 'O setor deixará de estar subordinado a outra equipe.' : 'Solte uma pessoa aqui para remover somente seu vínculo com o setor.'}</p></div><span>{people.filter(p => !p.department_id || !byId.has(p.department_id)).length}</span></div>
      {unassigned.length > 0 && <div className="org-editor-unassigned">{unassigned.map(personCard)}</div>}
      <div className="org-editor-board">{ordered.filter(({ dept }) => !term || normalize(dept.name).includes(term) || people.some(p => p.department_id === dept.id && matches(p))).map(({ dept, depth }) => {
        const members = people.filter(p => p.department_id === dept.id);
        const manager = people.find(p => p.id === dept.manager_id);
        return <article key={dept.id} className="org-editor-sector" {...dropProps(dept.id)}>
          <header><div className="org-editor-sector-title" draggable={!editing} onDragStart={e => startDrag(e, { kind: 'department', id: dept.id })} onDragEnd={endDrag}><GripVertical size={18} /><div><small>{depth ? `Vinculado a ${byId.get(dept.parent_id || '')?.name || 'setor superior'}` : 'Setor raiz'}</small><h3>{dept.name}</h3></div></div><button className="people-button" aria-label={`Organizar ${dept.name}`} onClick={() => openDepartment(dept)}><Pencil size={16} /></button></header>
          <div className="org-editor-lead"><EmployeeAvatar name={manager?.name || '?'} photo={manager?.photo_url} className="employee-avatar-small" /><div><span>Responsável</span><strong>{manager?.name || 'Não definido'}</strong></div><span><Users size={15} /> {members.length}</span></div>
          <div className="org-editor-members">{members.filter(matches).map(personCard)}{!members.filter(matches).length && <p className="org-editor-drop-hint">{term ? 'Nenhuma pessoa corresponde à busca.' : 'Arraste uma pessoa para esta equipe.'}</p>}</div>
        </article>;
      })}</div>
      {!departments.length && <p className="people-empty">Cadastre setores em Setores e Departamentos para organizar suas equipes.</p>}
    </>}
    <Dialog.Root open={Boolean(editing)} onOpenChange={open => { if (!open && !saving) setEditing(null); }}><Dialog.Portal><Dialog.Overlay className="people-modal-overlay" /><Dialog.Content className="people-page people-dialog org-editor-dialog" onEscapeKeyDown={e => { if (saving) e.preventDefault(); }} onInteractOutside={e => { if (saving) e.preventDefault(); }}>
      <header><div><Dialog.Title>{editing?.kind === 'person' ? 'Mover ou editar colaborador' : 'Organizar setor'}</Dialog.Title><Dialog.Description>{editing?.kind === 'person' ? 'O vínculo e o cargo serão atualizados no cadastro existente. O acesso e o perfil de permissão não serão alterados.' : 'Altere a hierarquia, o nome ou o responsável. As equipes subordinadas acompanham o setor.'}</Dialog.Description></div><button disabled={saving} className="people-button" aria-label="Cancelar alteração" onClick={() => setEditing(null)}><X size={18} /></button></header>
      <div className="org-editor-form">
        {formError && <p role="alert" className="people-form-error">{formError}</p>}
        {editing?.kind === 'person' ? <><div className="org-manager"><EmployeeAvatar name={editing.person.name} photo={editing.person.photo_url} className="employee-avatar-small" /><strong>{editing.person.name}</strong></div><p className="org-editor-context">Setor atual: {byId.get(editing.person.department_id || '')?.name || 'Sem setor'}</p><label htmlFor="org-person-sector">Novo setor</label><select id="org-person-sector" value={editing.department} disabled={saving} onChange={e => setEditing({ ...editing, department: e.target.value })}><option value="">Sem setor</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select><label htmlFor="org-person-position">Cargo</label><input id="org-person-position" value={editing.position} maxLength={200} disabled={saving} onChange={e => setEditing({ ...editing, position: e.target.value })} /></> : editing && <><label htmlFor="org-sector-name">Nome do setor</label><input id="org-sector-name" value={editing.name} maxLength={100} disabled={saving} onChange={e => setEditing({ ...editing, name: e.target.value })} /><label htmlFor="org-sector-parent">Setor superior</label><select id="org-sector-parent" value={editing.parent} disabled={saving} onChange={e => setEditing({ ...editing, parent: e.target.value })}><option value="">Sem superior (setor raiz)</option>{departments.filter(d => canReparentDepartment(departments, editing.dept.id, d.id)).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select><label htmlFor="org-sector-manager">Responsável</label><select id="org-sector-manager" value={editing.manager} disabled={saving} onChange={e => setEditing({ ...editing, manager: e.target.value })}><option value="">Sem responsável</option>{people.filter(p => p.status === 'active' || p.id === editing.manager).map(p => <option key={p.id} value={p.id}>{p.name}{p.status === 'inactive' ? ' · Inativo' : ''}</option>)}</select><p className="org-editor-context">Definir um responsável não altera automaticamente o setor de cadastro dessa pessoa.</p></>}
        {readOnly && <p className="org-editor-context">O ambiente local está em modo somente leitura. O salvamento estará disponível no ambiente habilitado para escrita.</p>}
      </div><footer><button className="people-button" disabled={saving} onClick={() => setEditing(null)}>Cancelar</button><button className="people-button org-primary" disabled={saving || !changed || readOnly} onClick={save}>{saving ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}{saving ? 'Salvando…' : 'Confirmar alteração'}</button></footer>
    </Dialog.Content></Dialog.Portal></Dialog.Root>
  </section>;
}
