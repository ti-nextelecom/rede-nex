import { useCallback, useEffect, useState } from 'react';
import { Building2, Check, ChevronDown, ChevronRight, Loader2, Network, Settings, Users, X } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { getDepartments, getUsers, updateDepartment, type Department } from '../lib/appApi';
import type { User } from '../types';

const ORG_CSS = `
.org-tree { margin: 0; padding: 0; list-style: none; }
.org-tree ul {
  margin: 0; padding: 0; list-style: none;
  padding-top: 28px; position: relative;
  display: flex; justify-content: center;
}
.org-tree ul::before {
  content: ''; position: absolute;
  top: 0; left: 50%;
  border-left: 1px solid #e2e8f0;
  height: 28px; width: 0;
}
.org-tree li {
  padding: 0 10px; padding-top: 28px;
  position: relative; text-align: center;
  display: flex; flex-direction: column; align-items: center;
}
.org-tree li::before, .org-tree li::after {
  content: ''; position: absolute;
  top: 0; right: 50%;
  border-top: 1px solid #e2e8f0;
  width: 50%; height: 28px;
  box-sizing: border-box;
}
.org-tree li::after {
  right: auto; left: 50%;
  border-left: 1px solid #e2e8f0;
  border-top: 1px solid #e2e8f0;
}
.org-tree li:only-child::before,
.org-tree li:only-child::after { display: none; }
.org-tree li:only-child { padding-top: 0; }
.org-tree li:first-child::before,
.org-tree li:last-child::after { border: 0 none; }
.org-tree li:last-child::before {
  border-right: 1px solid #e2e8f0; border-radius: 0 5px 0 0;
}
.org-tree li:first-child::after { border-radius: 5px 0 0 0; }
`;

interface OrgNode {
  id: string;
  name: string;
  parent_id: string | null;
  manager_name: string | null;
  manager_photo: string | null;
  manager_position: string | null;
  user_count: number;
  children: OrgNode[];
}

const COLORS = [
  { accent: '#3b82f6', light: '#eff6ff', text: '#1d4ed8' },
  { accent: '#10b981', light: '#f0fdf4', text: '#047857' },
  { accent: '#f59e0b', light: '#fffbeb', text: '#b45309' },
  { accent: '#8b5cf6', light: '#f5f3ff', text: '#6d28d9' },
];

