import { useEffect, useState } from 'react';
import { Trophy, Medal, Crown } from 'lucide-react';
import { getRanking, type RankingEntry } from '../lib/gamificationApi';
import { useAuth } from '../lib/auth';
import { RankBadge } from '../components/Gamification';

function Podium({ entries }: { entries: RankingEntry[] }) {
  const [second, first, third] = [entries[1], entries[0], entries[2]];

  const podiumEntry = (entry: RankingEntry | undefined, pos: number, height: string, medal: string) => {
    if (!entry) return <div className={`flex-1 ${height}`} />;
    const avatar = entry.photo_url
      || `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.name)}&size=80&background=0057b8&color=fff`;
    return (
      <div className="flex-1 flex flex-col items-center gap-2">
        <div className="text-2xl">{medal}</div>
        <div className="relative">
          <div className="rounded-full p-0.5" style={{ background: `linear-gradient(135deg, ${entry.rank.color}, ${entry.rank.color}88)` }}>
            <img src={avatar} alt={entry.name} className="w-14 h-14 rounded-full object-cover ring-2 ring-white" />
          </div>
          <span className="absolute -bottom-1 -right-1 text-lg leading-none">{entry.rank.emoji}</span>
        </div>
        <p className="text-white font-bold text-sm text-center leading-tight max-w-[80px] truncate">{entry.name}</p>
        <p className="text-white/60 text-xs">{entry.total_xp.toLocaleString()} XP</p>
        <div className={`w-full ${height} rounded-t-2xl flex items-start justify-center pt-2`}
          style={{ background: pos === 1 ? 'linear-gradient(180deg,#FFD700,#B8860B)' : pos === 2 ? 'linear-gradient(180deg,#C0C0C0,#808080)' : 'linear-gradient(180deg,#CD7F32,#8B4513)' }}>
          <span className="text-white/80 font-black text-xl">#{pos}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex items-end gap-2 px-4 pt-4">
      {podiumEntry(second, 2, 'h-20', '🥈')}
      {podiumEntry(first, 1, 'h-28', '🥇')}
      {podiumEntry(third, 3, 'h-16', '🥉')}
    </div>
  );
}

function RankingRow({ entry, isMe }: { entry: RankingEntry; isMe: boolean }) {
  const avatar = entry.photo_url
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.name)}&size=48&background=0057b8&color=fff`;

  const posStyle = entry.rank_position <= 3
    ? entry.rank_position === 1 ? 'text-yellow-500' : entry.rank_position === 2 ? 'text-slate-400' : 'text-amber-600'
    : 'text-slate-400';

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
        isMe
          ? 'bg-blue-50 border-blue-300 shadow-md ring-2 ring-blue-400/40'
          : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm'
      }`}
    >
      <span className={`w-8 text-center font-black text-sm flex-shrink-0 ${posStyle}`}>
        {entry.rank_position <= 3 ? ['🥇','🥈','🥉'][entry.rank_position - 1] : `#${entry.rank_position}`}
      </span>
      <div className="relative flex-shrink-0">
        <div className="rounded-full p-0.5" style={{ background: `linear-gradient(135deg, ${entry.rank.color}, ${entry.rank.color}55)` }}>
          <img src={avatar} alt={entry.name} className="w-10 h-10 rounded-full object-cover ring-1 ring-white" />
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 text-sm leading-none">{entry.rank.emoji}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`font-bold text-sm truncate ${isMe ? 'text-blue-700' : 'text-slate-800'}`}>{entry.name}</p>
          {isMe && <span className="text-[10px] bg-blue-500 text-white rounded-full px-1.5 py-0.5 font-bold flex-shrink-0">Você</span>}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <RankBadge rank={entry.rank} size="sm" />
          {entry.position && <span className="text-[10px] text-slate-400 truncate">{entry.position}</span>}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="font-black text-sm" style={{ color: entry.rank.color }}>{entry.total_xp.toLocaleString()}</p>
        <p className="text-[10px] text-slate-400">XP</p>
      </div>
    </div>
  );
}

export function Ranking() {
  const { user } = useAuth();
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [myPosition, setMyPosition] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRanking().then(data => {
      setRanking(data.ranking);
      setMyPosition(data.my_position);
    }).finally(() => setLoading(false));
  }, []);

  const top3 = ranking.slice(0, 3);
  const myEntry = ranking.find(r => r.id === user?.id);

  return (
    <div className="min-h-screen space-y-4">
      {/* Header com pódio */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg,#0a0a2e,#0d1b4b,#1a237e)' }}>
        <div className="p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Trophy size={28} className="text-yellow-400" />
            <h1 className="text-2xl font-black text-white">Ranking Global</h1>
          </div>
          <p className="text-white/60 text-sm">Compete com seus colegas e suba de nível</p>

          {myEntry && myPosition && (
            <div className="mt-4 inline-flex items-center gap-3 bg-white/10 rounded-2xl px-4 py-2">
              <Crown size={16} className="text-yellow-400" />
              <span className="text-white/80 text-sm">Sua posição:</span>
              <span className="text-white font-black text-lg">#{myPosition}</span>
              <span className="text-white/60 text-sm">{myEntry.total_xp.toLocaleString()} XP</span>
              <RankBadge rank={myEntry.rank} size="sm" />
            </div>
          )}
        </div>

        {top3.length > 0 && !loading && <Podium entries={top3} />}
      </div>

      {/* Lista completa */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : ranking.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Medal size={40} className="mx-auto mb-2 opacity-30" />
          <p>Nenhum usuário no ranking ainda</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={16} className="text-slate-400" />
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide">Classificação completa</h2>
            <span className="text-xs text-slate-400">({ranking.length} colaboradores)</span>
          </div>
          <div className="space-y-2">
            {ranking.map(entry => (
              <RankingRow key={entry.id} entry={entry} isMe={entry.id === user?.id} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
