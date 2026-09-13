import { useState, useEffect } from 'react';
import { Shield, Check, X, Info, CheckCircle2, RotateCcw } from 'lucide-react';
import { Card } from '../components/ui/card';

const ROLES = [
  { name: 'Administrador', description: 'Controle total do sistema', color: 'bg-red-100 text-red-700' },
  { name: 'Gestor', description: 'Gerenciamento do setor e publicações', color: 'bg-blue-100 text-blue-700' },
  { name: 'Editor', description: 'Pode criar e editar conteúdos', color: 'bg-amber-100 text-amber-700' },
  { name: 'Colaborador', description: 'Somente visualização e interação', color: 'bg-green-100 text-green-700' },
];

const MODULES = [
  { key: 'feed', label: 'Feed', actions: ['view', 'create', 'edit', 'delete', 'pin'] },
  { key: 'training', label: 'Treinamentos', actions: ['view', 'create', 'edit', 'delete', 'enroll'] },
  { key: 'wiki', label: 'Wiki', actions: ['view', 'create', 'edit', 'delete', 'publish'] },
  { key: 'users', label: 'Colaboradores', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'departments', label: 'Setores', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'permissions', label: 'Permissões', actions: ['view', 'edit'] },
];

const ACTION_LABELS: Record<string, string> = {
  view: 'Visualizar',
  create: 'Criar',
  edit: 'Editar',
  delete: 'Excluir',
  pin: 'Fixar',
  enroll: 'Matricular',
  publish: 'Publicar',
};

type PermMatrix = Record<string, Record<string, Record<string, boolean>>>;

const ALL_ACTIONS = ['view', 'create', 'edit', 'delete', 'pin', 'enroll', 'publish'];

function buildDefaults(): PermMatrix {
  const matrix: PermMatrix = {
    Administrador: {},
    Gestor: {},
    Editor: {},
    Colaborador: {},
  };

  for (const m of MODULES) {
    matrix.Administrador[m.key] = Object.fromEntries(m.actions.map(a => [a, true]));

    matrix.Gestor[m.key] = Object.fromEntries(
      m.actions.map(a => [a, a !== 'delete' || ['feed', 'wiki', 'training'].includes(m.key)])
    );
    matrix.Gestor.permissions = { view: true, edit: false };

    matrix.Editor[m.key] = Object.fromEntries(
      m.actions.map(a => [a, ['view', 'create', 'edit'].includes(a)])
    );
    matrix.Editor.permissions = { view: true, edit: false };

    matrix.Colaborador[m.key] = Object.fromEntries(
      m.actions.map(a => [a, a === 'view'])
    );
    matrix.Colaborador.permissions = { view: false, edit: false };
  }

  return matrix;
}

const STORAGE_KEY = 'rede_nex_permissions_v1';

function loadPermissions(): PermMatrix {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return buildDefaults();
}

export function Permissions() {
  const [selectedRole, setSelectedRole] = useState('Administrador');
  const [permissions, setPermissions] = useState<PermMatrix>(loadPermissions);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (saved) {
      const t = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(t);
    }
  }, [saved]);

  function toggle(module: string, action: string) {
    if (selectedRole === 'Administrador') return;
    setPermissions(prev => ({
      ...prev,
      [selectedRole]: {
        ...prev[selectedRole],
        [module]: {
          ...prev[selectedRole][module],
          [action]: !prev[selectedRole][module]?.[action],
        },
      },
    }));
  }

  function handleSave() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(permissions));
      setSaved(true);
    } catch {}
  }

  function handleReset() {
    const defaults = buildDefaults();
    setPermissions(defaults);
    localStorage.removeItem(STORAGE_KEY);
  }

  const currentPerms = permissions[selectedRole] ?? {};

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Permissões (RBAC)</h1>
          <p className="text-sm text-slate-500 mt-0.5">Controle de acesso baseado em perfis</p>
        </div>
        {saved && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs font-medium">
            <CheckCircle2 size={13} />
            Permissões salvas
          </div>
        )}
      </div>

      {/* Role cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {ROLES.map(role => (
          <button
            key={role.name}
            onClick={() => setSelectedRole(role.name)}
            className={`text-left p-4 rounded-xl border transition-all duration-150 ${
              selectedRole === role.name
                ? 'border-orange-400 shadow-md shadow-orange-100 bg-orange-50'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg ${role.color.replace('text-', 'bg-').split(' ')[0]} bg-opacity-20`}>
                <Shield size={14} className={role.color.split(' ')[1]} />
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${role.color}`}>
                {role.name}
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">{role.description}</p>
          </button>
        ))}
      </div>

      {selectedRole === 'Administrador' ? (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
          <Info size={14} className="text-blue-500 flex-shrink-0" />
          <p className="text-xs text-blue-700">O Administrador possui todas as permissões e não pode ser editado.</p>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg">
          <Info size={14} className="text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            As permissões definem o que cada perfil pode fazer na plataforma.
            Clique nos botões para alternar e salve para aplicar.
          </p>
        </div>
      )}

      {/* Permission matrix */}
      <Card className="border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Shield size={15} className="text-orange-500" />
          <h2 className="text-sm font-semibold text-slate-800">
            Permissões do Perfil: <span className="text-orange-600">{selectedRole}</span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Módulo</th>
                {ALL_ACTIONS.map(action => (
                  <th key={action} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center whitespace-nowrap">
                    {ACTION_LABELS[action]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {MODULES.map(module => (
                <tr key={module.key} className="hover:bg-slate-50/70">
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-medium text-slate-800">{module.label}</span>
                  </td>
                  {ALL_ACTIONS.map(action => {
                    const hasAction = module.actions.includes(action);
                    if (!hasAction) {
                      return (
                        <td key={action} className="px-4 py-3.5 text-center">
                          <span className="text-slate-200">—</span>
                        </td>
                      );
                    }
                    const allowed = currentPerms[module.key]?.[action] ?? false;
                    return (
                      <td key={action} className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => toggle(module.key, action)}
                          disabled={selectedRole === 'Administrador'}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center mx-auto transition-all duration-150 ${
                            allowed
                              ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                              : 'bg-red-50 text-red-400 hover:bg-red-100'
                          } ${selectedRole === 'Administrador' ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          {allowed ? <Check size={13} strokeWidth={2.5} /> : <X size={13} strokeWidth={2.5} />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <button
          onClick={handleReset}
          className="h-9 px-4 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2"
        >
          <RotateCcw size={13} />
          Restaurar padrão
        </button>
        <button
          onClick={handleSave}
          className="h-9 px-4 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors"
        >
          Salvar alterações
        </button>
      </div>
    </div>
  );
}
