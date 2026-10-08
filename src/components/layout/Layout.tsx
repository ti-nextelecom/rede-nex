import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { PasswordChangeGate } from './PasswordChangeGate';
import { MobileBottomNav } from './MobileBottomNav';
import { CopilotoWidget } from './CopilotoWidget';
import { pageTitle } from './navigation';
import './responsive.css';

const WORKSPACES = new Set(['/tarefas', '/projetos', '/bate-papo', '/copiloto', '/notas', '/wiki']);

export function Layout() {
  const { pathname } = useLocation();
  const contentRef = useRef<HTMLDivElement>(null);
  const workspace = WORKSPACES.has(pathname);

  useEffect(() => {
    document.title = `${pageTitle(pathname)} · REDE NEX`;
    contentRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="nex-app">
      <a href="#conteudo-principal" className="nex-skip-link">Pular para o conteúdo</a>
      <Navbar />
      <PasswordChangeGate />
      <main id="conteudo-principal" tabIndex={-1} className={workspace ? 'nex-main nex-main-workspace' : 'nex-main'}>
        <div ref={contentRef} className="nex-page" data-page={pathname.slice(1) || 'dashboard'}><Outlet /></div>
      </main>
      <MobileBottomNav />
      <CopilotoWidget />
    </div>
  );
}
