import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowUpRight, Crop, Pencil, RotateCcw, Square, Undo2, X } from 'lucide-react';
import { selectionRect, type MediaRect } from '../../../shared/mediaTools.mjs';
import './media-tools.css';
type Point = { x: number; y: number };
type Stroke = { kind: 'draw' | 'arrow' | 'rectangle'; points: Point[]; color: string; width: number };
interface Model { crop: MediaRect; strokes: Stroke[] }
const original = (): Model => ({ crop: { x: 0, y: 0, width: 1, height: 1 }, strokes: [] });
function renderImage(canvas: HTMLCanvasElement, image: HTMLImageElement, model: Model, active?: Stroke | null, selection?: MediaRect | null, maxSide = 1536) {
  const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const baseWidth = image.naturalWidth * ratio, baseHeight = image.naturalHeight * ratio;
  const { crop } = model;
  const width = Math.max(1, Math.round(baseWidth * crop.width)), height = Math.max(1, Math.round(baseHeight * crop.height));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext('2d'); if (!context) return;
  context.clearRect(0, 0, width, height);
  context.drawImage(image, crop.x * image.naturalWidth, crop.y * image.naturalHeight, crop.width * image.naturalWidth, crop.height * image.naturalHeight, 0, 0, width, height);
  const xy = (point: Point) => ({ x: (point.x - crop.x) * baseWidth, y: (point.y - crop.y) * baseHeight });
  for (const stroke of active ? [...model.strokes, active] : model.strokes) {
    if (!stroke.points.length) continue;
    context.strokeStyle = stroke.color; context.fillStyle = stroke.color; context.lineWidth = stroke.width * baseWidth; context.lineCap = 'round'; context.lineJoin = 'round';
    const first = xy(stroke.points[0]), last = xy(stroke.points.at(-1)!);
    context.beginPath();
    if (stroke.kind === 'rectangle') context.rect(first.x, first.y, last.x - first.x, last.y - first.y);
    else { context.moveTo(first.x, first.y); for (const point of stroke.points) { const position = xy(point); context.lineTo(position.x, position.y); } }
    context.stroke();
    if (stroke.kind === 'arrow') {
      const angle = Math.atan2(last.y - first.y, last.x - first.x), head = Math.max(12, context.lineWidth * 5);
      context.beginPath(); context.moveTo(last.x, last.y); context.lineTo(last.x - head * Math.cos(angle - .5), last.y - head * Math.sin(angle - .5)); context.moveTo(last.x, last.y); context.lineTo(last.x - head * Math.cos(angle + .5), last.y - head * Math.sin(angle + .5)); context.stroke();
    }
  }
  if (selection) {
    const x = (selection.x - crop.x) * baseWidth, y = (selection.y - crop.y) * baseHeight, w = selection.width * baseWidth, h = selection.height * baseHeight;
    context.fillStyle = '#0009'; context.fillRect(0, 0, width, y); context.fillRect(0, y + h, width, height - y - h); context.fillRect(0, y, x, h); context.fillRect(x + w, y, width - x - w, h);
    context.strokeStyle = '#fff'; context.lineWidth = Math.max(1, baseWidth / 500); context.setLineDash([10, 6]); context.strokeRect(x, y, w, h); context.setLineDash([]);
  }
}
export function ImageAttachmentEditor({ file, onApply, onClose }: { file: File; onApply(file: File): void; onClose(): void }) {
  const canvas = useRef<HTMLCanvasElement>(null), image = useRef<HTMLImageElement | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [model, setModel] = useState<Model>(original), [tool, setTool] = useState<'draw' | 'crop' | 'arrow' | 'rectangle'>('crop');
  const [color, setColor] = useState('#ff3838'), [width, setWidth] = useState(4), [ready, setReady] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<MediaRect | null>(null), [undoCount, setUndoCount] = useState(0);
  const history = useRef<Model[]>([]), active = useRef<Stroke | null>(null), selection = useRef<MediaRect | null>(null), first = useRef<Point | null>(null), frame = useRef<number | null>(null), mounted = useRef(true);
  const latest = useRef(model);
  useLayoutEffect(() => { latest.current = model; }, [model]);
  function paint() { if (canvas.current && image.current) renderImage(canvas.current, image.current, latest.current, active.current, selection.current); }
  function schedulePaint() { if (frame.current === null) frame.current = requestAnimationFrame(() => { frame.current = null; paint(); }); }
  function commit(next: Model) { history.current = [...history.current.slice(-19), latest.current]; latest.current = next; setModel(next); setUndoCount(history.current.length); }
  useEffect(() => {
    mounted.current = true;
    const url = URL.createObjectURL(file), element = new Image(); let alive = true;
    element.onload = () => { if (alive) { image.current = element; setReady(true); } }; element.onerror = () => { if (alive) setError('Não foi possível abrir esta imagem para edição. Você pode usar o original.'); }; element.src = url;
    return () => { alive = false; mounted.current = false; image.current = null; URL.revokeObjectURL(url); if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, [file]);
  useEffect(() => { if (ready) paint(); }, [ready, model]); // The canvas is a local preview; pointer moves paint outside React.
  function point(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const rectangle = event.currentTarget.getBoundingClientRect(), crop = latest.current.crop;
    return { x: crop.x + Math.min(1, Math.max(0, (event.clientX - rectangle.left) / rectangle.width)) * crop.width, y: crop.y + Math.min(1, Math.max(0, (event.clientY - rectangle.top) / rectangle.height)) * crop.height };
  }
  function applyCrop() { if (selected && selected.width > .002 && selected.height > .002) { commit({ ...latest.current, crop: selected }); selection.current = null; setSelected(null); } }
  async function finish() {
    if (!image.current || busy) return;
    setBusy(true); setError('');
    try {
      const output = document.createElement('canvas');
      const finalModel = selected && selected.width > .002 && selected.height > .002 ? { ...latest.current, crop: selected } : latest.current;
      renderImage(output, image.current, finalModel, null, null, 4096);
      const type = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
      const blob = await new Promise<Blob>((resolve, reject) => output.toBlob(value => value ? resolve(value) : reject(new Error('Não foi possível exportar a imagem.')), type, .92));
      if (blob.size > 20 * 1024 * 1024) throw new Error('A imagem editada excedeu 20 MB. Reduza o corte ou use o original.');
      if (mounted.current) onApply(new File([blob], file.name.replace(/\.[^.]+$/, '') + '-editada.' + (type === 'image/jpeg' ? 'jpg' : 'png'), { type }));
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Não foi possível editar.'); }
    finally { if (mounted.current) setBusy(false); }
  }
  return <Dialog.Root open onOpenChange={value => { if (!value) onClose(); }}><Dialog.Portal><Dialog.Overlay className="nex-media-backdrop" /><Dialog.Content className="nex-media-dialog nex-image-editor" onOpenAutoFocus={() => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }} onCloseAutoFocus={event => { if (returnFocus.current?.isConnected) { event.preventDefault(); returnFocus.current.focus({preventScroll:true}); } }} onEscapeKeyDown={event => event.stopPropagation()}>
    <header className="nex-media-toolbar"><Dialog.Title>Editar imagem · {file.name}</Dialog.Title><Dialog.Close aria-label="Cancelar edição"><X size={22} /></Dialog.Close></header>
    <Dialog.Description className="nex-media-help">Arraste para cortar ou marcar. A edição cria uma cópia; o original é preservado.{file.type === 'image/gif' ? ' Ao editar um GIF, a cópia será estática.' : ''}</Dialog.Description>
    <div className="nex-editor-tools">{([{ id: 'crop', label: 'Cortar', icon: Crop }, { id: 'draw', label: 'Riscar', icon: Pencil }, { id: 'arrow', label: 'Seta', icon: ArrowUpRight }, { id: 'rectangle', label: 'Retângulo', icon: Square }] as const).map(item => <button key={item.id} type="button" aria-pressed={tool === item.id} onClick={() => { setTool(item.id); selection.current = null; setSelected(null); schedulePaint(); }}><item.icon size={17} />{item.label}</button>)}<label>Cor<input type="color" value={color} onChange={event => setColor(event.target.value)} /></label><label>Traço<input type="range" min={2} max={12} value={width} onChange={event => setWidth(Number(event.target.value))} /></label><button type="button" disabled={!undoCount || busy} onClick={() => { const previous = history.current.pop(); if (previous) { latest.current = previous; setModel(previous); setUndoCount(history.current.length); } selection.current = null; setSelected(null); }}><Undo2 size={17} />Desfazer</button><button type="button" onClick={() => { commit(original()); selection.current = null; setSelected(null); }}><RotateCcw size={17} />Restaurar</button>{selected && <button type="button" onClick={applyCrop}>Aplicar corte</button>}</div>
    <div className="nex-editor-canvas-area">{!ready && !error && <p role="status">Carregando imagem…</p>}<canvas ref={canvas} aria-label="Área de edição da imagem" hidden={!ready} onPointerDown={event => {
      if (!ready || busy || event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); first.current = point(event); selection.current = null; setSelected(null);
      if (tool !== 'crop') active.current = { kind: tool, color, width: width / 1000, points: [first.current] };
    }} onPointerMove={event => { if (!first.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return; const next = point(event); if (tool === 'crop') selection.current = selectionRect(first.current, next, latest.current.crop); else if (active.current) { if (tool === 'draw') { if (active.current.points.length < 12000) active.current.points.push(next); } else active.current.points = [first.current, next]; } schedulePaint(); }} onPointerUp={event => { if (!first.current) return; if (active.current) commit({ ...latest.current, strokes: [...latest.current.strokes, active.current] }); else setSelected(selection.current); active.current = null; first.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); schedulePaint(); }} onPointerCancel={() => { first.current = null; active.current = null; selection.current = null; setSelected(null); schedulePaint(); }} /></div>
    {error && <p className="nex-editor-error" role="alert">{error}</p>}<footer className="nex-editor-footer"><button type="button" disabled={busy} onClick={() => onApply(file)}>Usar original</button><button type="button" disabled={!ready || busy} onClick={() => void finish()}>{busy ? 'Preparando…' : 'Aplicar edição'}</button></footer>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
