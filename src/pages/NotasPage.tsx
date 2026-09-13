import { useEffect, useState } from 'react';
import { BookText, Plus, Trash2, Save } from 'lucide-react';

interface Nota {
  id: string;
  title: string;
  content: string;
  updated_at: string;
}

const STORAGE_KEY = 'rede_nex_notas_v1';

function loadNotas(): Nota[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

export function NotasPage() {
  const [notas, setNotas] = useState<Nota[]>(loadNotas);
  const [selected, setSelected] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(false);

  const currentNota = notas.find(n => n.id === selected);

  useEffect(() => {
    if (currentNota) {
      setTitle(currentNota.title);
      setContent(currentNota.content);
    } else {
      setTitle('');
      setContent('');
    }
  }, [selected]);

  function persist(updated: Nota[]) {
    setNotas(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  function saveNota() {
    if (!selected) return;
    const updated = notas.map(n =>
      n.id === selected ? { ...n, title: title || 'Sem título', content, updated_at: new Date().toISOString() } : n
    );
    persist(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function newNota() {
    const id = Date.now().toString();
    const nota: Nota = { id, title: 'Nova nota', content: '', updated_at: new Date().toISOString() };
    persist([nota, ...notas]);
    setSelected(id);
    setTitle('Nova nota');
    setContent('');
  }

  function deleteNota(id: string) {
    persist(notas.filter(n => n.id !== id));
    if (selected === id) setSelected(null);
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-white dark:bg-slate-900">
      {/* Sidebar */}
      <div className="w-64 border-r border-slate-200 dark:border-slate-700 flex flex-col flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
          <div className="flex items-center gap-2">
            <BookText size={17} className="text-orange-500" />
            <h1 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Notas</h1>
          </div>
          <button
            onClick={newNota}
            className="h-7 w-7 flex items-center justify-center rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {notas.length === 0 && (
            <div className="p-6 text-center">
              <BookText size={32} className="mx-auto mb-2 text-slate-300" />
              <p className="text-xs text-slate-400">Nenhuma nota ainda.<br />Clique em + para criar.</p>
            </div>
          )}
          {notas.map(nota => (
            <button
              key={nota.id}
              onClick={() => setSelected(nota.id)}
              className={`w-full text-left p-3 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group ${selected === nota.id ? 'bg-orange-50 dark:bg-orange-900/20 border-l-2 border-l-orange-500' : ''}`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{nota.title}</p>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{nota.content.slice(0, 45) || 'Nota vazia'}</p>
                  <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">{fmtDate(nota.updated_at)}</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); deleteNota(nota.id); }}
                  className="opacity-0 group-hover:opacity-100 flex-shrink-0 h-6 w-6 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {selected ? (
          <>
            <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                onBlur={saveNota}
                className="flex-1 text-lg font-bold text-slate-800 dark:text-slate-100 bg-transparent border-none outline-none"
                placeholder="Título da nota"
              />
              <button
                onClick={saveNota}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition-colors"
              >
                <Save size={13} />
                {saved ? 'Salvo!' : 'Salvar'}
              </button>
            </div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              className="flex-1 p-6 text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 resize-none outline-none font-mono leading-relaxed"
              placeholder="Escreva sua nota aqui..."
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <BookText size={52} className="mb-4 opacity-20" />
            <p className="font-medium text-slate-500">Selecione uma nota ou crie uma nova</p>
            <button
              onClick={newNota}
              className="mt-5 flex items-center gap-2 h-9 px-5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors shadow-sm"
            >
              <Plus size={15} />
              Nova nota
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
