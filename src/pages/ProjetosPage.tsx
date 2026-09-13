import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  FilePlus2,
  Filter,
  FolderKanban,
  Gauge,
  LayoutGrid,
  LayoutList,
  Maximize2,
  Minimize2,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Target,
  TrendingUp,
  Trash2,
  Menu,
  X,
} from 'lucide-react';
import {
  createProject,
  deleteProject,
  fetchOpenRequests,
  fetchProjectSteps,
  fetchProjects,
  fetchProjectUsers,
  formatProjectDate,
  updateProject,
} from '../lib/projectsApi';
import type { Accent, Project, ProjectRequest, ProjectStep, ProjectUser, Status } from '../lib/projectsApi';
import { ProjectDetailView } from './ProjectDetail';
import { useAuth } from '../lib/auth';
import './projetos.css';

type Tab = 'Visão geral' | 'Projetos' | 'Solicitações' | 'Novo projeto' | 'Apresentação';

function formatDateShort(value: string | null): string {
  if (!value) return '';
  const dateOnly = value.includes('T') ? value.split('T')[0] : value;
  const d = new Date(`${dateOnly}T12:00:00`);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

const statusStyles: Record<Status, { label: string; className: string; dotClass: string }> = {
  'Não iniciado': { label: 'Aguardando', className: 'status-idle', dotClass: 'dot-idle' },
  'Em andamento': { label: 'Em andamento', className: 'status-progress', dotClass: 'dot-progress' },
  Concluído: { label: 'Concluído', className: 'status-done', dotClass: 'dot-done' },
  'Concluído Antes do Prazo': { label: 'Concluído antes do prazo', className: 'status-early', dotClass: 'dot-early' },
  Atrasado: { label: 'Atrasado', className: 'status-late', dotClass: 'dot-late' },
  Atenção: { label: 'Atenção', className: 'status-attention', dotClass: 'dot-attention' },
};

const accentOptions: { value: Accent; label: string; color: string }[] = [
  { value: 'blue', label: 'Azul', color: '#2878ee' },
  { value: 'teal', label: 'Verde-azulado', color: '#13a99b' },
  { value: 'pink', label: 'Rosa', color: '#d83b9e' },
  { value: 'violet', label: 'Violeta', color: '#7673ed' },
  { value: 'orange', label: 'Laranja', color: '#e9874a' },
  { value: 'navy', label: 'Azul-marinho', color: '#304363' },
];

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'NA';
}

function getStatusRowCls(status: Status): string {
  if (status === 'Atrasado') return 'pr-late';
  if (status === 'Atenção') return 'pr-attention';
  if (status === 'Em andamento') return 'pr-progress';
  if (status === 'Concluído' || status === 'Concluído Antes do Prazo') return 'pr-done';
  return '';
}

function getDateParts(date: Date) {
  return {
    day: date.toLocaleDateString('pt-BR', { day: '2-digit' }),
    month: date.toLocaleDateString('pt-BR', { month: 'long' }),
    weekday: date.toLocaleDateString('pt-BR', { weekday: 'long' }),
  };
}

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function SidebarTabIcon({ tab }: { tab: Tab }) {
  switch (tab) {
    case 'Visão geral': return <LayoutGrid size={15} />;
    case 'Projetos': return <FolderKanban size={15} />;
    case 'Apresentação': return <Play size={15} />;
    case 'Solicitações': return <Sparkles size={15} />;
    case 'Novo projeto': return <Plus size={15} />;
  }
}

