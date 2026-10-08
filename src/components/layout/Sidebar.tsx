import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Network,
  Newspaper,
  GraduationCap,
  BookOpen,
  Users,
  Shield,
  Settings,
  ChevronRight,
  MessageCircle,
  ListTodo,
  ScrollText,
  Calendar,
  FolderOpen,
  ClipboardList,
  FileSignature,
  Square,
  BarChart3,
  BookText,
  HelpCircle,
  Sparkles,
  FolderKanban,
  Receipt,
  Activity,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../lib/auth';
import { pcGetMinhasPermissoes } from '../../lib/prestacaoContasApi';
import './sidebar.css';

interface SidebarProps {
  open: boolean;
}

const baseNavItems = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/' },
  { label: 'Feed', icon: Newspaper, to: '/feed' },
  { label: 'Treinamentos', icon: GraduationCap, to: '/treinamentos' },
  { label: 'Wiki', icon: BookOpen, to: '/wiki' },
  { label: 'Colaboradores', icon: Users, to: '/colaboradores' },
  { label: 'Organograma', icon: Network, to: '/organograma' },
  { label: 'Bate-papo', icon: MessageCircle, to: '/bate-papo' },
  { label: 'Tarefas', icon: ListTodo, to: '/tarefas' },
  { label: 'Projetos', icon: FolderKanban, to: '/projetos' },
  // PC inserted at index 9 when user has access
  { label: 'Calendário', icon: Calendar, to: '/calendario' },
  { label: 'Drive', icon: FolderOpen, to: '/drive' },
  { label: 'Formulários', icon: ClipboardList, to: '/formularios' },
  { label: 'Assinatura', icon: FileSignature, to: '/assinatura' },
  { label: 'Quadro', icon: Square, to: '/lousas' },
  { label: 'Notas', icon: BookText, to: '/notas' },
  { label: 'Analytics', icon: BarChart3, to: '/analytics' },
  { label: 'Gestão T.I.', icon: Activity, to: '/gestao-ti' },
  { label: 'Ajuda', icon: HelpCircle, to: '/ajuda' },
  { label: 'Copiloto', icon: Sparkles, to: '/copiloto' },
  { label: 'Permissões', icon: Shield, to: '/permissoes' },
];

const pcNavItem = { label: 'Prestação de Contas', icon: Receipt, to: '/prestacao-contas' };

export function Sidebar({ open }: SidebarProps) {
  const { user } = useAuth();
  const isAdmin = ['Administrador', 'Gestor'].includes(user?.role_name ?? '');
  const [pcAccess, setPcAccess] = useState(false);

  useEffect(() => {
    if (!user) return;
    pcGetMinhasPermissoes()
      .then(r => setPcAccess(r.data.hasAccess))
      .catch(() => setPcAccess(false));
  }, [user]);

  const navItems = pcAccess
    ? [...baseNavItems.slice(0, 9), pcNavItem, ...baseNavItems.slice(9)]
    : baseNavItems;

  return (
    <>
      {/* Overlay for mobile */}
      {open && (
        <div className="sidebar-overlay" />
      )}

      <aside
        className={cn(
          'sidebar-modern',
          open ? 'sidebar-open' : 'sidebar-collapsed'
        )}
      >
        <nav className="sidebar-nav">
          <ul className="sidebar-list">
            {[...navItems, ...(isAdmin ? [{ label: 'Logs', icon: ScrollText, to: '/logs' }] : [])].map((item, index) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    cn(
                      'sidebar-item group',
                      isActive && 'active'
                    )
                  }
                  style={{ '--index': index } as React.CSSProperties}
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={17} className="sidebar-item-icon" />
                      <span className="sidebar-item-label">
                        {item.label}
                      </span>
                      {isActive && (
                        <ChevronRight size={13} className="sidebar-item-indicator" />
                      )}
                      {!open && (
                        <div className="sidebar-tooltip">
                          {item.label}
                        </div>
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Bottom section */}
        <div className="sidebar-bottom">
          <NavLink
            to="/configuracoes"
            className={({ isActive }) =>
              cn('sidebar-settings group', isActive && 'opacity-100')
            }
          >
            <Settings size={17} className="flex-shrink-0" />
            <span
              className={cn(
                'whitespace-nowrap transition-all duration-200',
                open ? 'opacity-100 w-auto' : 'opacity-0 w-0'
              )}
            >
              Configurações
            </span>
          </NavLink>
        </div>
      </aside>
    </>
  );
}
