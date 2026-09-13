import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, HelpCircle, Search, BookOpen, MessageCircle, ListTodo, Smartphone, Star, Calendar, GraduationCap, TicketCheck, Send, AlertTriangle, Monitor, Download } from 'lucide-react';
import { useAuth } from '../lib/auth';

const FAQ: { category: string; icon: React.ElementType; items: { q: string; a: string }[] }[] = [
  {
    category: 'Feed',
    icon: BookOpen,
    items: [
      { q: 'Como criar uma publicação?', a: 'No Feed, clique no campo "O que está acontecendo?" e selecione o tipo (Comunicado, Evento ou Publicação). Adicione o conteúdo e clique em Publicar.' },
      { q: 'Quais tipos de post existem?', a: 'Comunicado (informações oficiais), Evento (convites e agendas) e Publicação (conteúdo geral). Enquetes são criadas diretamente pelo botão Enquete.' },
      { q: 'Como reagir a uma publicação?', a: 'Passe o mouse sobre o botão de reação e escolha entre Curtir, Amei, Parabéns ou Perspicaz.' },
    ]
  },
  {
    category: 'Wiki',
    icon: BookOpen,
    items: [
      { q: 'Como criar um artigo na Wiki?', a: 'Acesse a Wiki pelo menu lateral, clique em "Novo artigo", escolha a categoria e preencha título e conteúdo.' },
      { q: 'O que significa "Validar" um artigo?', a: 'Validar confirma que o conteúdo é correto e útil — é uma forma de aprovação de qualidade do artigo.' },
      { q: 'O que são Comentários e Sugestões?', a: 'A seção de Comentários e Sugestões permite que colaboradores adicionem observações, correções ou melhorias ao artigo.' },
      { q: 'Como funciona o histórico de versões?', a: 'Todo artigo salvo cria uma nova versão. Clique em "Histórico" no menu do artigo para ver versões anteriores.' },
    ]
  },
  {
    category: 'Tarefas',
    icon: ListTodo,
    items: [
      { q: 'Como criar uma tarefa?', a: 'Acesse o módulo Tarefas e clique em "Nova Tarefa". Preencha título, descrição, prazo, prioridade e responsáveis.' },
      { q: 'O que são checklists?', a: 'Checklists são listas de itens dentro de uma tarefa. Adicione múltiplos checklists com itens e marque conforme avança.' },
      { q: 'Quais são as prioridades?', a: 'Baixa, Normal, Alta e Urgente. Use Urgente para tarefas críticas que precisam de atenção imediata.' },
      { q: 'O que é a aba Minhas Listas?', a: 'Minhas Listas permite criar grupos personalizados de tarefas com nomes definidos por você.' },
    ]
  },
  {
    category: 'Bate-papo',
    icon: MessageCircle,
    items: [
      { q: 'Como criar um grupo?', a: 'No Bate-papo, clique em "Novo grupo", adicione o nome, selecione os participantes e confirme.' },
      { q: 'Como mencionar alguém?', a: 'Digite @ seguido do nome da pessoa. Um menu aparecerá com as sugestões.' },
      { q: 'Como fixar uma conversa?', a: 'Mantenha pressionado (mobile) ou clique com botão direito (desktop) na conversa e escolha "Fixar".' },
    ]
  },
  {
    category: 'Calendário',
    icon: Calendar,
    items: [
      { q: 'Quais visualizações estão disponíveis?', a: 'Mensal (visão do mês completo) e Semanal (visão da semana). Alterne pelo seletor no topo da página.' },
      { q: 'Como criar um evento?', a: 'Clique em qualquer dia do calendário ou no botão "Novo Evento". Preencha título, data/hora, local e participantes.' },
    ]
  },
  {
    category: 'Gamificação',
    icon: Star,
    items: [
      { q: 'Como ganho XP?', a: 'Criando posts, completando tarefas, adicionando artigos na Wiki, participando de treinamentos e outras ações na plataforma.' },
      { q: 'O que são as missões?', a: 'Missões são desafios específicos que rendem XP extra. Veja-as no seu Perfil → Missões.' },
      { q: 'O que são ranks?', a: 'Ranks são níveis de progressão baseados no XP acumulado. Quanto mais XP, maior o rank.' },
    ]
  },
  {
    category: 'Treinamentos',
    icon: GraduationCap,
    items: [
      { q: 'Como iniciar um treinamento?', a: 'Acesse Treinamentos no menu, escolha o módulo desejado e clique em "Iniciar". Seu progresso é salvo automaticamente.' },
      { q: 'Ganho XP por treinamentos?', a: 'Sim! Completar módulos de treinamento rende pontos XP que contribuem para o seu ranking.' },
    ]
  },
];

