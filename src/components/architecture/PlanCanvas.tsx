import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { constrainLine, distance, elementBounds, elementSvg, EQUIPMENT, newId, round, snapPoint, translateElement, type ElementType, type PlanDocument, type PlanElement, type PlanFloor, type Point } from '../../../shared/architecture.mjs';
export type PlanTool='select'|'pan'|'calibrate'|ElementType;
export interface CanvasControls { fit():void;zoom(factor:number):void;cancel():void }
interface Props {document:PlanDocument;floor:PlanFloor;tool:PlanTool;equipmentId:string;selection:string[];grid:boolean;snap:boolean;orthogonal:boolean;coverage:boolean;readOnly:boolean;onSelection(ids:string[]):void;onCommit(elements:PlanElement[]):void;onCalibrate(a:Point,b:Point):void;onPosition(point:Point):void}
interface View {x:number;y:number;width:number;height:number}
type Gesture={kind:'pan';start:Point;view:View;scale:number}|{kind:'move';start:Point;elements:PlanElement[]}|{kind:'box';start:Point}|{kind:'draw';start:Point;client:Point};
const Shape=memo(function Shape({element,coverage,selected,locked}:{element:PlanElement;coverage:boolean;selected:boolean;locked:boolean}) {
  const bounds=elementBounds(element);
  return <g data-plan-element={element.id} className={`arch-plan-object ${locked?'is-locked':''}`}>
    <g dangerouslySetInnerHTML={{__html:elementSvg(element,{coverage})}} />
    {['wall','cable','dimension'].includes(element.type)?<line x1={element.x} y1={element.y} x2={element.x2} y2={element.y2} stroke="transparent" strokeWidth={.35} />:<rect x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} fill="transparent" stroke="none" />}
    {selected&&<rect x={bounds.x-.12} y={bounds.y-.12} width={bounds.width+.24} height={bounds.height+.24} fill="none" stroke="#f97316" strokeWidth={.04} strokeDasharray=".12 .08" pointerEvents="none" />}
  </g>;
});
export const PlanCanvas=forwardRef<CanvasControls,Props>(function PlanCanvas({document:doc,floor,tool,equipmentId,selection,grid,snap,orthogonal,coverage,readOnly,onSelection,onCommit,onCalibrate,onPosition},ref) {
  const svg=useRef<SVGSVGElement>(null),gesture=useRef<Gesture|null>(null),frame=useRef<number|null>(null),latestMove=useRef<React.PointerEvent<SVGSVGElement>|null>(null);
  const [view,setView]=useState<View>({x:-1,y:-1,width:doc.width+2,height:doc.height+2});
  const [anchor,setAnchor]=useState<Point|null>(null),[cursor,setCursor]=useState<Point|null>(null),[ghost,setGhost]=useState<PlanElement[]|null>(null),[box,setBox]=useState<{a:Point;b:Point}|null>(null),[space,setSpace]=useState(false);
  const locked=useMemo(()=>new Set(doc.layers.filter(layer=>layer.locked).map(layer=>layer.id)),[doc.layers]);
  const hidden=useMemo(()=>new Set(doc.layers.filter(layer=>!layer.visible).map(layer=>layer.id)),[doc.layers]);
  const selected=new Set(selection);
  function point(client:Point):Point {const matrix=svg.current?.getScreenCTM();if(!matrix)return {x:0,y:0};const transformed=new DOMPoint(client.x,client.y).matrixTransform(matrix.inverse());return {x:transformed.x,y:transformed.y};}
  const cancel=useCallback(()=>{gesture.current=null;setAnchor(null);setGhost(null);setBox(null);},[]);
  const zoom=useCallback((factor:number,around?:Point)=>{setView(old=>{const width=Math.min(1200,Math.max(2,old.width*factor)),actual=width/old.width,center=around||{x:old.x+old.width/2,y:old.y+old.height/2};return {x:center.x-(center.x-old.x)*actual,y:center.y-(center.y-old.y)*actual,width,height:old.height*actual};});},[]);
  useImperativeHandle(ref,()=>({fit:()=>setView({x:-1,y:-1,width:doc.width+2,height:doc.height+2}),zoom:factor=>zoom(factor),cancel}),[doc.width,doc.height,cancel,zoom]);
  useEffect(()=>{
    const element=svg.current;if(!element)return;
    const wheel=(event:WheelEvent)=>{event.preventDefault();const matrix=element.getScreenCTM();if(!matrix)return;const position=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());const factor=Math.exp(Math.max(-200,Math.min(200,event.deltaY))*.002);zoom(factor,position);};
    const keydown=(event:KeyboardEvent)=>{if((event.target as Element)?.closest('input,textarea,select,[role="dialog"]'))return;if(event.code==='Space'){event.preventDefault();setSpace(true);}if(event.key==='Escape')cancel();};
    const keyup=(event:KeyboardEvent)=>{if(event.code==='Space')setSpace(false);};const blur=()=>setSpace(false);
    element.addEventListener('wheel',wheel,{passive:false});window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',blur);
    return()=>{element.removeEventListener('wheel',wheel);window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);if(frame.current!==null)cancelAnimationFrame(frame.current);};
  },[cancel,zoom]);
  useEffect(()=>{cancel();},[tool,floor.id,cancel]);
  function createElement(start:Point,end:Point,kind=tool):PlanElement|null {
    if(!['wall','room','dimension','cable'].includes(kind))return null;
    const finish=constrainLine(start,end,orthogonal&&kind!=='room');if(distance(start,finish)<.1)return null;
    const base={id:'preview',type:kind as ElementType,layer:kind==='dimension'?'notes' as const:kind==='cable'?'network' as const:'structure' as const,x:start.x,y:start.y,rotation:0,label:''};
    return kind==='room'?{...base,x:Math.min(start.x,finish.x),y:Math.min(start.y,finish.y),width:Math.max(.1,Math.abs(finish.x-start.x)),height:Math.max(.1,Math.abs(finish.y-start.y)),label:'Ambiente',color:'#e2e8f0'}:{...base,x2:finish.x,y2:finish.y,thickness:.15};
  }
  function finishDrawing(start:Point,end:Point) {
    if(tool==='calibrate'){if(distance(start,end)>.1)onCalibrate(start,end);cancel();return;}
    const element=createElement(start,end);if(element){element.id=newId();onCommit([...floor.elements,element]);onSelection([element.id]);}cancel();
  }
  function placeEquipment(id:string,position:Point){
    const definition=EQUIPMENT.find(item=>item.id===id);if(!definition||readOnly||locked.has(definition.layer)||hidden.has(definition.layer))return;
    const count=doc.floors.flatMap(item=>item.elements).filter(item=>item.type==='equipment'&&EQUIPMENT.find(entry=>entry.id===item.equipment)?.code===definition.code).length;
    const element:PlanElement={id:newId(),type:'equipment',layer:definition.layer,...position,rotation:0,label:`${definition.code} ${String(count+1).padStart(2,'0')}`,equipment:id,size:.7,fov:90,range:6,height:2.5,model:'',address:''};onCommit([...floor.elements,element]);onSelection([element.id]);
  }
  function moveElements(active:Extract<Gesture,{kind:'move'}>,position:Point){const first=active.elements[0],destination=snapPoint({x:first.x+position.x-active.start.x,y:first.y+position.y-active.start.y},.1,snap),dx=destination.x-first.x,dy=destination.y-first.y;return active.elements.map(item=>translateElement(item,dx,dy));}
  function move(event:React.PointerEvent<SVGSVGElement>) {
    const raw=point({x:event.clientX,y:event.clientY}),position=snapPoint(raw,.1,snap);onPosition(position);setCursor(position);
    const active=gesture.current;if(!active)return;
    if(active.kind==='pan'){const dx=(event.clientX-active.start.x)/active.scale,dy=(event.clientY-active.start.y)/active.scale;setView({...active.view,x:active.view.x-dx,y:active.view.y-dy});}
    else if(active.kind==='move')setGhost(moveElements(active,raw));
    else if(active.kind==='box')setBox({a:active.start,b:position});
  }
  const preview=anchor&&cursor?createElement(anchor,cursor):null;
  const ghostMap=new Map(ghost?.map(element=>[element.id,element]));
  const elements=useMemo(()=>floor.elements.filter(element=>!hidden.has(element.layer)).slice().sort((a,b)=>(a.type==='room'?-1:0)-(b.type==='room'?-1:0)),[floor.elements,hidden]);
  return <div className="arch-canvas-wrap"><svg ref={svg} className={`arch-canvas tool-${space?'pan':tool}`} role="application" aria-label="Editor de planta baixa 2D. Role para ampliar, espaço e arraste para mover. Use a lista de objetos para seleção por teclado." tabIndex={0} viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
    onContextMenu={event=>{event.preventDefault();cancel();}}
    onDragOver={event=>{if(event.dataTransfer.types.includes('application/x-nex-equipment'))event.preventDefault();}}
    onDrop={event=>{const id=event.dataTransfer.getData('application/x-nex-equipment');if(id){event.preventDefault();placeEquipment(id,snapPoint(point({x:event.clientX,y:event.clientY}),.1,snap));}}}
    onPointerDown={event=>{
      if(event.button===2)return;svg.current?.focus({preventScroll:true});const raw=point({x:event.clientX,y:event.clientY}),position=snapPoint(raw,.1,snap);
      if(event.button===1||space||tool==='pan'){event.preventDefault();gesture.current={kind:'pan',start:{x:event.clientX,y:event.clientY},view,scale:svg.current?.getScreenCTM()?.a||1};event.currentTarget.setPointerCapture(event.pointerId);return;}
      if(tool==='select'){
        const id=(event.target as Element).closest('[data-plan-element]')?.getAttribute('data-plan-element');
        if(id){const ids=event.shiftKey?(selected.has(id)?selection.filter(value=>value!==id):[...selection,id]):selected.has(id)?selection:[id];onSelection(ids);const movable=floor.elements.filter(element=>ids.includes(element.id)&&!locked.has(element.layer));if(!readOnly&&movable.length&&!event.shiftKey){gesture.current={kind:'move',start:raw,elements:movable};event.currentTarget.setPointerCapture(event.pointerId);}}
        else {if(!event.shiftKey)onSelection([]);gesture.current={kind:'box',start:position};event.currentTarget.setPointerCapture(event.pointerId);}return;
      }
      if(readOnly)return;
      const layer=tool==='equipment'?EQUIPMENT.find(item=>item.id===equipmentId)?.layer:tool==='text'||tool==='dimension'?'notes':tool==='cable'?'network':'structure';if(layer&&(locked.has(layer)||hidden.has(layer)))return;
      if(tool==='equipment'){placeEquipment(equipmentId,position);return;}
      if(['door','window','text'].includes(tool)){const element:PlanElement={id:newId(),type:tool as ElementType,layer:tool==='text'?'notes':'structure',...position,rotation:0,label:tool==='text'?'Anotação':'',width:tool==='door'?.9:1.2,fontSize:.3};onCommit([...floor.elements,element]);onSelection([element.id]);return;}
      if(anchor){finishDrawing(anchor,position);return;}setAnchor(position);setCursor(position);gesture.current={kind:'draw',start:position,client:{x:event.clientX,y:event.clientY}};event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event=>{latestMove.current=event;if(frame.current===null)frame.current=requestAnimationFrame(()=>{frame.current=null;if(latestMove.current)move(latestMove.current);});}}
    onPointerUp={event=>{
      const active=gesture.current;gesture.current=null;if(frame.current!==null){cancelAnimationFrame(frame.current);frame.current=null;}latestMove.current=null;
      if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);if(!active)return;
      const raw=point({x:event.clientX,y:event.clientY}),position=snapPoint(raw,.1,snap);
      if(active.kind==='move'){const moved=moveElements(active,raw),map=new Map(moved.map(item=>[item.id,item]));if(moved.some((item,index)=>item.x!==active.elements[index].x||item.y!==active.elements[index].y))onCommit(floor.elements.map(item=>map.get(item.id)||item));setGhost(null);}
      else if(active.kind==='draw'&&Math.hypot(event.clientX-active.client.x,event.clientY-active.client.y)>5)finishDrawing(active.start,position);
      else if(active.kind==='box'){const left=Math.min(active.start.x,position.x),top=Math.min(active.start.y,position.y),right=Math.max(active.start.x,position.x),bottom=Math.max(active.start.y,position.y);if(right-left>.1&&bottom-top>.1){const ids=elements.filter(item=>{const bounds=elementBounds(item);return bounds.x>=left&&bounds.y>=top&&bounds.x+bounds.width<=right&&bounds.y+bounds.height<=bottom;}).map(item=>item.id);onSelection(event.shiftKey?[...new Set([...selection,...ids])]:ids);}setBox(null);}
    }} onPointerCancel={cancel}>
    <defs><pattern id={`plan-grid-${floor.id}`} width=".5" height=".5" patternUnits="userSpaceOnUse"><path d="M.5 0H0V.5" fill="none" stroke="#cbd5e1" strokeWidth=".012"/></pattern><pattern id={`plan-major-${floor.id}`} width="5" height="5" patternUnits="userSpaceOnUse"><path d="M5 0H0V5" fill="none" stroke="#b6c5d7" strokeWidth=".025"/></pattern></defs>
    <rect x={view.x} y={view.y} width={view.width} height={view.height} fill="#e7edf4"/>
    <rect width={doc.width} height={doc.height} fill="#fffefb" stroke="#94a3b8" strokeWidth=".03"/>
    {grid&&<g pointerEvents="none"><rect width={doc.width} height={doc.height} fill={`url(#plan-grid-${floor.id})`}/><rect width={doc.width} height={doc.height} fill={`url(#plan-major-${floor.id})`}/></g>}
    {floor.background&&<image href={floor.background.src} x={floor.background.x} y={floor.background.y} width={floor.background.width} height={floor.background.height} opacity={floor.background.opacity} preserveAspectRatio="none" pointerEvents="none"/>}
    {elements.map(element=><Shape key={element.id} element={ghostMap.get(element.id)||element} coverage={coverage} selected={selected.has(element.id)} locked={locked.has(element.layer)}/>) }
    {preview&&<g opacity={.6} pointerEvents="none" dangerouslySetInnerHTML={{__html:elementSvg(preview,{coverage:false})}}/>}
    {anchor&&cursor&&tool==='calibrate'&&<line x1={anchor.x} y1={anchor.y} x2={cursor.x} y2={cursor.y} stroke="#f97316" strokeWidth=".06" strokeDasharray=".16 .1"/>}
    {anchor&&<circle cx={anchor.x} cy={anchor.y} r={.1} fill="#f97316" pointerEvents="none"/>}
    {box&&<rect x={Math.min(box.a.x,box.b.x)} y={Math.min(box.a.y,box.b.y)} width={Math.abs(box.b.x-box.a.x)} height={Math.abs(box.b.y-box.a.y)} fill="#f9731617" stroke="#f97316" strokeWidth=".04" pointerEvents="none"/>}
    <g pointerEvents="none" fill="#64748b" fontSize=".22"><text x=".2" y="-.22">0,0</text><text x={doc.width-.1} y="-.22" textAnchor="end">{round(doc.width)} m</text></g>
  </svg>{anchor&&<div className="arch-canvas-hint">{tool==='room'?'Marque o canto oposto do ambiente.':tool==='calibrate'?'Marque o segundo ponto da medida conhecida.':'Marque o segundo ponto.'} <kbd>Esc</kbd> cancela</div>}</div>;
});
