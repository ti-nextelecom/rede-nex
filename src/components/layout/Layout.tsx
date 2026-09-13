import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { PasswordChangeGate } from './PasswordChangeGate';
import { MobileBottomNav } from './MobileBottomNav';
import { CopilotoWidget } from './CopilotoWidget';

export function Layout() {
  const location = useLocation();
  const contentRef = useRef<HTMLDivElement>(null);
  const isChat = location.pathname === '/bate-papo';
  const isCopiloto = location.pathname === '/copiloto';
  const isProjetos = location.pathname === '/projetos';

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    el.classList.remove('page-enter');
    void el.offsetHeight;
    el.classList.add('page-enter');
  }, [location.pathname]);

  return (
    <div className={isProjetos ? "h-dvh overflow-hidden relative" : "min-h-screen relative overflow-x-auto"}>
      {/* Gradient background */}
      <div className="fixed inset-0 z-0 layout-gradient" />
      <div className="fixed inset-0 z-0 layout-radial" />

      <div className="relative z-10">
        <Navbar />
        <PasswordChangeGate />
        {/* Blue side panels — hidden on mobile */}
        <div className="hidden md:block fixed top-14 left-0 bottom-0 w-4 z-10" style={{ background: 'linear-gradient(180deg, #0057b8, #ff7a00)', boxShadow: '4px 0 20px rgba(0,87,184,0.3)' }} />
        <div className="hidden md:block fixed top-14 right-0 bottom-0 w-4 z-10" style={{ background: 'linear-gradient(180deg, #0057b8, #ff7a00)', boxShadow: '-4px 0 20px rgba(255,122,0,0.3)' }} />
        <main className={isProjetos ? 'pt-14' : 'pt-14 pb-24 lg:pb-0 min-h-screen md:px-4'}>
          <div className={isChat || isCopiloto || isProjetos ? 'w-full py-0' : 'w-full py-0 md:py-5'}>
            <div className={isProjetos ? '' : 'md:rounded-2xl bg-white/90 dark:bg-slate-800/95 md:shadow-2xl md:backdrop-blur-sm'}>
              <div className={isCopiloto || isProjetos ? 'p-0' : 'p-3 md:p-6'}>
                <div ref={contentRef}>
                  <Outlet />
                </div>
              </div>
            </div>
          </div>
        </main>
        <MobileBottomNav />
        <CopilotoWidget />
      </div>
    </div>
  );
}
