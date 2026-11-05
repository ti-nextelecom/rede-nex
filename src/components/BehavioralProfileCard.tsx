import { Link } from 'react-router-dom';
import { BehavioralIdentity } from './BehavioralIdentity';
import { ArrowRight, PawPrint } from 'lucide-react';
import { behavioralIdentity } from '../../shared/behavioralProfiles.mjs';
import { useBehavioralBadges } from '../lib/behavioralBadges';
import './behavioral-identity.css';
export function BehavioralProfileCard({userId}:{userId?:string}){const badges=useBehavioralBadges(),entry=userId?badges.get(userId):undefined,identity=behavioralIdentity(entry);return <div className="behavioral-identity-card">{identity&&!['blend','balanced'].includes(entry!.mode)?<img src={identity.image} alt="" loading="lazy"/>:<PawPrint size={35} aria-hidden="true"/>}<div><strong>Seu perfil comportamental</strong><p>Conheça suas preferências e descubra seu avatar no modelo NEX.</p>{identity&&<div className="mt-2"><BehavioralIdentity userId={userId} compact/></div>}<Link to="/perfil-comportamental">{identity?'Ver meu resultado':'Responder questionário'}<ArrowRight size={13}/></Link></div></div>;}
