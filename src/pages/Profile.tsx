import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { Camera, Heart, ImagePlus, Mail, MessageCircle, Newspaper, Phone, Save, Settings, ShieldCheck, UserRound, Star, Target } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Card } from '../components/ui/card';
import { getGamificationProfile, getMissions, type GamificationProfile, type Mission } from '../lib/gamificationApi';
import { XPBar, BadgeGrid, MissionCard } from '../components/Gamification';
import { getFeedPosts } from '../lib/appApi';
import type { Post } from '../types';

type ProfileTab = 'config' | 'conquistas' | 'missoes' | 'publicacoes';

export function Profile() {
  const { user, uploadAvatar, uploadCover, updateProfile } = useAuth();
  const [params] = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<ProfileTab>(params.get('edit') === '1' ? 'config' : 'conquistas');
  const [gamification, setGamification] = useState<GamificationProfile | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    position: user?.position || '',
    bio: user?.bio || '',
    google_ical_url: user?.google_ical_url || '',
    photo_url: user?.photo_url || '',
  });

  useEffect(() => {
    setForm({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      position: user?.position || '',
      bio: user?.bio || '',
      google_ical_url: user?.google_ical_url || '',
      photo_url: user?.photo_url || '',
    });
  }, [user]);

  useEffect(() => {
    getGamificationProfile().then(setGamification).catch(() => {});
    getMissions().then(setMissions).catch(() => {});

  }, [user?.id]);

  useEffect(() => {
    if (tab !== 'publicacoes' || !user?.id) return;
    setPostsLoading(true);
    getFeedPosts()
      .then(all => setMyPosts(all.filter(p => p.users?.id === user.id || (p as Post & { user_id?: string }).user_id === user.id)))
      .catch(() => {})
      .finally(() => setPostsLoading(false));
  }, [tab, user?.id]);

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadAvatar(file);
    event.target.value = '';
  }

  async function handleCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadCover(file);
    event.target.value = '';
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await updateProfile(form);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  const avatar = user?.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'Rede Nex')}&size=160&background=ff7a00&color=fff`;
  const role = user?.roles?.name || user?.role_name || 'Usuário';
  const department = user?.departments?.name || user?.department_name || 'Rede Nex';

  const dailyMissions = missions.filter(m => m.type === 'daily');
  const weeklyMissions = missions.filter(m => m.type === 'weekly');
  const achievements = missions.filter(m => m.type === 'achievement');

  const tabs: { id: ProfileTab; label: string; icon: typeof Star }[] = [
    { id: 'conquistas', label: 'Conquistas', icon: Star },
    { id: 'missoes', label: 'Missões', icon: Target },
    { id: 'publicacoes', label: 'Publicações', icon: Newspaper },
    { id: 'config', label: 'Config.', icon: Settings },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      {/* Left card — avatar + info + rank */}
      <Card className="border-slate-200 overflow-hidden">
        <div className="relative h-28">
          {user?.cover_url
            ? <img src={user.cover_url} alt="Capa" className="h-full w-full object-cover" />
            : <div className="h-full w-full bg-gradient-to-r from-[#0057b8] to-[#ff7a00]" />}
          <button
            onClick={() => coverRef.current?.click()}
            className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-lg bg-black/40 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/60 transition-colors"
          >
            <ImagePlus size={13} /> Alterar capa
          </button>
          <input ref={coverRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleCover} />
        </div>
        <div className="px-6 pb-6">
          <div className="relative -mt-14 inline-block">
            <div
              className="rounded-full p-1"
              style={gamification ? { background: `linear-gradient(135deg, ${gamification.rank.color}, ${gamification.rank.color}88)` } : {}}
            >
              <img src={avatar} alt={user?.name || 'Usuário'} className="h-24 w-24 rounded-full object-cover ring-4 ring-white" />
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg hover:bg-orange-600"
            >
              <Camera size={15} />
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handlePhoto} />
          </div>

          <h1 className="mt-4 text-2xl font-bold text-slate-900">{user?.name}</h1>
          <p className="text-sm text-slate-500">{form.position || role}</p>

          {gamification && (
            <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <XPBar profile={gamification} compact />
            </div>
          )}

          <div className="mt-5 space-y-3 text-sm">
            <div className="flex items-center gap-2 text-slate-600">
              <ShieldCheck size={16} className="text-orange-500" />
              {role}
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <UserRound size={16} className="text-orange-500" />
              {department}
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Mail size={16} className="text-orange-500" />
              {user?.email}
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Phone size={16} className="text-orange-500" />
              {user?.phone || 'Telefone não informado'}
            </div>
          </div>

          {user?.bio && (
            <div className="mt-5 rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              {user.bio}
            </div>
          )}
        </div>
      </Card>

      {/* Right card — tabs */}
      <Card className="border-slate-200 overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-slate-100">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-all border-b-2 ${
                tab === t.id
                  ? 'border-orange-500 text-orange-600 bg-orange-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <t.icon size={15} />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Conquistas tab */}
          {tab === 'conquistas' && (
            <div className="space-y-6">
              {gamification ? (
                <>
                  <div>
                    <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                      <span>🏅</span> Conquistas ({gamification.badges.length})
                    </h3>
                    <BadgeGrid badges={gamification.badges} />
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          )}

          {/* Missões tab */}
          {tab === 'missoes' && (
            <div className="space-y-6">
              {missions.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {dailyMissions.length > 0 && (
                    <div>
                      <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                        <span className="text-blue-500">🌅</span> Missões diárias
                        <span className="text-xs font-normal text-slate-400">(resetam à meia-noite)</span>
                      </h3>
                      <div className="space-y-2">
                        {dailyMissions.map(m => <MissionCard key={m.slug} mission={m} />)}
                      </div>
                    </div>
                  )}
                  {weeklyMissions.length > 0 && (
                    <div>
                      <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                        <span className="text-purple-500">📅</span> Missões semanais
                        <span className="text-xs font-normal text-slate-400">(resetam toda segunda)</span>
                      </h3>
                      <div className="space-y-2">
                        {weeklyMissions.map(m => <MissionCard key={m.slug} mission={m} />)}
                      </div>
                    </div>
                  )}
                  {achievements.length > 0 && (
                    <div>
                      <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                        <span className="text-amber-500">🏆</span> Conquistas permanentes
                      </h3>
                      <div className="space-y-2">
                        {achievements.map(m => <MissionCard key={m.slug} mission={m} />)}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Publicações tab */}
          {tab === 'publicacoes' && (
            <div className="space-y-4">
              {postsLoading ? (
                <div className="flex justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-400 border-t-transparent" />
                </div>
              ) : myPosts.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Newspaper size={44} className="mx-auto mb-3 opacity-40" />
                  <p className="font-semibold text-slate-500">Nenhuma publicação ainda</p>
                  <p className="mt-1 text-sm">Acesse o Feed para criar sua primeira publicação.</p>
                </div>
              ) : (
                myPosts.map(post => (
                  <div key={post.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      <span>{new Date(post.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    </div>
                    <p className="text-sm leading-6 text-slate-700 whitespace-pre-wrap line-clamp-5">{post.content}</p>
                    {post.image_url && (
                      <img src={post.image_url} alt="" className="mt-3 max-h-48 w-full rounded-lg object-cover" />
                    )}
                    <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><Heart size={13} /> {post._count?.likes ?? 0}</span>
                      <span className="flex items-center gap-1"><MessageCircle size={13} /> {post._count?.comments ?? 0} comentários</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Configurações tab */}
          {tab === 'config' && (
            <>
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                  <Settings size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Configurações do perfil</h2>
                  <p className="text-sm text-slate-500">Atualize suas informações pessoais.</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">Nome</span>
                  <input
                    value={form.name}
                    onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-orange-400"
                    required
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">E-mail</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={event => setForm(prev => ({ ...prev, email: event.target.value }))}
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-orange-400"
                    required
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">Telefone</span>
                  <input
                    value={form.phone}
                    onChange={event => setForm(prev => ({ ...prev, phone: event.target.value }))}
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-orange-400"
                    placeholder="(00) 00000-0000"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">Cargo / Função</span>
                  <input
                    value={form.position}
                    onChange={event => setForm(prev => ({ ...prev, position: event.target.value }))}
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-orange-400"
                    placeholder="Ex.: Administrador"
                  />
                </label>

                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-sm font-semibold text-slate-700">Bio / Informações pessoais</span>
                  <textarea
                    value={form.bio}
                    onChange={event => setForm(prev => ({ ...prev, bio: event.target.value }))}
                    className="min-h-28 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-orange-400"
                    placeholder="Conte um pouco sobre sua área, responsabilidades ou contatos internos."
                  />
                </label>

                <div className="md:col-span-2 space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">Google Calendar (iCal)</span>
                  <input
                    type="url"
                    value={form.google_ical_url}
                    onChange={event => setForm(prev => ({ ...prev, google_ical_url: event.target.value }))}
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-orange-400"
                    placeholder="https://calendar.google.com/calendar/ical/..."
                  />
                  <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5 text-xs text-blue-700 space-y-1.5">
                    <p className="font-semibold">Como vincular seu Google Calendar:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Acesse <span className="font-medium">calendar.google.com</span></li>
                      <li>Clique nos 3 pontos ao lado do calendário desejado</li>
                      <li>Vá em <span className="font-medium">Configurações e compartilhamento</span></li>
                      <li>Role até <span className="font-medium">"Endereço secreto no formato iCal"</span></li>
                      <li>Clique em copiar e cole o link acima</li>
                    </ol>
                    <p className="text-blue-500">Os eventos aparecerão no Calendário com destaque azul.</p>
                  </div>
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">URL da foto de perfil</span>
                  <input
                    type="url"
                    value={form.photo_url}
                    onChange={event => setForm(prev => ({ ...prev, photo_url: event.target.value }))}
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-orange-400"
                    placeholder="https://nextelecom.bitrix24.com.br/b26742727/resize_cache/..."
                  />
                  <p className="text-xs text-slate-400">Cole o endereço da imagem para definir sua foto de perfil.</p>
                </div>

                                <div className="md:col-span-2 flex items-center justify-end">
                  <button disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-orange-500 px-4 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60">
                    <Save size={16} />
                    {saving ? 'Salvando...' : 'Salvar perfil'}
                  </button>
                </div>

                {saved && <p className="md:col-span-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Perfil atualizado com sucesso.</p>}
              </form>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
