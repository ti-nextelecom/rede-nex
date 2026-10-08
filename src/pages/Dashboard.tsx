import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, BookOpen, ChevronRight, GraduationCap, MessageCircle, Newspaper, Sparkles, TrendingUp, Users, Zap } from 'lucide-react';
import { getDashboardData } from '../lib/appApi';
import { useAuth } from '../lib/auth';

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

const statCards = [
  { label: 'Colaboradores', key: 'users' as const, icon: Users, accent: '#3b82f6', bg: 'rgba(59,130,246,0.08)', to: '/colaboradores' },
  { label: 'Treinamentos', key: 'trainings' as const, icon: GraduationCap, accent: '#e65b12', bg: 'rgba(230,91,18,0.08)', to: '/treinamentos' },
  { label: 'Artigos Wiki', key: 'articles' as const, icon: BookOpen, accent: '#10b981', bg: 'rgba(16,185,129,0.08)', to: '/wiki' },
  { label: 'Postagens', key: 'posts' as const, icon: Newspaper, accent: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', to: '/feed' },
];

const quickLinks = [
  { label: 'Feed', icon: Newspaper, to: '/feed', color: '#e65b12' },
  { label: 'Chat', icon: MessageCircle, to: '/bate-papo', color: '#3b82f6' },
  { label: 'Wiki', icon: BookOpen, to: '/wiki', color: '#10b981' },
  { label: 'Treinamentos', icon: GraduationCap, to: '/treinamentos', color: '#8b5cf6' },
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}m atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  return `${Math.floor(hours / 24)}d atrás`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function StatSkeleton() {
  return (
    <div className="rounded-2xl p-5 animate-pulse" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <div className="h-3 w-20 rounded" style={{ background: 'hsl(var(--muted))' }} />
          <div className="h-9 w-14 rounded" style={{ background: 'hsl(var(--muted))' }} />
          <div className="h-3 w-24 rounded" style={{ background: 'hsl(var(--muted))' }} />
        </div>
        <div className="h-12 w-12 rounded-xl" style={{ background: 'hsl(var(--muted))' }} />
      </div>
    </div>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ users: 0, trainings: 0, articles: 0, posts: 0 });
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const firstName = user?.name?.split(' ')[0] || 'Usuário';

  useEffect(() => {
    async function loadData() {
      try {
        const result = await getDashboardData();
        setStats(result.stats);
        setRecentPosts(result.recentPosts as unknown as RecentPost[]);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="space-y-6 page-enter">
      {/* Hero Welcome */}
      <div className="relative overflow-hidden rounded-2xl p-6 md:p-8"
        style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} className="text-primary" />
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'hsl(var(--muted-foreground))' }}>Painel de Controle</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold" style={{ color: 'hsl(var(--foreground))' }}>
              {getGreeting()}, <span className="text-primary">{firstName}</span>
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Acompanhe tudo o que acontece na sua rede corporativa
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
            style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
            <Activity size={14} className="text-emerald-500" />
            <span className="text-xs font-semibold text-emerald-500">Sistema Online</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          statCards.map((card) => (
            <Link to={card.to} key={card.key}>
              <div className="group rounded-2xl p-5 transition-all duration-200 hover:-translate-y-1 cursor-pointer"
                style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>{card.label}</p>
                    <p className="text-3xl font-bold mt-2 tabular-nums" style={{ color: 'hsl(var(--foreground))' }}>{stats[card.key]}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <TrendingUp size={11} style={{ color: card.accent }} />
                      <span className="text-[11px] font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}>Atualizado</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl transition-all duration-200 group-hover:scale-110" style={{ background: card.bg }}>
                    <card.icon size={22} style={{ color: card.accent }} />
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6">
        {/* Recent Posts */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ background: 'rgba(230, 91, 18, 0.08)' }}>
                <Zap size={16} className="text-primary" />
              </div>
              <h2 className="text-sm font-semibold" style={{ color: 'hsl(var(--foreground))' }}>Atividade Recente</h2>
            </div>
            <Link to="/feed" className="text-xs font-medium text-primary flex items-center gap-1 hover:opacity-80">
              Ver feed <ChevronRight size={13} />
            </Link>
          </div>
          <div>
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-start gap-3 px-5 py-4 animate-pulse" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                  <div className="w-9 h-9 rounded-full flex-shrink-0" style={{ background: 'hsl(var(--muted))' }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-3/4 rounded" style={{ background: 'hsl(var(--muted))' }} />
                    <div className="h-3 w-full rounded" style={{ background: 'hsl(var(--muted))' }} />
                  </div>
                </div>
              ))
            ) : recentPosts.length ? (
              recentPosts.map(post => (
                <div key={post.id} className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-muted/30 cursor-pointer"
                  style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                  <img
                    src={post.users?.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.users?.name || 'Rede Nex')}&size=40&background=e65b12&color=fff`}
                    alt={post.users?.name || 'Rede Nex'}
                    className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'hsl(var(--foreground))' }}>{post.users?.name || 'Rede Nex'}</p>
                    <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'hsl(var(--muted-foreground))' }}>{post.title || post.content}</p>
                    <p className="text-[11px] mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>{timeAgo(post.created_at)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-12 text-center">
                <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(230, 91, 18, 0.08)' }}>
                  <Newspaper size={24} className="text-primary opacity-50" />
                </div>
                <p className="font-semibold" style={{ color: 'hsl(var(--foreground))' }}>Nenhuma postagem</p>
                <p className="text-sm mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>As publicações do Feed aparecerão aqui.</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Access */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ background: 'rgba(59, 130, 246, 0.08)' }}>
                <Zap size={16} className="text-blue-500" />
              </div>
              <h2 className="text-sm font-semibold" style={{ color: 'hsl(var(--foreground))' }}>Acesso Rápido</h2>
            </div>
          </div>
          <div className="p-4 space-y-1">
            {quickLinks.map(item => (
              <Link key={item.to} to={item.to}
                className="flex items-center gap-3 px-3 py-3 rounded-xl group transition-all duration-200 hover:bg-muted/40">
                <div className="p-2 rounded-lg transition-all duration-200 group-hover:scale-110" style={{ background: `${item.color}12` }}>
                  <item.icon size={16} style={{ color: item.color }} />
                </div>
                <span className="text-sm font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}>{item.label}</span>
                <ChevronRight size={13} className="ml-auto" style={{ color: 'hsl(var(--border))' }} />
              </Link>
            ))}
          </div>

          {/* Mini pulse */}
          <div className="px-5 py-4" style={{ borderTop: '1px solid hsl(var(--border))' }}>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-60" />
              </div>
              <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>{stats.users} colaboradores na rede</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
