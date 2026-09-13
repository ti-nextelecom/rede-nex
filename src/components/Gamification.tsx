import type { Rank, Badge, GamificationProfile, Mission } from '../lib/gamificationApi';

interface RankBadgeProps {
  rank: Rank;
  size?: 'sm' | 'md' | 'lg';
}

export function RankBadge({ rank, size = 'md' }: RankBadgeProps) {
  const sizes = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2',
  };
  const emojiSizes = { sm: 'text-sm', md: 'text-base', lg: 'text-xl' };
  return (
    <span
      className={`inline-flex items-center rounded-full font-bold border ${sizes[size]}`}
      style={{ background: `${rank.color}22`, borderColor: `${rank.color}55`, color: rank.color }}
    >
      <span className={emojiSizes[size]}>{rank.emoji}</span>
      {rank.name}
    </span>
  );
}

interface XPBarProps {
  profile: GamificationProfile;
  compact?: boolean;
}

export function XPBar({ profile, compact = false }: XPBarProps) {
  const { rank, next_rank, progress_pct, total_xp, xp_to_next } = profile;
  if (compact) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold" style={{ color: rank.color }}>{rank.name}</span>
          {next_rank && <span className="text-xs text-slate-400">{xp_to_next.toLocaleString()} XP para {next_rank.name}</span>}
        </div>
        <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${progress_pct}%`, background: `linear-gradient(90deg, ${rank.color}, ${next_rank?.color ?? rank.color})` }} />
        </div>
      </div>
    );
  }
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{rank.emoji}</span>
          <div>
            <p className="font-black text-lg leading-none" style={{ color: rank.color }}>{rank.name}</p>
            <p className="text-xs text-slate-500">{total_xp.toLocaleString()} XP total</p>
          </div>
        </div>
        {next_rank && (
          <div className="text-right">
            <p className="text-xs text-slate-400">Próximo</p>
            <p className="text-sm font-bold" style={{ color: next_rank.color }}>{next_rank.emoji} {next_rank.name}</p>
          </div>
        )}
      </div>
      <div className="h-3 rounded-full bg-slate-200 overflow-hidden shadow-inner">
        <div className="h-full rounded-full transition-all duration-700 shadow-sm"
          style={{ width: `${progress_pct}%`, background: `linear-gradient(90deg, ${rank.color}, ${next_rank?.color ?? rank.color})` }} />
      </div>
      {next_rank && (
        <p className="text-xs text-slate-400 mt-1 text-center">{xp_to_next.toLocaleString()} XP para {next_rank.name}</p>
      )}
    </div>
  );
}

interface BadgeGridProps {
  badges: Badge[];
}

export function BadgeGrid({ badges }: BadgeGridProps) {
  if (!badges.length) {
    return (
      <div className="text-center py-8 text-slate-400">
        <p className="text-3xl mb-2">🏅</p>
        <p className="text-sm">Nenhum emblema ainda — complete missões para ganhar!</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
      {badges.map(badge => (
        <div key={badge.slug} className="flex flex-col items-center gap-1.5 group" title={badge.description}>
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-md border-2 group-hover:scale-110 transition-transform"
            style={{ background: `${badge.color}22`, borderColor: `${badge.color}55` }}
          >
            {badge.icon_emoji}
          </div>
          <p className="text-[10px] font-semibold text-slate-600 text-center leading-tight">{badge.name}</p>
        </div>
      ))}
    </div>
  );
}

interface MissionCardProps {
  mission: Mission;
}

export function MissionCard({ mission }: MissionCardProps) {
  const pct = Math.min(100, Math.round((mission.current_count / mission.target_count) * 100));
  const typeLabels: Record<string, string> = { daily: 'Diária', weekly: 'Semanal', achievement: 'Conquista' };
  const typeColors: Record<string, string> = { daily: '#3B82F6', weekly: '#8B5CF6', achievement: '#F59E0B' };
  const color = typeColors[mission.type] ?? '#64748B';

  return (
    <div className={`p-4 rounded-xl border transition-all ${mission.completed ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
      <div className="flex items-start gap-3">
        <div className="text-2xl flex-shrink-0">{mission.icon_emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className={`font-bold text-sm ${mission.completed ? 'text-emerald-700' : 'text-slate-800'}`}>{mission.name}</p>
            <span className="text-[9px] font-bold rounded-full px-1.5 py-0.5" style={{ background: `${color}22`, color }}>{typeLabels[mission.type]}</span>
          </div>
          <p className="text-xs text-slate-500 mb-2">{mission.description}</p>
          {!mission.completed && (
            <>
              <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden mb-1">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
              </div>
              <p className="text-[10px] text-slate-400">{mission.current_count}/{mission.target_count}</p>
            </>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="font-black text-sm text-amber-500">+{mission.xp_reward}</p>
          <p className="text-[9px] text-slate-400">XP</p>
          {mission.completed && <span className="text-emerald-500 text-lg">✓</span>}
        </div>
      </div>
    </div>
  );
}
