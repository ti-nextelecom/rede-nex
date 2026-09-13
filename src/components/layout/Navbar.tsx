import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Calendar,
  ChevronDown,
  ClipboardList,
  FileSignature,
  GraduationCap,
  HardDrive,
  HelpCircle,
  LayoutDashboard,
  LayoutGrid,
  FolderKanban,
  ListTodo,
  Receipt,
  LogOut,
  Megaphone,
  Menu,
  MessageCircle,
  Moon,
  Network,
  Newspaper,
  PanelLeft,
  Search,
  Settings,
  Shield,
  Sun,
  Trophy,
  User,
  Users,
  X,
} from 'lucide-react';
import { useDarkMode } from '../../lib/useDarkMode';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '../../lib/utils';
import { wsEventBus } from '../../lib/wsEventBus';
import { useAuth } from '../../lib/auth';
import { getNotifications, markAllNotificationsRead, markNotificationRead, type NotificationRow } from '../../lib/notificationsApi';

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Feed', to: '/feed', icon: Newspaper },
  { label: 'Conexão RH', to: '/jrh', icon: Megaphone },
  { label: 'Treinamentos', to: '/treinamentos', icon: GraduationCap },
  { label: 'Wiki', to: '/wiki', icon: BookOpen },
  { label: 'Bate-papo', to: '/bate-papo', icon: MessageCircle },
  { label: 'Tarefas', to: '/tarefas', icon: ListTodo },
  { label: 'Projetos', to: '/projetos', icon: FolderKanban },
];

