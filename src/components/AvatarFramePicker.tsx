import { useEffect, useRef, useState } from 'react';
import { Check, LockKeyhole, Save, Sparkles } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { getMyAvatarFrames, saveMyAvatarFrame, useAvatarFrames, type AvatarFrameProfile } from '../lib/avatarFrames';
import { AchievementAvatar } from './AchievementAvatar';

export function AvatarFramePicker() {
  const { user } = useAuth();
  const { update } = useAvatarFrames();
  const [profile, setProfile] = useState<AvatarFrameProfile | null>(null);
  const [selected, setSelected] = useState('automatic');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    const version = ++generation.current;
    setProfile(null); setError(''); setSaved(false); setSaving(false);
    getMyAvatarFrames().then(data => {
      if (version !== generation.current) return;
      setProfile(data); setSelected(data.selected_slug); update(data);
    }).catch(() => { if (version === generation.current) setError('Não foi possível carregar suas bordas. Tente novamente.'); });
    return () => { generation.current = version + 1; };
  }, [user?.id, retry, update]);

  async function save() {
    const version = generation.current;
    setSaving(true); setError(''); setSaved(false);
    try {
      const result = await saveMyAvatarFrame(selected);
      if (version !== generation.current) return;
      setProfile(result); setSelected(result.selected_slug); update(result); setSaved(true);
    } catch (cause) {
      if (version === generation.current) setError(cause instanceof Error ? cause.message.replace(/^API \d+: /, '') : 'Não foi possível salvar a borda.');
    } finally { if (version === generation.current) setSaving(false); }
  }
  if (!profile) return <div className="frame-picker" aria-busy={!error}>
    {error ? <><p role="alert" className="frame-picker__feedback">{error}</p><button className="frame-picker__save" onClick={() => setRetry(value => value + 1)}>Tentar novamente</button></> : <p role="status">Carregando bordas de conquistas…</p>}
  </div>;
  const previewName = profile.frames.find(frame => frame.slug === selected)?.name;
  return <div className="frame-picker">
    <div className="frame-picker__intro">
      <AchievementAvatar name={user?.name || 'Você'} photo={user?.photo_url} size={88} frame={selected} level={profile.level} />
      <div><h2>Bordas de conquistas</h2><p>Sua foto, sua conquista. Escolha uma borda padrão ou mostre os níveis que você já alcançou.</p>
        <span className="frame-picker__level"><Sparkles size={13} /> Nível {profile.level} · {profile.total_xp.toLocaleString('pt-BR')} XP</span></div>
    </div>
    {[0, 1].map(group => <section key={group} className="frame-picker__section" aria-label={group ? 'Bordas por nível' : 'Bordas padrão'}>
      <div className="frame-picker__heading"><h3>{group ? 'Conquistas por nível' : 'Bordas padrão'}</h3><span>{group ? 'Novos desenhos a cada nível alcançado' : 'Disponíveis para todos'}</span></div>
      <div className="frame-picker__grid">
        {profile.frames.filter(frame => group ? frame.level > 0 : frame.level === 0).map(frame => <button key={frame.slug} type="button"
          className="frame-option" aria-pressed={selected === frame.slug} disabled={!frame.unlocked || saving}
          onClick={() => { setSelected(frame.slug); setSaved(false); }} title={frame.unlocked ? frame.name : `Desbloqueia no nível ${frame.level}`}>
          {selected === frame.slug && <Check className="frame-option__check" size={15} />}
          <AchievementAvatar name={user?.name || 'Você'} photo={user?.photo_url} size={62} frame={frame.slug} level={Math.max(profile.level, frame.level)} />
          <span className="frame-option__name">{frame.name}</span>
          <span className="frame-option__status">{!frame.unlocked && <LockKeyhole size={11} />}{frame.level ? `Nível ${frame.level}${frame.unlocked ? ' · liberada' : ''}` : frame.slug === 'automatic' ? 'Acompanha seu nível' : 'Sempre disponível'}</span>
        </button>)}
      </div>
    </section>)}
    {error && <p className="frame-picker__feedback" role="alert">{error}</p>}
    {saved && <p className="frame-picker__feedback" role="status">Borda salva! Sua escolha já aparece nas conversas.</p>}
    <div className="frame-picker__footer"><p>{selected === 'automatic' ? 'A borda evolui com suas conquistas.' : previewName}</p>
      <button className="frame-picker__save" disabled={saving || selected === profile.selected_slug} onClick={() => void save()}><Save size={14} />{saving ? 'Salvando…' : 'Salvar borda'}</button></div>
  </div>;
}
