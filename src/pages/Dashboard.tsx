import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight, GraduationCap, Newspaper, Users } from 'lucide-react';
import { getDashboardData } from '../lib/appApi';
import { Card } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';

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
  { label: 'Colaboradores', key: 'users' as const, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', to: '/colaboradores' },
  { label: 'Treinamentos', key: 'trainings' as const, icon: GraduationCap, color: 'text-orange-600', bg: 'bg-orange-50', to: '/treinamentos' },
  { label: 'Artigos Wiki', key: 'articles' as const, icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50', to: '/wiki' },
  { label: 'Postagens', key: 'posts' as const, icon: Newspaper, color: 'text-violet-600', bg: 'bg-violet-50', to: '/feed' },
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

export function Dashboard() {
  const [stats, setStats] = useState<Stats>({ users: 0, trainings: 0, articles: 0, posts: 0 });
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);
  const [loading, setLoading] = useState(true);

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
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => (
          <Link to={card.to} key={card.key}>
            <Card className="p-4 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer border-slate-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">{card.label}</p>
                  {loading ? (
                    <Skeleton className="h-8 w-16 mt-2" />
                  ) : (
                    <p className="text-3xl font-bold text-slate-800 mt-1">{stats[card.key]}</p>
                  )}
                  <p className="text-xs text-slate-500 mt-1">Atualizado em tempo real</p>
                </div>
                <div className={`p-2.5 rounded-xl ${card.bg}`}>
                  <card.icon size={20} className={card.color} />
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6">
        <Card className="border-slate-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Newspaper size={16} className="text-orange-500" />
              <h2 className="text-sm font-semibold text-slate-800">Últimas Postagens</h2>
            </div>
            <Link to="/feed" className="text-xs text-orange-600 hover:text-orange-700 flex items-center gap-1 font-medium">
              Ver feed <ChevronRight size={13} />
            </Link>
          </div>

          <div className="divide-y divide-slate-50">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-start gap-3 px-5 py-4">
                  <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))
            ) : recentPosts.length ? (
              recentPosts.map(post => (
                <div key={post.id} className="flex items-start gap-3 px-5 py-4 hover:bg-slate-50/70 transition-colors">
                  <img
                    src={post.users?.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.users?.name || 'Rede Nex')}&size=40&background=ff7a00&color=fff`}
                    alt={post.users?.name || 'Rede Nex'}
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-1 ring-slate-200"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{post.users?.name || 'Rede Nex'}</p>
                    <p className="text-xs text-slate-600 mt-0.5 line-clamp-1">{post.title || post.content}</p>
                    <p className="text-[11px] text-slate-500 mt-1">{timeAgo(post.created_at)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-10 text-center">
                <Newspaper size={36} className="mx-auto text-slate-300 mb-3" />
                <p className="font-semibold text-slate-600">Nenhuma postagem cadastrada</p>
                <p className="text-sm text-slate-500 mt-1">As publicações reais do Feed aparecerão aqui.</p>
              </div>
            )}
          </div>
        </Card>

        <Card className="border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800">Acesso Rápido</h2>
          </div>
          <div className="px-5 py-4 space-y-2">
            {statCards.map(item => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-orange-50 group transition-colors"
              >
                <div className="p-1.5 rounded-md bg-orange-50 group-hover:bg-orange-100 transition-colors">
                  <item.icon size={13} className="text-orange-500" />
                </div>
                <span className="text-sm text-slate-700 group-hover:text-orange-700 font-medium">{item.label}</span>
                <ChevronRight size={13} className="ml-auto text-slate-300 group-hover:text-orange-400" />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