const MORE_ITEMS = [
  { label: 'Colaboradores', to: '/colaboradores', icon: Users, color: 'text-emerald-400' },
  { label: 'Ranking', to: '/ranking', icon: Trophy, color: 'text-yellow-400' },
  { label: 'Calendário', to: '/calendario', icon: Calendar, color: 'text-blue-400' },
  { label: 'Drive', to: '/drive', icon: HardDrive, color: 'text-emerald-400' },
  { label: 'Formulários', to: '/formularios', icon: ClipboardList, color: 'text-violet-400' },
  { label: 'Assinatura', to: '/assinatura', icon: FileSignature, color: 'text-orange-400' },
  { label: 'Quadro', to: '/lousas', icon: LayoutGrid, color: 'text-pink-400' },
  { label: 'Analytics', to: '/analytics', icon: BarChart3, color: 'text-cyan-400' },
  { label: 'Ajuda', to: '/ajuda', icon: HelpCircle, color: 'text-teal-400' },
  { label: 'Organograma', to: '/organograma', icon: Network, color: 'text-blue-400' },
  { label: 'Prestação de Contas', to: '/prestacao-contas', icon: Receipt, color: 'text-green-400' },
  { label: 'Permissões', to: '/permissoes', icon: Shield, color: 'text-red-400', adminOnly: true },
  { label: 'Setores', to: '/departamentos', icon: Building2, color: 'text-orange-400', adminOnly: true },
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function playNotificationSound() {
  const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;
  const audio = new AudioContextCtor();
  const gain = audio.createGain();
  const oscillator = audio.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(740, audio.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(1040, audio.currentTime + 0.09);
  gain.gain.setValueAtTime(0.0001, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12, audio.currentTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.2);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.22);
  window.setTimeout(() => audio.close(), 350);
}

interface NavbarProps {
  onToggleSidebar?: () => void;
}

export function Navbar({ onToggleSidebar }: NavbarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [overflowFrom, setOverflowFrom] = useState(99);
  const navRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [feedUnread, setFeedUnread] = useState(0);
  const [wikiUnread, setWikiUnread] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);
  const [toast, setToast] = useState<NotificationRow | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const knownUnreadRef = useRef<Set<string>>(new Set());
  const firstNotificationLoadRef = useRef(true);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locationPathRef = useRef(location.pathname);
  useEffect(() => { locationPathRef.current = location.pathname; }, [location.pathname]);
  useEffect(() => { if (location.pathname === '/bate-papo') setChatUnread(0); }, [location.pathname]);
  const { dark, toggle: toggleDark } = useDarkMode();
  const unreadCount = notifications.filter(notification => !notification.read).length;
  const roleName = user?.roles?.name || user?.role_name || 'Usuário';
  const isAdmin = ['Administrador', 'Gestor'].includes(roleName);
  const visibleNavItems = NAV_ITEMS.filter(item => !item.adminOnly || isAdmin);
  const visibleMoreItems = MORE_ITEMS.filter(item => !item.adminOnly || isAdmin);
  const avatar = user?.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'Rede Nex')}&size=80&background=ff7a00&color=fff`;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    if (moreOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [moreOpen]);

  function showToast(notification: NotificationRow) {
    setToast(notification);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 6000);
    if ('Notification' in window && Notification.permission === 'granted') {
      const icon = notification.actor_photo_url && !notification.actor_photo_url.startsWith('data:')
        ? notification.actor_photo_url
        : '/assets/images/logo_nex.png';
      new Notification(notification.title, { body: notification.message || '', icon });
    }
  }

  async function loadNotifications() {
    const nextNotifications = await getNotifications().catch(() => []);
    const displayNotifications = nextNotifications.filter(n => n.type !== 'chat');
    const unreadIds = new Set(displayNotifications.filter(n => !n.read).map(n => n.id));
    const newIds = [...unreadIds].filter(id => !knownUnreadRef.current.has(id));
    const hasNewUnread = newIds.length > 0;
    if (!firstNotificationLoadRef.current && hasNewUnread) {
      playNotificationSound();
      const newest = displayNotifications.find(n => newIds.includes(n.id));
      if (newest) showToast(newest);
    }
    if (firstNotificationLoadRef.current && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    firstNotificationLoadRef.current = false;
    knownUnreadRef.current = unreadIds;
    setNotifications(displayNotifications);
    setFeedUnread(displayNotifications.filter(n => n.type === 'feed' && !n.read).length);
    setWikiUnread(displayNotifications.filter(n => n.type === 'wiki' && !n.read).length);
  }

  useEffect(() => {
    loadNotifications();
    const interval = window.setInterval(loadNotifications, 15000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    return wsEventBus.subscribe((msg) => {
      if (msg.type === 'message:incoming' && locationPathRef.current !== '/bate-papo') {
        setChatUnread(prev => prev + 1);
      }
    });
  }, []);

  async function openNotification(notification: NotificationRow) {
    if (!notification.read) {
      await markNotificationRead(notification.id).catch(() => undefined);
      await loadNotifications();
    }
    if (notification.link) navigate(notification.link);
  }

  // Priority Navigation: move items that don't fit into the "Mais" dropdown
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const items = Array.from(nav.querySelectorAll<HTMLElement>('[data-nav-item]'));
    if (!items.length) return;
    const widths = items.map(el => el.offsetWidth || 90);
    const MORE_W = 78;

    function recalc() {
      if (!navRef.current) return;
      const avail = navRef.current.clientWidth;
      let sum = 0;
      let count = widths.length;
      for (let i = 0; i < widths.length; i++) {
        const needMore = i < widths.length - 1;
        if (sum + widths[i] + (needMore ? MORE_W : 0) > avail) {
          count = i;
          break;
        }
        sum += widths[i];
      }
      setOverflowFrom(count);
    }

    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [visibleNavItems.length]);

  const overflowNavItems = visibleNavItems.slice(overflowFrom < 99 ? overflowFrom : visibleNavItems.length);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14" style={{ background: 'linear-gradient(135deg, #0057b8 0%, #003d80 100%)' }}>
      <div className="flex items-center h-full px-4 gap-1">
        <NavLink to="/" className="flex items-center gap-2 flex-shrink-0 mr-3 group">
          <img src="/assets/images/logo_nex.png" alt="Rede Nex" className="h-8 w-auto drop-shadow-md group-hover:drop-shadow-lg transition-all rounded" />
        </NavLink>

        <div className="w-px h-6 bg-white/20 mx-1 hidden lg:block" />

        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="hidden lg:flex items-center justify-center p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-all duration-200 flex-shrink-0 active:scale-95"
            title="Alternar menu lateral"
          >
            <PanelLeft size={17} />
          </button>
        )}

        <nav ref={navRef} className="hidden lg:flex items-stretch h-full gap-0.5 flex-1 min-w-0">
          {visibleNavItems.slice(0, overflowFrom).map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              data-nav-item
              className={({ isActive }) =>
                cn(
                  'relative flex items-center gap-1.5 px-3 h-full text-sm font-medium transition-all duration-200 group flex-shrink-0',
                  isActive ? 'text-orange-400 bg-white/10' : 'text-white/85 hover:text-white hover:bg-white/10'
                )
              }
            >
              {({ isActive }) => {
                const hasDot = (item.to === '/feed' && feedUnread > 0) || (item.to === '/wiki' && wikiUnread > 0) || (item.to === '/bate-papo' && chatUnread > 0);
                return (
                  <>
                    <item.icon size={14} className={cn('transition-colors', isActive ? 'text-orange-400' : 'text-white/60 group-hover:text-white')} />
                    {item.label}
                    {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-400 rounded-full nav-underline-enter" />}
                    {hasDot && !isActive && <span className="absolute top-2.5 right-1.5 h-2 w-2 rounded-full bg-orange-400 shadow-sm ring-1 ring-blue-700/50" />}
                  </>
                );
              }}
            </NavLink>
          ))}

          {/* Dropdown "Mais" — novos módulos */}
          <div className="relative flex items-stretch" ref={moreMenuRef}>
            <button
              onClick={() => setMoreOpen(v => !v)}
              className={cn(
                'relative flex items-center gap-1.5 px-3 h-full text-sm font-medium transition-all duration-200',
                moreOpen ? 'text-orange-400 bg-white/10' : 'text-white/85 hover:text-white hover:bg-white/10'
              )}
            >
              <Menu size={14} className={cn('transition-colors', moreOpen ? 'text-orange-400' : 'text-white/60')} />
              Mais
              <ChevronDown size={11} className={cn('transition-transform duration-200', moreOpen ? 'rotate-180 text-orange-400' : 'text-white/50')} />
            </button>

            {moreOpen && (
              <div className="absolute top-full left-0 mt-0 w-80 bg-white rounded-b-xl shadow-2xl border border-slate-200/60 overflow-hidden z-50">
                <div className="h-0.5 bg-orange-400" />
                {overflowNavItems.length > 0 && (
                  <div className="p-2 border-b border-slate-100">
                    {overflowNavItems.map(item => (
                      <button
                        key={item.to}
                        onClick={() => { navigate(item.to); setMoreOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-orange-50 hover:text-orange-700 transition-colors text-left"
                      >
                        <item.icon size={15} className="flex-shrink-0 text-blue-500" />
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="p-2 grid grid-cols-2 gap-1.5">
                  {visibleMoreItems.map(item => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.to}
                        onClick={() => { navigate(item.to); setMoreOpen(false); }}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-orange-50 hover:text-orange-700 transition-colors text-left group"
                      >
                        <Icon size={15} className={cn('flex-shrink-0 transition-colors', item.color, 'group-hover:text-orange-500')} />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </nav>

        <div className="ml-auto flex items-center gap-1.5 flex-shrink-0 relative z-10">
          <div className="hidden md:flex items-center">
            {searchOpen ? (
              <div className="flex items-center gap-1">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Pesquisar..."
                    className="pl-8 pr-3 h-8 w-52 rounded-lg bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400/50 shadow-sm"
                    value={searchValue}
                    onChange={event => setSearchValue(event.target.value)}
                  />
                </div>
                <button onClick={() => { setSearchOpen(false); setSearchValue(''); }} className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 transition-colors">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button onClick={() => setSearchOpen(true)} className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-all duration-200 active:scale-95">
                <Search size={17} />
              </button>
            )}
          </div>

          <button
            onClick={toggleDark}
            title={dark ? 'Modo claro' : 'Modo noturno'}
            className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-all duration-200 active:scale-95"
          >
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-all duration-200 active:scale-95">
                <Bell size={17} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-3.5 h-3.5 px-0.5 bg-orange-500 rounded-full text-white text-[8px] flex items-center justify-center font-bold border border-blue-700 leading-none">
                    {unreadCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0 shadow-2xl border-slate-200/60">
              <div className="h-0.5 bg-orange-400" />
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <span className="font-semibold text-sm text-slate-800">Notificações</span>
                {unreadCount > 0 && (
                  <button
                    className="text-[10px] font-medium bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full"
                    onClick={async () => {
                      await markAllNotificationsRead().catch(() => undefined);
                      await loadNotifications();
                    }}
                  >
                    Marcar lidas
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length ? notifications.map(notification => (
                  <button
                    key={notification.id}
                    onClick={() => openNotification(notification)}
                    className={cn(
                      'w-full px-4 py-3 border-b border-slate-50 cursor-pointer transition-all duration-150 hover:bg-slate-50 hover:pl-5 text-left',
                      !notification.read && 'bg-orange-50/50'
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="relative flex-shrink-0">
                        {notification.actor_photo_url ? (
                          <img src={notification.actor_photo_url} alt={notification.actor_name || ''} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                            <Bell size={14} className="text-orange-500" />
                          </div>
                        )}
                        {!notification.read && (
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-orange-500 border border-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {notification.actor_name && <p className="text-[10px] font-semibold text-orange-600 leading-none mb-0.5">{notification.actor_name}</p>}
                        <p className="text-xs font-semibold text-slate-800">{notification.title}</p>
                        {notification.message && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notification.message}</p>}
                        <p className="text-[10px] text-slate-400 mt-1">{timeAgo(notification.created_at)}</p>
                      </div>
                    </div>
                  </button>
                )) : (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">Nenhuma notificação</div>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-all duration-200 group active:scale-95">
                <img src={avatar} alt={user?.name || 'Usuário'} className="w-7 h-7 rounded-full object-cover ring-2 ring-orange-400/70 group-hover:ring-orange-400 transition-all" />
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-white leading-none max-w-32 truncate">{user?.name || 'Usuário'}</p>
                  <p className="text-[10px] text-white/60 leading-none mt-0.5">{roleName}</p>
                </div>
                <ChevronDown size={12} className="text-white/50 hidden sm:block group-hover:text-white/80 transition-colors" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 shadow-2xl border-slate-200/60">
              <div className="h-0.5 bg-orange-400" />
              <DropdownMenuItem className="gap-2 text-sm cursor-pointer hover:bg-orange-50 hover:text-orange-700 transition-colors" onClick={() => navigate('/perfil')}>
                <User size={13} /> Meu Perfil
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-sm cursor-pointer hover:bg-orange-50 hover:text-orange-700 transition-colors" onClick={() => navigate('/perfil?edit=1')}>
                <Settings size={13} /> Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 text-sm text-red-500 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                onClick={async () => {
                  await logout();
                  navigate('/login', { replace: true });
                }}
              >
                <LogOut size={13} /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button className="lg:hidden p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors" onClick={() => setMobileMenuOpen(value => !value)}>
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-white/10 bg-[#003d80] shadow-xl max-h-[80vh] overflow-y-auto">
          <nav className="px-3 py-3 space-y-0.5">
            {visibleNavItems.map(item => (
              <button
                key={item.to}
                onClick={() => { navigate(item.to); setMobileMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-all duration-150"
              >
                <item.icon size={15} className="text-white/50" />
                {item.label}
              </button>
            ))}
            <div className="my-2 border-t border-white/10" />
            <p className="px-3 py-1 text-[10px] font-semibold text-white/40 uppercase tracking-widest">Mais módulos</p>
            {visibleMoreItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.to}
                  onClick={() => { navigate(item.to); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-all duration-150"
                >
                  <Icon size={15} className={item.color} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {toast && (
        <div
          className="fixed bottom-5 right-5 z-[9999] w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden cursor-pointer"
          onClick={() => { if (toast.link) navigate(toast.link); setToast(null); }}
        >
          <div className="flex items-start gap-3 p-4">
            {toast.actor_photo_url ? (
              <img src={toast.actor_photo_url} alt={toast.actor_name || ''} className="h-9 w-9 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="h-9 w-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <Bell size={16} className="text-orange-600" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              {toast.actor_name && <p className="text-[10px] font-semibold text-orange-600 leading-none mb-0.5">{toast.actor_name}</p>}
              <p className="text-sm font-bold text-slate-900 leading-tight">{toast.title}</p>
              {toast.message && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{toast.message}</p>}
            </div>
            <button
              onClick={e => { e.stopPropagation(); setToast(null); }}
              className="text-slate-400 hover:text-slate-600 p-0.5 flex-shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
