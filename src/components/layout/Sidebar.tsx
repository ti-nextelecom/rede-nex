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
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../lib/auth';
import { pcGetMinhasPermissoes } from '../../lib/prestacaoContasApi';

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
        <div className="fixed inset-0 bg-black/20 z-30 lg:hidden" />
      )}

      <aside
        className={cn(
          'fixed top-14 left-0 bottom-0 z-40 bg-white border-r border-slate-200 flex flex-col transition-all duration-200 ease-in-out overflow-hidden',
          open ? 'w-56' : 'w-0 lg:w-14'
        )}
      >
        <nav className="flex-1 py-4 overflow-y-auto scrollbar-thin overflow-x-hidden">
          <ul className="space-y-0.5 px-2">
            {[...navItems, ...(isAdmin ? [{ label: 'Logs', icon: ScrollText, to: '/logs' }] : [])].map(item => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative border-l-2',
                      isActive
                        ? 'bg-gradient-to-r from-orange-50 to-transparent text-orange-600 border-orange-500 shadow-sm'
                        : 'text-slate-600 hover:bg-slate-50/80 hover:text-slate-900 hover:translate-x-0.5 border-transparent'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        size={17}
                        className={cn(
                          'flex-shrink-0 transition-colors',
                          isActive ? 'text-orange-500' : 'text-slate-400 group-hover:text-orange-500 transition-colors duration-200'
                        )}
                      />
                      <span
                        className={cn(
                          'whitespace-nowrap transition-all duration-200',
                          open ? 'opacity-100 w-auto' : 'opacity-0 w-0 lg:opacity-0 lg:w-0'
                        )}
                      >
                        {item.label}
                      </span>
                      {isActive && open && (
                        <ChevronRight size={13} className="ml-auto text-orange-400" />
                      )}
                      {/* Tooltip for collapsed state */}
                      {!open && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden lg:block">
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
        <div className="border-t border-slate-100 px-2 py-3 overflow-x-hidden">
          <NavLink
            to="/configuracoes"
            className="flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all duration-150"
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
