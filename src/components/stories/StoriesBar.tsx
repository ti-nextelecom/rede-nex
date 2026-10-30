import { createPortal } from 'react-dom';
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { layoutStoryText, STORY_WIDTH, STORY_HEIGHT } from '../../../shared/storyTextLayout.mjs';
import { Camera, ChevronLeft, ChevronRight, Eye, Pause, Play, Plus, Volume2, VolumeX, X } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import {
  createStory, getStoryViewers, listStories, recordStoryView,
  type Story, type StoryViewer,
} from '../../lib/storiesApi';
import { cn } from '../../lib/utils';
import './stories.css';

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
  for (const group of map.values()) group.stories.sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at));
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
  const [sIdx, setSIdx] = useState(()=>Math.max(0,groups[startIdx]?.stories.findIndex(story=>!story.viewed_by_me) ?? 0));
  const [progress, setProgress] = useState(0);
  const [viewers, setViewers] = useState<StoryViewer[]>([]);
  const [showViewers, setShowViewers] = useState(false);
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [ready, setReady] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [muted, setMuted] = useState(true);
  const [viewerError, setViewerError] = useState('');
  const elapsedRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef({ x: 0, y: 0, time: 0 });
  const recordedRef = useRef(new Set<string>());
  const viewersRequestRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const group = groups[gIdx];
  const story = group?.stories[sIdx];
  const duration=story && !story.image_url && !story.video_url ? Math.min(20000,Math.max(5500,(story.content?.match(/\S+/g)?.length || 0)*280)) : 5500;
  const stopped = paused || holding || hidden || showViewers || ready !== story.id || failed;

  const goNext = useCallback(() => {
    if (sIdx < group.stories.length - 1) setSIdx(i => i + 1);
    else if (gIdx < groups.length - 1) { setGIdx(i => i + 1); setSIdx(0); }
    else onClose();
  }, [sIdx, gIdx, group.stories.length, groups.length, onClose]);

  const goPrev = useCallback(() => {
    if (sIdx > 0) setSIdx(i => i - 1);
    else if (gIdx > 0) { setGIdx(i => i - 1); setSIdx(groups[gIdx - 1].stories.length - 1); }
  }, [sIdx, gIdx, groups]);

  useEffect(() => {
    if (!story) return;
    setProgress(0);
    elapsedRef.current = 0;
    setReady(!story.image_url && !story.video_url ? story.id : null);
    setFailed(false);
    setPaused(false);
    setHolding(false);
    setShowViewers(false);
    setViewers([]);
    setViewerError('');
    viewersRequestRef.current += 1;
  }, [story?.id]);

  useEffect(() => {
    if (!story || ready !== story.id || failed || recordedRef.current.has(story.id)) return;
    recordedRef.current.add(story.id);
    recordStoryView(story.id).then(() => onViewed(story.id)).catch(() => { recordedRef.current.delete(story.id); });
  }, [story, ready, failed, onViewed]);

  useEffect(() => {
    if (stopped || story.video_url) return;
    let previous = performance.now();
    const tick = () => {
      const now = performance.now();
      elapsedRef.current += now - previous;
      previous = now;
      const p = Math.min(elapsedRef.current / duration, 1);
      setProgress(p);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else goNext();
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [story.id, story.video_url, stopped, goNext,duration]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (stopped) video.pause();
    else video.play().catch(() => setPaused(true));
  }, [stopped, story.id]);

  useEffect(() => {
    const overflow = document.body.style.overflow;
    const focused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const visibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('visibilitychange', visibility); focused?.focus(); };
  }, []);

  async function loadViewers() {
    setShowViewers(true);
    setViewerError('');
    const request = ++viewersRequestRef.current;
    try {
      const v = await getStoryViewers(story.id);
      if (request === viewersRequestRef.current) setViewers(v);
    } catch { if (request === viewersRequestRef.current) setViewerError('Não foi possível carregar as visualizações.'); }
  }

  if (!group || !story) return null;
  const isOwn = story.user_id === user?.id;
  const hasMedia = !!(story.image_url || story.video_url);

  const viewer = (
    <div ref={dialogRef} tabIndex={-1} role='dialog' aria-modal='true' aria-label='Stories da equipe' className='nex-story-overlay' onClick={onClose}
      onKeyDown={e => {
        if (e.key === 'Escape') { e.stopPropagation(); if (showViewers) setShowViewers(false); else onClose(); }
        const reading = (e.target as HTMLElement).closest('.nex-story-caption');
        if (e.key === 'ArrowRight' && !reading) { e.preventDefault(); goNext(); }
        if (e.key === 'ArrowLeft' && !reading) { e.preventDefault(); goPrev(); }
        if (e.code === 'Space' && e.target === dialogRef.current) { e.preventDefault(); setPaused(v => !v); }
        if (e.key === 'Tab') {
          const buttons = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),[tabindex="0"]') || [])].filter(el => el.getClientRects().length);
          const first = buttons[0], last = buttons[buttons.length - 1];
          if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { e.preventDefault(); last?.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
        }
      }}>
      <button className='nex-story-desktop-nav' aria-label='Story anterior' disabled={gIdx === 0 && sIdx === 0} onClick={e => { e.stopPropagation(); goPrev(); }}><ChevronLeft /></button>
      <div className='nex-story-stage' onClick={e => e.stopPropagation()}>
        {/* Progress bars */}
        <div className='nex-story-progress'>
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
        <div className='nex-story-header'>
          <div className="flex items-center gap-2">
            <img
              src={storyAvatar(group.name, group.photoUrl, 32)}
              alt={group.name}
              className="h-8 w-8 rounded-full object-cover ring-2 ring-white"
            />
            <div>
              <p className="text-sm font-bold text-white leading-tight">{group.name}</p>
              <p className="text-xs text-white/70">{timeAgo(story.created_at)} · {sIdx+1} de {group.stories.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button aria-label={paused ? 'Reproduzir story' : 'Pausar story'} onClick={() => setPaused(v => !v)}>{paused ? <Play size={20} /> : <Pause size={20} />}</button>
            {story.video_url && <button aria-label={muted ? 'Ativar som' : 'Silenciar vídeo'} onClick={() => setMuted(v => !v)}>{muted ? <VolumeX size={20} /> : <Volume2 size={20} />}</button>}
            {isOwn && (
              <button aria-label={`Ver ${story.view_count} visualizações do story`} onClick={loadViewers} className="flex items-center gap-2 p-2 rounded-xl text-white/80 hover:text-white active:bg-white/20">
                <Eye size={20} /><span className="text-sm font-medium">{story.view_count}</span>
              </button>
            )}
            <button aria-label='Fechar stories' onClick={onClose} className="text-white/70 hover:text-white"><X size={20} /></button>
          </div>
        </div>

        {/* Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {story.video_url ? (
            <video
              ref={videoRef}
              key={story.id}
              src={story.video_url}
              className='nex-story-media'
              playsInline muted={muted}
              onLoadedData={() => setReady(story.id)}
              onWaiting={() => setReady(null)}
              onCanPlay={() => setReady(story.id)}
              onError={() => setFailed(true)}
              onTimeUpdate={e => { const v = e.currentTarget; if (v.duration) setProgress(v.currentTime / v.duration); }}
              onEnded={goNext}
            />
          ) : story.image_url ? (
            <img
              key={story.id}
              src={story.image_url}
              alt="Story"
              className='nex-story-media'
              onLoad={() => setReady(story.id)}
              onError={() => setFailed(true)}
            />
          ) : (
            <div className="nex-story-text-backdrop absolute inset-0" />
          )}

          {story.content && (
            <div tabIndex={0} className={cn('nex-story-caption', hasMedia && 'has-media')}
              onFocus={() => setPaused(true)} onPointerDown={() => setPaused(true)} onWheel={() => setPaused(true)}>
              {story.content}
            </div>
          )}
        </div>

        {/* Tap zones */}
        {['previous', 'next'].map(direction => <button key={direction} className={`nex-story-tap ${direction}`} aria-label={direction === 'next' ? 'Próximo story; segure para pausar' : 'Story anterior; segure para pausar'}
          onPointerDown={e => { pointerRef.current = { x: e.clientX, y: e.clientY, time: performance.now() }; setHolding(true); e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerUp={e => {
            const { x, y, time } = pointerRef.current;
            setHolding(false);
            const dx = e.clientX - x, dy = e.clientY - y;
            if (dy > 100 && Math.abs(dy) > Math.abs(dx)) { onClose(); return; }
            if (Math.abs(dx) > 60) {
              const nextGroup = gIdx + (dx < 0 ? 1 : -1);
              if (nextGroup >= 0 && nextGroup < groups.length) { setGIdx(nextGroup); setSIdx(0); }
              else if (dx < 0) onClose();
            } else if (performance.now() - time < 250) { if (direction === 'next') goNext(); else goPrev(); }
          }}
          onPointerCancel={() => setHolding(false)} onLostPointerCapture={() => setHolding(false)}
          onClick={e => { if (e.detail === 0) { if (direction === 'next') goNext(); else goPrev(); } }} />)}
        {ready !== story.id && !failed && <p className='nex-story-status' role='status'>Carregando story…</p>}
        {failed && <div className='nex-story-status' role='alert'><p>Não foi possível carregar esta mídia.</p><button onClick={goNext}>Próximo story</button></div>}
        {paused && !showViewers && <span className='nex-story-paused'>Pausado</span>}

        {/* Viewers drawer */}
        {showViewers && (
          <div className="absolute bottom-0 left-0 right-0 z-30 bg-black/80 rounded-t-2xl p-4 max-h-56 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white font-semibold text-sm">Visualizações ({viewers.length})</p>
              <button onClick={() => setShowViewers(false)} className="text-white/60 hover:text-white">
                <X size={16} />
              </button>
            </div>
            {viewerError && <p role='alert' className='text-sm text-white'>{viewerError}</p>}
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
      <button className='nex-story-desktop-nav' aria-label='Próximo story' onClick={e => { e.stopPropagation(); goNext(); }}><ChevronRight /></button>
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
  const [postError, setPostError] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileRef   = useRef<HTMLInputElement>(null);
  const [previewWidth, setPreviewWidth] = useState(360);
  const textLayouts = useMemo(() => {
    const ctx = document.createElement('canvas').getContext('2d')!;
    return texts.map(text => ({ ...text, layout: layoutStoryText(text, (line, size) => {
      ctx.font = `bold ${size}px Arial`;
      return ctx.measureText(line).width;
    }) }));
  }, [texts]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => setPreviewWidth(canvas.clientWidth));
    observer.observe(canvas);
    setPreviewWidth(canvas.clientWidth);
    return () => observer.disconnect();
  }, []);

  const COLORS = ['#ffffff', '#000000', '#ff7a00', '#ffdd00', '#ff3b78', '#00bfff', '#00e676'];

  useEffect(() => {
    const overflow = document.body.style.overflow;
    const focused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    editorRef.current?.focus();
    return () => { document.body.style.overflow = overflow; focused?.focus(); };
  }, []);

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
    if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) { setPostError('Escolha uma imagem ou um vídeo.'); return; }
    if (f.size > 25 * 1024 * 1024) { setPostError('Use uma mídia com até 25 MB.'); return; }
    setPostError('');
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
    const t = textLayouts.find(t => t.id === id);
    if (!t) return;
    textMovedRef.current = false;
    setTextDragging({ id, sx: e.clientX, sy: e.clientY, ox: t.layout.x / STORY_WIDTH * 100, oy: t.layout.y / STORY_HEIGHT * 100 });
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
    const t = textLayouts.find(t => t.id === id);
    if (!t) return;
    textMovedRef.current = false;
    setTextDragging({ id, sx: e.touches[0].clientX, sy: e.touches[0].clientY, ox: t.layout.x / STORY_WIDTH * 100, oy: t.layout.y / STORY_HEIGHT * 100 });
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
    setPostError('');
    setPosting(true);
    try {
      let imageUrl: string | undefined;
      let videoUrl: string | undefined;
      let textContent: string | undefined;

      if (bgMedia?.type === 'video') {
        videoUrl = bgMedia.url;
        textContent = texts.map(t => t.text).join(' ') || undefined;
      } else {
        const W = STORY_WIDTH, H = STORY_HEIGHT;
        const el = canvasRef.current;
        const cw = el?.clientWidth  || W;
        const ch = el?.clientHeight || H;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d')!;

        if (bgMedia?.type === 'image') {
          const img = new Image();
          await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('Imagem inválida')); img.src = bgMedia.url; });
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

        for (const t of textLayouts) {
          ctx.save();
          const {fontSize, lines, x, y, lineHeight} = t.layout;
          ctx.font = `bold ${fontSize}px Arial`;
          ctx.fillStyle = t.color;
          ctx.shadowColor = 'rgba(0,0,0,0.8)';
          ctx.shadowBlur = 10;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          lines.forEach((line, index) => ctx.fillText(line, x, y + (index - (lines.length - 1) / 2) * lineHeight));
          ctx.restore();
        }

        imageUrl = canvas.toDataURL('image/jpeg', 0.9);
      }

      const s = await createStory({ content: textContent, image_url: imageUrl, video_url: videoUrl });
      onCreated(s);
      onClose();
    } catch { setPostError('Não foi possível publicar. Sua edição foi mantida; tente novamente.'); } finally { setPosting(false); }
  }

  const canPost = !posting && (!!bgMedia || texts.length > 0);

  return createPortal(
    <div ref={editorRef} tabIndex={-1} className='nex-story-editor' role='dialog' aria-modal='true' aria-label='Criar story' style={{ userSelect: 'none' }} onKeyDown={e => {
      if (e.key === 'Escape' && !addingText && !posting) { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab') {
        const controls = [...(editorRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not([type="file"])') || [])].filter(el => el.getClientRects().length);
        const first = controls[0], last = controls[controls.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === editorRef.current)) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }}>
      {postError && <p role='alert' className='nex-story-editor-error'>{postError}</p>}
      <div
        ref={canvasRef}
        className='nex-story-editor-canvas bg-gradient-to-br from-orange-500 via-rose-600 to-purple-800'
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
        {textLayouts.map(t => (
          <div
            key={t.id}
            className="nex-story-editor-text absolute rounded"
            style={{
              left: `${t.layout.x / STORY_WIDTH * 100}%`, top: `${t.layout.y / STORY_HEIGHT * 100}%`,
              width: `${t.layout.width / STORY_WIDTH * 100}%`,
              height: `${t.layout.height / STORY_HEIGHT * 100}%`,
              transform: 'translate(-50%, -50%)',
              color: t.color, fontSize: `${t.layout.fontSize * previewWidth / STORY_WIDTH}px`, fontWeight: 'bold', fontFamily: 'Arial, sans-serif',
              textShadow: '0 1px 6px rgba(0,0,0,0.8)',
              touchAction: 'none', cursor: 'grab',
              outline: t.id === selectedId ? '2px dashed rgba(255,255,255,0.85)' : 'none',
              outlineOffset: '4px',
            }}
            onMouseDown={e => { e.stopPropagation(); onTextMouseDown(e, t.id); }}
            onTouchStart={e => { e.stopPropagation(); onTextTouchStart(e, t.id); }}
          >
            {t.layout.lines.map((line, index) => <span key={index} style={{ display: 'block', whiteSpace: 'pre', height: '1.5em', textAlign: 'center' }}>{line || '\u00a0'}</span>)}
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
  // Freeze order while open: marking someone viewed must not switch the author.
  const [viewer, setViewer] = useState<{ groups: StoryGroup[]; index: number } | null>(null);
  const [creating, setCreating] = useState(false);
  const [loadError,setLoadError]=useState(false);
  const [retry,setRetry]=useState(0);
  const stripRef=useRef<HTMLDivElement>(null);
  const [scrollable,setScrollable]=useState({left:false,right:false});
  useEffect(()=>{
    const strip=stripRef.current;if(!strip)return;
    const update=()=>{
      const next={left:strip.scrollLeft>1,right:strip.scrollLeft+strip.clientWidth<strip.scrollWidth-1};
      setScrollable(previous=>previous.left===next.left && previous.right===next.right?previous:next);
    };
    update();const observer=new ResizeObserver(update);observer.observe(strip);strip.addEventListener('scroll',update,{passive:true});
    return()=>{observer.disconnect();strip.removeEventListener('scroll',update);};
  },[loading,stories.length]);

  useEffect(() => {
    let active=true,busy=false;
    setLoading(true);setLoadError(false);
    const refresh=async()=>{
      if(busy || document.hidden)return;busy=true;
      try{const next=await listStories();if(active){setStories(next);setLoadError(false);}}
      catch{if(active)setLoadError(true);}
      finally{busy=false;if(active)setLoading(false);}
    };
    void refresh();const timer=window.setInterval(()=>void refresh(),60000);
    window.addEventListener('focus',refresh);
    document.addEventListener('visibilitychange',refresh);
    return()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
  }, [user?.id,retry]);

  const groups = buildGroups(stories, user?.id);

  function handleMyClick() {
    const myIdx = groups.findIndex(g => g.userId === user?.id);
    if (myIdx >= 0) setViewer({ groups, index: myIdx });
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

  return (
    <>
      <section className='nex-stories-section' aria-label='Stories dos colaboradores'>
        <header className='nex-stories-heading'><div><strong>Stories</strong><span>{loading?'Carregando…':others.some(group=>!group.allViewed)?'Novidades da equipe':'Da sua equipe'}</span></div>
          <nav aria-label='Navegar pelos stories'>
            <button type='button' disabled={!scrollable.left} aria-label='Rolar stories para a esquerda' onClick={()=>stripRef.current?.scrollBy({left:-200,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}><ChevronLeft size={17}/></button>
            <button type='button' disabled={!scrollable.right} aria-label='Rolar stories para a direita' onClick={()=>stripRef.current?.scrollBy({left:200,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}><ChevronRight size={17}/></button>
          </nav>
        </header>
        <div ref={stripRef} className='nex-stories-strip' aria-busy={loading}>
          <div className='nex-story-person is-own'>
            <button type='button' onClick={handleMyClick} className='nex-story-person-open' aria-label={myHasStories?'Ver meus stories':'Criar meu primeiro story'}>
              <span className={cn('nex-story-ring',myHasStories?'is-new':'is-empty')}><img src={storyAvatar(user?.name,user?.photo_url,72)} alt='' draggable={false}/></span>
              <span className='nex-story-person-name'>Seu story</span>
            </button>
            <button type='button' aria-label='Criar story' className='story-add-button' onClick={()=>setCreating(true)}><Plus size={15}/></button>
          </div>
          {loading?Array.from({length:3},(_,index)=><div className='nex-story-skeleton' key={index}><i/><span/></div>):others.map(group=>{const unread=group.stories.filter(story=>!story.viewed_by_me).length;return <div key={group.userId} className='nex-story-person'>
            <button type='button' className='nex-story-person-open' title={group.name} aria-label={`Ver stories de ${group.name}${group.allViewed?', já vistos':', novidades'}`} onClick={()=>setViewer({groups,index:groups.indexOf(group)})}>
              <span className={cn('nex-story-ring',group.allViewed?'is-viewed':'is-new')}><img src={storyAvatar(group.name,group.photoUrl,72)} alt='' draggable={false}/></span>
              <span className='nex-story-person-name'>{group.name.split(' ')[0]}</span>
              <span className='nex-story-person-status'>{group.allViewed?'Visto':`${unread} ${unread===1?'novo':'novos'}`}</span>
            </button>
          </div>;})}
          {!loading && !others.length && !loadError && <p className='nex-stories-empty'>Compartilhe um momento<br/>com sua equipe.</p>}
        </div>
        {loadError && <div className='nex-stories-error' role='status'>Não foi possível atualizar os stories. <button type='button' onClick={()=>setRetry(value=>value+1)}>Tentar novamente</button></div>}
      </section>

      {viewer !== null && (
        <StoryViewer
          groups={viewer.groups}
          startIdx={viewer.index}
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