type Tipo = 'helpdesk' | 'correcao' | 'desenvolvimento';

const TIPOS: { value: Tipo; label: string; desc: string; icon: string }[] = [
  { value: 'helpdesk',      label: 'Helpdesk',       desc: 'Suporte técnico, hardware, software', icon: '🖥️' },
  { value: 'correcao',      label: 'Correção',        desc: 'Erro em sistema ou ferramenta', icon: '🔧' },
  { value: 'desenvolvimento', label: 'Desenvolvimento', desc: 'Nova funcionalidade ou melhoria', icon: '💻' },
];

function ChamadoForm() {
  const { user } = useAuth();
  const [tipo, setTipo] = useState<Tipo>('helpdesk');
  const [descricao, setDescricao] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ sucesso: boolean; id_chamado?: number; titulo?: string; categoria?: string; prazo?: string; erro?: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!descricao.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/ajuda/chamado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, descricao: descricao.trim(), urgente }),
      });
      const data = await res.json();
      if (res.ok && data.sucesso) {
        setResult({ sucesso: true, ...data });
        setDescricao('');
        setUrgente(false);
        setTipo('helpdesk');
      } else {
        setResult({ sucesso: false, erro: data.error?.message || data.message || 'Erro ao abrir chamado' });
      }
    } catch {
      setResult({ sucesso: false, erro: 'Erro de conexão. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Tipo do chamado</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TIPOS.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTipo(t.value)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                tipo === t.value
                  ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="text-2xl mb-1">{t.icon}</div>
              <div className="font-semibold text-sm text-slate-800 dark:text-slate-200">{t.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
          Descrição do problema <span className="text-red-500">*</span>
        </label>
        <textarea
          value={descricao}
          onChange={e => setDescricao(e.target.value)}
          placeholder="Descreva o problema ou solicitação com o máximo de detalhes possível..."
          rows={4}
          required
          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900/30 transition-all resize-none"
        />
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setUrgente(v => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors ${urgente ? 'bg-red-500' : 'bg-slate-300 dark:bg-slate-600'}`}
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${urgente ? 'translate-x-6' : 'translate-x-1'}`} />
          </div>
          <div>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Urgente</span>
            <span className="ml-2 text-xs text-slate-500">Alta prioridade</span>
          </div>
        </label>

        <button
          type="submit"
          disabled={loading || !descricao.trim()}
          className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Send size={14} />
          {loading ? 'Enviando...' : 'Abrir Chamado'}
        </button>
      </div>

      {result && (
        <div className={`p-4 rounded-xl border ${result.sucesso ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
          {result.sucesso ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <TicketCheck size={16} className="text-green-600 dark:text-green-400" />
                <span className="font-bold text-green-800 dark:text-green-300">Chamado aberto com sucesso!</span>
              </div>
              <p className="text-2xl font-black text-green-700 dark:text-green-300">#{result.id_chamado}</p>
              <p className="text-sm text-green-700 dark:text-green-400 mt-1">{result.titulo}</p>
              <p className="text-xs text-green-600 dark:text-green-500 mt-1">Prazo: {result.prazo} · Categoria: {result.categoria}</p>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-semibold text-red-800 dark:text-red-300">Erro ao abrir chamado</span>
                <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">{result.erro}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  );
}

export function AjudaPage() {
  const [tab, setTab] = useState<'faq' | 'chamado'>('faq');
  const [search, setSearch] = useState('');
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installDone, setInstallDone] = useState(false);

  useEffect(() => {
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);
    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') { setInstallDone(true); setInstallPrompt(null); }
  }

  const filtered = FAQ.map(cat => ({
    ...cat,
    items: cat.items.filter(item =>
      !search ||
      item.q.toLowerCase().includes(search.toLowerCase()) ||
      item.a.toLowerCase().includes(search.toLowerCase())
    )
  })).filter(cat => cat.items.length > 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-12 w-12 rounded-2xl bg-orange-100 flex items-center justify-center">
          <HelpCircle size={24} className="text-orange-500" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">Central de Ajuda</h1>
          <p className="text-sm text-slate-500">Encontre respostas ou abra um chamado para o TI</p>
        </div>
      </div>

      {/* Download Rede Nex Desktop */}
      <a
        href="https://rede.nextelecom.net.br/api/downloads/Rede%20Nex%20Setup%201.0.4.exe"
        download
        className="flex items-center gap-4 p-4 mb-3 rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors no-underline group"
      >
        <div className="h-11 w-11 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
          <Monitor size={22} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">Rede Nex Desktop</span>
            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300">v1.0.4</span>
            <span className="text-xs text-slate-500">Windows</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Aplicativo desktop para acessar o sistema internamente</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 group-hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex-shrink-0">
          <Download size={13} />
          Baixar
        </div>
      </a>

      {/* Mobile install card */}
      <div className="flex items-center gap-4 p-4 mb-6 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/20">
        <div className="h-11 w-11 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0">
          <Smartphone size={22} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">Rede Nex Mobile</span>
            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300">v1.0.4</span>
            <span className="text-xs text-slate-500">Android · iOS</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {isStandalone || installDone
              ? 'App instalado na tela inicial'
              : 'Instale na tela inicial sem precisar de loja de apps'}
          </p>
        </div>
        {isStandalone || installDone ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex-shrink-0">
            ✓ Instalado
          </span>
        ) : installPrompt ? (
          <button
            onClick={handleInstall}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors flex-shrink-0"
          >
            <Download size={13} />
            Instalar
          </button>
        ) : (
          <span className="text-[11px] text-slate-500 flex-shrink-0 text-center leading-tight max-w-[90px]">
            No Chrome: ⋮ → Instalar app
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-6">
        <button
          onClick={() => setTab('faq')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all ${tab === 'faq' ? 'bg-white dark:bg-slate-700 text-orange-500 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          <HelpCircle size={15} />
          Perguntas Frequentes
        </button>
        <button
          onClick={() => setTab('chamado')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all ${tab === 'chamado' ? 'bg-white dark:bg-slate-700 text-orange-500 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          <TicketCheck size={15} />
          Abrir Chamado TI
        </button>
      </div>

      {tab === 'faq' && (
        <>
          <div className="relative mb-8">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar dúvidas..."
              className="w-full pl-9 pr-4 h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all text-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="space-y-6">
            {filtered.map(cat => (
              <div key={cat.category}>
                <div className="flex items-center gap-2 mb-3">
                  <cat.icon size={15} className="text-orange-500" />
                  <h2 className="font-bold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">{cat.category}</h2>
                </div>
                <div className="space-y-2">
                  {cat.items.map((item, i) => {
                    const key = `${cat.category}-${i}`;
                    const isOpen = openItem === key;
                    return (
                      <div key={key} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800">
                        <button
                          onClick={() => setOpenItem(isOpen ? null : key)}
                          className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
                        >
                          <span className="font-medium text-slate-800 dark:text-slate-200 text-sm pr-4">{item.q}</span>
                          {isOpen
                            ? <ChevronUp size={15} className="text-orange-400 flex-shrink-0" />
                            : <ChevronDown size={15} className="text-slate-400 flex-shrink-0" />}
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-4 pt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                            {item.a}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <HelpCircle size={44} className="mx-auto mb-3 opacity-25" />
                <p className="font-medium">Nenhum resultado para "{search}"</p>
                <p className="text-sm mt-1">Tente outros termos ou abra um chamado para o TI</p>
              </div>
            )}
          </div>

          <div className="mt-10 p-6 bg-orange-50 dark:bg-orange-900/20 rounded-2xl border border-orange-100 dark:border-orange-800">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1.5">Ainda com dúvidas?</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              Não encontrou o que precisava? Abra um chamado direto para o time de TI.
            </p>
            <button
              onClick={() => setTab('chamado')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <TicketCheck size={14} />
              Abrir Chamado TI
            </button>
          </div>
        </>
      )}

      {tab === 'chamado' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <TicketCheck size={20} className="text-orange-500" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 dark:text-slate-200">Abrir Chamado para o TI</h2>
              <p className="text-xs text-slate-500">Prazo de atendimento: até 24h úteis</p>
            </div>
          </div>
          <ChamadoForm />
        </div>
      )}
    </div>
  );
}
