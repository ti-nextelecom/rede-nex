import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowUpRight, Building2, ChevronDown, ChevronRight, Layers, List, Loader2, Minus, Network, Plus, RefreshCw, Search, Settings, UserCheck, Users } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { apiGet } from '../lib/apiClient';
import { EmployeeAvatar } from '../components/EmployeeAvatar';
import { OrgMapEditor } from '../components/OrgMapEditor';
import { filterOrgTree, flattenOrgTree, type OrgNode } from '../../shared/orgTree.mjs';
import './people-workspace.css';
import './org-workspace.css';

const COLORS = ['#83b9dd', '#7dceb4', '#d6b07b', '#b4a1db'];

function OrgBranch({ node, depth, collapsed, onToggle }: {
  node: OrgNode; depth: number; collapsed: Set<string>; onToggle: (id: string) => void;
}) {
  const open = !collapsed.has(node.id);
  const hasChildren = node.children.length > 0;
  const childrenId = `org-children-${node.id}`;
  return <li className="org-node" style={{ '--org-depth': Math.min(depth, 4), '--org-accent': COLORS[Math.min(depth, COLORS.length - 1)] } as CSSProperties}>
    <article className="org-card">
      <div className="org-card-heading"><span className="org-dept-icon"><Building2 size={19} aria-hidden="true" /></span><span className="org-level">Nível {depth + 1}</span></div>
      <h3>{node.name}</h3>
      <div className="org-manager">
        <EmployeeAvatar name={node.manager_name || '?'} photo={node.manager_photo} className="employee-avatar-small" />
        <div><span>Responsável</span><strong>{node.manager_name || 'Não definido'}</strong>{node.manager_position && <small>{node.manager_position}</small>}</div>
      </div>
      <div className="org-card-footer">
        <span><Users size={14} aria-hidden="true" /> {node.user_count} no setor</span>
        {hasChildren && <button aria-label={`${open ? 'Recolher' : 'Expandir'} ${node.name}`} aria-expanded={open} aria-controls={open ? childrenId : undefined} onClick={() => onToggle(node.id)}>
          {node.children.length} setor(es) {open ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}
        </button>}
      </div>
    </article>
    {hasChildren && open && <ul id={childrenId}>{node.children.map(child => <OrgBranch key={child.id} node={child} depth={depth + 1} collapsed={collapsed} onToggle={onToggle} />)}</ul>}
  </li>;
}

