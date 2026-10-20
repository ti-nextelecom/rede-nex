import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Bell, ChevronDown, Grid2X2, LogOut, Search, Settings, User, X } from 'lucide-react';
import { useDarkMode } from '../../lib/useDarkMode';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import { cn } from '../../lib/utils';
import { wsEventBus } from '../../lib/wsEventBus';
import { useAuth } from '../../lib/auth';
import { useHrAccess } from '../../lib/hrAccess';
import { getNotifications, markAllNotificationsRead, markNotificationRead, type NotificationRow } from '../../lib/notificationsApi';
import { PRIMARY_NAVIGATION, navigationForRole } from './navigation';
import './navbar.css';

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

export function Navbar() {
  const [logoFailed, setLogoFailed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [moreSearch, setMoreSearch] = useState('');
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [chatUnread, setChatUnread] = useState(0);
  const [toast, setToast] = useState<NotificationRow | null>(null);
  const knownUnread = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locationPath = useRef(location.pathname);
  useDarkMode();
  const role = user?.roles?.name || user?.role_name || 'Usuário';
  const { allowed } = useHrAccess();
  const items = navigationForRole(role, allowed('rh.view'));
  const moreItems = items.filter(item => !PRIMARY_NAVIGATION.some(primary => primary.to === item.to));
  const unreadCount = notifications.filter(item => !item.read).length;
  const searchItems = items.filter(item => item.label.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  const filteredMoreItems = moreItems.filter(item => item.label.toLocaleLowerCase('pt-BR').includes(moreSearch.toLocaleLowerCase('pt-BR')));
  const initials = (user?.name || 'NEX').split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('');

  const loadNotifications = useCallback(async () => {
    const next = (await getNotifications().catch(() => [])).filter(item => item.type !== 'chat');
    const unread = new Set(next.filter(item => !item.read).map(item => item.id));
    const newest = next.find(item => unread.has(item.id) && !knownUnread.current.has(item.id));
    if (!firstLoad.current && newest && newest.type !== 'task' && newest.type !== 'project' && !newest.link?.startsWith('/tarefas') && !newest.link?.startsWith('/projetos')) {
      playNotificationSound();
      setToast(newest);
    }
    firstLoad.current = false;
    knownUnread.current = unread;
    setNotifications(next);
  }, []);

  useEffect(() => {
    void loadNotifications();
    const interval = window.setInterval(loadNotifications, 15000);
    return () => window.clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    locationPath.current = location.pathname;
    if (location.pathname === '/bate-papo') setChatUnread(0);
  }, [location.pathname]);

  useEffect(() => wsEventBus.subscribe(message => {
    if (message.type === 'message:incoming' && locationPath.current !== '/bate-papo') setChatUnread(value => value + 1);
  }), []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  function navigateWithinApp(link?: string | null) {
    if (link?.startsWith('/') && !link.startsWith('//') && !link.includes('\\')) navigate(link);
  }

  async function openNotification(notification: NotificationRow) {
    if (!notification.read) {
      await markNotificationRead(notification.id).catch(() => undefined);
      await loadNotifications();
    }
    navigateWithinApp(notification.link);
    setToast(null);
  }

  const feedHasDot = notifications.some(n => n.type === 'feed' && !n.read);

  return (
    <header className="navbar-modern">
      <div className="navbar-content">
        <NavLink to="/" className="navbar-logo" aria-label="REDE NEX — início">
          <span className="navbar-brand-mark" aria-hidden="true">{logoFailed ? <Grid2X2 size={23} /> : <img src="/assets/images/logo_nex.png" alt="" onError={() => setLogoFailed(true)} />}</span>
          <span>REDE <strong>NEX</strong></span>
        </NavLink>
        <nav className="navbar-nav" aria-label="Navegação principal">
          <div className="navbar-primary-links">
            {PRIMARY_NAVIGATION.map(item => {
              const active = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
              return (
                <NavLink key={item.to} to={item.to} className={cn('nav-item navbar-primary-link', active && 'active')}>
                  <item.icon size={18} aria-hidden="true" />
                  <span>{item.label}</span>
                  {item.to === '/feed' && feedHasDot && <span className="nav-unread-dot" aria-label="Novas publicações" />}
                  {item.to === '/bate-papo' && chatUnread > 0 && <span className="nav-unread-count" aria-label={`${chatUnread} mensagens não lidas`}>{chatUnread > 99 ? '99+' : chatUnread}</span>}
                </NavLink>
              );
            })}
          </div>
          <DropdownMenu onOpenChange={open => { if (!open) setMoreSearch(''); }}>
            <DropdownMenuTrigger asChild>
              <button type="button" className={cn('nav-item', moreItems.some(item => item.to === location.pathname) && 'active')}>
                <Grid2X2 size={17} />Mais<ChevronDown size={12} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="nex-more-menu">
              <div className="nex-more-menu-header">
                <div><p>Mais recursos</p><span>Todos os módulos disponíveis</span></div>
              </div>
              <label className="nex-more-menu-search">
                <Search size={16} />
                <input autoFocus aria-label="Pesquisar recursos" placeholder="Pesquisar módulo..." value={moreSearch} onChange={event => setMoreSearch(event.target.value)} />
              </label>
              <div className="nex-more-menu-list">
                {filteredMoreItems.map(item => (
                  <DropdownMenuItem key={item.to} asChild>
                    <NavLink to={item.to} className="nex-more-menu-item">
                      <span className="nex-more-card-icon"><item.icon size={17} /></span>
                      <span><strong>{item.label}</strong><small>{item.adminOnly ? 'Configuração administrativa' : 'Abrir recurso'}</small></span>
                    </NavLink>
                  </DropdownMenuItem>
                ))}
                {!filteredMoreItems.length && <p className="nex-more-empty">Nenhum recurso encontrado.</p>}
              </div>
              <div className="nex-more-footer"><Search size={14} /> <span>Atalho:</span> <kbd>Ctrl</kbd> <span>+</span> <kbd>K</kbd></div>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
        <div className="navbar-actions">
          <button onClick={() => setSearchOpen(true)} className="navbar-icon-button" aria-label="Buscar módulo" title="Buscar módulo"><Search size={19} /></button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="navbar-icon-button relative" aria-label={`Notificações, ${unreadCount} não lidas`}>
                <Bell size={19} />{unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-24px)] p-0">
              <div className="flex items-center justify-between gap-3 p-4 border-b border-border">
                <span className="font-semibold text-sm">Notificações</span>
                {unreadCount > 0 && <button className="text-xs text-primary min-h-9" onClick={async () => { await markAllNotificationsRead().catch(() => undefined); await loadNotifications(); }}>Marcar lidas</button>}
              </div>
              <div className="max-h-[60dvh] overflow-y-auto">
                {notifications.length ? notifications.map(notification => (
                  <DropdownMenuItem key={notification.id} onSelect={() => { void openNotification(notification); }} className={cn('items-start gap-3 p-4 border-b border-border cursor-pointer', !notification.read && 'bg-primary/5')}>
                    <Bell size={16} className="shrink-0 mt-1 text-primary" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{notification.title}</p>
                      {notification.message && <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>}
                      <p className="text-xs text-muted-foreground mt-1">{timeAgo(notification.created_at)}</p>
                    </div>
                  </DropdownMenuItem>
                )) : <p className="p-8 text-center text-sm text-muted-foreground">Você está em dia. Nenhuma notificação.</p>}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="navbar-profile" aria-label="Abrir menu da conta">
                {user?.photo_url ? <img src={user.photo_url} alt="" /> : <span className="navbar-initials">{initials}</span>}
                <span className="navbar-profile-name">{user?.name?.split(' ')[0] || 'Minha conta'}</span><ChevronDown size={12} className="hidden sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-2"><p className="text-sm font-semibold truncate">{user?.name}</p><p className="text-xs text-muted-foreground">{role}</p></div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate('/perfil')} className="gap-2"><User size={16} />Meu perfil</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate('/configuracoes')} className="gap-2"><Settings size={16} />Configurações</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 text-destructive" onSelect={() => { void logout().then(() => navigate('/login', { replace: true })); }}><LogOut size={16} />Sair</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <Dialog open={searchOpen} onOpenChange={value => { setSearchOpen(value); if (!value) setSearch(''); }}>
        <DialogContent className="nex-module-dialog">
          <DialogTitle>Para onde vamos?</DialogTitle>
          <DialogDescription>Encontre um módulo da REDE NEX pelo nome.</DialogDescription>
          <label className="nex-module-search !my-0"><Search size={18} /><input aria-label="Buscar módulo pelo nome" placeholder="Tarefas, projetos, pessoas…" value={search} onChange={event => setSearch(event.target.value)} /></label>
          <div className="max-h-[50dvh] overflow-y-auto space-y-1">
            {searchItems.map(item => <NavLink key={item.to} to={item.to} onClick={() => { setSearchOpen(false); setSearch(''); }} className="flex items-center gap-3 rounded-lg p-3 text-sm hover:bg-muted"><item.icon size={18} className="text-primary" />{item.label}</NavLink>)}
            {!searchItems.length && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum módulo encontrado.</p>}
          </div>
        </DialogContent>
      </Dialog>
      {toast && <div className="nex-notification-toast" role="status">
        <button className="text-left flex-1 min-w-0" onClick={() => { void openNotification(toast); }}><p className="font-semibold text-sm">{toast.title}</p><p className="text-xs text-muted-foreground line-clamp-2">{toast.message}</p></button>
        <button aria-label="Fechar notificação" className="navbar-icon-button" onClick={() => setToast(null)}><X size={16} /></button>
      </div>}
    </header>
  );
}