export function ProjetosPage() {
  const auth = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('Visão geral');
  const [projects, setProjects] = useState<Project[]>([]);
  const [requests, setRequests] = useState<ProjectRequest[]>([]);
  const [users, setUsers] = useState<ProjectUser[]>([]);
  const [statusFilter, setStatusFilter] = useState<'Todos' | Status>('Em andamento');
  const [search, setSearch] = useState('');
  const [isTvMode, setIsTvMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const now = useNow();

  const isAdmin = auth.user?.role_name === 'Administrador';

  const loadProjects = useCallback(async () => {
    try {
      const data = await fetchProjects();
      setProjects(data);
      setSelectedProject(prev => prev ? (data.find(p => p.id === prev.id) ?? prev) : null);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Falha ao carregar projetos.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    try {
      const data = await fetchOpenRequests();
      setRequests(data);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try { const data = await fetchProjectUsers(); setUsers(data); } catch { /* noop */ }
  }, []);

  useEffect(() => {
    loadProjects();
    loadRequests();
    loadUsers();
  }, [loadProjects, loadRequests, loadUsers]);

  const filteredProjects = useMemo(() => projects.filter((project) => {
    const matchesStatus = statusFilter === 'Todos' || project.status === statusFilter;
    const query = search.toLowerCase();
    return matchesStatus && (!query || `${project.name} ${project.responsible_name} ${project.category}`.toLowerCase().includes(query));
  }), [projects, search, statusFilter]);

  const averageProgress = projects.length
    ? Math.round(projects.reduce((total, project) => total + project.progress, 0) / projects.length)
    : 0;

  const onTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setSelectedProject(null);
  };

  const handleAddProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || 'Novo projeto');
    const owner = String(form.get('owner') || 'A definir');
    const startDateValue = String(form.get('start_date') || '');
    const deadlineValue = String(form.get('deadline') || '');
    const category = String(form.get('category') || 'Estratégico');
    const accent = String(form.get('accent') || 'blue') as Accent;
    const summary = String(form.get('summary') || '');
    try {
      const statusValue = String(form.get('status') || 'Não iniciado') as Status;
      const tagValue = String(form.get('tag') || '');
      const responsibleUser = users.find(u => u.name === owner);
      await createProject({
        name,
        responsible_name: owner,
        responsible_photo_url: responsibleUser?.photo_url ?? null,
        category,
        start_date: startDateValue || null,
        deadline: deadlineValue || null,
        summary: summary || null,
        accent,
        status: statusValue,
        tag: tagValue || null,
      });
      await loadProjects();
      onTabChange('Projetos');
      event.currentTarget.reset();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Falha ao criar projeto.');
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await deleteProject(id);
      await loadProjects();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Falha ao remover projeto.');
    }
  };

  const handleSaveProject = async (id: string, payload: Partial<Project>) => {
    try {
      await updateProject(id, payload);
      await loadProjects();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Falha ao salvar projeto.');
    }
  };

  const renderContent = () => {
    if (selectedProject) {
      return (
        <ProjectDetailView
          project={selectedProject}
          onBack={() => setSelectedProject(null)}
          onProjectUpdated={loadProjects}
          isAdmin={isAdmin}
          currentUserId={auth.user?.id}
          currentUserName={auth.user?.name}
        />
      );
    }
    if (loading) return <div className="empty-state"><p>Carregando projetos…</p></div>;
    if (activeTab === 'Novo projeto' && isAdmin) {
      return <NewProjectView onSubmit={handleAddProject} onCancel={() => onTabChange('Projetos')} users={users} />;
    }
    if (activeTab === 'Solicitações') {
      return <RequestsView requests={requests} onResolve={loadRequests} />;
    }
    if (activeTab === 'Apresentação') {
      return (
        <PresentationInlineView
          projects={projects}
          onEnterTv={() => {
            setIsTvMode(true);
            onTabChange('Apresentação');
            document.documentElement.requestFullscreen?.().catch(() => undefined);
          }}
        />
      );
    }
    if (activeTab === 'Projetos') {
      return (
        <ProjectsView
          projects={filteredProjects}
          projectsCount={projects.length}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          search={search}
          setSearch={setSearch}
          onNew={() => onTabChange('Novo projeto')}
          onDelete={handleDeleteProject}
          onSave={handleSaveProject}
          onOpenDetail={setSelectedProject}
          isAdmin={isAdmin}
          users={users}
        />
      );
    }
    return (
      <OverviewView
        projects={projects}
        requests={requests}
        averageProgress={averageProgress}
        onProjects={() => onTabChange('Projetos')}
        onPresentation={() => onTabChange('Apresentação')}
        users={users}
      />
    );
  };

  const visibleTabs: Tab[] = isAdmin
    ? ['Visão geral', 'Projetos', 'Apresentação', 'Solicitações', 'Novo projeto']
    : ['Visão geral', 'Projetos', 'Apresentação', 'Solicitações'];

  const activeTabForSidebar: Tab = selectedProject ? 'Projetos' : activeTab;

  if (activeTab === 'Apresentação' && isTvMode && !selectedProject) {
    return (
      <div className="projetos-wrap">
        <PresentationView
          projects={projects}
          now={now}
          onExit={() => {
            setIsTvMode(false);
            onTabChange('Visão geral');
            document.exitFullscreen?.().catch(() => undefined);
          }}
        />
      </div>
    );
  }

  return (
    <div className="projetos-wrap">
      {sidebarOpen && <div className="sidebar-overlay open" onClick={() => setSidebarOpen(false)} />}
      <div className="projetos-layout">
        <aside className={`projetos-sidebar${sidebarOpen ? ' open' : ''}`}>
          <button className="sidebar-mobile-close" onClick={() => setSidebarOpen(false)}><X size={15} /></button>
          <div className="sidebar-brand">
            <div className="sidebar-brand-icon"><FolderKanban size={16} /></div>
            <strong>Projetos</strong>
          </div>
          <div className="sidebar-section">
            <span className="sidebar-section-label">NAVEGAÇÃO</span>
            {visibleTabs.map((tab) => (
              <button
                key={tab}
                className={activeTabForSidebar === tab ? 'sidebar-nav-item active' : 'sidebar-nav-item'}
                onClick={() => onTabChange(tab)}
              >
                <SidebarTabIcon tab={tab} />
                <span>{tab}</span>
                {tab === 'Solicitações' && requests.length > 0 && (
                  <span className="tab-badge">{requests.length}</span>
                )}
              </button>
            ))}
          </div>
          <div className="sidebar-divider" />
          <div className="sidebar-section">
            <span className="sidebar-section-label">ACESSO RÁPIDO</span>
            {isAdmin && (
              <button className="sidebar-nav-item" onClick={() => onTabChange('Novo projeto')}>
                <FilePlus2 size={15} />
                <span>Crie apontamentos</span>
              </button>
            )}
            <button
              className="sidebar-nav-item"
              onClick={() => { setStatusFilter('Atenção'); onTabChange('Projetos'); }}
            >
              <Target size={15} />
              <span>Revisar atenção</span>
            </button>
          </div>
          {users.length > 0 && (
            <>
              <div className="sidebar-divider" />
              <div className="sidebar-section">
                <span className="sidebar-section-label">EQUIPE · {users.length}</span>
                <div className="sidebar-users">
                  {users.slice(0, 12).map((u) => (
                    u.photo_url
                      ? <img key={u.id} src={u.photo_url} alt={u.name} className="avatar avatar-photo" title={u.name} />
                      : <div key={u.id} className="avatar avatar-navy" title={`${u.name}${u.role_name ? ` · ${u.role_name}` : ''}`}>{getInitials(u.name)}</div>
                  ))}
                </div>
              </div>
            </>
          )}
          <div className="sidebar-footer">
            {auth.user && (
              <div className="sidebar-current-user">
                <div className="avatar avatar-blue">{getInitials(auth.user.name ?? '—')}</div>
                <div className="sidebar-user-info">
                  <strong>{auth.user.name}</strong>
                  <small>{auth.user.role_name ?? 'Usuário'}</small>
                </div>
              </div>
            )}
          </div>
        </aside>
        <div className="projetos-main">
          <div className="projetos-mobile-header">
            <button className="projetos-menu-btn" onClick={() => setSidebarOpen(true)}><Menu size={18} /></button>
          </div>
          {loadError && <div className="error-banner">{loadError}</div>}
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

function OverviewView({ projects, requests, averageProgress, onProjects, onPresentation, users }: {
  projects: Project[];
  requests: ProjectRequest[];
  averageProgress: number;
  onProjects: () => void;
  onPresentation: () => void;
  users?: ProjectUser[];
}) {
  const active = projects.filter((p) => p.status === 'Em andamento').length;
  const attention = projects.filter((p) => p.status === 'Atenção').length;
  return (
    <div className="view-fade">
      <section className="metric-grid">
        <MetricCard label="Projetos ativos" value={String(active + attention)} caption="em movimento agora" icon={<FolderKanban size={18} />} accent="blue" trend={`${active} em andamento`} />
        <MetricCard label="Andamento médio" value={`${averageProgress}%`} caption="do portfólio completo" icon={<Gauge size={18} />} accent="green" trend="portfólio" />
        <MetricCard label="Próximos prazos" value={String(projects.filter((p) => p.deadline).length)} caption="marcados no painel" icon={<Clock3 size={18} />} accent="orange" trend={`${attention} exigem atenção`} />
        <MetricCard label="Solicitações" value={String(requests.length).padStart(2, '0')} caption="aguardando decisão" icon={<Sparkles size={18} />} accent="pink" trend="Ver solicitações" />
      </section>
      <section className="content-grid">
        <div className="panel portfolio-panel">
          <div className="panel-heading">
            <div><span className="section-kicker">Portfólio</span><h2>Projetos em foco</h2></div>
            <button className="text-button" onClick={onProjects}>Ver todos <ArrowUpRight size={15} /></button>
          </div>
          <div className="project-list">
            {projects.slice(0, 5).map((project) => <ProjectRow project={project} key={project.id} users={users} />)}
          </div>
        </div>
        <div className="panel timeline-panel">
          <div className="panel-heading">
            <div><span className="section-kicker">Calendário</span><h2>Próximos marcos</h2></div>
            <button className="primary-button" onClick={onPresentation}><Play size={15} /> Apresentar</button>
          </div>
          <div className="timeline">
            {projects.slice(0, 5).map((project) => (
              <TimelineItem
                key={project.id}
                day={formatProjectDate(project.deadline).slice(0, 2)}
                month={formatProjectDate(project.deadline).slice(3, 6).toUpperCase()}
                title={project.name}
                owner={project.responsible_name}
                color={project.accent}
              />
            ))}
          </div>
        </div>
      </section>
      <section className="highlight-banner">
        <div className="highlight-icon"><TrendingUp size={21} /></div>
        <div>
          <span className="section-kicker">Leitura rápida</span>
          <h2>
            {attention > 0
              ? <>O portfólio tem <strong>{attention} projeto{attention > 1 ? 's' : ''}</strong> que pede{attention > 1 ? 'm' : ''} uma decisão esta semana.</>
              : <>O portfólio está <strong>saudável</strong> e sem pendências críticas no momento.</>
            }
          </h2>
        </div>
        <button className="banner-action" onClick={onProjects}>Revisar atenção <ChevronRight size={16} /></button>
      </section>
    </div>
  );
}

function ProjectsView({ projects, projectsCount, statusFilter, setStatusFilter, search, setSearch, onNew, onDelete, onSave, onOpenDetail, isAdmin, users }: {
  projects: Project[];
  projectsCount: number;
  statusFilter: 'Todos' | Status;
  setStatusFilter: (v: 'Todos' | Status) => void;
  search: string;
  setSearch: (v: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onSave: (id: string, payload: Partial<Project>) => void;
  onOpenDetail: (project: Project) => void;
  isAdmin: boolean;
  users?: ProjectUser[];
}) {
  const [editing, setEditing] = useState<Project | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'calendar'>('grid');
  return (
    <div className="view-fade">
      <div className="view-heading">
        <div><span className="section-kicker">Workspace / Projetos</span><h2>{statusFilter === 'Todos' ? 'Todos os projetos' : statusFilter} <span className="heading-count">{projectsCount}</span></h2></div>
        {isAdmin && <button className="primary-button" onClick={onNew}><Plus size={17} /> Novo projeto</button>}
      </div>
      <div className="filters">
        <div className="search-field"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar projeto ou responsável" /></div>
        <div className="filter-select"><Filter size={16} /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'Todos' | Status)}><option>Todos</option><option>Não iniciado</option><option>Em andamento</option><option>Concluído</option><option>Concluído Antes do Prazo</option><option>Atrasado</option><option>Atenção</option></select></div>
        <div className="view-mode-btns">
          <button className={viewMode === 'grid' ? 'view-mode-btn active' : 'view-mode-btn'} onClick={() => setViewMode('grid')} title="Cards"><LayoutGrid size={16} /></button>
          <button className={viewMode === 'list' ? 'view-mode-btn active' : 'view-mode-btn'} onClick={() => setViewMode('list')} title="Lista"><LayoutList size={16} /></button>
          <button className={viewMode === 'calendar' ? 'view-mode-btn active' : 'view-mode-btn'} onClick={() => setViewMode('calendar')} title="Calendário"><CalendarDays size={16} /></button>
        </div>
      </div>
      {projects.length === 0 ? (
        <div className="empty-state"><Search size={28} /><h3>Nenhum projeto encontrado</h3><p>Crie um novo projeto ou ajuste os filtros.</p></div>
      ) : viewMode === 'grid' ? (
        <div className="project-card-grid">
          {projects.map((project) => (
            <ProjectCard
              project={project}
              key={project.id}
              onEdit={isAdmin ? () => setEditing(project) : undefined}
              onDelete={isAdmin ? () => onDelete(project.id) : undefined}
              onOpen={() => onOpenDetail(project)}
              users={users}
            />
          ))}
        </div>
      ) : viewMode === 'list' ? (
        <ProjectListView projects={projects} onEdit={isAdmin ? setEditing : undefined} onDelete={isAdmin ? onDelete : undefined} onOpen={onOpenDetail} users={users} />
      ) : (
        <ProjectCalendarView projects={projects} onOpen={onOpenDetail} />
      )}
      {editing && isAdmin && (
        <ProjectEditModal
          project={editing}
          onClose={() => setEditing(null)}
          onSave={(payload) => { onSave(editing.id, payload); setEditing(null); }}
          users={users}
        />
      )}
    </div>
  );
}

function ProjectEditModal({ project, onClose, onSave, users }: {
  project: Project;
  onClose: () => void;
  onSave: (payload: Partial<Project>) => void;
  users?: ProjectUser[];
}) {
  const [name, setName] = useState(project.name);
  const [responsible, setResponsible] = useState(project.responsible_name);
  const [responsiblePhotoUrl, setResponsiblePhotoUrl] = useState<string | null>(project.responsible_photo_url ?? null);
  const [ownerMode, setOwnerMode] = useState<'select' | 'text'>(users && users.length > 0 ? 'select' : 'text');
  const [status, setStatus] = useState<Status>(project.status);
  const [progress, setProgress] = useState(project.progress);
  const [phase, setPhase] = useState(project.phase);
  const [category, setCategory] = useState(project.category);
  const [startDate, setStartDate] = useState(project.start_date ?? '');
  const [deadline, setDeadline] = useState(project.deadline ?? '');
  const [nextAction, setNextAction] = useState(project.next_action);
  const [accent, setAccent] = useState<Accent>(project.accent);
  const [tag, setTag] = useState(project.tag ?? '');
  const [tagColor, setTagColor] = useState(project.tag_color ?? '');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave({ name, responsible_name: responsible, responsible_photo_url: responsiblePhotoUrl, status, progress, phase, category, start_date: startDate || null, deadline: deadline || null, next_action: nextAction, accent, tag: tag.trim() || null, tag_color: tagColor || null });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div><span className="section-kicker">Editar projeto</span><h3>{project.name}</h3></div>
          <button className="round-button" onClick={onClose}><X size={18} /></button>
        </div>
        <form className="project-form" onSubmit={submit}>
          <label>Nome<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <div className="form-row">
            <label>Responsável
              {users && users.length > 0 && ownerMode === 'select'
                ? <>
                    <select value={responsible} onChange={(e) => { const u = users.find(x => x.name === e.target.value); setResponsible(e.target.value); setResponsiblePhotoUrl(u?.photo_url ?? null); }} required>
                      <option value="">Selecionar responsável…</option>
                      {users.map((u) => <option key={u.id} value={u.name}>{u.name}{u.role_name ? ` · ${u.role_name}` : ''}</option>)}
                    </select>
                    <button type="button" className="tag-add-btn" style={{marginTop:4}} onClick={() => setOwnerMode('text')}>Digitar manualmente</button>
                  </>
                : <>
                    <input value={responsible} onChange={(e) => { setResponsible(e.target.value); setResponsiblePhotoUrl(null); }} required />
                    {users && users.length > 0 && <button type="button" className="tag-add-btn" style={{marginTop:4}} onClick={() => setOwnerMode('select')}>Selecionar usuário</button>}
                  </>
              }
            </label>
            <label>Categoria<input value={category} onChange={(e) => setCategory(e.target.value)} /></label>
          </div>
          <div className="form-row">
            <label>Status
              <div className="status-preset-picker" style={{marginTop:8}}>
                {(['Não iniciado','Em andamento','Concluído','Concluído Antes do Prazo','Atrasado'] as Status[]).map((s) => (
                  <label key={s} className="status-preset-option">
                    <input type="radio" name="edit_status" value={s} checked={status === s} onChange={() => setStatus(s)} />
                    <span className={`status-preset-pill ${statusStyles[s].className}`}><i />{statusStyles[s].label}</span>
                  </label>
                ))}
              </div>
            </label>
            <label>Fase
              <select value={phase} onChange={(e) => setPhase(e.target.value)}>
                <option>Descoberta</option><option>Planejamento</option><option>Execução</option><option>Testes</option><option>Go-live</option><option>Estabilização</option>
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>Progresso (%)<input type="number" min={0} max={100} value={progress} onChange={(e) => setProgress(Math.min(100, Math.max(0, Number(e.target.value))))} /></label>
          </div>
          <div className="form-row">
            <label>Prazo de início<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
            <label>Prazo final<input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></label>
          </div>
          <label>Próximo passo<input value={nextAction} onChange={(e) => setNextAction(e.target.value)} /></label>
          <label>Etiqueta <span className="optional">opcional — ex: URGENTE, VIP, Q3</span>
            <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Texto livre para destacar informação" maxLength={30} />
          </label>
          <label>Cor da etiqueta <span className="optional">opcional</span>
            <div className="tag-color-picker">
              {'#2878ee,#d83b9e,#11a99b,#7673ed,#e9874a,#ef4444,#f59e0b,#22c55e,#304363,#6b7280'.split(',').map(c => (
                <button type="button" key={c} className={tagColor === c ? 'accent-dot active' : 'accent-dot'} style={{background: c}} onClick={() => setTagColor(c)} aria-label={c} />
              ))}
              <input type="color" value={tagColor || '#2878ee'} onChange={(e) => setTagColor(e.target.value)} className="tag-color-input" title="Cor personalizada" />
              {tagColor && <button type="button" className="round-button" style={{marginLeft:4,fontSize:14}} onClick={() => setTagColor('')} title="Limpar cor">×</button>}
            </div>
          </label>
          <label>Cor de destaque
            <div className="accent-picker">
              {accentOptions.map((opt) => (
                <button type="button" key={opt.value} className={accent === opt.value ? 'accent-dot active' : 'accent-dot'} style={{ background: opt.color }} onClick={() => setAccent(opt.value)} aria-label={opt.label} />
              ))}
            </div>
          </label>
          <div className="form-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancelar</button>
            <button type="submit" className="primary-button"><Check size={16} /> Salvar alterações</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NewProjectView({ onSubmit, onCancel, users }: {
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  users: ProjectUser[];
}) {
  const [accent, setAccent] = useState<Accent>('blue');
  const [newStatus, setNewStatus] = useState<Status>('Não iniciado');
  const [ownerMode, setOwnerMode] = useState<'select' | 'text'>(users.length > 0 ? 'select' : 'text');
  return (
    <div className="view-fade new-project-layout">
      <div className="form-intro">
        <div className="new-icon"><FilePlus2 size={24} /></div>
        <span className="section-kicker">Novo projeto</span>
        <h2>Comece uma nova frente estratégica.</h2>
        <p>Cadastre o essencial agora. Depois, na aba Projetos, você poderá detalhar as etapas, responsáveis e marcos do projeto.</p>
        <div className="form-tip"><CircleHelp size={17} /><span>Os prazos aparecem automaticamente no calendário e na apresentação do painel.</span></div>
      </div>
      <form className="project-form" onSubmit={onSubmit}>
        <label>Nome do projeto<input name="name" required placeholder="Ex.: Expansão regional 2026" /></label>
        <label>Responsável
          {users.length > 0 && ownerMode === 'select'
            ? <>
                <select name="owner" required>
                  <option value="">Selecionar responsável…</option>
                  {users.map((u) => <option key={u.id} value={u.name}>{u.name}{u.role_name ? ` · ${u.role_name}` : ''}</option>)}
                </select>
                <button type="button" className="tag-add-btn" style={{marginTop:4}} onClick={() => setOwnerMode('text')}>Digitar nome manualmente</button>
              </>
            : <>
                <input name="owner" required placeholder="Nome da pessoa responsável" />
                {users.length > 0 && <button type="button" className="tag-add-btn" style={{marginTop:4}} onClick={() => setOwnerMode('select')}>Selecionar usuário cadastrado</button>}
              </>
          }
        </label>
        <div className="form-row">
          <label>Categoria
            <select name="category" defaultValue="Estratégico">
              <option>Estratégico</option><option>Operações</option><option>Tecnologia</option><option>Infraestrutura</option><option>Produção</option>
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>Prazo de início<input name="start_date" type="date" /></label>
          <label>Prazo final<input name="deadline" type="date" /></label>
        </div>
        <label>Status inicial
          <div className="status-preset-picker">
            {(['Não iniciado','Em andamento','Concluído','Concluído Antes do Prazo','Atrasado'] as Status[]).map((s) => (
              <label key={s} className="status-preset-option">
                <input type="radio" name="status" value={s} checked={newStatus === s} onChange={() => setNewStatus(s)} />
                <span className={`status-preset-pill ${statusStyles[s].className}`}><i />{statusStyles[s].label}</span>
              </label>
            ))}
          </div>
        </label>
        <label>Etiqueta <span className="optional">opcional — ex: URGENTE, VIP, Q3</span>
          <input name="tag" placeholder="Texto livre para destacar informação" maxLength={30} />
        </label>
        <label>Resumo <span className="optional">opcional</span>
          <textarea name="summary" placeholder="Qual é o resultado esperado?" rows={4} />
        </label>
        <label>Cor de destaque
          <div className="accent-picker">
            {accentOptions.map((opt) => (
              <button type="button" key={opt.value} className={accent === opt.value ? 'accent-dot active' : 'accent-dot'} style={{ background: opt.color }} onClick={() => setAccent(opt.value)} aria-label={opt.label} />
            ))}
          </div>
          <input type="hidden" name="accent" value={accent} />
        </label>
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>Cancelar</button>
          <button type="submit" className="primary-button"><Plus size={17} /> Criar projeto</button>
        </div>
      </form>
    </div>
  );
}

function RequestsView({ requests, onResolve }: { requests: ProjectRequest[]; onResolve: () => void }) {
  return (
    <div className="view-fade">
      <div className="view-heading">
        <div><span className="section-kicker">Caixa de entrada</span><h2>Solicitações <span className="heading-count">{requests.length} {requests.length === 1 ? 'nova' : 'novas'}</span></h2></div>
      </div>
      {requests.length > 0
        ? <div className="requests-list">
            {requests.map((request) => (
              <div className="request-row" key={request.id}>
                <div className="request-symbol tone-blue"><FilePlus2 size={18} /></div>
                <div className="request-main"><strong>{request.title}</strong><span>{request.requester_name} · {request.request_type}</span></div>
                <span className="request-type type-blue">{request.status}</span>
                <button className="request-action" onClick={onResolve}>Resolver <ArrowUpRight size={15} /></button>
              </div>
            ))}
          </div>
        : <div className="empty-state"><Check size={28} /><h3>Tudo em dia</h3><p>Nenhuma solicitação pendente no momento.</p></div>
      }
    </div>
  );
}

function PresentationInlineView({ projects, onEnterTv }: { projects: Project[]; onEnterTv: () => void }) {
  const [steps, setSteps] = useState<ProjectStep[]>([]);
  const [loadingSteps, setLoadingSteps] = useState(true);
  const [users, setUsers] = useState<ProjectUser[]>([]);

  useEffect(() => { fetchProjectUsers().then(setUsers).catch(() => {}); }, []);
  useEffect(() => {
    if (!projects[0]) return;
    setLoadingSteps(true);
    fetchProjectSteps(projects[0].id).then((data) => { setSteps(data); setLoadingSteps(false); }).catch(() => setLoadingSteps(false));
  }, [projects[0]?.id]);

  return (
    <div className="view-fade presentation-inline">
      <div className="view-heading">
        <div><span className="section-kicker">Apresentação</span><h2>Modo apresentação <span className="heading-count">{projects.length} projetos</span></h2></div>
        <button className="primary-button" onClick={onEnterTv}><Maximize2 size={16} /> Iniciar em tela cheia</button>
      </div>
      <p className="presentation-help">A apresentação percorre automaticamente cada projeto com suas etapas, prazos e responsáveis. Use o botão acima para iniciar em tela cheia (ideal para TV).</p>
      {projects.length === 0
        ? <div className="empty-state"><FolderKanban size={28} /><h3>Nenhum projeto para apresentar</h3><p>Crie projetos primeiro para visualizá-los aqui.</p></div>
        : <div className="presentation-preview"><PresentationCard project={projects[0]} index={0} total={projects.length} steps={steps} loadingSteps={loadingSteps} users={users} /></div>
      }
    </div>
  );
}

function PresentationView({ projects, now, onExit }: { projects: Project[]; now: Date; onExit: () => void }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [steps, setSteps] = useState<ProjectStep[]>([]);
  const [loadingSteps, setLoadingSteps] = useState(true);
  const [users, setUsers] = useState<ProjectUser[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [slideTime, setSlideTime] = useState<number>(() => Number(localStorage.getItem('pres_slide_time') ?? 9));
  const [tickerDuration, setTickerDuration] = useState<number>(() => Number(localStorage.getItem('pres_ticker_dur') ?? 45));
  const [cardZoom, setCardZoom] = useState<number>(() => Number(localStorage.getItem('pres_zoom') ?? 1));

  useEffect(() => { fetchProjectUsers().then(setUsers).catch(() => {}); }, []);

  useEffect(() => {
    if (projects.length === 0) return;
    const interval = window.setInterval(() => {
      if (!paused) setIndex((current) => (current + 1) % Math.max(1, projects.length));
    }, slideTime * 1000);
    return () => window.clearInterval(interval);
  }, [projects.length, paused, slideTime]);

  const currentProject = projects[index];

  useEffect(() => {
    if (!currentProject) return;
    setLoadingSteps(true);
    fetchProjectSteps(currentProject.id).then((data) => { setSteps(data); setLoadingSteps(false); }).catch(() => setLoadingSteps(false));
  }, [currentProject]);

  if (projects.length === 0) {
    return (
      <div className="presentation-screen">
        <div className="presentation-empty">
          <FolderKanban size={48} /><h2>Nenhum projeto cadastrado</h2>
          <p>Adicione projetos pelo painel para vê-los aqui.</p>
          <button className="primary-button" onClick={onExit}>Voltar ao painel</button>
        </div>
      </div>
    );
  }

  const dateParts = getDateParts(now);

  return (
    <div className="presentation-screen">
      <header className="presentation-top">
        <img src={import.meta.env.BASE_URL + 'logo_nex-telecom_TevSiL.png'} alt="Nex Telecom" className="presentation-logo" />
        <div className="presentation-clock">
          <CalendarDays size={20} />
          <strong>{dateParts.day} de {dateParts.month}</strong>
          <span>{now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </header>
      <div className="presentation-stage">
        <PresentationCard project={currentProject} index={index} total={projects.length} steps={steps} loadingSteps={loadingSteps} users={users} tickerDuration={tickerDuration} cardZoom={cardZoom} />
      </div>
      {showSettings && (
        <div className="pres-settings-panel">
          <strong>Configurações</strong>
          <label>Tempo por projeto (s)
            <input type="number" min={3} max={120} value={slideTime} onChange={(e) => { const v = Math.max(3, Math.min(120, Number(e.target.value))); setSlideTime(v); localStorage.setItem('pres_slide_time', String(v)); }} />
          </label>
          <label>Velocidade do letreiro (s)
            <input type="number" min={5} max={120} value={tickerDuration} onChange={(e) => { const v = Math.max(5, Math.min(120, Number(e.target.value))); setTickerDuration(v); localStorage.setItem('pres_ticker_dur', String(v)); }} />
          </label>
          <button className="secondary-button" onClick={() => setShowSettings(false)}>Fechar</button>
        </div>
      )}
      <footer className="presentation-footer">
        <div className="presentation-controls">
          <button className="presentation-control" onClick={() => setIndex((i) => (i - 1 + projects.length) % projects.length)} aria-label="Anterior"><ChevronLeft size={22} /></button>
          <button className="presentation-control" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Play' : 'Pause'}>{paused ? <Play size={22} /> : <Pause size={22} />}</button>
          <button className="presentation-control" onClick={() => setIndex((i) => (i + 1) % projects.length)} aria-label="Próximo"><ChevronRight size={22} /></button>
        </div>
        <div className="presentation-dots">
          {projects.map((p, i) => (
            <button key={p.id} className={i === index ? 'presentation-dot active' : 'presentation-dot'} onClick={() => setIndex(i)} aria-label={`Projeto ${i + 1}`} />
          ))}
        </div>
        <div className="pres-zoom-controls">
          <button className="presentation-control pres-zoom-btn" onClick={() => { const v = Math.max(0.6, +(cardZoom - 0.05).toFixed(2)); setCardZoom(v); localStorage.setItem('pres_zoom', String(v)); }} title="Reduzir zoom">−</button>
          <span className="pres-zoom-label">{Math.round(cardZoom * 100)}%</span>
          <button className="presentation-control pres-zoom-btn" onClick={() => { const v = Math.min(1.3, +(cardZoom + 0.05).toFixed(2)); setCardZoom(v); localStorage.setItem('pres_zoom', String(v)); }} title="Ampliar zoom">+</button>
        </div>
        <button className="presentation-control" onClick={() => setShowSettings((s) => !s)} title="Configurações"><Settings2 size={18} /></button>
        <button className="presentation-exit" onClick={onExit}><Minimize2 size={16} /> Sair</button>
      </footer>
    </div>
  );
}

const PRESENTATION_DONE: Status[] = ['Concluído', 'Concluído Antes do Prazo'];

const stepRowClass: Record<Status, string> = {
  'Concluído': 'step-row-done',
  'Concluído Antes do Prazo': 'step-row-early',
  'Atrasado': 'step-row-late',
  'Em andamento': 'step-row-progress',
  'Atenção': 'step-row-attention',
  'Não iniciado': '',
};

function PresentationCard({ project, index, total, steps, loadingSteps, users, tickerDuration = 45, cardZoom = 1 }: {
  project: Project;
  index: number;
  total: number;
  steps?: ProjectStep[];
  loadingSteps?: boolean;
  users?: ProjectUser[];
  tickerDuration?: number;
  cardZoom?: number;
}) {
  if (!project) return null;
  const status = statusStyles[project.status];

  const rName = project.responsible_name.toLowerCase();
  const responsibleUser = users?.find((u) =>
    u.name.toLowerCase() === rName ||
    u.name.toLowerCase().startsWith(rName) ||
    rName.startsWith(u.name.split(' ')[0].toLowerCase())
  );
  const responsiblePhoto = responsibleUser?.photo_url ?? project.responsible_photo_url;
  const ownerAvatar = responsiblePhoto
    ? <img src={responsiblePhoto} alt={project.responsible_name} className="avatar avatar-photo" />
    : <div className={`avatar avatar-${project.accent}`}>{getInitials(project.responsible_name)}</div>;

  const nextStep = steps?.find((s) => !PRESENTATION_DONE.includes(s.status));
  const nextActionText = nextStep?.name ?? project.next_action;

  const doneCount = steps?.filter((s) => PRESENTATION_DONE.includes(s.status)).length ?? 0;
  const inProgressCount = steps?.filter((s) => s.status === 'Em andamento').length ?? 0;
  const lateCount = steps?.filter((s) => s.status === 'Atrasado').length ?? 0;
  const totalSteps = steps?.length ?? 0;
  const tickerText = totalSteps > 0
    ? `📊 Progresso: ${project.progress}%  ·  ✅ ${doneCount} concluída${doneCount !== 1 ? 's' : ''}  ·  🔵 ${inProgressCount} em andamento  ·  🔴 ${lateCount} atrasada${lateCount !== 1 ? 's' : ''}  ·  Próximo: ${nextActionText}  ·  Fase: ${project.phase}  ·  Prazo: ${formatProjectDate(project.deadline)}  ·  Responsável: ${project.responsible_name}`
    : `📊 Progresso: ${project.progress}%  ·  Responsável: ${project.responsible_name}  ·  Fase: ${project.phase}  ·  Prazo: ${formatProjectDate(project.deadline)}`;

  return (
    <article className={`presentation-card card-${project.accent}`} style={cardZoom !== 1 ? { transform: `scale(${cardZoom})`, transformOrigin: 'top center' } : undefined}>
      <div className="presentation-card-header">
        <div className="presentation-index"><span>{String(index + 1).padStart(2, '0')}</span> / {String(total).padStart(2, '0')}</div>
        <div className={`status-pill ${status.className}`}><i />{status.label}</div>
      </div>
      <div className="presentation-card-body">
        <div className="presentation-card-left">
          <span className="card-category">{project.category}</span>
          <h2 className="presentation-title">{project.name}</h2>
          {project.summary && <p className="presentation-summary">{project.summary.length > 100 ? project.summary.slice(0, 100) + '…' : project.summary}</p>}
          <div className="presentation-owner">{ownerAvatar}<div><small>Responsável</small><strong>{project.responsible_name}</strong></div></div>
          <div className="presentation-meta">
            {project.start_date && <div><CalendarDays size={15} /><span>Início: <strong>{formatProjectDate(project.start_date)}</strong></span></div>}
            <div><CalendarDays size={15} /><span>Prazo final: <strong>{formatProjectDate(project.deadline)}</strong></span></div>
            {project.tag && <div className="presentation-tag-row"><span className="presentation-tag" style={project.tag_color ? {background: project.tag_color, borderColor: project.tag_color, color: '#fff'} : undefined}>{project.tag}</span></div>}
            <div><Target size={15} /><span>Fase: <strong>{project.phase}</strong></span></div>
          </div>
          <div className="presentation-progress">
            <div className="progress-heading"><span>Progresso geral</span><strong>{project.progress}%</strong></div>
            <div className="progress-track large"><div className={`progress-fill fill-${project.accent}`} style={{ width: `${project.progress}%` }} /></div>
          </div>
          <div className="presentation-next"><span>Próximo passo</span><strong>{nextActionText}</strong><ArrowRight size={16} /></div>
        </div>
        <div className="presentation-card-right">
          <h3>Etapas do projeto</h3>
          {loadingSteps ? (
            <p className="presentation-loading">Carregando etapas…</p>
          ) : steps && steps.length > 0 ? (() => {
            const CHUNK = 7;
            const chunks: ProjectStep[][] = [];
            for (let i = 0; i < steps.length; i += CHUNK) chunks.push(steps.slice(i, i + CHUNK));
            return (
              <div className="presentation-steps-multi">
                {chunks.map((chunk, ci) => (
                  <div key={ci} className="presentation-steps-col">
                    {chunk.map((step, stepIdx) => {
                      const globalIdx = ci * CHUNK + stepIdx;
                      const assigneeName = step.responsible_user?.name ?? step.responsible_name;
                      const assigneePhoto = step.responsible_user?.photo_url ?? null;
                      return (
                        <div key={step.id} className={`presentation-step ${stepRowClass[step.status]}`}>
                          <div className="pres-step-num">{globalIdx + 1}</div>
                          <div className="pres-step-info">
                            <div className="pres-step-name-row"><strong className="pres-step-name">{step.name}</strong></div>
                            <span className="pres-step-status">
                              {statusStyles[step.status].label}
                              {PRESENTATION_DONE.includes(step.status) && step.delivery_date && (
                                <span className="pres-step-delivery"> · {formatDateShort(step.delivery_date)}</span>
                              )}
                            </span>
                            {(step.start_date || step.deadline) && (
                              <span className="pres-step-deadline">
                                <CalendarDays size={10} />
                                {step.start_date && <>{formatDateShort(step.start_date)}{step.deadline && <span style={{margin:'0 4px',opacity:.6}}>→</span>}</>}
                                {step.deadline && formatDateShort(step.deadline)}
                              </span>
                            )}
                            {step.tag && <span className="pres-step-tag">{step.tag}</span>}
                          </div>
                          {assigneeName && (
                            <div className="pres-step-right">
                              <div className="pres-assignee-group">
                                <small className="pres-assignee-label">Responsável</small>
                                {assigneePhoto
                                  ? <img src={assigneePhoto} alt={assigneeName} className="avatar avatar-photo pres-assignee-avatar-lg" />
                                  : <div className="avatar avatar-navy pres-assignee-avatar-lg">{getInitials(assigneeName)}</div>
                                }
                                <span className="pres-assignee-name">{assigneeName.split(' ')[0]}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })() : <div className="presentation-steps-empty"><p>Nenhuma etapa cadastrada.</p></div>}
        </div>
      </div>
      {!loadingSteps && (
        <div className="pres-ticker">
          <span className="pres-ticker-inner" style={{ animationDuration: `${tickerDuration}s` }}>{tickerText}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{tickerText}</span>
        </div>
      )}
    </article>
  );
}

function MetricCard({ label, value, caption, icon, accent, trend }: { label: string; value: string; caption: string; icon: ReactNode; accent: string; trend: string }) {
  return <div className="metric-card"><div className={`metric-icon metric-${accent}`}>{icon}</div><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><span className="metric-caption">{caption}</span><div className={`metric-trend trend-${accent}`}><TrendingUp size={13} /> {trend}</div></div>;
}

function ProjectRow({ project, users }: { project: Project; users?: ProjectUser[] }) {
  return (
    <div className={`project-row ${getStatusRowCls(project.status)}`}>
      <div className={`project-badge tone-${project.accent}`}>{project.code}</div>
      <div className="project-row-main">
        <div className="project-row-title"><strong>{project.name}</strong><StatusPill status={project.status} />{project.tag && <span className="project-tag">{project.tag}</span>}</div>
        <div className="project-progress-line"><div className="progress-track"><div className={`progress-fill fill-${project.accent}`} style={{ width: `${project.progress}%` }} /></div><span>{project.progress}%</span></div>
      </div>
      <OwnerAvatar project={project} users={users} />
      <span className="row-deadline">
        {project.start_date && <><span>{formatProjectDate(project.start_date)}</span><span style={{margin:'0 5px',color:'#c5cdd8'}}>→</span></>}
        <CalendarDays size={14} /> {formatProjectDate(project.deadline)}
      </span>
      <ChevronRight className="row-arrow" size={16} />
    </div>
  );
}

function ProjectCard({ project, onEdit, onDelete, onOpen, users }: { project: Project; onEdit?: () => void; onDelete?: () => void; onOpen: () => void; users?: ProjectUser[] }) {
  return (
    <article className={`project-card card-${project.accent}`} onClick={onOpen} role="button">
      <div className="card-top">
        <div className={`project-badge tone-${project.accent}`}>{project.code}</div>
        {(onEdit || onDelete) && (
          <div className="card-top-actions" onClick={(e) => e.stopPropagation()}>
            {onEdit && <button className="round-button" onClick={onEdit} aria-label="Editar"><Pencil size={15} /></button>}
            {onDelete && <button className="round-button" onClick={onDelete} aria-label="Excluir"><Trash2 size={15} /></button>}
          </div>
        )}
      </div>
      <div className="card-title-row">
        <div><span className="card-category">{project.category}</span>{project.tag && <span className="project-tag">{project.tag}</span>}<h3>{project.name}</h3></div>
        <StatusPill status={project.status} />
      </div>
      <div className="card-progress">
        <div className="progress-heading"><span>Progresso geral</span><strong>{project.progress}%</strong></div>
        <div className="progress-track"><div className={`progress-fill fill-${project.accent}`} style={{ width: `${project.progress}%` }} /></div>
      </div>
      <div className="card-footer">
        <div className="owner"><OwnerAvatar project={project} users={users} /><div><small>Responsável</small><strong>{project.responsible_name}</strong></div></div>
        <div className="deadline">
          {project.start_date && <><small>Início</small><strong><CalendarDays size={13} /> {formatProjectDate(project.start_date)}</strong></>}
          {project.start_date && <span style={{margin:'0 4px',color:'#c5cdd8'}}>→</span>}
          <small>{project.start_date ? 'Prazo final' : 'Prazo final'}</small>
          <strong><Clock3 size={13} /> {formatProjectDate(project.deadline)}</strong>
        </div>
      </div>
      <div className="next-action"><span>Próximo passo</span><strong>{project.next_action}</strong><ArrowUpRight size={15} /></div>
    </article>
  );
}

function ProjectListView({ projects, onEdit, onDelete, onOpen, users }: { projects: Project[]; onEdit?: (p: Project) => void; onDelete?: (id: string) => void; onOpen: (p: Project) => void; users?: ProjectUser[] }) {
  return (
    <div className="project-list-view">
      <table className="project-list-tbl">
        <thead><tr><th>Projeto</th><th>Categoria</th><th>Responsável</th><th>Progresso</th><th>Prazo</th>{(onEdit || onDelete) && <th></th>}</tr></thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id} className={`project-list-row ${getStatusRowCls(p.status)}`} onClick={() => onOpen(p)}>
              <td><div className="project-list-name"><div className={`project-badge tone-${p.accent}`}>{p.code}</div><div><strong>{p.name}</strong><StatusPill status={p.status} /></div></div></td>
              <td className="list-cat">{p.category}</td>
              <td><div className="list-owner"><OwnerAvatar project={p} users={users} /><span>{p.responsible_name.split(' ')[0]}</span></div></td>
              <td><div className="list-progress"><div className="progress-track"><div className={`progress-fill fill-${p.accent}`} style={{ width: `${p.progress}%` }} /></div><span>{p.progress}%</span></div></td>
              <td className="list-deadline">{p.start_date && <span style={{marginRight:5}}>{formatProjectDate(p.start_date)} →</span>}<CalendarDays size={13} />{formatProjectDate(p.deadline)}</td>
              {(onEdit || onDelete) && (
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="step-tbl-actions">
                    {onEdit && <button className="round-button" onClick={() => onEdit(p)}><Pencil size={14} /></button>}
                    {onDelete && <button className="round-button" onClick={() => onDelete(p.id)}><Trash2 size={14} /></button>}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProjectCalendarView({ projects, onOpen }: { projects: Project[]; onOpen: (p: Project) => void }) {
  const [calDate, setCalDate] = useState(new Date());
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = (firstDay.getDay() + 6) % 7;

  const projectsByDay: Record<number, Project[]> = {};
  projects.forEach((p) => {
    if (!p.deadline) return;
    const raw = p.deadline.includes('T') ? p.deadline.split('T')[0] : p.deadline;
    const d = new Date(`${raw}T12:00:00`);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      projectsByDay[day] = projectsByDay[day] ? [...projectsByDay[day], p] : [p];
    }
  });

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  return (
    <div className="calendar-view">
      <div className="calendar-nav">
        <button onClick={() => setCalDate(new Date(year, month - 1, 1))}><ChevronLeft size={18} /></button>
        <strong>{firstDay.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</strong>
        <button onClick={() => setCalDate(new Date(year, month + 1, 1))}><ChevronRight size={18} /></button>
      </div>
      <div className="calendar-grid">
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => <div key={d} className="cal-weekday">{d}</div>)}
        {Array.from({ length: startWeekday }).map((_, i) => <div key={`e${i}`} className="cal-day empty" />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const isToday = isCurrentMonth && today.getDate() === day;
          const dayProjects = projectsByDay[day] || [];
          return (
            <div key={day} className={`cal-day${isToday ? ' today' : ''}`}>
              <span className="cal-day-num">{day}</span>
              {dayProjects.map((p) => (
                <button key={p.id} className={`cal-project-chip tone-${p.accent} ${getStatusRowCls(p.status)}`} onClick={() => onOpen(p)} title={p.name}>
                  <span className={`step-status-dot ${statusStyles[p.status].dotClass}`} />
                  {p.name.length > 14 ? `${p.name.slice(0, 14)}…` : p.name}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  return <span className={`status-pill ${statusStyles[status].className}`}><i />{statusStyles[status].label}</span>;
}

function OwnerAvatar({ project, users }: { project: Project; users?: ProjectUser[] }) {
  const photoUrl = project.responsible_photo_url ?? users?.find((u) => u.name === project.responsible_name)?.photo_url ?? null;
  return photoUrl
    ? <img src={photoUrl} alt={project.responsible_name} className="avatar avatar-photo" />
    : <div className={`avatar avatar-${project.accent}`}>{getInitials(project.responsible_name)}</div>;
}

function TimelineItem({ day, month, title, owner, color }: { day: string; month: string; title: string; owner: string; color: string }) {
  return (
    <div className="timeline-item">
      <div className={`timeline-date date-${color}`}><strong>{day}</strong><span>{month}</span></div>
      <div className="timeline-detail"><strong>{title}</strong><span>{owner}</span></div>
      <ChevronRight size={16} />
    </div>
  );
}