export function OrgChartPage() {
  const [tree, setTree] = useState<OrgNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingMap, setEditingMap] = useState(false);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'tree' | 'list'>(() => window.matchMedia('(max-width: 767px)').matches ? 'list' : 'tree');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const canvasRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const isAdmin = ['Administrador', 'Gestor'].includes(user?.role_name || user?.roles?.name || '');
  const loadTree = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await apiGet<{ data: OrgNode[] }>('/org-chart');
      setTree(response.data || []);
    } catch { setError('Não foi possível carregar o organograma. Tente novamente.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadTree(); }, [loadTree]);

  const flat = useMemo(() => flattenOrgTree(tree), [tree]);
  const visibleTree = useMemo(() => filterOrgTree(tree, search), [tree, search]);
  const visibleFlat = useMemo(() => flattenOrgTree(visibleTree), [visibleTree]);
  useEffect(() => {
    if (loading || view !== 'tree') return;
    const frame = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (canvas) canvas.scrollLeft = Math.max(0, (canvas.scrollWidth - canvas.clientWidth) / 2);
    });
    return () => cancelAnimationFrame(frame);
  }, [loading, view, visibleTree]);
  const toggle = (id: string) => setCollapsed(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  return <div className="people-page org-workspace">
    <header className="people-hero"><div><span className="people-eyebrow"><Network size={16} aria-hidden="true" /> PESSOAS / ESTRUTURA</span><h1>Organograma</h1><p>Conecte pessoas, equipes e responsabilidades.</p></div><div className="people-hero-actions">
      <Link to="/colaboradores" className="people-button"><Users size={17} aria-hidden="true" /> Ver colaboradores <ArrowUpRight size={15} aria-hidden="true" /></Link>
      {isAdmin && !editingMap && <button className="people-button org-primary" onClick={() => setEditingMap(true)}><Settings size={17} aria-hidden="true" /> Editar mapa</button>}
    </div></header>
    <div className="org-metrics" aria-label="Resumo da estrutura">
      {[{ label: 'Setores na estrutura', value: flat.length, Icon: Building2 }, { label: 'Colaboradores ativos nos setores', value: flat.reduce((sum, { node }) => sum + Number(node.user_count || 0), 0), Icon: Users }, { label: 'Setores com responsável', value: flat.filter(({ node }) => node.manager_name).length, Icon: UserCheck }, { label: 'Níveis de organização', value: flat.length ? Math.max(...flat.map(item => item.depth)) + 1 : 0, Icon: Layers }].map(({ label, value, Icon }) => <div key={label}><Icon size={20} aria-hidden="true" /><span>{label}</span><strong>{loading || error ? '—' : value}</strong></div>)}
    </div>
    {editingMap && isAdmin ? <OrgMapEditor onClose={() => { setEditingMap(false); void loadTree(); }} /> : <div className="org-map-panel">
      <div className="people-section-heading"><div><h2>Mapa da organização</h2><p>Expanda os setores para explorar a hierarquia e seus responsáveis.</p></div><span className="people-result-count" aria-live="polite">{loading ? 'Carregando…' : error ? 'Dados indisponíveis' : `${visibleFlat.length} setor(es)`}</span></div>
      <div className="org-toolbar">
        <label className="org-search"><Search size={18} aria-hidden="true" /><input value={search} onChange={e => { setSearch(e.target.value); setCollapsed(new Set()); }} placeholder="Buscar setor ou responsável" aria-label="Buscar no organograma" /></label>
        <div className="people-view-toggle" role="group" aria-label="Visualização do organograma"><button onClick={() => setView('tree')} aria-label="Visualizar árvore" aria-pressed={view === 'tree'}><Network size={18} /></button><button onClick={() => setView('list')} aria-label="Visualizar lista hierárquica" aria-pressed={view === 'list'}><List size={18} /></button></div>
        <div className="org-expand-actions"><button className="people-button" disabled={loading || Boolean(error)} onClick={() => setCollapsed(new Set())}><Plus size={15} /> Expandir tudo</button><button className="people-button" disabled={loading || Boolean(error)} onClick={() => setCollapsed(new Set(visibleFlat.filter(({ node }) => node.children.length).map(({ node }) => node.id)))}><Minus size={15} /> Recolher tudo</button><button className="people-button" disabled={loading} onClick={loadTree} aria-label="Atualizar organograma"><RefreshCw size={16} /></button></div>
      </div>
      {loading ? <div className="org-loading" role="status"><Loader2 size={26} className="animate-spin" /> Carregando estrutura…</div> : error ? <div className="people-empty" role="alert"><AlertCircle size={30} /><h3>Estrutura indisponível</h3><p>{error}</p><button className="people-button" onClick={loadTree}>Tentar novamente</button></div> : visibleTree.length === 0 ? <div className="people-empty"><Network size={34} /><h3>{tree.length ? 'Nenhum setor encontrado' : 'Estrutura ainda não configurada'}</h3><p>{tree.length ? 'Busque por outro nome de setor ou responsável.' : 'A hierarquia será exibida conforme os vínculos cadastrados nos setores.'}</p>{search && <button className="people-button" onClick={() => setSearch('')}>Limpar busca</button>}</div> : <>
        <div ref={canvasRef} className={view === 'tree' ? 'org-canvas' : 'org-list-canvas'} tabIndex={0} aria-label="Estrutura de setores. Use a rolagem para navegar.">
          <div className={view === 'tree' ? 'org-canvas-content' : ''}><ul className={view === 'tree' ? 'org-tree' : 'org-list'}>{visibleTree.map(root => <OrgBranch key={root.id} node={root} depth={0} collapsed={collapsed} onToggle={toggle} />)}</ul></div>
        </div>
        <div className="org-map-note"><span><i /> Setores e responsáveis cadastrados</span><span>{view === 'tree' ? 'Role na horizontal para explorar a estrutura.' : 'A lista mantém a relação entre setores superiores e suas equipes.'}</span></div>
      </>}
    </div>}
  </div>;
}
