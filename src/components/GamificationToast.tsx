import { useEffect, useState } from 'react';
import type { XPResult } from '../lib/xpEvents';

interface ToastEntry {
  id: number;
  event: XPResult;
  exiting: boolean;
}

let idCounter = 0;

export function GamificationToast() {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  useEffect(() => {
    function handler(e: Event) {
      const event = (e as CustomEvent<XPResult>).detail;
      if (!event) return;
      const id = ++idCounter;
      setToasts(prev => [...prev, { id, event, exiting: false }]);

      setTimeout(() => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
      }, 3800);

      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 4300);
    }
    window.addEventListener('xp:award', handler);
    return () => window.removeEventListener('xp:award', handler);
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-6 right-4 z-[9999] flex flex-col-reverse gap-3 w-72 pointer-events-none">
      {toasts.map(({ id, event, exiting }) => (
        <div
          key={id}
          className={`xp-toast ${exiting ? 'xp-toast-exit' : 'xp-toast-enter'}`}
        >
          <XPToastCard event={event} />
        </div>
      ))}
    </div>
  );
}

function XPToastCard({ event }: { event: XPResult }) {
  const isRankUp = !!event.rank_up;
  const hasMissions = event.completed_missions.length > 0;
  const hasBadges = event.new_badges.length > 0;

  return (
    <div className="rounded-2xl shadow-2xl overflow-hidden pointer-events-auto border border-white/20">
      <div
        className="px-4 py-3 flex items-center gap-3"
        style={{
          background: isRankUp
            ? `linear-gradient(135deg, #7c3aed, #db2777)`
            : `linear-gradient(135deg, #f97316, #f59e0b)`,
        }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-white/70 uppercase tracking-wider">XP Conquistado</p>
          <p className="text-2xl font-black text-white leading-tight">+{event.xp_awarded} XP</p>
        </div>

        {isRankUp ? (
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] font-semibold text-white/80">Rank up!</p>
            <p className="text-lg font-black text-white">
              {event.rank_up!.emoji} {event.rank_up!.name}
            </p>
          </div>
        ) : (
          <div className="text-3xl select-none">⚡</div>
        )}
      </div>

      {(hasMissions || hasBadges) && (
        <div className="bg-white px-4 py-2.5 space-y-1.5">
          {event.completed_missions.map(m => (
            <div key={m.slug} className="flex items-center gap-2">
              <span className="text-emerald-500 text-base font-bold flex-shrink-0">✓</span>
              <span className="text-xs font-semibold text-slate-700 flex-1 min-w-0 truncate">{m.name}</span>
              <span className="text-xs font-black text-amber-500 flex-shrink-0">+{m.xp} XP</span>
            </div>
          ))}
          {hasBadges && (
            <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
              <span className="text-base">🏅</span>
              <span className="text-xs text-slate-500 font-medium">
                {event.new_badges.length === 1 ? 'Novo badge desbloqueado!' : `${event.new_badges.length} badges novos!`}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
