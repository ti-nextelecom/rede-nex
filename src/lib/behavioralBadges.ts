import { createContext, useContext } from 'react';
import type { BehavioralBadgeEntry } from './behavioralApi';
export const BEHAVIORAL_CHANGED='nex:behavioral-profile-changed';
const empty=new Map<string,BehavioralBadgeEntry>();
export const BehavioralBadgesContext=createContext<ReadonlyMap<string,BehavioralBadgeEntry>>(empty);
export const useBehavioralBadges=()=>useContext(BehavioralBadgesContext);
export function behavioralProfileChanged(){window.dispatchEvent(new Event(BEHAVIORAL_CHANGED));}
