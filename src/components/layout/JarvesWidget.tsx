import { useEffect,useId,useRef,useState,type PointerEvent,type KeyboardEvent } from 'react';
import { Bot, GripVertical, RotateCcw, X } from 'lucide-react';
import { DashboardCopilotChat } from '../DashboardCopilotChat';
import { useAuth } from '../../lib/auth';
import { initAudioContext } from '../../hooks/useAudioContext';
import {clampFloatingPosition,floatingBounds,restoreFloatingPosition,serializeFloatingPosition,type FloatingPoint} from '../../../shared/floatingPosition.mjs';
import './jarves-widget.css';


export function JarvesWidget() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const [position,setPosition]=useState<FloatingPoint|null>(null);
  const [dragging,setDragging]=useState(false);
  const fabRef=useRef<HTMLButtonElement>(null);
  const pointRef=useRef<FloatingPoint>({x:12,y:12});
  const gesture=useRef<{id:number;x:number;y:number;start:FloatingPoint}|null>(null);
  const moved=useRef(false);
  const helpId=useId();
  const storageKey=`nex.jarvis.position.v1:${user?.id || 'anonymous'}`;

  function bounds(){
    const style=getComputedStyle(document.documentElement);
    return floatingBounds(window.innerWidth,window.visualViewport?.height || window.innerHeight,
      fabRef.current?.offsetWidth || 54,parseFloat(style.getPropertyValue('--nex-header-height')) || 0,
      window.innerWidth<768 ? document.querySelector('.nex-bottom-nav')?.getBoundingClientRect().height || 76:0);
  }
  function place(point:FloatingPoint,persist=false){
    const area=bounds(),next=clampFloatingPosition(point,area);
    pointRef.current=next;setPosition(next);
    if(persist)try{localStorage.setItem(storageKey,serializeFloatingPosition(next,area));}catch{/* Position remains usable when storage is unavailable. */}
  }
  function resetPosition(){
    try{localStorage.removeItem(storageKey);}catch{}
    const area=bounds();place({x:area.minX,y:area.maxY});
  }
  useEffect(()=>{
    let normalized:string|null=null;
    try{normalized=localStorage.getItem(storageKey);}catch{}
    const restore=()=>{const next=restoreFloatingPosition(normalized,bounds());pointRef.current=next;setPosition(next);};
    restore();
    // Keep the chosen relative position when changing screen size or opening a keyboard.
    const resize=()=>{try{normalized=localStorage.getItem(storageKey);}catch{}restore();};
    window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);
    return()=>{window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize);};
  },[storageKey]);
  useEffect(()=>{
    if(!open)return;
    const escape=(event:globalThis.KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);fabRef.current?.focus();}};
    window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);
  },[open]);
  function pointerDown(event:PointerEvent<HTMLButtonElement>){
    if(event.button!==0 || !event.isPrimary)return;
    moved.current=false;
    gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,start:pointRef.current};
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event:PointerEvent<HTMLButtonElement>){
    const start=gesture.current;if(!start || start.id!==event.pointerId)return;
    const dx=event.clientX-start.x,dy=event.clientY-start.y;
    if(!moved.current && Math.hypot(dx,dy)<6)return;
    moved.current=true;setDragging(true);place({x:start.start.x+dx,y:start.start.y+dy});
  }
  function pointerEnd(event:PointerEvent<HTMLButtonElement>){
    if(gesture.current?.id!==event.pointerId)return;
    if(moved.current)place(pointRef.current,true);
    gesture.current=null;setDragging(false);
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function moveWithKeyboard(event:KeyboardEvent<HTMLButtonElement>){
    const steps:Record<string,FloatingPoint>={ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1}};
    if(event.key==='Home'){event.preventDefault();resetPosition();return;}
    const step=steps[event.key];if(!step)return;
    event.preventDefault();const distance=event.shiftKey?48:16;
    place({x:pointRef.current.x+step.x*distance,y:pointRef.current.y+step.y*distance},true);
  }
  const viewportHeight=window.visualViewport?.height || window.innerHeight;
  const panelWidth=Math.min(420,window.innerWidth-24);
  const panelHeight=Math.min(640,viewportHeight-32);
  const point=position || pointRef.current;
  const panelLeft=Math.max(12,Math.min(point.x,window.innerWidth-panelWidth-12));
  const roomAbove=point.y-12,roomBelow=viewportHeight-point.y-66;
  const panelTop=roomAbove>=Math.min(360,panelHeight) ? Math.max(12,point.y-panelHeight-12)
    : roomBelow>=Math.min(360,panelHeight) ? point.y+66 : Math.max(12,(viewportHeight-panelHeight)/2);

  function handleNavigate() {
    setOpen(false);
  }

  return <>
    {open && (
      <div
        className="jarves-widget-overlay"
        onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
      >
        <div className="jarves-widget-panel jarves-widget-movable-panel" role='dialog' aria-label='Jarvis — assistente pessoal'
          style={{left:panelLeft,top:panelTop,width:panelWidth,maxHeight:Math.min(panelHeight,viewportHeight-panelTop-12)}}>
          <div className='jarves-position-toolbar'>
            <button type='button' className='jarves-drag-handle' aria-label='Mover Jarvis' title='Arraste para mover; use as setas pelo teclado'
              onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onLostPointerCapture={()=>{gesture.current=null;setDragging(false);}} onKeyDown={moveWithKeyboard}>
              <GripVertical size={17}/><span>Mover Jarvis</span>
            </button>
            <button type='button' aria-label='Restaurar posição do Jarvis' title='Restaurar posição' onClick={resetPosition}><RotateCcw size={17}/></button>
            <button type='button' aria-label='Fechar painel do Jarvis' onClick={()=>{setOpen(false);fabRef.current?.focus();}}><X size={19}/></button>
          </div>
          <DashboardCopilotChat
            autoStartConversation
            autoStartListening={false}
            userName={user?.name ?? undefined}
            onNavigate={handleNavigate}
          />
        </div>
      </div>
    )}
    <button
      ref={fabRef}
      type="button"
      className={`jarves-widget-fab${open ? ' is-open' : ''}${dragging?' is-dragging':''}`}
      style={position?{left:position.x,top:position.y,bottom:'auto'}:undefined}
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd}
      onLostPointerCapture={()=>{gesture.current=null;setDragging(false);}}
      onKeyDown={moveWithKeyboard}
      aria-describedby={helpId}
      onClick={event => {
        if(event.detail>0 && moved.current)return;
        if (!open) {
          try { initAudioContext(); } catch {}
        }
        setOpen(p => !p);
      }}
      aria-label={open ? 'Fechar Jarves' : 'Abrir Jarves — Assistente pessoal'}
      title="Jarvis — arraste para mover ou clique para conversar"
    >
      {open ? <X size={22} /> : <Bot size={22} />}
    </button>
    <span id={helpId} className='sr-only'>Arraste para reposicionar. Use as setas para mover, Shift para mover mais e Home para restaurar. Enter abre ou fecha o assistente.</span>
  </>;
}
