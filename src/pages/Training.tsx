import { useEffect, useState } from 'react';
import {
  GraduationCap, Search, Clock, ChevronRight, Play, BookOpen,
  TrendingUp, CheckCircle2, Award, Star,
  Wrench, Network, DollarSign, Headphones, Server, Users,
  Plus, Pencil, Trash2, X, ExternalLink,
} from 'lucide-react';
import { getTrainingData, getAllTrainings, createTraining, updateTraining, deleteTraining, saveTrainingProgress, getTrainingProgress } from '../lib/appApi';
import type { CreateTrainingInput } from '../lib/appApi';
import { Card } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { Progress } from '../components/ui/progress';
import { useAuth } from '../lib/auth';
import { dispatchXPEvent } from '../lib/xpEvents';
import type { Training, Category } from '../types';

const ADMIN_ROLES = ['Administrador', 'Gestor'];

const CATEGORY_ICONS: Record<string, typeof Wrench> = {
  'Suporte Técnico': Wrench,
  'NOC': Network,
  'Comercial': TrendingUp,
  'Financeiro': DollarSign,
  'CSC': Headphones,
  'Infraestrutura': Server,
  'Recursos Humanos': Users,
};

const LEVEL_CONFIG = {
  beginner: { label: 'Iniciante', color: 'bg-emerald-100 text-emerald-700' },
  intermediate: { label: 'Intermediário', color: 'bg-amber-100 text-amber-700' },
  advanced: { label: 'Avançado', color: 'bg-red-100 text-red-700' },
};

interface TrainingWithProgress extends Training {
  _progress: number;
  _completed: boolean;
}

