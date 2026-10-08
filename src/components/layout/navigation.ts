import {
  BarChart3, BookOpen, BookText, Building2, Calendar, ClipboardList, FileSignature,
  FolderKanban, FolderOpen, GraduationCap, HelpCircle, LayoutDashboard, ListTodo,
  Megaphone, MessageCircle, Network, Newspaper, Receipt, ScrollText, Settings,
  Shield, Sparkles, Square, Trophy, Users, type LucideIcon,
  Activity,
} from 'lucide-react';

export type NavigationItem = { to: string; label: string; icon: LucideIcon; adminOnly?: boolean };

export const PRIMARY_NAVIGATION: NavigationItem[] = [
  { to: '/feed', label: 'Feed', icon: Newspaper },
  { to: '/jrh', label: 'Conexão RH', icon: Megaphone },
  { to: '/bate-papo', label: 'Chat', icon: MessageCircle },
  { to: '/tarefas', label: 'Tarefas', icon: ListTodo },
  { to: '/projetos', label: 'Projetos', icon: FolderKanban },
];

export const NAVIGATION: NavigationItem[] = [
  ...PRIMARY_NAVIGATION,
  { to: '/jrh', label: 'Conexão RH', icon: Megaphone },
  { to: '/treinamentos', label: 'Treinamentos', icon: GraduationCap },
  { to: '/wiki', label: 'Wiki', icon: BookOpen },
  { to: '/colaboradores', label: 'Colaboradores', icon: Users },
  { to: '/organograma', label: 'Organograma', icon: Network },
  { to: '/calendario', label: 'Calendário', icon: Calendar },
  { to: '/drive', label: 'Drive', icon: FolderOpen },
  { to: '/formularios', label: 'Formulários', icon: ClipboardList },
  { to: '/assinatura', label: 'Assinatura', icon: FileSignature },
  { to: '/lousas', label: 'Quadro', icon: Square },
  { to: '/notas', label: 'Notas', icon: BookText },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/prestacao-contas', label: 'Prestação de Contas', icon: Receipt },
  { to: '/ranking', label: 'Ranking', icon: Trophy },
  { to: '/copiloto', label: 'Copiloto', icon: Sparkles },
  { to: '/gestao-ti', label: 'Gestão T.I.', icon: Activity },
  { to: '/ajuda', label: 'Ajuda', icon: HelpCircle },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
  { to: '/permissoes', label: 'Permissões', icon: Shield, adminOnly: true },
  { to: '/departamentos', label: 'Setores', icon: Building2, adminOnly: true },
  { to: '/logs', label: 'Logs', icon: ScrollText, adminOnly: true },
];

export const pageTitle = (path: string) => NAVIGATION.find(item => item.to === path)?.label || (path === '/perfil' ? 'Meu perfil' : 'REDE NEX');
export const navigationForRole = (role: string) => NAVIGATION.filter(item => !item.adminOnly || ['Administrador', 'Gestor'].includes(role));
