import { createRoot } from 'react-dom/client';
import { Link, MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from '../../src/lib/auth';
import { Dashboard } from '../../src/pages/Dashboard';
import { ProjetosPage } from '../../src/pages/ProjetosPage';
import { Chat } from '../../src/pages/Chat';
import { CalendarPage } from '../../src/pages/CalendarPage';
import { PrestacaoContasPage } from '../../src/pages/PrestacaoContasPage';
import '../../src/index.css';
import '../../src/components/layout/responsive.css';

function Fixture() {
  const location = useLocation();
  const workspace = ['/projetos', '/bate-papo'].includes(location.pathname);
  return <div className="nex-app">
    <header style={{ position: 'fixed', zIndex: 10, inset: '0 0 auto', height: 'var(--nex-header-height)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', background: '#101720', borderBottom: '1px solid #ffffff12', gap: 12 }}>
      <strong style={{ color: '#ff8a42', fontSize: 16, whiteSpace: 'nowrap' }}>REDE NEX</strong>
      <nav style={{display:'flex',gap:12,fontSize:12}}><Link to="/">Dashboard</Link><Link to="/projetos">Projetos</Link><Link to="/bate-papo">Chat</Link><Link to="/prestacao-contas">Contas</Link></nav>
      <span style={{ fontSize: 10, color: '#a1adbf', textAlign: 'right' }}>TESTE ISOLADO · DADOS FICTÍCIOS</span>
    </header>
    <main className={workspace ? 'nex-main nex-main-workspace' : 'nex-main'}><div className="nex-page" data-page={location.pathname.slice(1) || 'dashboard'}>
      <Routes><Route path="/" element={<Dashboard />} /><Route path="/projetos" element={<ProjetosPage />} /><Route path="/bate-papo" element={<Chat />} /><Route path="/calendario" element={<CalendarPage />} /><Route path="/prestacao-contas" element={<PrestacaoContasPage />} /><Route path="*" element={<p>Destino de teste: {location.pathname}{location.search}</p>} /></Routes>
    </div></main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<MemoryRouter><AuthProvider><Fixture /></AuthProvider></MemoryRouter>);
