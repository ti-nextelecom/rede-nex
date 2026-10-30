const limit=(value,min,max)=>Math.max(min,Math.min(Number.isFinite(value)?value:min,Math.max(min,max)));
export function floatingBounds(width,height,size=54,header=0,bottom=0) {
  const maxY=Math.max(12,height-size-bottom-16);
  return {minX:12,minY:Math.min(maxY,Math.max(12,header+8)),maxX:Math.max(12,width-size-12),maxY};
}
export function clampFloatingPosition(point,bounds) {
  return {x:limit(point.x,bounds.minX,bounds.maxX),y:limit(point.y,Math.min(bounds.minY,bounds.maxY),bounds.maxY)};
}
export function restoreFloatingPosition(raw,bounds) {
  try {
    const stored=JSON.parse(raw);
    if(stored?.version!==1 || !Number.isFinite(stored.x) || !Number.isFinite(stored.y))throw new Error();
    return clampFloatingPosition({x:bounds.minX+limit(stored.x,0,1)*(bounds.maxX-bounds.minX),y:bounds.minY+limit(stored.y,0,1)*(bounds.maxY-bounds.minY)},bounds);
  }catch{return clampFloatingPosition({x:bounds.minX,y:bounds.maxY},bounds);}
}
export function serializeFloatingPosition(point,bounds) {
  const clamped=clampFloatingPosition(point,bounds);
  return JSON.stringify({version:1,x:(clamped.x-bounds.minX)/Math.max(1,bounds.maxX-bounds.minX),y:(clamped.y-bounds.minY)/Math.max(1,bounds.maxY-bounds.minY)});
}
