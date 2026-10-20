import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FolderKanban,
  FolderOpen,
  ListTodo,
  MessageCircle,
  Newspaper,
  RefreshCw,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import { getDashboardData } from '../lib/appApi';
import { apiGet } from '../lib/apiClient';
import { useAuth } from '../lib/auth';
import { fetchPersonalProjects } from '../lib/personalProjects';
import { buildWorkBriefing, dayKey, isFinished, isTaskMine, type PersonalProject } from '../../shared/personalWork.mjs';
import { DailyBriefing } from '../components/DailyBriefing';
import './dashboard.css';

interface Stats {
  users: number;
  trainings: number;
  articles: number;
  posts: number;
}

interface RecentPost {
  id: string;
  title: string | null;
  content: string;
  type: string;
  created_at: string;
  users?: { name: string; photo_url?: string; position?: string };
}

interface DashboardTask {
  id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'done' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  deadline?: string | null;
  protocol?: string | null;
  owner_id?: string;
  created_by?: string;
  owner?: { id: string };
  assignees?: Array<{ id: string; name: string; photo_url?: string }>;
}

type TaskLaneId = 'overdue' | 'today' | 'week' | 'later';

const modules = [
  { label: 'Tarefas', description: 'Prioridades e entregas', icon: ListTodo, to: '/tarefas', tone: 'blue' },
  { label: 'Projetos', description: 'Planos em andamento', icon: FolderKanban, to: '/projetos', tone: 'violet' },
  { label: 'Chat', description: 'Conversas da equipe', icon: MessageCircle, to: '/bate-papo', tone: 'cyan' },
  { label: 'Feed', description: 'Comunicados internos', icon: Newspaper, to: '/feed', tone: 'orange' },
  { label: 'Calendário', description: 'Agenda compartilhada', icon: CalendarDays, to: '/calendario', tone: 'emerald' },
  { label: 'Drive', description: 'Arquivos e documentos', icon: FolderOpen, to: '/drive', tone: 'amber' },
];

const laneMeta: Record<TaskLaneId, { label: string; hint: string; tone: string }> = {
  overdue: { label: 'Vencidas', hint: 'Precisam de atenção', tone: 'red' },
  today: { label: 'Hoje', hint: 'Prazo até o fim do dia', tone: 'orange' },
  week: { label: 'Esta semana', hint: 'Próximos 7 dias', tone: 'blue' },
  later: { label: 'Sem prazo', hint: 'Ainda não planejadas', tone: 'slate' },
};

const projectLanes = [
  { id: 'attention', label: 'Precisam de atenção', hint: 'Prazos vencidos ou riscos sinalizados', tone: 'red' },
  { id: 'active', label: 'Em andamento', hint: 'Projetos em que você está envolvido', tone: 'blue' },
  { id: 'waiting', label: 'Não iniciados', hint: 'Organize os próximos passos', tone: 'slate' },
  { id: 'done', label: 'Concluídos', hint: 'Entregas finalizadas pela equipe', tone: 'green' },
] as const;

function projectLane(project: PersonalProject) {
  if (isFinished(project.status)) return 'done';
  if (project.overdue_count || ['Atrasado', 'Atenção'].includes(project.status)
    || (project.deadline && project.deadline.slice(0, 10) < dayKey()!)) return 'attention';
  return project.status === 'Não iniciado' ? 'waiting' : 'active';
}

function startOfToday() {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
}

function taskLane(task: DashboardTask): TaskLaneId | 'done' | 'future' {
  if (isFinished(task.status)) return 'done';
  if (!task.deadline) return 'later';
  const today = startOfToday();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 8);
  const deadline = new Date(`${dayKey(task.deadline)}T12:00:00`);
  if (deadline < today) return 'overdue';
  if (deadline < tomorrow) return 'today';
  if (deadline < nextWeek) return 'week';
  return 'future';
}

