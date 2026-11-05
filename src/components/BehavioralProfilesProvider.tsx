import { useEffect, useRef, useState, type ReactNode } from 'react';
import { getBehavioralBadges, type BehavioralBadgeEntry } from '../lib/behavioralApi';
import { BEHAVIORAL_CHANGED, BehavioralBadgesContext } from '../lib/behavioralBadges';
import { useAuth } from '../lib/auth';
const empty=new Map<string,BehavioralBadgeEntry>();
export function BehavioralProfilesProvider({children}:{children:ReactNode}){
  const {user}=useAuth();const [state,setState]=useState<{owner:string;entries:ReadonlyMap<string,BehavioralBadgeEntry>;signature:string}>({owner:'',entries:empty,signature:''});const sequence=useRef(0);
  useEffect(()=>{if(!user?.id)return;let alive=true,enabled=true;const owner=user.id;
    const load=async()=>{if(!enabled)return;const request=++sequence.current;try{const rows=await getBehavioralBadges();if(alive&&request===sequence.current){const signature=JSON.stringify(rows);setState(previous=>previous.owner===owner&&previous.signature===signature?previous:{owner,signature,entries:new Map(rows.map(row=>[row.user_id,row]))});}}catch(error){if(error instanceof Error&&/API (404|503)/.test(error.message))enabled=false;}};
    void load();const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void load();},60000);const refresh=()=>{enabled=true;void load();};window.addEventListener('focus',load);window.addEventListener(BEHAVIORAL_CHANGED,refresh);
    return()=>{alive=false;window.clearInterval(timer);window.removeEventListener('focus',load);window.removeEventListener(BEHAVIORAL_CHANGED,refresh);};
  },[user?.id]);
  return <BehavioralBadgesContext.Provider value={state.owner===user?.id?state.entries:empty}>{children}</BehavioralBadgesContext.Provider>;
}
