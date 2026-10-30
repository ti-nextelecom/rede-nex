export interface MediaAsset { temporary?: boolean; url: string; name?: string; type?: string; kind?: 'image' | 'pdf' | 'video' | 'audio' | 'file' }
export interface MediaRect { x: number; y: number; width: number; height: number }
export function safeMediaSource(value: unknown): string | null;
export function mediaKind(asset: Partial<MediaAsset>): 'image' | 'pdf' | 'video' | 'audio' | 'file';
export function clampZoom(value: number): number;
export function fitMedia(width: number, height: number, viewportWidth: number, viewportHeight: number, zoom?: number): { width: number; height: number };
export function selectionRect(a: {x:number;y:number}, b:{x:number;y:number}, crop?:MediaRect): MediaRect;
