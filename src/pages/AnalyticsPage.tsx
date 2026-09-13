import { useEffect, useState } from 'react';
import {
  BarChart3, BookOpen, Calendar, ClipboardList, FileSignature,
  GraduationCap, HardDrive, LayoutGrid, Newspaper, TrendingDown,
  TrendingUp, Users,
} from 'lucide-react';
import { apiGet } from '../lib/apiClient';

type Period = 'week' | 'month' | 'quarter' | 'year';

const PERIODS: { value: Period; label: string; desc: string }[] = [
  { value: 'week',    label: '7 dias',    desc: 'Últimos 7 dias' },
  { value: 'month',   label: '30 dias',   desc: 'Últimos 30 dias' },
  { value: 'quarter', label: 'Trimestre', desc: 'Último trimestre' },
  { value: 'year',    label: 'Ano',       desc: 'Último ano' },
];

interface Stats { users: number; trainings: number; articles: number; posts: number; }
interface TopUser { id: string; name: string; photo_url?: string; total_xp: number; rank_slug: string; rank?: { name: string; emoji: string; color: string }; rank_position?: number; }
interface Trend { current: number; previous: number; delta: number; pct: number; }
interface ActivityDay { day: string; posts: number; }

interface ModuleStats {
  calendar: { total_events: number; events_this_month: number };
  drive: { files: number; folders: number; total_size: number };
  forms: { total: number; responses: number };
  sign: { documents: number; pending: number; signed: number; rejected: number };
  whiteboard: { total: number };
}

interface AnalyticsData {
  period: Period;
  stats: Stats;
  trends: { users: Trend; posts: Trend; articles: Trend; active_users: number };
  activity_by_day: ActivityDay[];
  post_types: { type: string; count: number }[];
  modules: ModuleStats;
  top_users: TopUser[];
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}

