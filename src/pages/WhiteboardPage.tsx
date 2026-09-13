import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Circle, Download, Eraser, Minus, Pen,
  Plus, Square, Trash2, Type, Users, X,
} from 'lucide-react';
import { apiDelete, apiGet, apiPost, apiPut } from '../lib/apiClient';
import { cn } from '../lib/utils';

interface Whiteboard { id: string; title: string; thumbnail_url?: string; creator?: { id: string; name: string; photo_url?: string }; participants?: { id: string; name: string }[]; created_at: string; updated_at: string; }
type Tool = 'pen' | 'eraser' | 'line' | 'rect' | 'circle' | 'text' | 'select';

interface DrawPath { type: 'pen' | 'eraser'; points: [number, number][]; color: string; width: number; }
interface DrawShape { type: 'line' | 'rect' | 'circle'; x1: number; y1: number; x2: number; y2: number; color: string; width: number; }
interface DrawText { type: 'text'; x: number; y: number; text: string; color: string; size: number; }
type DrawItem = DrawPath | DrawShape | DrawText;

const COLORS = ['#1e293b','#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#ffffff'];
const WIDTHS = [2, 4, 8, 14];

export function WhiteboardPage() {
  const [boards, setBoards] = useState<Whiteboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<Whiteboard | null>(null);
  const [items, setItems] = useState<DrawItem[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#1e293b');
  const [width, setWidth] = useState(3);
  const [drawing, setDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<[number,number][]>([]);
  const [startPos, setStartPos] = useState<[number,number] | null>(null);
  const [previewEnd, setPreviewEnd] = useState<[number,number] | null>(null);
  const [history, setHistory] = useState<DrawItem[][]>([[]]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Refs for stale-closure-safe touch handlers
  const drawingRef = useRef(false);
  const currentPathRef = useRef<[number,number][]>([]);
  const startPosRef = useRef<[number,number] | null>(null);
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const widthRef = useRef(width);
  const itemsRef = useRef(items);

  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { widthRef.current = width; }, [width]);
  useEffect(() => { itemsRef.current = items; }, [items]);

  const load = async () => {
    setLoading(true);
    try { const r = await apiGet<{ data: Whiteboard[] }>('/whiteboards'); setBoards(r.data ?? []); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => () => clearTimeout(saveTimerRef.current), []);

  const openBoard = async (wb: Whiteboard) => {
    try {
      const r = await apiGet<{ data: Whiteboard & { data: { items?: DrawItem[] } } }>(`/whiteboards/${wb.id}`);
      const savedItems = r.data?.data?.items || [];
      setCurrent(r.data);
      setItems(savedItems);
      itemsRef.current = savedItems;
      setHistory([savedItems]);
      setHistoryIdx(0);
    } catch { setCurrent(wb); setItems([]); itemsRef.current = []; setHistory([[]]); setHistoryIdx(0); }
  };

  const createBoard = async () => {
    if (!newTitle.trim()) return;
    const r = await apiPost<{ data: Whiteboard }>('/whiteboards', { title: newTitle.trim() });
    setBoards(b => [r.data, ...b]);
    setNewTitle(''); setShowNew(false);
    await openBoard(r.data);
  };

  const deleteBoard = async (id: string) => {
    if (!confirm('Remover este whiteboard?')) return;
    await apiDelete(`/whiteboards/${id}`);
    setBoards(b => b.filter(wb => wb.id !== id));
    if (current?.id === id) setCurrent(null);
  };

  const saveBoard = useCallback(async (itemsToSave: DrawItem[]) => {
    if (!current) return;
    const canvas = canvasRef.current;
    const thumbnail = canvas?.toDataURL('image/jpeg', 0.3) || undefined;
    await apiPut(`/whiteboards/${current.id}`, { data: { items: itemsToSave }, thumbnail_url: thumbnail });
  }, [current]);

  const debouncedSave = useCallback((itemsToSave: DrawItem[]) => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveBoard(itemsToSave), 1500);
  }, [saveBoard]);

  const pushHistoryItems = (newItems: DrawItem[]) => {
    setHistory(h => {
      const newHistory = h.slice(0, historyIdx + 1).concat([newItems]);
      setHistoryIdx(newHistory.length - 1);
      return newHistory;
    });
    setItems(newItems);
    itemsRef.current = newItems;
  };

  const commitStroke = useCallback((path: [number,number][], end: [number,number] | null) => {
    const t = toolRef.current, c = colorRef.current, w = widthRef.current;
    const sp = startPosRef.current;
    const cur = itemsRef.current;

    if ((t === 'pen' || t === 'eraser') && path.length > 1) {
      const newItem: DrawPath = { type: t, points: path, color: t === 'eraser' ? '#ffffff' : c, width: w };
      const newItems = [...cur, newItem];
      pushHistoryItems(newItems);
      debouncedSave(newItems);
    } else if (sp && end && (t === 'line' || t === 'rect' || t === 'circle')) {
      const newItem: DrawShape = { type: t, x1: sp[0], y1: sp[1], x2: end[0], y2: end[1], color: c, width: w };
      const newItems = [...cur, newItem];
      pushHistoryItems(newItems);
      debouncedSave(newItems);
    }
    currentPathRef.current = [];
    startPosRef.current = null;
    drawingRef.current = false;
    setDrawing(false);
    setCurrentPath([]);
    setStartPos(null);
    setPreviewEnd(null);
  }, [debouncedSave, historyIdx]);

  const cancelDraw = useCallback(() => {
    drawingRef.current = false;
    currentPathRef.current = [];
    startPosRef.current = null;
    setDrawing(false);
    setCurrentPath([]);
    setStartPos(null);
    setPreviewEnd(null);
  }, []);

  const getCanvasPos = (clientX: number, clientY: number): [number, number] => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return [(clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY];
  };

  // Mouse handlers
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e.clientX, e.clientY);
    drawingRef.current = true; setDrawing(true);
    startPosRef.current = pos; setStartPos(pos);
    currentPathRef.current = [pos];
    if (toolRef.current === 'pen' || toolRef.current === 'eraser') setCurrentPath([pos]);
    if (toolRef.current === 'text') {
      const text = prompt('Digite o texto:');
      if (text) pushHistoryItems([...itemsRef.current, { type: 'text', x: pos[0], y: pos[1], text, color: colorRef.current, size: widthRef.current * 5 + 10 }]);
      cancelDraw();
    }
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const pos = getCanvasPos(e.clientX, e.clientY);
    if (toolRef.current === 'pen' || toolRef.current === 'eraser') {
      currentPathRef.current = [...currentPathRef.current, pos];
      setCurrentPath(currentPathRef.current);
    } else {
      setPreviewEnd(pos);
    }
  };

  const onMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const pos = getCanvasPos(e.clientX, e.clientY);
    commitStroke(currentPathRef.current, pos);
  };

  // Touch handlers (with touch-action: none to prevent scroll)
  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const t = e.touches[0];
    const pos = getCanvasPos(t.clientX, t.clientY);
    drawingRef.current = true; setDrawing(true);
    startPosRef.current = pos; setStartPos(pos);
    currentPathRef.current = [pos];
    if (toolRef.current === 'pen' || toolRef.current === 'eraser') setCurrentPath([pos]);
    if (toolRef.current === 'text') {
      const text = prompt('Digite o texto:');
      if (text) pushHistoryItems([...itemsRef.current, { type: 'text', x: pos[0], y: pos[1], text, color: colorRef.current, size: widthRef.current * 5 + 10 }]);
      cancelDraw();
    }
  };

  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const t = e.touches[0];
    const pos = getCanvasPos(t.clientX, t.clientY);
    if (toolRef.current === 'pen' || toolRef.current === 'eraser') {
      currentPathRef.current = [...currentPathRef.current, pos];
      setCurrentPath(currentPathRef.current);
    } else {
      setPreviewEnd(pos);
    }
  };

  const onTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const t = e.changedTouches[0];
    const pos = t ? getCanvasPos(t.clientX, t.clientY) : (currentPathRef.current[currentPathRef.current.length - 1] ?? startPosRef.current ?? [0, 0] as [number,number]);
    commitStroke(currentPathRef.current, pos);
  };

  const undo = () => {
    if (historyIdx > 0) {
      const idx = historyIdx - 1;
      setHistoryIdx(idx);
      setItems(history[idx]);
      itemsRef.current = history[idx];
    }
  };

  const redo = () => {
    if (historyIdx < history.length - 1) {
      const idx = historyIdx + 1;
      setHistoryIdx(idx);
      setItems(history[idx]);
      itemsRef.current = history[idx];
    }
  };

  // Draw on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const drawItem = (item: DrawItem) => {
      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (item.type === 'pen' || item.type === 'eraser') {
        if (item.points.length < 2) { ctx.restore(); return; }
        ctx.globalCompositeOperation = item.type === 'eraser' ? 'destination-out' : 'source-over';
        ctx.strokeStyle = item.color; ctx.lineWidth = item.width;
        ctx.beginPath(); ctx.moveTo(item.points[0][0], item.points[0][1]);
        item.points.forEach(p => ctx.lineTo(p[0], p[1]));
        ctx.stroke();
      } else if (item.type === 'line') {
        ctx.strokeStyle = item.color; ctx.lineWidth = item.width;
        ctx.beginPath(); ctx.moveTo(item.x1, item.y1); ctx.lineTo(item.x2, item.y2); ctx.stroke();
      } else if (item.type === 'rect') {
        ctx.strokeStyle = item.color; ctx.lineWidth = item.width;
        ctx.strokeRect(item.x1, item.y1, item.x2 - item.x1, item.y2 - item.y1);
      } else if (item.type === 'circle') {
        const rx = Math.abs(item.x2 - item.x1) / 2, ry = Math.abs(item.y2 - item.y1) / 2;
        ctx.strokeStyle = item.color; ctx.lineWidth = item.width;
        ctx.beginPath();
        ctx.ellipse(Math.min(item.x1,item.x2)+rx, Math.min(item.y1,item.y2)+ry, rx, ry, 0, 0, Math.PI*2);
        ctx.stroke();
      } else if (item.type === 'text') {
        ctx.fillStyle = item.color; ctx.font = `${item.size}px sans-serif`;
        ctx.fillText(item.text, item.x, item.y);
      }
      ctx.restore();
    };

    items.forEach(drawItem);

    if (drawing && currentPath.length > 1 && (tool === 'pen' || tool === 'eraser')) {
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = tool === 'eraser' ? '#cccccc' : color; ctx.lineWidth = width;
      ctx.beginPath(); ctx.moveTo(currentPath[0][0], currentPath[0][1]);
      currentPath.forEach(p => ctx.lineTo(p[0], p[1])); ctx.stroke(); ctx.restore();
    }
    if (drawing && startPos && previewEnd && (tool === 'line' || tool === 'rect' || tool === 'circle')) {
      ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = color; ctx.lineWidth = width;
      if (tool === 'line') {
        ctx.beginPath(); ctx.moveTo(startPos[0], startPos[1]); ctx.lineTo(previewEnd[0], previewEnd[1]); ctx.stroke();
      } else if (tool === 'rect') {
        ctx.strokeRect(startPos[0], startPos[1], previewEnd[0] - startPos[0], previewEnd[1] - startPos[1]);
      } else if (tool === 'circle') {
        const rx = Math.abs(previewEnd[0] - startPos[0]) / 2, ry = Math.abs(previewEnd[1] - startPos[1]) / 2;
        ctx.beginPath();
        ctx.ellipse(Math.min(startPos[0],previewEnd[0])+rx, Math.min(startPos[1],previewEnd[1])+ry, rx, ry, 0, 0, Math.PI*2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }, [items, currentPath, drawing, startPos, previewEnd, color, width, tool]);

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = `${current?.title || 'whiteboard'}.png`;
    a.href = canvas.toDataURL();
    a.click();
  };

  if (current) return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 7rem)' }}>
      {/* Scrollable toolbar — single row on all screen sizes */}
      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1.5 mb-2 overflow-x-auto flex-nowrap">
        <button onClick={() => { saveBoard(items); setCurrent(null); load(); }}
          className="text-sm text-orange-600 font-medium hover:underline mr-1 flex-shrink-0 px-1">←</button>
        <span className="text-xs font-semibold text-slate-700 mr-1 max-w-[80px] truncate flex-shrink-0">{current.title}</span>

        <div className="w-px h-5 bg-slate-200 mx-0.5 flex-shrink-0" />

        {([['pen',Pen],['eraser',Eraser],['line',Minus],['rect',Square],['circle',Circle],['text',Type]] as [Tool,any][]).map(([t, Icon]) => (
          <button key={t} onClick={() => setTool(t)}
            className={cn('p-2 rounded-lg transition-colors flex-shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center', tool === t ? 'bg-orange-100 text-orange-600' : 'text-slate-500 hover:bg-slate-100')}>
            <Icon size={16} />
          </button>
        ))}

        <div className="w-px h-5 bg-slate-200 mx-0.5 flex-shrink-0" />

        {COLORS.map(c => (
          <button key={c} onClick={() => setColor(c)} className="flex-shrink-0"
            style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: c, border: color === c ? '2px solid #334155' : '2px solid #e2e8f0' }} />
        ))}

        <div className="w-px h-5 bg-slate-200 mx-0.5 flex-shrink-0" />

        {WIDTHS.map(w => (
          <button key={w} onClick={() => setWidth(w)}
            className={cn('rounded transition-colors px-1 py-1 flex-shrink-0 flex items-center justify-center min-w-[28px] min-h-[28px]', width === w ? 'bg-orange-100' : 'hover:bg-slate-100')}>
            <div className="bg-slate-800 rounded-full" style={{ width: 14, height: Math.max(w/1.5, 1.5) }} />
          </button>
        ))}

        <div className="w-px h-5 bg-slate-200 mx-0.5 flex-shrink-0" />

        <button onClick={undo} disabled={historyIdx === 0} className="p-1.5 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-40 text-sm flex-shrink-0">↩</button>
        <button onClick={redo} disabled={historyIdx === history.length - 1} className="p-1.5 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-40 text-sm flex-shrink-0">↪</button>
        <button onClick={() => { const ni: DrawItem[] = []; pushHistoryItems(ni); debouncedSave(ni); }} className="p-1.5 rounded text-red-400 hover:bg-red-50 flex-shrink-0">
          <Trash2 size={14} />
        </button>
        <button onClick={downloadCanvas} className="p-1.5 rounded text-slate-500 hover:bg-slate-100 flex-shrink-0">
          <Download size={14} />
        </button>
      </div>

      <canvas ref={canvasRef} width={1280} height={720}
        className={cn('flex-1 border border-slate-200 rounded-xl bg-white w-full', tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair')}
        style={{ touchAction: 'none', maxHeight: 'calc(100vh - 12rem)' }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
        onMouseLeave={cancelDraw}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Square size={20} className="text-orange-500" />
          <h1 className="text-lg font-bold text-slate-800">Quadro</h1>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors">
          <Plus size={15} /> Nova lousa
        </button>
      </div>

      {showNew && (
        <div className="flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
          <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createBoard(); if (e.key === 'Escape') setShowNew(false); }}
            placeholder="Nome da lousa" className="flex-1 bg-transparent text-sm outline-none text-slate-800" />
          <button onClick={createBoard} className="px-2.5 py-1.5 bg-orange-500 text-white text-xs font-semibold rounded">Criar</button>
          <button onClick={() => setShowNew(false)} className="text-slate-400 hover:text-slate-600"><X size={15} /></button>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Carregando...</div>
      ) : boards.length === 0 ? (
        <div className="py-12 text-center bg-white border border-slate-200 rounded-xl">
          <Square size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">Nenhuma lousa criada</p>
          <button onClick={() => setShowNew(true)} className="mt-3 text-orange-600 text-sm font-medium hover:underline">Criar primeira lousa</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {boards.map(wb => (
            <div key={wb.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow group">
              <div onClick={() => openBoard(wb)} className="cursor-pointer">
                {wb.thumbnail_url ? (
                  <img src={wb.thumbnail_url} alt={wb.title} className="w-full h-36 object-cover bg-slate-100" />
                ) : (
                  <div className="w-full h-36 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                    <Square size={32} className="text-slate-200" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 cursor-pointer hover:text-orange-600 transition-colors truncate" onClick={() => openBoard(wb)}>{wb.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                      {wb.participants && wb.participants.length > 0 && (
                        <span className="flex items-center gap-1"><Users size={10} /> {wb.participants.length}</span>
                      )}
                      <span>{new Date(wb.updated_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                  <button onClick={() => deleteBoard(wb.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-all flex-shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