function formatDate(value?: string | null, includeYear = false) {
  if (!value) return 'Sem prazo';
  return new Date(value.includes('T') ? value : `${value}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    ...(includeYear ? { year: 'numeric' } : {}),
  });
}

function timeAgo(dateStr: string) {
  const diff = Math.max(0, Date.now() - new Date(dateStr).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function initials(name?: string) {
  return (name || 'Rede Nex')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();
}

function TaskAvatar({ name, photo }: { name: string; photo?: string }) {
  return photo
    ? <img src={photo} alt={name} className="dashboard-avatar" />
    : <span className="dashboard-avatar dashboard-avatar-fallback" title={name}>{initials(name)}</span>;
}

function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton" aria-label="Carregando central de trabalho" role="status">
      <div className="dashboard-skeleton-hero" />
      <div className="dashboard-skeleton-row">{Array.from({ length: 4 }).map((_, index) => <span key={index} />)}</div>
      <div className="dashboard-skeleton-grid"><span /><span /></div>
    </div>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ users: 0, trainings: 0, articles: 0, posts: 0 });
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [projects, setProjects] = useState<PersonalProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const firstName = user?.name?.split(' ')[0] || 'Colaborador';

  const loadData = useCallback(async (background = false) => {
    if (!user) return;
    if (background) setRefreshing(true);
    else setLoading(true);
    setLoadError('');

    const [dashboardResult, taskResult, projectResult] = await Promise.allSettled([
      getDashboardData(),
      apiGet<{ data: DashboardTask[] }>('/tasks'),
      fetchPersonalProjects(user),
    ]);

    if (dashboardResult.status === 'fulfilled') {
      setStats(dashboardResult.value.stats);
      setRecentPosts(dashboardResult.value.recentPosts as unknown as RecentPost[]);
    }
    if (taskResult.status === 'fulfilled') setTasks((taskResult.value.data ?? []).filter(task => isTaskMine(task, user.id)));
    if (projectResult.status === 'fulfilled') {
      setProjects(projectResult.value.projects);
      if (projectResult.value.incomplete) setLoadError('Algumas etapas não puderam ser consultadas; sua participação e pendências podem estar incompletas.');
    }

    const failed = [dashboardResult, taskResult, projectResult].filter(result => result.status === 'rejected').length;
    if (failed === 3) setLoadError('Não foi possível atualizar a central de trabalho.');
    else if (failed > 0) setLoadError('Alguns indicadores não puderam ser atualizados.');
    setLastUpdated(new Date());
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => {
    void loadData();
    const refresh = () => { if (!document.hidden) void loadData(true); };
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(interval); window.removeEventListener('focus', refresh); };
  }, [loadData]);

  const briefing = useMemo(() => buildWorkBriefing(tasks, projects, user?.id), [tasks, projects, user?.id]);

  const taskLanes = useMemo(() => {
    const lanes: Record<TaskLaneId, DashboardTask[]> = { overdue: [], today: [], week: [], later: [] };
    tasks.forEach(task => {
      const lane = taskLane(task);
      if (lane in lanes) lanes[lane as TaskLaneId].push(task);
    });
    Object.values(lanes).forEach(items => items.sort((a, b) => {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    }));
    return lanes;
  }, [tasks]);

  const activeTasks = tasks.filter(task => !isFinished(task.status)).length;
  const completedTasks = tasks.filter(task => task.status === 'done').length;
  const activeProjects = projects.filter(project => !project.status.toLocaleLowerCase('pt-BR').includes('conclu')).length;
  const projectPulse = projects;
  const todayLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date());

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="work-hub page-enter">
      <header className="work-hub-hero">
        <div className="work-hub-hero-copy">
          <span className="work-hub-kicker"><Sparkles size={14} /> Central de trabalho</span>
          <h1>{getGreeting()}, <strong>{firstName}</strong></h1>
          <p>Suas prioridades, projetos e conversas reunidos em um só lugar.</p>
          <div className="work-hub-date"><CalendarDays size={15} /><span>{todayLabel}</span></div>
        </div>
        <div className="work-hub-hero-actions">
          <button type="button" onClick={() => void loadData(true)} disabled={refreshing} className="work-hub-refresh">
            <RefreshCw size={16} className={refreshing ? 'is-spinning' : ''} />
            {refreshing ? 'Atualizando' : 'Atualizar'}
          </button>
          <Link to="/tarefas" className="work-hub-primary-action"><ListTodo size={17} /> Abrir tarefas</Link>
          <span className="work-hub-online"><i /> Operação online</span>
        </div>
      </header>

      {loadError && <div className="work-hub-warning" role="status">{loadError} Os demais dados continuam disponíveis.</div>}

      {user && <DailyBriefing key={user.id} userId={user.id} briefing={briefing} />}

      <section className="work-hub-modules" aria-label="Módulos principais">
        {modules.map(item => (
          <Link key={item.to} to={item.to} className={`work-hub-module is-${item.tone}`}>
            <span className="work-hub-module-icon"><item.icon size={19} /></span>
            <span><strong>{item.label}</strong><small>{item.description}</small></span>
            <ArrowRight size={15} className="work-hub-module-arrow" />
          </Link>
        ))}
      </section>

      <section className="work-hub-metrics" aria-label="Resumo da operação">
        <Link to="/tarefas" className="work-hub-metric">
          <span className="work-hub-metric-icon is-blue"><ListTodo size={18} /></span>
          <span><small>Minhas tarefas ativas</small><strong>{activeTasks}</strong></span>
          <em>{completedTasks} concluídas</em>
        </Link>
        <Link to="/projetos" className="work-hub-metric">
          <span className="work-hub-metric-icon is-violet"><FolderKanban size={18} /></span>
          <span><small>Meus projetos ativos</small><strong>{activeProjects}</strong></span>
          <em>{projects.length} no total</em>
        </Link>
        <Link to="/colaboradores" className="work-hub-metric">
          <span className="work-hub-metric-icon is-emerald"><Users size={18} /></span>
          <span><small>Colaboradores</small><strong>{stats.users}</strong></span>
          <em>na rede</em>
        </Link>
        <Link to="/wiki" className="work-hub-metric">
          <span className="work-hub-metric-icon is-orange"><BookOpen size={18} /></span>
          <span><small>Base de conhecimento</small><strong>{stats.articles}</strong></span>
          <em>artigos publicados</em>
        </Link>
      </section>

      <div className="work-hub-grid">
        <section className="work-hub-panel work-hub-tasks">
          <div className="work-hub-panel-heading">
            <div>
              <span className="work-hub-section-kicker">Meu trabalho</span>
              <h2>Prazos e prioridades</h2>
            </div>
            <Link to="/tarefas">Ver todas <ArrowRight size={14} /></Link>
          </div>
          <div className="work-hub-task-lanes">
            {(Object.keys(laneMeta) as TaskLaneId[]).map(laneId => {
              const lane = laneMeta[laneId];
              const laneTasks = taskLanes[laneId];
              return (
                <article key={laneId} className={`work-hub-task-lane is-${lane.tone}`}>
                  <header>
                    <span><i />{lane.label}</span>
                    <strong>{laneTasks.length}</strong>
                  </header>
                  <p>{lane.hint}</p>
                  <div className="work-hub-task-list">
                    {laneTasks.slice(0, 3).map(task => (
                      <Link key={task.id} to={`/tarefas?tarefa=${encodeURIComponent(task.id)}`} className="work-hub-task-card">
                        <span className={`work-hub-priority is-${task.priority}`} />
                        <strong>{task.title}</strong>
                        <div>
                          <span><Clock3 size={12} />{formatDate(task.deadline)}</span>
                          <span className="work-hub-avatars">
                            {(task.assignees || []).slice(0, 3).map(assignee => <TaskAvatar key={assignee.id} name={assignee.name} photo={assignee.photo_url} />)}
                          </span>
                        </div>
                      </Link>
                    ))}
                    {!laneTasks.length && <div className="work-hub-empty-lane"><CheckCircle2 size={18} /><span>Nada por aqui</span></div>}
                    {laneTasks.length > 3 && <Link to="/tarefas" className="work-hub-lane-more">+ {laneTasks.length - 3} tarefas</Link>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

          <section className="work-hub-panel work-hub-projects" aria-labelledby="my-projects-title">
            <div className="work-hub-panel-heading">
              <div><span className="work-hub-section-kicker">Responsável ou participante</span><h2 id="my-projects-title">Meus projetos</h2></div>
              <Link to="/projetos">Ver todos <ArrowRight size={14} /></Link>
            </div>
            <div className="work-hub-task-lanes work-hub-project-board" aria-label="Meus projetos agrupados por situação">
              {projectLanes.map(lane => {
                const items = projectPulse.filter(project => projectLane(project) === lane.id);
                return <article key={lane.id} className={`work-hub-task-lane is-${lane.tone}`}>
                  <header><span><i />{lane.label}</span><strong>{items.length}</strong></header>
                  <p>{lane.hint}</p>
                  <div className="work-hub-task-list">
                    {items.map(project => <Link key={project.id} to={`/projetos?projeto=${encodeURIComponent(project.id)}`} className="work-hub-task-card work-hub-project-card">
                      <strong>{project.name}</strong>
                      <span className="work-hub-project-role">{project.involvement === 'responsible' ? 'Responsável' : 'Participante'}</span>
                      <div className="work-hub-project-card-progress"><span>{project.phase || project.status}</span><strong>{project.progress}%</strong></div>
                      <div className="work-hub-progress"><span style={{ width: `${Math.min(100, Math.max(0, project.progress))}%` }} /></div>
                      <p className={project.overdue_count ? 'has-overdue' : ''}>{project.pending_count === null ? 'Pendências indisponíveis' : `${project.pending_count} etapa(s) pendente(s)`}{project.overdue_count ? ` • ${project.overdue_count} vencida(s)` : ''}</p>
                      <div><span><Clock3 size={12} />{formatDate(project.deadline?.slice(0, 10), true)}</span><TaskAvatar name={project.responsible_name} photo={project.responsible_photo_url || undefined} /></div>
                    </Link>)}
                    {!items.length && <div className="work-hub-empty-lane"><CheckCircle2 size={18} /><span>Nenhum projeto nesta situação</span></div>}
                  </div>
                </article>;
              })}
            </div>
          </section>

        <section className="work-hub-panel work-hub-activity">
          <div className="work-hub-panel-heading">
            <div><span className="work-hub-section-kicker">Colaboração</span><h2>Atividade recente</h2></div>
            <Link to="/feed">Abrir feed <ArrowRight size={14} /></Link>
          </div>
          <div className="work-hub-activity-list">
            {recentPosts.slice(0, 5).map(post => (
              <Link to="/feed" key={post.id} className="work-hub-activity-item">
                {post.users?.photo_url
                  ? <img src={post.users.photo_url} alt={post.users.name} />
                  : <span className="work-hub-activity-avatar">{initials(post.users?.name)}</span>}
                <span className="work-hub-activity-copy">
                  <strong>{post.users?.name || 'Rede Nex'}</strong>
                  <span>{post.title || post.content}</span>
                </span>
                <time>{timeAgo(post.created_at)}</time>
              </Link>
            ))}
            {!recentPosts.length && <div className="work-hub-empty"><Newspaper size={24} /><p>As novas publicações aparecerão aqui.</p></div>}
          </div>
        </section>

        <aside className="work-hub-panel work-hub-discover">
          <div className="work-hub-discover-icon"><Search size={22} /></div>
          <span className="work-hub-section-kicker">Encontre rápido</span>
          <h2>Todos os recursos, sem se perder</h2>
          <p>Use a busca do topo ou pressione <kbd>Ctrl</kbd> + <kbd>K</kbd> para abrir qualquer módulo.</p>
          <Link to="/ajuda">Conhecer a central <ArrowRight size={14} /></Link>
        </aside>
      </div>

      <footer className="work-hub-footer">
        <span><Activity size={14} /> Dados da operação REDE NEX</span>
        {lastUpdated && <span>Atualizado às {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
      </footer>
    </div>
  );
}
