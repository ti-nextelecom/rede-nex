import { MediaViewer } from '../media/MediaViewer';
export function ImageLightbox({ src, alt, onClose }: { src: string; alt?: string; onClose(): void }) {
  return <MediaViewer key={src} asset={{ url: src, name: alt || 'Imagem', kind: 'image' }} onClose={onClose} />;
}