/* ── Desktop: árvore horizontal ── */
function OrgCard({ node, level, defaultOpen }: { node: OrgNode; level: number; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const color = COLORS[Math.min(level, COLORS.length - 1)];
  const hasChildren = node.children.length > 0;

  return (
    <li>
      <div
        style={{
          display: 'inline-block', minWidth: 172, maxWidth: 210,
          background: 'white', borderRadius: 10, textAlign: 'left', overflow: 'hidden',
          border: '1px solid #e2e8f0', borderTop: `3px solid ${color.accent}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          cursor: hasChildren ? 'pointer' : 'default',
          transition: 'box-shadow 0.15s, transform 0.15s',
          userSelect: 'none',
        }}
        onClick={() => hasChildren && setOpen(v => !v)}
        onMouseEnter={e => { if (hasChildren) { const el = e.currentTarget as HTMLElement; el.style.boxShadow = '0 4px 14px rgba(0,0,0,0.1)'; el.style.transform = 'translateY(-1px)'; } }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; el.style.transform = ''; }}
      >
        <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: node.manager_name ? 8 : 0 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1, background: color.light, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={11} color={color.accent} />
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#0f172a', letterSpacing: '0.02em', lineHeight: 1.35 }}>
              {node.name}
            </span>
          </div>
          {node.manager_name && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 28 }}>
              {node.manager_photo ? (
                <img src={node.manager_photo} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `1.5px solid ${color.accent}40` }} />
              ) : (
                <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: color.light, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${color.accent}30` }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: color.accent }}>{node.manager_name[0]?.toUpperCase()}</span>
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 9.5, fontWeight: 600, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>{node.manager_name}</div>
                {node.manager_position && (
                  <div style={{ fontSize: 8.5, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>{node.manager_position}</div>
                )}
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Users size={9} color="#94a3b8" />
            <span style={{ fontSize: 9, color: '#94a3b8' }}>{node.user_count} colaborador{node.user_count !== 1 ? 'es' : ''}</span>
          </div>
          {hasChildren && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: color.light, borderRadius: 4, padding: '2px 6px', border: `1px solid ${color.accent}20` }}>
              <span style={{ fontSize: 8.5, color: color.text, fontWeight: 600 }}>{node.children.length} dept{node.children.length !== 1 ? 's' : ''}</span>
              {open ? <ChevronDown size={9} color={color.text} /> : <ChevronRight size={9} color={color.text} />}
            </div>
          )}
        </div>
      </div>
      {hasChildren && open && (
        <ul>
          {node.children.map(child => (
            <OrgCard key={child.id} node={child} level={level + 1} defaultOpen={level < 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

/* ── Mobile: lista colapsável vertical ── */
function OrgCardMobile({ node, level }: { node: OrgNode; level: number }) {
  const [open, setOpen] = useState(level < 1);
  const color = COLORS[Math.min(level, COLORS.length - 1)];
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-3 active:bg-slate-50 transition-colors"
        style={{
          paddingLeft: 16 + level * 20,
          paddingRight: 12,
          paddingTop: 10,
          paddingBottom: 10,
          borderLeft: level > 0 ? `2px solid ${color.accent}30` : 'none',
          marginLeft: level > 0 ? 16 + (level - 1) * 20 : 0,
          cursor: hasChildren ? 'pointer' : 'default',
        }}
        onClick={() => hasChildren && setOpen(v => !v)}
      >
        {/* Level indicator bar */}
        <div style={{ width: 3, height: 36, borderRadius: 2, background: color.accent, flexShrink: 0 }} />

        {/* Icon */}
        <div style={{ width: 34, height: 34, borderRadius: 9, background: color.light, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1.5px solid ${color.accent}30` }}>
          <Building2 size={15} color={color.accent} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>{node.name}</span>
            {hasChildren && (
              <span style={{ fontSize: 10, fontWeight: 600, color: color.text, background: color.light, borderRadius: 10, padding: '1px 6px', border: `1px solid ${color.accent}20` }}>
                {node.children.length}
              </span>
            )}
          </div>
          {node.manager_name && (
            <div className="flex items-center gap-1.5 mt-0.5">
              {node.manager_photo ? (
                <img src={node.manager_photo} alt="" style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: color.light, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${color.accent}30` }}>
                  <span style={{ fontSize: 7, fontWeight: 700, color: color.accent }}>{node.manager_name[0]?.toUpperCase()}</span>
                </div>
              )}
              <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {node.manager_name}{node.manager_position ? ` · ${node.manager_position}` : ''}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1 mt-0.5">
            <Users size={10} color="#94a3b8" />
            <span style={{ fontSize: 10, color: '#94a3b8' }}>{node.user_count} colaborador{node.user_count !== 1 ? 'es' : ''}</span>
          </div>
        </div>

        {/* Expand icon */}
        {hasChildren && (
          <div style={{ color: color.accent, flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>
            <ChevronRight size={18} />
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ marginLeft: 16 + level * 20, height: 1, background: '#f1f5f9' }} />

      {/* Children */}
      {hasChildren && open && (
        <div style={{ overflow: 'hidden' }}>
          {node.children.map(child => (
            <OrgCardMobile key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Modal de configuração ── */
interface ConfigRow {
  id: string;
  name: string;
  parent_id: string | null;
  manager_id: string | null;
}

function OrgConfig({ onClose }: { onClose: () => void }) {
  const [depts, setDepts] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadErr, setLoadErr] = useState('');

  useEffect(() => {
    Promise.all([getDepartments(), getUsers()])
      .then(([d, u]) => {
        setDepts(d as Department[]);
        setUsers(u.filter(u => u.status === 'active'));
        setRows(d.map(dept => ({
          id: dept.id,
          name: dept.name,
          parent_id: (dept as Department & { parent_id?: string | null }).parent_id ?? null,
          manager_id: (dept as Department & { manager_id?: string | null }).manager_id ?? null,
        })));
      })
      .catch(() => setLoadErr('Erro ao carregar dados'));
  }, []);

  function setRow(id: string, field: 'parent_id' | 'manager_id', value: string | null) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value || null } : r));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await Promise.all(rows.map(r =>
        updateDepartment(r.id, { manager_id: r.manager_id, parent_id: r.parent_id })
      ));
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 900);
    } catch {
      setLoadErr('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-t-2xl lg:rounded-2xl shadow-2xl w-full lg:max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
              <Settings size={18} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Configurar Organograma</h2>
              <p className="text-xs text-slate-500">Hierarquia e responsáveis de cada departamento</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {loadErr ? (
            <div className="flex items-center justify-center h-40 text-sm text-red-500">{loadErr}</div>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 size={20} className="animate-spin text-slate-400" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Departamento</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 hidden sm:table-cell">Superior</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Responsável</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Building2 size={13} className="text-blue-400 flex-shrink-0" />
                        <span className="font-medium text-slate-800 text-xs">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 hidden sm:table-cell">
                      <select
                        value={row.parent_id ?? ''}
                        onChange={e => setRow(row.id, 'parent_id', e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                      >
                        <option value="">— Raiz —</option>
                        {depts.filter(d => d.id !== row.id).map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={row.manager_id ?? ''}
                        onChange={e => setRow(row.id, 'manager_id', e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                      >
                        <option value="">— Sem responsável —</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.name}{u.position ? ` · ${u.position}` : ''}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl">
          <span className="text-xs text-slate-400">{rows.length} departamento{rows.length !== 1 ? 's' : ''}</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || saved}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-70 transition-colors"
            >
              {saved ? <Check size={13} /> : saving ? <Loader2 size={13} className="animate-spin" /> : null}
              {saved ? 'Salvo!' : saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Página principal ── */
export function OrgChartPage() {
  const [tree, setTree] = useState<OrgNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [configOpen, setConfigOpen] = useState(false);
  const { user } = useAuth();
  const isAdmin = ['Administrador', 'Gestor'].includes(user?.role_name ?? '');

  const loadTree = useCallback(() => {
    setLoading(true);
    fetch('/api/org-chart')
      .then(r => r.json())
      .then(d => setTree(d.data || []))
      .catch(() => setError('Erro ao carregar organograma'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadTree(); }, [loadTree]);

  if (loading) return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
    </div>
  );

  if (error) return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh]">
      <p className="text-slate-500 text-sm">{error}</p>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col bg-white lg:bg-slate-50/60" style={{ minHeight: "calc(100vh - 8rem)" }}>
      <style>{ORG_CSS}</style>

      {configOpen && (
        <OrgConfig onClose={() => { setConfigOpen(false); loadTree(); }} />
      )}

      {/* Header */}
      <div className="px-4 lg:px-6 py-4 bg-white border-b border-slate-200 flex items-center gap-3 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
          <Network size={18} className="text-blue-600" />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-bold text-slate-900">Organograma</h1>
          <p className="text-xs text-slate-500">Estrutura hierárquica da empresa</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setConfigOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <Settings size={13} />
            <span className="hidden sm:inline">Configurar</span>
          </button>
        )}
      </div>

      {tree.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
          <Network size={44} strokeWidth={1} />
          <p className="text-sm">Estrutura não configurada.</p>
        </div>
      ) : (
        <>
          {/* Desktop: árvore horizontal */}
          <div className="hidden lg:flex flex-1 overflow-auto p-10 justify-center">
            <div style={{ minWidth: 'max-content' }}>
              <ul className="org-tree">
                {tree.map(root => (
                  <OrgCard key={root.id} node={root} level={0} defaultOpen={true} />
                ))}
              </ul>
            </div>
          </div>

          {/* Mobile: lista colapsável */}
          <div className="lg:hidden overflow-auto bg-white" style={{ minHeight: "calc(100vh - 12rem)" }}>
            {tree.map(root => (
              <OrgCardMobile key={root.id} node={root} level={0} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
