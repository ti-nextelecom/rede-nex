import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  AlignJustify, BarChart3, BookOpen, BookText, Building2, Calendar, ClipboardList,
  FileSignature, FolderKanban, FolderOpen, GraduationCap, HelpCircle, LayoutDashboard,
  ListTodo, Megaphone, MessageCircle, Network, Newspaper, Settings, Shield, Sparkles, Square, Trophy, Users, X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../lib/auth';

const MAIN_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Início', end: true },
  { to: '/feed', icon: Newspaper, label: 'Feed', end: false },
  { to: '/bate-papo', icon: MessageCircle, label: 'Chat', end: false },
  { to: '/tarefas', icon: ListTodo, label: 'Tarefas', end: false },
  { to: '/projetos', icon: FolderKanban, label: 'Projetos', end: false },
];

const MORE_BASE = [
  { to: '/treinamentos', icon: GraduationCap, label: 'Treinamentos', bg: 'bg-violet-50', fg: 'text-violet-700' },
  { to: '/jrh', icon: Megaphone, label: 'Conexão RH', bg: 'bg-rose-50', fg: 'text-rose-700' },
  { to: '/wiki', icon: BookOpen, label: 'Wiki', bg: 'bg-sky-50', fg: 'text-sky-700' },
  { to: '/colaboradores', icon: Users, label: 'Colaboradores', bg: 'bg-emerald-50', fg: 'text-emerald-700' },
  { to: '/organograma', icon: Network, label: 'Organograma', bg: 'bg-blue-50', fg: 'text-blue-700' },
  { to: '/calendario', icon: Calendar, label: 'Calendário', bg: 'bg-cyan-50', fg: 'text-cyan-700' },
  { to: '/drive', icon: FolderOpen, label: 'Drive', bg: 'bg-green-50', fg: 'text-green-700' },
  { to: '/formularios', icon: ClipboardList, label: 'Formulários', bg: 'bg-indigo-50', fg: 'text-indigo-700' },
  { to: '/assinatura', icon: FileSignature, label: 'Assinatura', bg: 'bg-rose-50', fg: 'text-rose-700' },
  { to: '/lousas', icon: Square, label: 'Quadro', bg: 'bg-pink-50', fg: 'text-pink-700' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics', bg: 'bg-teal-50', fg: 'text-teal-700' },
  { to: '/notas', icon: BookText, label: 'Notas', bg: 'bg-amber-50', fg: 'text-amber-700' },
  { to: '/ajuda', icon: HelpCircle, label: 'Ajuda', bg: 'bg-slate-50', fg: 'text-slate-700' },
  { to: '/copiloto', icon: Sparkles, label: 'Copiloto', bg: 'bg-orange-50', fg: 'text-orange-700' },
  { to: '/ranking', icon: Trophy, label: 'Ranking', bg: 'bg-yellow-50', fg: 'text-yellow-700' },
];

const MORE_ADMIN = [
  { to: '/permissoes', icon: Shield, label: 'Permissões', bg: 'bg-red-50', fg: 'text-red-700' },
  { to: '/departamentos', icon: Building2, label: 'Setores', bg: 'bg-orange-50', fg: 'text-orange-700' },
  { to: '/configuracoes', icon: Settings, label: 'Configurações', bg: 'bg-slate-50', fg: 'text-slate-700' },
];

export function MobileBottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const roleName = user?.roles?.name || user?.role_name || 'Usuário';
  const isAdmin = ['Administrador', 'Gestor'].includes(roleName);
  const moreItems = isAdmin ? [...MORE_BASE, ...MORE_ADMIN] : MORE_BASE;

  function handleMoreNav(to: string) {
    setMoreOpen(false);
    setTimeout(() => navigate(to), 180);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="lg:hidden fixed inset-0 z-[45] bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ease-out"
        style={{ opacity: moreOpen ? 1 : 0, pointerEvents: moreOpen ? 'auto' : 'none' }}
        onClick={() => setMoreOpen(false)}
      />

      {/* Bottom sheet */}
      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 z-[46] bg-white rounded-t-3xl shadow-2xl border-t border-slate-200/60 transition-transform duration-300 ease-out"
        style={{ transform: moreOpen ? 'translateY(0)' : 'translateY(100%)' }}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-slate-200 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 py-2">
          <span className="text-sm font-bold text-slate-700">Mais opções</span>
          <button
            onClick={() => setMoreOpen(false)}
            className="h-8 w-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <X size={15} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 px-4 pt-1 pb-10 overflow-y-auto max-h-[70vh]">
          {moreItems.map(item => (
            <button
              key={item.to}
              onClick={() => handleMoreNav(item.to)}
              className={cn(
                'flex flex-col items-center gap-2.5 p-4 rounded-2xl transition-all duration-150 active:scale-95',
                item.bg, item.fg
              )}
            >
              <item.icon size={26} />
              <span className="text-xs font-bold leading-tight text-center">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Nav bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/60 bg-white/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="flex items-stretch h-20">
          {MAIN_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex-1 flex flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors',
                  isActive ? 'text-[#0057b8]' : 'text-slate-400 hover:text-slate-600'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className={cn('p-2 rounded-xl transition-all', isActive ? 'bg-blue-50' : '')}>
                    <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}

          <button
            onClick={() => setMoreOpen(v => !v)}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors',
              moreOpen ? 'text-[#0057b8]' : 'text-slate-400 hover:text-slate-600'
            )}
          >
            <div className={cn('p-2 rounded-xl transition-all duration-200', moreOpen ? 'bg-blue-50 rotate-90' : '')}>
              <AlignJustify size={24} strokeWidth={2} className="transition-transform duration-200" />
            </div>
            <span>Mais</span>
          </button>
        </div>
        <div className="h-safe-area-inset-bottom" />
      </nav>
    </>
  );
}