function getEmbedInfo(url: string): { embedUrl: string; type: 'youtube' | 'drive' | 'vimeo' | 'direct' | null } {
  if (!url) return { embedUrl: '', type: null };

  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch) return { embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`, type: 'youtube' };

  const driveViewMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveViewMatch) return { embedUrl: `https://drive.google.com/file/d/${driveViewMatch[1]}/preview`, type: 'drive' };

  const driveOpenMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (driveOpenMatch) return { embedUrl: `https://drive.google.com/file/d/${driveOpenMatch[1]}/preview`, type: 'drive' };

  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return { embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`, type: 'vimeo' };

  return { embedUrl: url, type: 'direct' };
}

function TrainingForm({
  training,
  categories,
  onSave,
  onClose,
}: {
  training?: Training | null;
  categories: Category[];
  onSave: (t: Training) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<CreateTrainingInput>({
    title: training?.title ?? '',
    description: training?.description ?? '',
    category_id: training?.category_id ?? '',
    video_url: training?.video_url ?? '',
    pdf_url: training?.pdf_url ?? '',
    duration_minutes: training?.duration_minutes ?? 30,
    level: training?.level ?? 'beginner',
    status: training?.status ?? 'published',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title?.trim()) { setError('Título é obrigatório'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, category_id: form.category_id || undefined };
      const saved = training
        ? await updateTraining(training.id, payload)
        : await createTraining(payload);
      onSave(saved);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800">
            {training ? 'Editar Treinamento' : 'Novo Treinamento'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">Título *</label>
            <input
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Nome do treinamento"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">Descrição</label>
            <textarea
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 resize-none"
              rows={3}
              value={form.description ?? ''}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Descrição breve do conteúdo"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">
              Link de Vídeo / Conteúdo
            </label>
            <input
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
              value={form.video_url ?? ''}
              onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))}
              placeholder="https://drive.google.com/... ou https://youtube.com/..."
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Google Drive, YouTube, Vimeo ou link direto — reproduzido inline
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">Link PDF / Material</label>
            <input
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
              value={form.pdf_url ?? ''}
              onChange={e => setForm(f => ({ ...f, pdf_url: e.target.value }))}
              placeholder="https://drive.google.com/... ou link direto .pdf"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Categoria</label>
              <select
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400/30"
                value={form.category_id ?? ''}
                onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
              >
                <option value="">Sem categoria</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Nível</label>
              <select
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400/30"
                value={form.level}
                onChange={e => setForm(f => ({ ...f, level: e.target.value as Training['level'] }))}
              >
                <option value="beginner">Iniciante</option>
                <option value="intermediate">Intermediário</option>
                <option value="advanced">Avançado</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Duração (min)</label>
              <input
                type="number"
                min={1}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30"
                value={form.duration_minutes}
                onChange={e => setForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) || 30 }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Status</label>
              <select
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400/30"
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as Training['status'] }))}
              >
                <option value="published">Publicado</option>
                <option value="draft">Rascunho</option>
                <option value="archived">Arquivado</option>
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-9 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Training() {
  const { user } = useAuth();
  const isAdmin = ADMIN_ROLES.includes(user?.role_name ?? '');

  const [trainings, setTrainings] = useState<TrainingWithProgress[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedTraining, setSelectedTraining] = useState<TrainingWithProgress | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [isAdmin]);

  async function loadData() {
    const data = isAdmin ? await getAllTrainings() : await getTrainingData();
    setTrainings(data.trainings.map(t => ({ ...t, _progress: 0, _completed: false })));
    setCategories(data.categories);
    setLoading(false);
  }

  function handleSaved(saved: Training) {
    setTrainings(prev => {
      const exists = prev.find(t => t.id === saved.id);
      if (exists) return prev.map(t => t.id === saved.id ? { ...saved, _progress: t._progress, _completed: t._completed } : t);
      return [{ ...saved, _progress: 0, _completed: false }, ...prev];
    });
    setShowForm(false);
    setEditingTraining(null);
  }

  async function handleDelete(id: string) {
    await deleteTraining(id);
    setTrainings(prev => prev.filter(t => t.id !== id));
    setDeleteConfirm(null);
    if (selectedTraining?.id === id) setSelectedTraining(null);
  }

  const stats = {
    total: trainings.filter(t => t.status === 'published').length,
    completed: trainings.filter(t => t._completed).length,
    inProgress: trainings.filter(t => t._progress > 0 && !t._completed).length,
    pending: trainings.filter(t => t._progress === 0 && !t._completed && t.status === 'published').length,
  };

  const filtered = trainings.filter(t => {
    if (!isAdmin && t.status !== 'published') return false;
    const cat = t.categories;
    const matchCat = selectedCategory === 'all' || cat?.name === selectedCategory;
    const matchLevel = selectedLevel === 'all' || t.level === selectedLevel;
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.description?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchLevel && matchSearch;
  });

  if (selectedTraining) {
    return (
      <TrainingDetail
        training={selectedTraining}
        onBack={() => setSelectedTraining(null)}
        isAdmin={isAdmin}
        onEdit={t => { setEditingTraining(t); setShowForm(true); }}
        onDelete={id => setDeleteConfirm(id)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {(showForm || editingTraining) && (
        <TrainingForm
          training={editingTraining}
          categories={categories}
          onSave={handleSaved}
          onClose={() => { setShowForm(false); setEditingTraining(null); }}
        />
      )}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="text-base font-bold text-slate-800 mb-2">Excluir treinamento?</h3>
            <p className="text-sm text-slate-500 mb-5">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 h-9 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 h-9 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold">Excluir</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Treinamentos</h1>
          <p className="text-sm text-slate-500 mt-0.5">Portal de capacitação dos colaboradores</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setEditingTraining(null); setShowForm(true); }}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors"
          >
            <Plus size={14} /> Novo
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, icon: GraduationCap, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Concluídos', value: stats.completed, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Em Progresso', value: stats.inProgress, icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Pendentes', value: stats.pending, icon: Clock, color: 'text-slate-600', bg: 'bg-slate-50' },
        ].map(s => (
          <Card key={s.label} className="p-4 border-slate-200">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.bg}`}>
                <s.icon size={18} className={s.color} />
              </div>
              <div>
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className="text-2xl font-bold text-slate-800">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-5 border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Award size={16} className="text-orange-500" />
            <span className="text-sm font-semibold text-slate-800">Seu Progresso Geral</span>
          </div>
          <span className="text-sm font-bold text-orange-600">
            {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
          </span>
        </div>
        <Progress value={stats.total > 0 ? (stats.completed / stats.total) * 100 : 0} className="h-2.5" />
        <p className="text-xs text-slate-500 mt-2">
          {stats.completed} de {stats.total} treinamentos concluídos
        </p>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar treinamentos..."
            className="w-full pl-9 pr-4 h-9 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          value={selectedLevel}
          onChange={e => setSelectedLevel(e.target.value)}
          className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400/30"
        >
          <option value="all">Todos os níveis</option>
          <option value="beginner">Iniciante</option>
          <option value="intermediate">Intermediário</option>
          <option value="advanced">Avançado</option>
        </select>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
            selectedCategory === 'all'
              ? 'bg-orange-500 text-white border-orange-500'
              : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'
          }`}
        >
          <GraduationCap size={11} /> Todos
        </button>
        {categories.map(cat => {
          const Icon = CATEGORY_ICONS[cat.name] || BookOpen;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.name)}
              className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                selectedCategory === cat.name
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'
              }`}
            >
              <Icon size={11} /> {cat.name}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="border-slate-200 overflow-hidden">
                <Skeleton className="h-36 w-full" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </Card>
            ))
          : filtered.map(training => {
              const cat = training.categories;
              const levelConf = LEVEL_CONFIG[training.level];
              const Icon = cat?.name ? CATEGORY_ICONS[cat.name] || BookOpen : BookOpen;
              const isDraft = training.status !== 'published';

              return (
                <Card
                  key={training.id}
                  className={`border-slate-200 overflow-hidden hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer relative ${isDraft ? 'opacity-70' : ''}`}
                  onClick={() => setSelectedTraining(training)}
                >
                  {isDraft && (
                    <div className="absolute top-2 left-2 z-10">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-700 text-white">
                        {training.status === 'draft' ? 'Rascunho' : 'Arquivado'}
                      </span>
                    </div>
                  )}
                  {isAdmin && (
                    <div className="absolute top-2 right-2 z-10 flex gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => { setEditingTraining(training); setShowForm(true); }}
                        className="w-6 h-6 rounded-md bg-white/90 hover:bg-white shadow flex items-center justify-center text-slate-600 hover:text-orange-600 transition-colors"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(training.id)}
                        className="w-6 h-6 rounded-md bg-white/90 hover:bg-white shadow flex items-center justify-center text-slate-600 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )}
                  <div
                    className="h-36 flex items-center justify-center relative"
                    style={{ background: `linear-gradient(135deg, ${cat?.color || '#ff7a00'}22, ${cat?.color || '#ff7a00'}44)` }}
                  >
                    <Icon size={48} style={{ color: cat?.color || '#ff7a00' }} className="opacity-70" />
                    {training._completed && (
                      <div className="absolute top-2 right-2">
                        <div className="flex items-center gap-1 bg-emerald-500 text-white text-[10px] font-medium px-2 py-1 rounded-full">
                          <CheckCircle2 size={9} /> Concluído
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-200">
                      <div className="h-full bg-emerald-500 transition-all" style={{ width: `${training._progress}%` }} />
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">{training.title}</h3>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 mb-3">{training.description}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${levelConf.color}`}>
                        {levelConf.label}
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock size={9} /> {training.duration_minutes}min
                      </span>
                      {training._progress > 0 && !training._completed && (
                        <span className="text-[10px] text-orange-600 ml-auto font-medium">{training._progress}%</span>
                      )}
                    </div>
                    <button className="mt-3 w-full flex items-center justify-center gap-2 h-8 rounded-lg text-xs font-semibold transition-colors bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white">
                      <Play size={11} fill="currentColor" />
                      {training._progress > 0 ? 'Continuar' : 'Iniciar Treinamento'}
                    </button>
                  </div>
                </Card>
              );
            })}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16">
          <GraduationCap size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">Nenhum treinamento encontrado</p>
          <p className="text-slate-400 text-sm mt-1">Tente ajustar os filtros</p>
        </div>
      )}
    </div>
  );
}

function TrainingDetail({
  training,
  onBack,
  isAdmin,
  onEdit,
  onDelete,
}: {
  training: TrainingWithProgress;
  onBack: () => void;
  isAdmin: boolean;
  onEdit: (t: Training) => void;
  onDelete: (id: string) => void;
}) {
  const [progress, setProgress] = useState(training._progress);
  const [savingProgress, setSavingProgress] = useState(false);

  useEffect(() => {
    getTrainingProgress(training.id).then(p => {
      if (p.progress_pct > training._progress) setProgress(p.progress_pct);
    }).catch(() => {});
  }, [training.id, training._progress]);
  const [activeTab, setActiveTab] = useState<'video' | 'pdf'>('video');
  const levelConf = LEVEL_CONFIG[training.level];
  const cat = training.categories;

  const videoEmbed = getEmbedInfo(training.video_url ?? '');
  const pdfEmbed = getEmbedInfo(training.pdf_url ?? '');
  const hasVideo = videoEmbed.type !== null;
  const hasPdf = pdfEmbed.type !== null;

  const checklist = [
    { label: 'Assista ao vídeo introdutório', done: progress >= 25 },
    { label: 'Leia o material complementar', done: progress >= 50 },
    { label: 'Complete os exercícios práticos', done: progress >= 75 },
    { label: 'Faça a avaliação final', done: progress >= 100 },
  ];

  const currentEmbed = activeTab === 'pdf' ? pdfEmbed : videoEmbed;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ChevronRight size={14} className="rotate-180" /> Voltar para Treinamentos
        </button>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => onEdit(training)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Pencil size={12} /> Editar
            </button>
            <button
              onClick={() => onDelete(training.id)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-red-200 text-xs text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={12} /> Excluir
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {/* Tab bar for video/pdf */}
          {(hasVideo || hasPdf) && (
            <div className="flex gap-2">
              {hasVideo && (
                <button
                  onClick={() => setActiveTab('video')}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                    activeTab === 'video'
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'
                  }`}
                >
                  <Play size={11} fill="currentColor" /> Vídeo
                </button>
              )}
              {hasPdf && (
                <button
                  onClick={() => setActiveTab('pdf')}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                    activeTab === 'pdf'
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'
                  }`}
                >
                  <BookOpen size={11} /> Material PDF
                </button>
              )}
            </div>
          )}

          {/* Embed player */}
          <Card className="border-slate-200 overflow-hidden">
            {currentEmbed.type !== null ? (
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  src={currentEmbed.embedUrl}
                  className="absolute inset-0 w-full h-full"
                  allowFullScreen
                  allow="autoplay; encrypted-media; fullscreen"
                  loading="lazy"
                  title={training.title}
                />
              </div>
            ) : (
              <div
                className="h-64 flex flex-col items-center justify-center gap-3"
                style={{ background: `linear-gradient(135deg, ${cat?.color || '#ff7a00'}22, ${cat?.color || '#ff7a00'}44)` }}
              >
                <div className="w-16 h-16 rounded-full bg-white/80 flex items-center justify-center shadow-lg">
                  <Play size={24} className="text-orange-500 ml-1" fill="currentColor" />
                </div>
                <p className="text-sm text-slate-600 bg-white/70 px-3 py-1 rounded-full">
                  Nenhum conteúdo vinculado
                </p>
                {isAdmin && (
                  <button
                    onClick={() => onEdit(training)}
                    className="text-xs text-orange-600 underline"
                  >
                    Adicionar link de vídeo ou material
                  </button>
                )}
              </div>
            )}
          </Card>

          {/* Open external link fallback */}
          {currentEmbed.type !== null && (
            <div className="flex justify-end">
              <a
                href={activeTab === 'pdf' ? (training.pdf_url ?? '') : (training.video_url ?? '')}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                <ExternalLink size={11} /> Abrir no navegador
              </a>
            </div>
          )}

          <Card className="p-5 border-slate-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-lg font-bold text-slate-800">{training.title}</h1>
                <p className="text-sm text-slate-500 mt-1">{training.description}</p>
              </div>
              <span className={`flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${levelConf.color}`}>
                {levelConf.label}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
              <span className="flex items-center gap-1"><Clock size={12} /> {training.duration_minutes} minutos</span>
              <span className="flex items-center gap-1"><BookOpen size={12} /> {cat?.name}</span>
              <span className="flex items-center gap-1"><Star size={12} /> 4.8 (24 avaliações)</span>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5 border-slate-200">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Seu Progresso</h3>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500">Conclusão</span>
              <span className="text-sm font-bold text-orange-600">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2.5 mb-4" />
            {training._completed ? (
              <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
                <CheckCircle2 size={14} />
                <span className="text-xs font-medium">Treinamento concluído!</span>
              </div>
            ) : (
              <button
                onClick={async () => {
                  if (savingProgress) return;
                  const newPct = Math.min(100, progress + 25);
                  setProgress(newPct);
                  setSavingProgress(true);
                  try {
                    const result = await saveTrainingProgress(training.id, newPct);
                    if (result?.gamification) dispatchXPEvent(result.gamification);
                  } catch { /* ignore */ } finally { setSavingProgress(false); }
                }}
                className="w-full h-9 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Play size={13} fill="currentColor" />
                {progress > 0 ? 'Continuar' : 'Iniciar'}
              </button>
            )}
          </Card>

          <Card className="p-5 border-slate-200">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Checklist de Conclusão</h3>
            <ul className="space-y-2.5">
              {checklist.map((item, i) => (
                <li key={i} className="flex items-center gap-2.5">
                  <div className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center ${item.done ? 'bg-emerald-500' : 'bg-slate-100 border border-slate-300'}`}>
                    {item.done && <CheckCircle2 size={10} className="text-white" />}
                  </div>
                  <span className={`text-xs ${item.done ? 'text-slate-700' : 'text-slate-400'}`}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
            {progress >= 100 && (
              <button className="mt-4 w-full h-9 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                <Award size={14} /> Emitir Certificado
              </button>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
