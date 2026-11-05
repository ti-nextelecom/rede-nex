import { useMemo } from 'react';
import { DraftingCompass } from 'lucide-react';
import { floorSvg, type PlanDocument } from '../../../shared/architecture.mjs';
export function PlanThumbnail({document}:{document?:PlanDocument}) {
  const source=useMemo(()=>{if(!document)return null;try{return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(floorSvg(document,document.floors[0].id,{coverage:false}));}catch{return null;}},[document]);
  return source?<img className="arch-plan-thumbnail" alt="Prévia da planta do primeiro pavimento" loading="lazy" src={source}/>:<span className="arch-thumbnail-fallback"><DraftingCompass size={40}/>Planta 2D</span>;
}
