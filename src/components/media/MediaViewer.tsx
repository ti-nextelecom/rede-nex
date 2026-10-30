import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Download, ExternalLink, Maximize2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { clampZoom, fitMedia, mediaKind, safeMediaSource, type MediaAsset } from '../../../shared/mediaTools.mjs';
import './media-tools.css';
const PdfPreview = lazy(() => import('./PdfPreview'));
export function MediaViewer({ asset, onClose }: { asset: MediaAsset; onClose(): void }) {
  const [zoom, setZoom] = useState(1), [size, setSize] = useState({ width: 1, height: 1 });
  const [viewport, setViewport] = useState({ width: 800, height: 600 }), [error, setError] = useState(false), [loaded, setLoaded] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ x: 0, y: 0, left: 0, top: 0, distance: 0, zoom: 1 });
  const url = safeMediaSource(asset.url), kind = asset.kind || mediaKind(asset);
  useEffect(() => { const element = stage.current; if (!element) return; const resize = () => setViewport({ width: element.clientWidth, height: element.clientHeight }); const observer = new ResizeObserver(resize); observer.observe(element); resize(); return () => observer.disconnect(); }, []);
  useEffect(() => {
    const element=stage.current; if (!element || kind !== 'image') return;
    const wheel=(event: WheelEvent) => { if (event.ctrlKey) { event.preventDefault(); setZoom(value => clampZoom(value - event.deltaY * .002)); } };
    element.addEventListener('wheel',wheel,{passive:false}); return () => element.removeEventListener('wheel',wheel);
  },[kind]);
  const dimensions = fitMedia(size.width, size.height, viewport.width, viewport.height, zoom);
  function changeZoom(value: number) { setZoom(clampZoom(value)); }
  return <Dialog.Root open onOpenChange={value => { if (!value) onClose(); }}><Dialog.Portal><Dialog.Overlay className="nex-media-backdrop" /><Dialog.Content className="nex-media-dialog" onOpenAutoFocus={() => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }} onCloseAutoFocus={event => { if (returnFocus.current?.isConnected) { event.preventDefault(); returnFocus.current.focus({preventScroll:true}); } }} onEscapeKeyDown={event => event.stopPropagation()} onKeyDown={event => {
    if ((event.target as HTMLElement).matches('input,textarea,select')) return;
    if (['+', '='].includes(event.key)) { event.preventDefault(); changeZoom(zoom + .25); }
    if (event.key === '-') { event.preventDefault(); changeZoom(zoom - .25); }
    if (event.key === '0') changeZoom(1);
  }}>
    <header className="nex-media-toolbar"><Dialog.Title>{asset.name || 'Visualizar anexo'}</Dialog.Title><div>
      {(kind === 'image' || kind === 'pdf') && <><button type="button" aria-label="Diminuir zoom" disabled={zoom <= .25} onClick={() => changeZoom(zoom - .25)}><ZoomOut size={20} /></button><output aria-label="Zoom">{Math.round(zoom * 100)}%</output><button type="button" aria-label="Aumentar zoom" disabled={zoom >= 4} onClick={() => changeZoom(zoom + .25)}><ZoomIn size={20} /></button><button type="button" aria-label="Ajustar à tela" title="Ajustar à tela" onClick={() => changeZoom(1)}><Maximize2 size={20} /></button></>}
      {url && <><a href={url} download={asset.name || undefined} target="_blank" rel="noopener noreferrer" aria-label="Baixar arquivo"><Download size={20} /></a><a href={url} target="_blank" rel="noopener noreferrer" aria-label="Abrir original" title="Abrir original"><ExternalLink size={19} /></a></>}
      <Dialog.Close aria-label="Fechar visualização (Esc)"><X size={22} /></Dialog.Close>
    </div></header><Dialog.Description className="nex-media-help">Esc para fechar · + e − para zoom · 0 para ajustar à tela{kind === 'image' ? ' · arraste para navegar · Ctrl + rolagem para zoom' : ''}</Dialog.Description>
    <div ref={stage} className={`nex-media-stage is-${kind}`} tabIndex={0}
      onPointerDown={event => {
        if (kind !== 'image' || event.button !== 0) return;
        const element = event.currentTarget; pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); element.setPointerCapture(event.pointerId);
        const values = [...pointers.current.values()];
        gesture.current = { x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop, distance: values.length === 2 ? Math.hypot(values[1].x - values[0].x, values[1].y - values[0].y) : 0, zoom };
      }} onPointerMove={event => {
        if (!pointers.current.has(event.pointerId)) return;
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const values = [...pointers.current.values()];
        if (values.length === 2 && gesture.current.distance) changeZoom(gesture.current.zoom * Math.hypot(values[1].x - values[0].x, values[1].y - values[0].y) / gesture.current.distance);
        else if (zoom > 1) { event.currentTarget.scrollLeft = gesture.current.left - event.clientX + gesture.current.x; event.currentTarget.scrollTop = gesture.current.top - event.clientY + gesture.current.y; }
      }} onPointerUp={event => { pointers.current.delete(event.pointerId); }} onPointerCancel={event => { pointers.current.delete(event.pointerId); }} onDoubleClick={() => { if (kind === 'image') changeZoom(zoom === 1 ? 2 : 1); }}>
      {!url || error ? <p role="alert">Não foi possível abrir o anexo. O arquivo original foi preservado.</p> : kind === 'image' ? <div className="nex-image-space" style={{ width: Math.max(viewport.width, dimensions.width + 32), height: Math.max(viewport.height, dimensions.height + 32) }}>{!loaded && <p className="nex-media-loading" role="status">Carregando imagem…</p>}<img src={url} alt={asset.name || 'Imagem'} draggable={false} style={dimensions} onLoad={event => { setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }); setLoaded(true); }} onError={() => setError(true)} /></div>
        : kind === 'pdf' ? <Suspense fallback={<p role="status">Preparando visualizador…</p>}><PdfPreview url={url} width={viewport.width} zoom={zoom} /></Suspense>
          : kind === 'video' ? <video src={url} controls autoPlay={false} /> : kind === 'audio' ? <audio src={url} controls /> : <div className="nex-media-fallback"><p>Este formato pode ser aberto no aplicativo do seu dispositivo.</p><a href={url} target="_blank" rel="noopener noreferrer">Abrir arquivo original</a></div>}
    </div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
