import { safeMediaSource, type MediaAsset } from '../../shared/mediaTools.mjs';
export const MEDIA_OPEN = 'nex:media-open';
export const MEDIA_EDIT = 'nex:media-edit';
export let mediaHostReady = false;
export function setMediaHostReady(value: boolean) { mediaHostReady = value; }
export function openMedia(asset: MediaAsset) {
  const url = safeMediaSource(asset.url);
  if (url) window.dispatchEvent(new CustomEvent(MEDIA_OPEN, { detail: { ...asset, url } }));
}
export function editImage(file: File): Promise<File | null> {
  if (!mediaHostReady || !/^image\/(png|jpeg|webp|gif|avif)$/.test(file.type)) return Promise.resolve(file);
  return new Promise(resolve => window.dispatchEvent(new CustomEvent(MEDIA_EDIT, { detail: { file, resolve } })));
}
export async function reviewImageUploads(files: File[]) {
  const result: File[] = [];
  for (const file of files) { const reviewed = await editImage(file); if (reviewed) result.push(reviewed); }
  return result;
}
