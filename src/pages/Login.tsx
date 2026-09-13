import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '../lib/auth';

const KEYFRAMES = `
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes btn-shine {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes pulse-dot {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50%       { opacity: 1;   transform: scale(1.4); }
}
@keyframes logo-in {
  from { opacity: 0; transform: translateY(-14px) scale(0.94); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes logo-glow {
  0%, 100% { opacity: 0.55; transform: scale(1); }
  50%       { opacity: 1;   transform: scale(1.12); }
}
@keyframes halo-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes tagline-in {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-8px); }
}

/* ─── Mobile responsive ─── */
.login-right-panel {
  width: clamp(320px, 35vw, 420px);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: rgba(3,8,18,0.92);
  backdrop-filter: blur(32px);
  -webkit-backdrop-filter: blur(32px);
  border-left: 1px solid rgba(255,255,255,0.07);
  animation: fadeUp 0.55s ease 0.1s both;
  position: relative;
  z-index: 1;
}
.login-right-inner {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 20px 32px;
  gap: 22px;
  min-height: 0;
}
.login-mobile-hero {
  display: none;
}
@media (max-width: 1023px) {
  .login-right-panel {
    width: 100% !important;
    border-left: none !important;
    background: transparent !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }
  .login-right-inner {
    padding: 20px 28px 8px !important;
    justify-content: flex-start !important;
  }
  .login-top-bar {
    display: none !important;
  }
  .login-mobile-hero {
    display: flex !important;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 24px 8px;
    gap: 10px;
    flex-shrink: 0;
    animation: logo-in 0.9s cubic-bezier(0.22,1,0.36,1) 0.2s both;
  }
  .login-footer {
    padding-bottom: 28px !important;
  }
}
`;

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => { emailRef.current?.focus(); }, []);
  useEffect(() => { if (user) navigate('/', { replace: true }); }, [user, navigate]);
  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      const match = raw.match(/^API (\d+):\s*(.+)/);
      if (match && match[1] !== '401') {
        setError(match[2]);
      } else {
        setError('E-mail ou senha inválidos.');
      }
    } finally {
      setBusy(false);
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', height: 46, borderRadius: 10,
    fontSize: 13, color: '#e8f0fe', outline: 'none',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.09)',
    transition: 'border-color .15s, box-shadow .15s, background .15s',
    boxSizing: 'border-box',
  };

  return (
    <>
      <style>{KEYFRAMES}</style>

      <div style={{ position: 'fixed', inset: 0, display: 'flex', overflow: 'hidden', background: '#020913' }}>

        {/* ══════════════════════════════════════
            MOBILE background decorativo
        ══════════════════════════════════════ */}
        <div className="lg:hidden" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
          {/* Halo laranja topo-esquerdo */}
          <div style={{
            position: 'absolute', top: '-10%', left: '-10%',
            width: 420, height: 420,
            background: 'radial-gradient(circle, rgba(232,71,25,0.28) 0%, rgba(232,71,25,0.07) 45%, transparent 68%)',
            filter: 'blur(45px)', borderRadius: '50%',
            animation: 'logo-glow 4s ease-in-out infinite',
          }}/>
          {/* Halo azul centro */}
          <div style={{
            position: 'absolute', top: '38%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 580, height: 320,
            background: 'radial-gradient(ellipse, rgba(0,87,184,0.2) 0%, transparent 70%)',
            filter: 'blur(55px)',
            animation: 'logo-glow 5s ease-in-out infinite 1.2s',
          }}/>
          {/* Halo laranja inferior-direito */}
          <div style={{
            position: 'absolute', bottom: '-8%', right: '-8%',
            width: 380, height: 380,
            background: 'radial-gradient(circle, rgba(232,71,25,0.2) 0%, transparent 65%)',
            filter: 'blur(50px)', borderRadius: '50%',
            animation: 'logo-glow 3.5s ease-in-out infinite 2s',
          }}/>
          {/* Ponto de luz central */}
          <div style={{
            position: 'absolute', top: '28%', left: '50%', transform: 'translateX(-50%)',
            width: 2, height: 2, borderRadius: '50%',
            background: '#e84719',
            boxShadow: '0 0 40px 20px rgba(232,71,25,0.12)',
          }}/>
          {/* Grid sutil */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.04 }} xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="mgrid" width="48" height="48" patternUnits="userSpaceOnUse">
                <path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgba(232,71,25,1)" strokeWidth="0.6"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#mgrid)"/>
          </svg>
          {/* Linha diagonal decorativa */}
          <div style={{
            position: 'absolute', top: 0, right: '30%',
            width: 1, height: '100%',
            background: 'linear-gradient(to bottom, transparent 0%, rgba(232,71,25,0.12) 30%, rgba(0,87,184,0.12) 70%, transparent 100%)',
          }}/>
        </div>

        {/* ══════════════════════════════════════
            LEFT — Imagem futurista (desktop only)
        ══════════════════════════════════════ */}
        <div
          className="hidden lg:block"
          style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden', animation: 'fadeIn 0.8s ease both' }}
        >
          <img
            src="/assets/images/nex_bg.svg"
            alt="" aria-hidden="true"
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'left center',
              pointerEvents: 'none', userSelect: 'none',
            }}
          />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, rgba(2,9,19,0.3) 0%, rgba(2,9,19,0.1) 45%, rgba(2,9,19,0.45) 100%)',
            pointerEvents: 'none',
          }}/>
          <div style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: 120,
            background: 'linear-gradient(to right, transparent, rgba(2,9,19,0.95))',
            pointerEvents: 'none',
          }}/>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 20, padding: '32px 80px 32px 48px',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, animation: 'logo-in 0.9s cubic-bezier(0.22,1,0.36,1) 0.3s both' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{
                  position: 'absolute', width: 320, height: 320,
                  background: 'radial-gradient(circle, rgba(232,71,25,0.3) 0%, rgba(232,71,25,0.08) 45%, transparent 70%)',
                  filter: 'blur(22px)', borderRadius: '50%',
                  animation: 'logo-glow 3s ease-in-out infinite', pointerEvents: 'none',
                }}/>
                <div style={{
                  position: 'absolute', width: 280, height: 280,
                  background: 'radial-gradient(circle, rgba(14,165,233,0.15) 0%, transparent 65%)',
                  filter: 'blur(28px)', borderRadius: '50%',
                  animation: 'logo-glow 4s ease-in-out infinite 1.5s', pointerEvents: 'none',
                }}/>
                <svg style={{ position: 'absolute', width: 260, height: 260,
                  animation: 'halo-spin 12s linear infinite', pointerEvents: 'none', opacity: 0.22 }}
                  viewBox="0 0 260 260">
                  <circle cx="130" cy="130" r="124" fill="none"
                    stroke="url(#ringGrad2)" strokeWidth="1.5"
                    strokeDasharray="90 200" strokeLinecap="round"/>
                  <defs>
                    <linearGradient id="ringGrad2" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#e84719" stopOpacity="1"/>
                      <stop offset="60%" stopColor="#0ea5e9" stopOpacity="0.6"/>
                      <stop offset="100%" stopColor="#e84719" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                </svg>
                <img
                  src="/assets/images/logo_nex.png"
                  alt=""
                  style={{
                    position: 'relative', zIndex: 2,
                    width: 180, height: 180,
                    objectFit: 'contain', objectPosition: 'center',
                    filter: [
                      'drop-shadow(0 0 12px rgba(232,71,25,0.95))',
                      'drop-shadow(0 0 32px rgba(232,71,25,0.6))',
                      'drop-shadow(0 0 60px rgba(14,165,233,0.3))',
                    ].join(' '),
                  }}
                />
              </div>
              <div style={{ lineHeight: 1, textAlign: 'center' }}>
                <span style={{ fontFamily: '"Arial Black", "Impact", sans-serif', fontWeight: 900, fontSize: 42, letterSpacing: '-0.01em', color: '#e84719', textShadow: '0 0 16px rgba(232,71,25,0.85), 0 0 40px rgba(232,71,25,0.4)' }}>NEX</span>
                <span style={{ fontFamily: '"Arial Black", "Impact", sans-serif', fontWeight: 900, fontSize: 42, letterSpacing: '0.04em', color: '#dce8f8', textShadow: '0 0 16px rgba(14,165,233,0.4), 0 2px 8px rgba(0,0,0,0.8)' }}>TELECOM</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, animation: 'tagline-in 0.8s ease 0.6s both' }}>
              <div style={{ width: 48, height: 1, background: 'linear-gradient(to right, transparent, rgba(232,71,25,0.7))' }}/>
              {[0, 0.3, 0.6].map(d => (
                <div key={d} style={{ width: 5, height: 5, borderRadius: '50%', background: '#e84719', boxShadow: '0 0 6px #e84719', animation: `pulse-dot 2s ease-in-out ${d}s infinite` }}/>
              ))}
              <div style={{ width: 48, height: 1, background: 'linear-gradient(to left, transparent, rgba(232,71,25,0.7))' }}/>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 17, fontWeight: 300, letterSpacing: '0.05em', textAlign: 'center', lineHeight: 1.6, textShadow: '0 2px 12px rgba(0,0,0,0.9)', animation: 'tagline-in 0.8s ease 0.75s both' }}>
              Conectando você ao <span style={{ color: '#e84719', fontWeight: 700, textShadow: '0 0 12px rgba(232,71,25,0.7)' }}>mundo!</span>
            </p>
          </div>
        </div>

        {/* ══════════════════════════════════════
            RIGHT — Formulário
        ══════════════════════════════════════ */}
        <div className="login-right-panel">

          {/* Barra de cor topo */}
          <div className="login-top-bar" style={{ height: 2, flexShrink: 0,
            background: 'linear-gradient(to right, transparent, #e84719 30%, #0ea5e9 68%, transparent)',
            opacity: 0.85 }}/>

          {/* Hero mobile — logo + nome centralizado */}
          <div className="login-mobile-hero">
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{
                position: 'absolute', width: 130, height: 130,
                background: 'radial-gradient(circle, rgba(232,71,25,0.4) 0%, transparent 70%)',
                filter: 'blur(24px)', borderRadius: '50%',
                animation: 'logo-glow 3s ease-in-out infinite',
              }}/>
              <svg style={{ position: 'absolute', width: 110, height: 110, animation: 'halo-spin 10s linear infinite', opacity: 0.3 }} viewBox="0 0 110 110">
                <circle cx="55" cy="55" r="52" fill="none" stroke="url(#mobileRing)" strokeWidth="1" strokeDasharray="40 80" strokeLinecap="round"/>
                <defs>
                  <linearGradient id="mobileRing" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#e84719" stopOpacity="1"/>
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.5"/>
                  </linearGradient>
                </defs>
              </svg>
              <img
                src="/assets/images/logo_nex.png"
                alt="NexTelecom"
                style={{
                  position: 'relative', zIndex: 1,
                  width: 72, height: 72, objectFit: 'contain',
                  filter: 'drop-shadow(0 0 8px rgba(232,71,25,0.9)) drop-shadow(0 0 24px rgba(232,71,25,0.5))',
                  animation: 'float 3s ease-in-out infinite',
                }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div style={{ lineHeight: 1, textAlign: 'center' }}>
              <span style={{ fontFamily: '"Arial Black", Impact, sans-serif', fontWeight: 900, fontSize: 28, color: '#e84719', textShadow: '0 0 12px rgba(232,71,25,0.8)' }}>NEX</span>
              <span style={{ fontFamily: '"Arial Black", Impact, sans-serif', fontWeight: 900, fontSize: 28, color: '#dce8f8', textShadow: '0 0 10px rgba(14,165,233,0.35)' }}>TELECOM</span>
            </div>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', letterSpacing: '0.12em', textTransform: 'uppercase', textAlign: 'center' }}>
              Plataforma Corporativa
            </p>
          </div>

          {/* Formulário */}
          <div className="login-right-inner">
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#f0f6ff', letterSpacing: '-0.01em', marginBottom: 5 }}>
                Entrar na plataforma
              </h1>
              <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.34)' }}>
                Use seu e-mail corporativo para acessar
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.36)' }}>E-MAIL</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={12} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.24)', pointerEvents: 'none' }}/>
                  <input ref={emailRef} type="email" value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="usuario@nexcorporativo.net.br"
                    required autoComplete="email"
                    style={{ ...inp, paddingLeft: 34, paddingRight: 12 }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#e84719'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,71,25,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}/>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.36)' }}>SENHA</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={12} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.24)', pointerEvents: 'none' }}/>
                  <input type={showPw ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" required autoComplete="current-password"
                    style={{ ...inp, paddingLeft: 34, paddingRight: 40 }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#e84719'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,71,25,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}/>
                  <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)}
                    style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.28)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                    {showPw ? <EyeOff size={14}/> : <Eye size={14}/>}
                  </button>
                </div>
              </div>

              {error && (
                <div style={{ borderRadius: 8, padding: '8px 12px', fontSize: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span>⚠</span> {error}
                </div>
              )}

              <button type="submit" disabled={busy} style={{
                width: '100%', height: 48, borderRadius: 11, marginTop: 4,
                fontWeight: 700, fontSize: 13.5, letterSpacing: '0.04em', color: '#fff',
                border: 'none', cursor: busy ? 'not-allowed' : 'pointer',
                background: 'linear-gradient(270deg, #e84719, #c43612, #1e3d8e, #2d5cc8, #e84719)',
                backgroundSize: '280% 280%',
                animation: busy ? 'none' : 'btn-shine 5s ease infinite',
                boxShadow: busy ? 'none' : '0 4px 20px rgba(232,71,25,0.32)',
                opacity: busy ? 0.6 : 1, transition: 'opacity .2s',
              }}>
                {busy ? 'Entrando...' : 'Entrar'}
              </button>
              <div style={{ textAlign: 'center', marginTop: 6 }}>
                <Link to='/esqueci-senha' style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#e84719')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.28)')}>
                  Esqueceu sua senha?
                </Link>
              </div>
            </form>
          </div>

          <div className="login-footer" style={{ padding: '0 32px 20px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }}/>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)', letterSpacing: '0.07em' }}>REDE NEX © {new Date().getFullYear()}</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }}/>
            </div>
            <div style={{ display: 'flex', gap: 14 }}>
              {['Política de Privacidade', 'Termos de Uso'].map(t => (
                <a key={t} href="#" style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)', textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.18)')}>
                  {t}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
