import { createPortal } from 'react-dom';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Camera, Eye, Plus, X } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import {
  createStory, getStoryViewers, listStories, recordStoryView,
  type Story, type StoryViewer,
} from '../../lib/storiesApi';
import { cn } from '../../lib/utils';

function storyAvatar(name?: string | null, photoUrl?: string | null, size = 80) {
  return photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&size=${size * 2}&background=ff7a00&color=fff`;
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

type StoryGroup = {
  userId: string;
  name: string;
  photoUrl: string | null;
  stories: Story[];
  allViewed: boolean;
};

function buildGroups(stories: Story[], myId?: string): StoryGroup[] {
  const map = new Map<string, StoryGroup>();
  for (const s of stories) {
    if (!map.has(s.user_id)) {
      map.set(s.user_id, {
        userId: s.user_id,
        name: s.users?.name ?? 'Usuário',
        photoUrl: s.users?.photo_url ?? null,
        stories: [],
        allViewed: true,
      });
    }
    const g = map.get(s.user_id)!;
    g.stories.push(s);
    if (!s.viewed_by_me) g.allViewed = false;
  }
  return [...map.values()].sort((a, b) => {
    if (a.userId === myId) return -1;
    if (b.userId === myId) return 1;
    if (!a.allViewed && b.allViewed) return -1;
    if (a.allViewed && !b.allViewed) return 1;
    return 0;
  });
}

// ── StoryViewer ──────────────────────────────────────────────────────────────
function StoryViewer({
  groups, startIdx, onClose, onViewed,
}: {
  groups: StoryGroup[];
  startIdx: number;
  onClose: () => void;
  onViewed: (id: string) => void;
}) {
  const { user } = useAuth();
  const [gIdx, setGIdx] = useState(startIdx);
  const [sIdx, setSIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [viewers, setViewers] = useState<StoryViewer[]>([]);
  const [showViewers, setShowViewers] = useState(false);
  const rafRef = useRef<number | null>(null);
  const DURATION = 5000;

  const group = groups[gIdx];
  const story = group?.stories[sIdx];

  useEffect(() => {
    if (!story) return;
    recordStoryView(story.id).catch(() => {});
    onViewed(story.id);
    setProgress(0);
    setShowViewers(false);
    setViewers([]);

    if (story.video_url) return;
    const start = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - start) / DURATION, 1);
      setProgress(p);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else goNext();
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [gIdx, sIdx]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  function goNext() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (sIdx < group.stories.length - 1) setSIdx(i => i + 1);
    else if (gIdx < groups.length - 1) { setGIdx(i => i + 1); setSIdx(0); }
    else onClose();
  }

  function goPrev() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (sIdx > 0) setSIdx(i => i - 1);
    else if (gIdx > 0) { setGIdx(i => i - 1); setSIdx(0); }
  }

  async function loadViewers() {
    try {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const v = await getStoryViewers(story.id);
      setViewers(v);
      setShowViewers(true);
    } catch {}
  }

  if (!group || !story) return null;
  const isOwn = story.user_id === user?.id;
  const hasMedia = !!(story.image_url || story.video_url);

  const viewer = (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center" onClick={onClose}>
      <div className="relative h-full w-full sm:max-w-sm md:w-auto md:max-w-none md:aspect-[9/16]" onClick={e => e.stopPropagation()}>
        {/* Progress bars */}
        <div className="absolute top-3 left-3 right-3 z-30 flex gap-1">
          {group.stories.map((s, i) => (
            <div key={s.id} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full"
                style={{
                  width: i < sIdx ? '100%' : i === sIdx ? `${progress * 100}%` : '0%',
                  transition: 'none',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-8 left-3 right-3 z-30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src={storyAvatar(group.name, group.photoUrl, 32)}
              alt={group.name}
              className="h-8 w-8 rounded-full object-cover ring-2 ring-white"
            />
            <div>
              <p className="text-sm font-bold text-white leading-tight">{group.name}</p>
              <p className="text-xs text-white/70">{timeAgo(story.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isOwn && (
              <button onClick={loadViewers} className="flex items-center gap-2 p-2 rounded-xl text-white/80 hover:text-white active:bg-white/20">
                <Eye size={20} /><span className="text-sm font-medium">{story.view_count}</span>
              </button>
            )}
            <button onClick={onClose} className="text-white/70 hover:text-white"><X size={20} /></button>
          </div>
        </div>

        {/* Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {story.video_url ? (
            <video
              key={story.id}
              src={story.video_url}
              className="h-full w-full object-cover"
              controls
              autoPlay
              onEnded={goNext}
            />
          ) : story.image_url ? (
            <img
              key={story.id}
              src={story.image_url}
              alt="Story"
              className="h-full w-full object-cover"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500 via-rose-600 to-purple-800" />
          )}

          {story.content && (
            <div className={cn(
              'relative z-10 px-8 text-white font-bold text-2xl text-center leading-snug',
              hasMedia
                ? 'absolute bottom-20 left-0 right-0 z-10 bg-black/50 backdrop-blur-sm py-3'
                : 'py-6',
            )}>
              {story.content}
            </div>
          )}
        </div>

        {/* Tap zones */}
        <button className="absolute left-0 top-0 h-full w-1/3 z-20 opacity-0" onClick={goPrev} />
        <button className="absolute right-0 top-0 h-full w-1/3 z-20 opacity-0" onClick={goNext} />

        {/* Viewers drawer */}
        {showViewers && (
          <div className="absolute bottom-0 left-0 right-0 z-30 bg-black/80 rounded-t-2xl p-4 max-h-56 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white font-semibold text-sm">Visualizações ({viewers.length})</p>
              <button onClick={() => setShowViewers(false)} className="text-white/60 hover:text-white">
                <X size={16} />
              </button>
            </div>
            {viewers.map(v => (
              <div key={v.user_id} className="flex items-center gap-2 py-1">
                <img src={storyAvatar(v.name, v.photo_url, 24)} alt={v.name}
                  className="h-6 w-6 rounded-full object-cover" />
                <p className="text-white/90 text-xs flex-1">{v.name}</p>
                <p className="text-white/50 text-xs">{timeAgo(v.viewed_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
  return createPortal(viewer, document.body);
}

// ── CreateStoryModal (editor estilo Instagram v2) ────────────────────────────
function CreateStoryModal({
  onClose, onCreated,
}: {
  onClose: () => void;
  onCreated: (s: Story) => void;
}) {
  // Background
  const [bgMedia, setBgMedia]     = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const [imgScale, setImgScale]   = useState(1);
  const [imgOffset, setImgOffset] = useState({ x: 0, y: 0 });

  // Text overlays
  const [texts, setTexts] = useState<{ id: string; text: string; x: number; y: number; color: string; size: number }[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addingText, setAddingText] = useState(false);
  const [newText, setNewText] = useState('');

  // Active style (for new text OR selected text)
  const [activeColor, setActiveColor] = useState('#ffffff');
  const [activeSize,  setActiveSize]  = useState(24);

  // Drag state
  const [textDragging, setTextDragging] = useState<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [bgDragging,   setBgDragging]   = useState<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const textMovedRef   = useRef(false);
  const pinchDistRef   = useRef<number | null>(null);
  const pinchScaleRef  = useRef(1);
  const imgScaleRef    = useRef(1);

  const [posting, setPosting] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileRef   = useRef<HTMLInputElement>(null);

  const COLORS = ['#ffffff', '#000000', '#ff7a00', '#ffdd00', '#ff3b78', '#00bfff', '#00e676'];

  // Keep imgScaleRef in sync for pinch start capture
  useEffect(() => { imgScaleRef.current = imgScale; }, [imgScale]);

  // Sync toolbar to selected text
  const selectedText = texts.find(t => t.id === selectedId) ?? null;
  useEffect(() => {
    if (selectedText) {
      setActiveColor(selectedText.color);
      setActiveSize(selectedText.size);
    }
  }, [selectedId]);

  function applyColor(c: string) {
    setActiveColor(c);
    if (selectedId) setTexts(prev => prev.map(t => t.id === selectedId ? { ...t, color: c } : t));
  }

  function applySize(delta: number) {
    const next = Math.max(12, Math.min(60, activeSize + delta));
    setActiveSize(next);
    if (selectedId) setTexts(prev => prev.map(t => t.id === selectedId ? { ...t, size: next } : t));
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const type: 'image' | 'video' = f.type.startsWith('video') ? 'video' : 'image';
    const reader = new FileReader();
    reader.onload = ev => {
      setBgMedia({ url: ev.target?.result as string, type });
      setImgScale(1);
      setImgOffset({ x: 0, y: 0 });
    };
    reader.readAsDataURL(f);
    e.target.value = '';
  }

  function confirmText() {
    if (!newText.trim()) { setAddingText(false); setNewText(''); return; }
    const id = Math.random().toString(36).slice(2);
    setTexts(prev => [...prev, { id, text: newText.trim(), x: 50, y: 50, color: activeColor, size: activeSize }]);
    setSelectedId(id);
    setAddingText(false);
    setNewText('');
  }

  function getPinchDist(touches: React.TouchList) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ── Mouse handlers ─────────────────────────────────────────────────────────
  function onTextMouseDown(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    const t = texts.find(t => t.id === id);
    if (!t) return;
    textMovedRef.current = false;
    setTextDragging({ id, sx: e.clientX, sy: e.clientY, ox: t.x, oy: t.y });
  }

  function onCanvasMouseDown(e: React.MouseEvent) {
    setSelectedId(null);
    if (bgMedia?.type === 'image')
      setBgDragging({ sx: e.clientX, sy: e.clientY, ox: imgOffset.x, oy: imgOffset.y });
  }

  function onCanvasMouseMove(e: React.MouseEvent) {
    if (textDragging && canvasRef.current) {
      if (Math.abs(e.clientX - textDragging.sx) > 5 || Math.abs(e.clientY - textDragging.sy) > 5)
        textMovedRef.current = true;
      const rect = canvasRef.current.getBoundingClientRect();
      const dx = ((e.clientX - textDragging.sx) / rect.width)  * 100;
      const dy = ((e.clientY - textDragging.sy) / rect.height) * 100;
      setTexts(prev => prev.map(t => t.id === textDragging.id
        ? { ...t, x: Math.max(5, Math.min(95, textDragging.ox + dx)), y: Math.max(5, Math.min(95, textDragging.oy + dy)) }
        : t));
      return;
    }
    if (bgDragging && bgMedia?.type === 'image') {
      setImgOffset({ x: bgDragging.ox + e.clientX - bgDragging.sx, y: bgDragging.oy + e.clientY - bgDragging.sy });
    }
  }

  function onCanvasMouseUp() {
    if (textDragging) {
      if (!textMovedRef.current) setSelectedId(prev => prev === textDragging.id ? null : textDragging.id);
      setTextDragging(null);
    }
    setBgDragging(null);
  }

  function onCanvasWheel(e: React.WheelEvent) {
    e.preventDefault();
    setImgScale(s => Math.max(0.5, Math.min(4, s - e.deltaY * 0.001)));
  }

  // ── Touch handlers ─────────────────────────────────────────────────────────
  function onTextTouchStart(e: React.TouchEvent, id: string) {
    e.stopPropagation();
    const t = texts.find(t => t.id === id);
    if (!t) return;
    textMovedRef.current = false;
    setTextDragging({ id, sx: e.touches[0].clientX, sy: e.touches[0].clientY, ox: t.x, oy: t.y });
  }

  function onCanvasTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      pinchDistRef.current  = getPinchDist(e.touches);
      pinchScaleRef.current = imgScaleRef.current;
    } else if (!textDragging) {
      setSelectedId(null);
      if (bgMedia?.type === 'image')
        setBgDragging({ sx: e.touches[0].clientX, sy: e.touches[0].clientY, ox: imgOffset.x, oy: imgOffset.y });
    }
  }

  function onCanvasTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && pinchDistRef.current !== null) {
      const ratio = getPinchDist(e.touches) / pinchDistRef.current;
      setImgScale(Math.max(0.5, Math.min(4, pinchScaleRef.current * ratio)));
      return;
    }
    if (textDragging && canvasRef.current && e.touches.length === 1) {
      if (Math.abs(e.touches[0].clientX - textDragging.sx) > 5 || Math.abs(e.touches[0].clientY - textDragging.sy) > 5)
        textMovedRef.current = true;
      const rect = canvasRef.current.getBoundingClientRect();
      const dx = ((e.touches[0].clientX - textDragging.sx) / rect.width)  * 100;
      const dy = ((e.touches[0].clientY - textDragging.sy) / rect.height) * 100;
      setTexts(prev => prev.map(t => t.id === textDragging.id
        ? { ...t, x: Math.max(5, Math.min(95, textDragging.ox + dx)), y: Math.max(5, Math.min(95, textDragging.oy + dy)) }
        : t));
      return;
    }
    if (bgDragging && bgMedia?.type === 'image' && e.touches.length === 1) {
      setImgOffset({ x: bgDragging.ox + e.touches[0].clientX - bgDragging.sx, y: bgDragging.oy + e.touches[0].clientY - bgDragging.sy });
    }
  }

  function onCanvasTouchEnd(e: React.TouchEvent) {
    if (e.touches.length < 2) pinchDistRef.current = null;
    if (textDragging) {
      if (!textMovedRef.current) setSelectedId(prev => prev === textDragging.id ? null : textDragging.id);
      setTextDragging(null);
    }
    setBgDragging(null);
  }

  // ── Post ───────────────────────────────────────────────────────────────────
  async function post() {
    if (posting || (!bgMedia && texts.length === 0)) return;
    setPosting(true);
    try {
      let imageUrl: string | undefined;
      let videoUrl: string | undefined;
      let textContent: string | undefined;

      if (bgMedia?.type === 'video') {
        videoUrl = bgMedia.url;
        textContent = texts.map(t => t.text).join(' ') || undefined;
      } else {
        const W = 720, H = 1280;
        const el = canvasRef.current;
        const cw = el?.clientWidth  || W;
        const ch = el?.clientHeight || H;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d')!;

        if (bgMedia?.type === 'image') {
          const img = new Image();
          await new Promise<void>(res => { img.onload = () => res(); img.src = bgMedia.url; });
          const cssBase    = Math.max(cw / img.width, ch / img.height);
          const canvasBase = Math.max(W  / img.width, H  / img.height);
          const ratio      = canvasBase / cssBase;
          ctx.save();
          ctx.translate(W / 2 + imgOffset.x * ratio, H / 2 + imgOffset.y * ratio);
          ctx.scale(imgScale * canvasBase, imgScale * canvasBase);
          ctx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);
          ctx.restore();
        } else {
          const grad = ctx.createLinearGradient(0, 0, 0, H);
          grad.addColorStop(0, '#f97316');
          grad.addColorStop(0.5, '#e11d48');
          grad.addColorStop(1, '#7e22ce');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, W, H);
        }

        for (const t of texts) {
          ctx.save();
          ctx.font = `bold ${t.size * 2}px Arial`;
          ctx.fillStyle = t.color;
          ctx.shadowColor = 'rgba(0,0,0,0.8)';
          ctx.shadowBlur = 10;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(t.text, (t.x / 100) * W, (t.y / 100) * H);
          ctx.restore();
        }

        imageUrl = canvas.toDataURL('image/jpeg', 0.9);
      }

      const s = await createStory({ content: textContent, image_url: imageUrl, video_url: videoUrl });
      onCreated(s);
      onClose();
    } catch {} finally { setPosting(false); }
  }

  const canPost = !posting && (!!bgMedia || texts.length > 0);

  return createPortal(
    <div className="fixed inset-0 z-[210] bg-black flex flex-col" style={{ userSelect: 'none' }}>
      <div
        ref={canvasRef}
        className="relative flex-1 overflow-hidden bg-gradient-to-br from-orange-500 via-rose-600 to-purple-800"
        style={{ cursor: bgMedia?.type === 'image' ? (bgDragging ? 'grabbing' : 'grab') : 'default' }}
        onMouseDown={onCanvasMouseDown}
        onMouseMove={onCanvasMouseMove}
        onMouseUp={onCanvasMouseUp}
        onMouseLeave={onCanvasMouseUp}
        onWheel={onCanvasWheel}
        onTouchStart={onCanvasTouchStart}
        onTouchMove={onCanvasTouchMove}
        onTouchEnd={onCanvasTouchEnd}
      >
        {/* Background image with pan+zoom */}
        {bgMedia?.type === 'image' && (
          <img
            src={bgMedia.url}
            alt=""
            draggable={false}
            className="absolute w-full h-full object-cover pointer-events-none"
            style={{ transform: `scale(${imgScale}) translate(${imgOffset.x / imgScale}px, ${imgOffset.y / imgScale}px)`, transformOrigin: 'center' }}
          />
        )}
        {bgMedia?.type === 'video' && (
          <video src={bgMedia.url} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
        )}

        {/* Text overlays */}
        {texts.map(t => (
          <div
            key={t.id}
            className="absolute px-2 py-0.5 rounded"
            style={{
              left: `${t.x}%`, top: `${t.y}%`,
              transform: 'translate(-50%, -50%)',
              color: t.color, fontSize: `${t.size}px`, fontWeight: 'bold',
              textShadow: '0 1px 6px rgba(0,0,0,0.8)',
              touchAction: 'none', cursor: 'grab',
              outline: t.id === selectedId ? '2px dashed rgba(255,255,255,0.85)' : 'none',
              outlineOffset: '4px',
            }}
            onMouseDown={e => { e.stopPropagation(); onTextMouseDown(e, t.id); }}
            onTouchStart={e => { e.stopPropagation(); onTextTouchStart(e, t.id); }}
          >
            {t.text}
          </div>
        ))}

        {/* Text input overlay */}
        {addingText && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50" onClick={confirmText}>
            <div className="w-5/6" onClick={e => e.stopPropagation()}>
              <input
                autoFocus
                value={newText}
                onChange={e => setNewText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') confirmText();
                  if (e.key === 'Escape') { setAddingText(false); setNewText(''); }
                }}
                placeholder="Digite seu texto..."
                className="w-full bg-transparent outline-none text-center font-bold placeholder-white/50"
                style={{ color: activeColor, fontSize: `${activeSize}px`, textShadow: '0 1px 4px rgba(0,0,0,0.8)', borderBottom: '2px solid rgba(255,255,255,0.6)' }}
              />
              <div className="flex justify-center mt-5 gap-3">
                <button onClick={() => { setAddingText(false); setNewText(''); }} className="px-4 py-2 rounded-full bg-white/20 text-white text-sm">Cancelar</button>
                <button onClick={confirmText} className="px-6 py-2 rounded-full bg-orange-500 text-white text-sm font-semibold">Adicionar</button>
              </div>
            </div>
          </div>
        )}

        {/* Top bar */}
        <div
          className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4"
          onMouseDown={e => e.stopPropagation()}
          onTouchStart={e => e.stopPropagation()}
        >
          <button onClick={onClose} className="h-10 w-10 flex items-center justify-center rounded-full bg-black/50 text-white">
            <X size={20} />
          </button>
          {bgMedia?.type === 'image' && (
            <span className="text-white/50 text-xs bg-black/30 rounded-full px-3 py-1">
              Arraste • Scroll/pinch p/ zoom
            </span>
          )}
          <button onClick={post} disabled={!canPost} className="h-10 px-5 rounded-full bg-orange-500 text-white font-semibold text-sm disabled:opacity-40">
            {posting ? 'Publicando...' : 'Publicar →'}
          </button>
        </div>

        {/* Bottom toolbar */}
        {!addingText && (
          <div
            className="absolute bottom-0 left-0 right-0 z-20 p-4 space-y-3"
            onMouseDown={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}
          >
            {/* Color + delete row */}
            <div className="flex items-center gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => applyColor(c)}
                  className="h-7 w-7 rounded-full transition-transform flex-shrink-0"
                  style={{
                    background: c,
                    border: activeColor === c ? '3px solid white' : '2px solid rgba(255,255,255,0.4)',
                    transform: activeColor === c ? 'scale(1.25)' : 'scale(1)',
                  }}
                />
              ))}
              {selectedId && (
                <button
                  onClick={() => { setTexts(prev => prev.filter(t => t.id !== selectedId)); setSelectedId(null); }}
                  className="ml-auto h-8 w-8 rounded-full bg-red-500/80 text-white flex items-center justify-center flex-shrink-0"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Tool row */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setSelectedId(null); setAddingText(true); }}
                className="h-12 w-12 rounded-2xl bg-black/50 text-white flex items-center justify-center border border-white/30"
              >
                <span className="text-base font-bold">Aa</span>
              </button>
              <button
                onClick={() => applySize(-4)}
                className="h-10 w-10 rounded-xl bg-black/40 text-white flex items-center justify-center font-bold"
              >
                A-
              </button>
              <button
                onClick={() => applySize(4)}
                className="h-10 w-10 rounded-xl bg-black/40 text-white flex items-center justify-center font-bold"
              >
                A+
              </button>
              <span className="text-white/50 text-xs">{selectedText ? selectedText.size : activeSize}px</span>
              <button
                onClick={() => fileRef.current?.click()}
                className="h-12 w-12 rounded-2xl bg-black/50 text-white flex items-center justify-center border border-white/30 ml-auto"
              >
                <Camera size={22} />
              </button>
            </div>
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={onFile} />
    </div>,
    document.body
  );
}


// ── StoriesBar ───────────────────────────────────────────────────────────────
export function StoriesBar() {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    listStories().then(setStories).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const groups = buildGroups(stories, user?.id);

  function handleMyClick() {
    const myIdx = groups.findIndex(g => g.userId === user?.id);
    if (myIdx >= 0) setViewer(myIdx);
    else setCreating(true);
  }

  function handleViewed(id: string) {
    setStories(prev => prev.map(s => s.id === id ? { ...s, viewed_by_me: true } : s));
  }

  function handleCreated(s: Story) {
    setStories(prev => [s, ...prev]);
  }

  const myHasStories = stories.some(s => s.user_id === user?.id);
  const others = groups.filter(g => g.userId !== user?.id);

  if (loading) {
    return (
      <div className="flex gap-3 px-4 py-3 overflow-x-auto border-b border-slate-100 bg-white">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div className="h-14 w-14 rounded-full bg-slate-100 animate-pulse" />
            <div className="h-2 w-10 bg-slate-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-3 px-4 py-3 overflow-x-auto border-b border-slate-100 flex-shrink-0 bg-white">
        {/* My bubble */}
        <button onClick={handleMyClick} className="flex flex-col items-center gap-1.5 flex-shrink-0">
          <div className="relative">
            <div className={cn(
              'h-14 w-14 rounded-full p-0.5',
              myHasStories ? 'bg-gradient-to-br from-orange-400 to-rose-500' : 'bg-slate-200',
            )}>
              <div className="h-full w-full rounded-full overflow-hidden ring-2 ring-white">
                <img
                  src={storyAvatar(user?.name, (user as any)?.photo_url, 56)}
                  alt={user?.name ?? 'Eu'}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
            <button onClick={e => { e.stopPropagation(); setCreating(true); }} className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-orange-500 border-2 border-white flex items-center justify-center">
              <Plus size={11} className="text-white" />
            </button>
          </div>
          <span className="text-[11px] text-slate-600 font-medium w-14 text-center truncate leading-tight">
            Minha story
          </span>
        </button>

        {/* Others */}
        {others.map(g => {
          const absIdx = groups.indexOf(g);
          return (
            <button
              key={g.userId}
              onClick={() => setViewer(absIdx)}
              className="flex flex-col items-center gap-1.5 flex-shrink-0"
            >
              <div className={cn(
                'h-14 w-14 rounded-full p-0.5',
                g.allViewed ? 'bg-slate-300' : 'bg-gradient-to-br from-orange-400 to-rose-500',
              )}>
                <div className="h-full w-full rounded-full overflow-hidden ring-2 ring-white">
                  <img
                    src={storyAvatar(g.name, g.photoUrl, 56)}
                    alt={g.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
              <span className="text-[11px] text-slate-600 font-medium w-14 text-center truncate leading-tight">
                {g.name.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>

      {viewer !== null && (
        <StoryViewer
          groups={groups}
          startIdx={viewer}
          onClose={() => setViewer(null)}
          onViewed={handleViewed}
        />
      )}

      {creating && (
        <CreateStoryModal
          onClose={() => setCreating(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}
