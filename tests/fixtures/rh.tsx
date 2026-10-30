import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../src/lib/auth';
import { HrAccessProvider } from '../../src/lib/hrAccess';
import { HrPage } from '../../src/pages/HrPage';
import { HrPermissionsPanel } from '../../src/components/HrPermissionsPanel';
import '../../src/index.css';
function Fixture() {
  const [permissions,setPermissions]=useState(false);
  const [dark,setDark]=useState(true);
  return <div className={dark ? 'dark' : ''} style={{minHeight:'100vh',background:dark?'#0c1017':'#f1f5f9',padding:'clamp(12px,3vw,38px)'}}>
    <div style={{display:'flex',flexWrap:'wrap',gap:15,paddingBottom:24,color:dark?'#cbd5e1':'#334155',fontSize:13}}><strong>REDE NEX · TESTE ISOLADO · dados fictícios</strong><button onClick={()=>setPermissions(!permissions)}>{permissions?'Abrir RH':'Abrir Permissões'}</button><button onClick={()=>setDark(!dark)}>Alternar tema</button>{['admin','employee','manager','blocked'].map(actor=><a key={actor} href={'/api/__fixture/actor?as='+actor}>{actor}</a>)}</div>
    {permissions?<HrPermissionsPanel/>:<HrPage/>}
  </div>;
}
createRoot(document.getElementById('root')!).render(<MemoryRouter><AuthProvider><HrAccessProvider><Fixture/></HrAccessProvider></AuthProvider></MemoryRouter>);