function TrendBadge({ pct, delta, period }: { pct: number; delta: number; period: Period }) {
  const label = { week: '7d', month: '30d', quarter: '90d', year: '1 ano' }[period];
  if (delta === 0) return <span className="text-[10px] text-slate-400 font-medium">sem variação ({label})</span>;
  const up = delta > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${up ? 'text-emerald-600' : 'text-red-500'}`}>
      <Icon size={10} />
      {up ? '+' : ''}{delta} ({up ? '+' : ''}{pct}%) vs {label} anterior
    </span>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
      <div className="w-full flex items-end h-14 bg-slate-50 rounded overflow-hidden">
        <div className="w-full rounded-t transition-all duration-500" style={{ height: `${Math.max(pct, 3)}%`, backgroundColor: color }} />
      </div>
      <span className="text-[8px] text-slate-400 truncate w-full text-center">{value}</span>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, bg, trend, period = 'week' }: {
  label: string; value: number; icon: React.ElementType; color: string; bg: string; trend?: Trend; period?: Period;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4">
      <div className="flex items-start justify-between mb-2">
        <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider leading-tight">{label}</p>
        <div className={`p-1.5 sm:p-2 rounded-lg ${bg} flex-shrink-0`}>
          <Icon size={14} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-slate-800 mb-1">{value.toLocaleString('pt-BR')}</p>
      {trend && <TrendBadge pct={trend.pct} delta={trend.delta} period={period} />}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <div className="text-right">
        <span className="text-sm font-bold text-slate-800">{value}</span>
        {sub && <span className="text-[10px] text-slate-400 ml-1">{sub}</span>}
      </div>
    </div>
  );
}

function XpBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-100 rounded-full h-2">
        <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

const POST_TYPE_LABELS: Record<string, string> = {
  message: 'Publicação', announcement: 'Comunicado', alert: 'Aviso',
  update: 'Atualização', event: 'Evento', poll: 'Enquete',
};
const POST_TYPE_COLORS: Record<string, string> = {
  message: '#8b5cf6', announcement: '#f97316', alert: '#ef4444',
  update: '#10b981', event: '#3b82f6', poll: '#ec4899',
};

export function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('week');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [analyticsResult, rankingResult] = await Promise.all([
          apiGet<{ data: Omit<AnalyticsData, 'top_users'> }>(`/analytics?period=${period}`).catch(() => null),
          apiGet<{ data: { ranking: TopUser[] } }>('/gamification/ranking').catch(() => null),
        ]);
        if (!analyticsResult) { setError('Não foi possível carregar os dados.'); return; }
        setData({
          ...analyticsResult.data,
          top_users: rankingResult?.data?.ranking?.slice(0, 8) ?? [],
        });
      } catch { setError('Erro ao carregar analytics.'); }
      finally { setLoading(false); }
    };
    load();
  }, [period]);

  const periodDesc = PERIODS.find(p => p.value === period)?.desc ?? '';

  return (
    <div className="space-y-5">
      {/* Header + Period selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 size={20} className="text-orange-500" />
          <h1 className="text-lg font-bold text-slate-800">Analytics & BI</h1>
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                period === p.value
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <BarChart3 size={32} className="mx-auto text-orange-300 mb-3 animate-pulse" />
          <p className="text-slate-400 text-sm">Carregando dados de {periodDesc.toLowerCase()}…</p>
        </div>
      ) : error || !data ? (
        <div className="py-20 text-center">
          <BarChart3 size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">{error || 'Sem dados'}</p>
          <button onClick={() => setPeriod(period)} className="mt-3 text-orange-600 text-sm font-medium hover:underline">
            Tentar novamente
          </button>
        </div>
      ) : <Content data={data} period={period} periodDesc={periodDesc} />}
    </div>
  );
}

function Content({ data, period, periodDesc }: { data: AnalyticsData; period: Period; periodDesc: string }) {
  const { stats: s, trends: t, modules: m, activity_by_day, post_types, top_users } = data;
  const maxXP = top_users[0]?.total_xp || 1;
  const maxActivity = Math.max(...activity_by_day.map(d => d.posts), 1);
  const signTotal = (m.sign.signed + m.sign.pending + m.sign.rejected);
  const signRate = signTotal > 0 ? Math.round((m.sign.signed / signTotal) * 100) : 0;
  const postTotal = post_types.reduce((a, b) => a + b.count, 0);

  return (
    <>
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Colaboradores" value={s.users} icon={Users} color="#3b82f6" bg="bg-blue-50" trend={t.users} period={period} />
        <StatCard label="Postagens" value={s.posts} icon={Newspaper} color="#8b5cf6" bg="bg-violet-50" trend={t.posts} period={period} />
        <StatCard label="Artigos Wiki" value={s.articles} icon={BookOpen} color="#10b981" bg="bg-emerald-50" trend={t.articles} period={period} />
        <StatCard label="Treinamentos" value={s.trainings} icon={GraduationCap} color="#f97316" bg="bg-orange-50" />
      </div>

      {/* Engagement strip */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-4 text-white flex flex-wrap gap-4 sm:gap-8 items-center">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-200">Usuários ativos</p>
          <p className="text-2xl font-bold">{t.active_users}</p>
          <p className="text-[10px] text-blue-200">{periodDesc.toLowerCase()}</p>
        </div>
        <div className="w-px h-10 bg-blue-500 hidden sm:block" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-200">Novos usuários</p>
          <p className="text-2xl font-bold">{t.users.current}</p>
          <p className="text-[10px] text-blue-200">{periodDesc.toLowerCase()}</p>
        </div>
        <div className="w-px h-10 bg-blue-500 hidden sm:block" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-200">Publicações</p>
          <p className="text-2xl font-bold">{t.posts.current}</p>
          <p className="text-[10px] text-blue-200">{periodDesc.toLowerCase()}</p>
        </div>
        {signTotal > 0 && (
          <>
            <div className="w-px h-10 bg-blue-500 hidden sm:block" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-200">Taxa de assinatura</p>
              <p className="text-2xl font-bold">{signRate}%</p>
              <p className="text-[10px] text-blue-200">documentos concluídos</p>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráfico de atividade */}
        <div className="bg-white border border-slate-200 rounded-xl lg:col-span-2">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
            <BarChart3 size={15} className="text-orange-500" />
            <h2 className="text-sm font-semibold text-slate-800">Publicações — {periodDesc}</h2>
          </div>
          <div className="px-4 py-4">
            {activity_by_day.every(d => d.posts === 0) ? (
              <p className="text-sm text-slate-400 text-center py-6">Nenhuma publicação neste período</p>
            ) : (
              <div className="flex items-end gap-1 h-20">
                {activity_by_day.map(day => (
                  <div key={day.day} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
                    <MiniBar value={day.posts} max={maxActivity} color="#f97316" />
                    <span className="text-[8px] text-slate-400 truncate w-full text-center">{day.day}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tipos de publicação */}
        <div className="bg-white border border-slate-200 rounded-xl">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
            <Newspaper size={15} className="text-orange-500" />
            <h2 className="text-sm font-semibold text-slate-800">Tipos de publicação</h2>
            <span className="text-[10px] text-slate-400 ml-auto">{periodDesc}</span>
          </div>
          <div className="px-4 py-3 space-y-2">
            {post_types.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Sem publicações</p>
            ) : post_types.map(pt => {
              const label = POST_TYPE_LABELS[pt.type] || pt.type;
              const color = POST_TYPE_COLORS[pt.type] || '#94a3b8';
              const pct = postTotal > 0 ? Math.round((pt.count / postTotal) * 100) : 0;
              return (
                <div key={pt.type} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs text-slate-700 flex-1">{label}</span>
                  <span className="text-xs font-bold text-slate-800">{pt.count}</span>
                  <span className="text-[10px] text-slate-400 w-8 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Módulos */}
      <div>
        <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
          <BarChart3 size={14} className="text-orange-500" />
          Utilização dos Módulos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-blue-50"><Calendar size={14} className="text-blue-500" /></div>
              <h3 className="text-sm font-semibold text-slate-800">Calendário</h3>
            </div>
            <Stat label="Total de eventos" value={m.calendar.total_events} />
            <Stat label="Eventos este mês" value={m.calendar.events_this_month} />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-emerald-50"><HardDrive size={14} className="text-emerald-500" /></div>
              <h3 className="text-sm font-semibold text-slate-800">Drive</h3>
            </div>
            <Stat label="Arquivos" value={m.drive.files} />
            <Stat label="Pastas" value={m.drive.folders} />
            <Stat label="Espaço utilizado" value={formatBytes(m.drive.total_size)} />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-violet-50"><ClipboardList size={14} className="text-violet-500" /></div>
              <h3 className="text-sm font-semibold text-slate-800">Formulários</h3>
            </div>
            <Stat label="Formulários criados" value={m.forms.total} />
            <Stat label="Respostas recebidas" value={m.forms.responses} />
            {m.forms.total > 0 && (
              <Stat label="Média por formulário" value={(m.forms.responses / m.forms.total).toFixed(1)} sub="respostas" />
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-orange-50"><FileSignature size={14} className="text-orange-500" /></div>
              <h3 className="text-sm font-semibold text-slate-800">Assinatura Digital</h3>
            </div>
            <Stat label="Documentos" value={m.sign.documents} />
            <Stat label="Assinados" value={m.sign.signed} />
            <Stat label="Pendentes" value={m.sign.pending} />
            {signTotal > 0 && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-slate-500">Taxa de conclusão</span>
                  <span className="text-[10px] font-bold text-emerald-600">{signRate}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-1.5 bg-emerald-500 rounded-full" style={{ width: `${signRate}%` }} />
                </div>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-pink-50"><LayoutGrid size={14} className="text-pink-500" /></div>
              <h3 className="text-sm font-semibold text-slate-800">Lousas</h3>
            </div>
            <Stat label="Lousas criadas" value={m.whiteboard.total} />
          </div>
        </div>
      </div>

      {/* Ranking XP */}
      {top_users.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
            <TrendingUp size={16} className="text-orange-500" />
            <h2 className="text-sm font-semibold text-slate-800">Ranking de Engajamento (XP)</h2>
            <span className="text-[10px] text-slate-400 ml-auto">Histórico completo</span>
          </div>
          <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            {top_users.map((u, idx) => (
              <div key={u.id} className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0
                  ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : idx === 1 ? 'bg-slate-200 text-slate-700' : idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>
                  {idx + 1}
                </span>
                <img
                  src={u.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&size=24&background=f97316&color=fff`}
                  alt={u.name}
                  className="w-6 h-6 rounded-full flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{u.name}</p>
                  <XpBar value={u.total_xp ?? 0} max={maxXP} color="#f97316" />
                </div>
                <div className="text-right flex-shrink-0 min-w-[60px]">
                  <p className="text-xs font-bold text-slate-700">{(u.total_xp ?? 0).toLocaleString('pt-BR')} XP</p>
                  <p className="text-[10px] text-slate-400">{u.rank?.name ?? u.rank_slug ?? ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
