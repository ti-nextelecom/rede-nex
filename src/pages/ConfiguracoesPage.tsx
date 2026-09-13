import { useState, useEffect, useCallback } from 'react';
import { Settings, Eye, EyeOff, Shield, Building2, Users, ChevronRight, RefreshCw } from 'lucide-react';
import {
  LayoutDashboard, GraduationCap, Trophy, Calendar, HardDrive,
  ClipboardList, FileSignature, LayoutGrid, BarChart3, HelpCircle, Network,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/utils';
import { getNavSettings, updateNavSettings, resetNavSettings } from '../lib/navSettingsApi';
import type { NavSettings } from '../lib/navSettingsApi';

const ALL_MORE_ITEMS = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Treinamentos', to: '/treinamentos', icon: GraduationCap },
  { label: 'Colaboradores', to: '/colaboradores', icon: Users },
  { label: 'Ranking', to: '/ranking', icon: Trophy },
  { label: 'Calendário', to: '/calendario', icon: Calendar },
  { label: 'Drive', to: '/drive', icon: HardDrive },
  { label: 'Formulários', to: '/formularios', icon: ClipboardList },
  { label: 'Assinatura', to: '/assinatura', icon: FileSignature },
  { label: 'Quadro', to: '/lousas', icon: LayoutGrid },
  { label: 'Analytics', to: '/analytics', icon: BarChart3 },
  { label: 'Ajuda', to: '/ajuda', icon: HelpCircle },
  { label: 'Organograma', to: '/organograma', icon: Network },
];

const ROLES = ['Administrador', 'Gestor', 'Colaborador', 'Usuário'];

export function ConfiguracoesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const roleName = user?.roles?.name || user?.role_name || 'Usuário';
  const isAdmin = ['Administrador', 'Gestor'].includes(roleName);

  const [selectedRole, setSelectedRole] = useState('Gestor');
  const [settings, setSettings] = useState<NavSettings>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNavSettings();
      setSettings(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">Acesso restrito a administradores.</p>
      </div>
    );
  }

  const roleVis: string[] | null | undefined = settings[selectedRole];

  function isVisible(to: string) {
    if (roleVis === undefined || roleVis === null) return true;
    return roleVis.includes(to);
  }

  async function toggle(to: string) {
    setSaving(true);
    try {
      const current: string[] = roleVis !== null && roleVis !== undefined
        ? roleVis
        : ALL_MORE_ITEMS.map(i => i.to);
      const next = current.includes(to) ? current.filter(r => r !== to) : [...current, to];
      await updateNavSettings(selectedRole, next);
      setSettings(prev => ({ ...prev, [selectedRole]: next }));
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  async function reset() {
    setSaving(true);
    try {
      await resetNavSettings(selectedRole);
      setSettings(prev => { const s = { ...prev }; delete s[selectedRole]; return s; });
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-orange-100 rounded-xl">
          <Settings size={22} className="text-orange-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Configurações</h1>
          <p className="text-sm text-slate-500">Gerencie acessos, grupos e visibilidade do menu</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Grupos de Permissão', desc: 'Criar e editar grupos', icon: Shield, to: '/permissoes', bg: 'bg-red-50', fg: 'text-red-700' },
          { label: 'Setores', desc: 'Departamentos da empresa', icon: Building2, to: '/departamentos', bg: 'bg-orange-50', fg: 'text-orange-700' },
          { label: 'Colaboradores', desc: 'Gerenciar usuários', icon: Users, to: '/colaboradores', bg: 'bg-emerald-50', fg: 'text-emerald-700' },
        ].map(item => (
          <button key={item.to} onClick={() => navigate(item.to)}
            className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:border-orange-300 hover:bg-orange-50/30 transition-all text-left group">
            <div className={cn('p-2 rounded-lg', item.bg)}>
              <item.icon size={18} className={item.fg} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">{item.label}</p>
              <p className="text-xs text-slate-500">{item.desc}</p>
            </div>
            <ChevronRight size={16} className="text-slate-400 group-hover:text-orange-500 transition-colors" />
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Visibilidade do Menu por Grupo</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure quais itens do menu "Mais" cada grupo pode ver. Feed, Bate-papo, Wiki e Tarefas são sempre visíveis.
            </p>
          </div>
          <button onClick={loadSettings} disabled={loading} className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-slate-100 flex gap-2 flex-wrap">
          {ROLES.map(role => (
            <button key={role} onClick={() => setSelectedRole(role)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                selectedRole === role ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
              {role}
            </button>
          ))}
        </div>

        {selectedRole === 'Administrador' ? (
          <div className="px-5 py-8 text-center">
            <Shield size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-500 font-medium">Administradores sempre veem todos os itens do menu.</p>
          </div>
        ) : loading ? (
          <div className="px-5 py-8 text-center text-slate-400 text-sm">Carregando...</div>
        ) : (
          <>
            <div className={cn('divide-y divide-slate-50 transition-opacity', saving && 'opacity-60 pointer-events-none')}>
              {ALL_MORE_ITEMS.map(item => {
                const visible = isVisible(item.to);
                return (
                  <div key={item.to} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60 transition-colors">
                    <item.icon size={15} className="text-slate-400 flex-shrink-0" />
                    <span className="text-sm text-slate-700 flex-1">{item.label}</span>
                    <button onClick={() => toggle(item.to)}
                      className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[32px]',
                        visible ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}>
                      {visible ? <><Eye size={12} />Visível</> : <><EyeOff size={12} />Oculto</>}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                {roleVis != null
                  ? `${roleVis.length} de ${ALL_MORE_ITEMS.length} itens visíveis`
                  : 'Todos os itens visíveis (padrão)'}
              </p>
              {roleVis != null && (
                <button onClick={reset} disabled={saving}
                  className="text-xs text-orange-600 font-medium hover:underline disabled:opacity-40">
                  Restaurar padrão
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
