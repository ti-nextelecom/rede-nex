export interface FloatingPoint { x:number;y:number }
export interface FloatingBounds { minX:number;minY:number;maxX:number;maxY:number }
export function floatingBounds(width:number,height:number,size?:number,header?:number,bottom?:number):FloatingBounds;
export function clampFloatingPosition(point:FloatingPoint,bounds:FloatingBounds):FloatingPoint;
export function restoreFloatingPosition(raw:string|null,bounds:FloatingBounds):FloatingPoint;
export function serializeFloatingPosition(point:FloatingPoint,bounds:FloatingBounds):string;
