import { useId, useState } from 'react';
import { resolveAvatarFrame, type AvatarFrame } from '../../shared/achievementFrames.mjs';
import { useAvatarFrames } from '../lib/avatarFrames';
import './achievement-frames.css';
import { BehavioralAvatarSymbol } from './BehavioralIdentity';
import { useBehavioralBadges } from '../lib/behavioralBadges';
import { behavioralIdentity } from '../../shared/behavioralProfiles.mjs';

function FrameArt({ frame }: { frame: AvatarFrame }) {
  const id = useId().replace(/:/g, '');
  const motif = frame.motif;
  const points = (count: number, radius: number, offset = -90) => Array.from({ length: count }, (_, index) => {
    const angle = (offset + index * 360 / count) * Math.PI / 180;
    return [50 + Math.cos(angle) * radius, 50 + Math.sin(angle) * radius];
  });
  return <svg className="achievement-avatar__art" viewBox="0 0 100 100" aria-hidden="true">
    <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop stopColor={frame.colors[0]} /><stop offset="1" stopColor={frame.colors[1]} /></linearGradient></defs>
    <g stroke={`url(#${id})`} fill="none" strokeWidth="3">
      <circle cx="50" cy="50" r="44" strokeWidth="5" opacity=".22" />
      <circle cx="50" cy="50" r="43" strokeWidth={motif === 'circle' ? 3 : 4}
        strokeDasharray={motif === 'dashes' ? '12 5' : motif === 'arcs' ? '48 19' : undefined} />
      {['double', 'laurel', 'crown'].includes(motif) && <circle cx="50" cy="50" r="48" strokeWidth="1.5" />}
      {['hex', 'diamond'].includes(motif) && <polygon points={points(motif === 'hex' ? 6 : 4, 49).map(p => p.join(',')).join(' ')} strokeWidth="2" />}
      {['dots', 'stars', 'orbit'].includes(motif) && points(motif === 'dots' ? 8 : motif === 'stars' ? 5 : 3, 46).map(([x, y], i) =>
        motif === 'stars' ? <path key={i} d={`M${x} ${y - 4}l1.4 2.6 3 .5-2.2 2.1.6 3-2.8-1.4-2.8 1.4.6-3-2.2-2.1 3-.5z`} fill={`url(#${id})`} strokeWidth="1" />
          : <circle key={i} cx={x} cy={y} r={motif === 'orbit' ? 4 : 2.8} fill={`url(#${id})`} strokeWidth="1" />)}
      {motif === 'rays' && points(12, 47).map(([x, y], i) => <path key={i} d={`M${50 + (x - 50) * .9} ${50 + (y - 50) * .9}L${x} ${y}`} strokeWidth="3" strokeLinecap="round" />)}
      {['leaves', 'laurel'].includes(motif) && [-1, 1].map(side => <g key={side} transform={`translate(50 50) scale(${side} 1)`}>
        {[0, 1, 2, 3].map(i => <ellipse key={i} cx="41" cy={-17 + i * 12} rx="3" ry="6" transform={`rotate(${-28 + i * 18} 41 ${-17 + i * 12})`} fill={`url(#${id})`} strokeWidth="1" />)}
      </g>)}
      {motif === 'crown' && <><path d="M32 13l-3-10 12 6L50 0l9 9 12-6-3 10z" fill={`url(#${id})`} strokeWidth="1.5" /><path d="M21 80l-4 7m62-7 4 7M50 89l-4 5 4 5 4-5z" strokeWidth="3" /></>}
    </g>
  </svg>;
}

export function AchievementAvatar({ userId, name, photo, size = 40, frame: preview, level: previewLevel, className = '' }: {
  userId?: string; name: string; photo?: string | null; size?: number; frame?: string; level?: number; className?: string;
}) {
  const { entries } = useAvatarFrames();
  const behavioral=useBehavioralBadges();
  const animal=preview===undefined?behavioralIdentity(userId?behavioral.get(userId):null):null;
  const entry = userId ? entries.get(userId) : undefined;
  const frame = resolveAvatarFrame(preview ?? entry?.frame_slug, previewLevel ?? entry?.level ?? 1);
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'NX';
  return <span className={`achievement-avatar ${frame.motif === 'none' ? 'achievement-avatar--plain' : ''} ${className}`}
    style={{ width: size, height: size }} role="img" aria-label={`${name}${animal?' · Perfil comportamental: '+animal.name:''}`} title={`${name} · ${frame.name}${animal?' · '+animal.name:''}`} data-frame={frame.slug}>
    <span className="achievement-avatar__face">
      {photo && photo !== failedPhoto ? <img src={photo} alt="" loading="lazy" onError={() => setFailedPhoto(photo)} /> : <span>{initials}</span>}
    </span>
    {frame.motif !== 'none' && <FrameArt frame={frame} />}
    {animal&&<BehavioralAvatarSymbol userId={userId} size={size>=70?28:size>=36?17:13}/>}
  </span>;
}
