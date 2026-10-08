import { useEffect, useState } from 'react';
import { X, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface Props {
  src: string;
  alt?: string;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, onClose }: Props) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    setScale(s => Math.min(5, Math.max(0.5, s - e.deltaY * 0.002)));
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/92"
      onClick={onClose}
    >
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <button
          className="p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          onClick={e => { e.stopPropagation(); setScale(s => Math.min(5, s + 0.5)); }}
          title="Aproximar"
        >
          <ZoomIn size={18} />
        </button>
        <span className="text-white text-sm font-semibold min-w-[44px] text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          className="p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          onClick={e => { e.stopPropagation(); setScale(s => Math.max(0.5, s - 0.5)); }}
          title="Afastar"
        >
          <ZoomOut size={18} />
        </button>
        <button
          className="p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          onClick={onClose}
          title="Fechar (Esc)"
        >
          <X size={18} />
        </button>
      </div>
      <div
        className="overflow-auto max-w-[95vw] max-h-[92vh] flex items-center justify-center"
        onWheel={handleWheel}
        onClick={e => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt || 'Imagem'}
          style={{ transform: `scale(${scale})`, transformOrigin: 'center center', transition: 'transform 0.15s ease' }}
          className="max-w-[92vw] max-h-[88vh] object-contain select-none"
          draggable={false}
        />
      </div>
      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-xs">
        Scroll para zoom · Esc para fechar
      </p>
    </div>
  );
}
