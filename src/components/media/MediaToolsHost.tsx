import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MEDIA_EDIT, MEDIA_OPEN, setMediaHostReady } from '../../lib/mediaTools';
import type { MediaAsset } from '../../../shared/mediaTools.mjs';
import { MediaViewer } from './MediaViewer';
import { ImageAttachmentEditor } from './ImageAttachmentEditor';
interface EditRequest { key: number; file: File; resolve(file: File | null): void }
export function MediaToolsHost() {
  const [asset, setAsset] = useState<MediaAsset | null>(null), [request, setRequest] = useState<EditRequest | null>(null);
  const queue = useRef<EditRequest[]>([]), active = useRef<EditRequest | null>(null);
  const sequence = useRef(0);
  const location = useLocation();
  function complete(file: File | null) { active.current?.resolve(file); const next = queue.current.shift() || null; active.current = next; setRequest(next); }
  useEffect(() => () => { if (asset?.temporary && asset.url.startsWith('blob:')) URL.revokeObjectURL(asset.url); }, [asset]);
  useEffect(() => {
    setMediaHostReady(true);
    const open = (event: Event) => setAsset((event as CustomEvent<MediaAsset>).detail);
    const edit = (event: Event) => { const value = { ...(event as CustomEvent<EditRequest>).detail, key: ++sequence.current }; if (active.current) queue.current.push(value); else { active.current = value; setRequest(value); } };
    window.addEventListener(MEDIA_OPEN, open); window.addEventListener(MEDIA_EDIT, edit);
    return () => { setMediaHostReady(false); window.removeEventListener(MEDIA_OPEN, open); window.removeEventListener(MEDIA_EDIT, edit); active.current?.resolve(null); queue.current.forEach(item => item.resolve(null)); active.current = null; queue.current = []; };
  }, []);
  useEffect(() => { setAsset(null); active.current?.resolve(null); queue.current.forEach(item => item.resolve(null)); active.current = null; queue.current = []; setRequest(null); }, [location.key]);
  return <>{asset && <MediaViewer key={asset.url} asset={asset} onClose={() => setAsset(null)} />}{request && <ImageAttachmentEditor key={request.key} file={request.file} onApply={complete} onClose={() => complete(null)} />}</>;
}
