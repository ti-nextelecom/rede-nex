import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const mismatch = confirm.length > 0 && password !== confirm;

  useEffect(() => {
    if (!token) setError('Link inválido. Solicite um novo link de redefinição.');
  }, [token]);

  const inp: React.CSSProperties = {
    width: '100%', height: 46, borderRadius: 10,
    fontSize: 13, color: '#e8f0fe', outline: 'none',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.09)',
    transition: 'border-color .15s, box-shadow .15s, background .15s',
    boxSizing: 'border-box',
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('As senhas não coincidem.'); return; }
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.message || 'Erro ao redefinir senha');
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020913' }}>
      <div style={{ width: 'clamp(300px,90vw,400px)', background: 'rgba(3,8,18,0.96)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ height: 2, background: 'linear-gradient(to right, transparent, #e84719 30%, #0ea5e9 68%, transparent)', borderRadius: 2, marginBottom: 4 }}/>

        {done ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center', padding: '8px 0' }}>
            <CheckCircle size={48} color="#22c55e" strokeWidth={1.5}/>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f0f6ff', marginBottom: 8 }}>Senha redefinida!</h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Redirecionando para o login...</p>
            </div>
          </div>
        ) : !token ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center', padding: '8px 0' }}>
            <XCircle size={48} color="#ef4444" strokeWidth={1.5}/>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f0f6ff', marginBottom: 8 }}>Link inválido</h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>Solicite um novo link de redefinição de senha.</p>
            </div>
            <Link to="/esqueci-senha" style={{ fontSize: 13, color: '#e84719', textDecoration: 'none' }}>Solicitar novo link</Link>
          </div>
        ) : (
          <>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: '#f0f6ff', marginBottom: 5 }}>Nova senha</h1>
              <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.34)', lineHeight: 1.5 }}>
                Crie uma senha forte com pelo menos 8 caracteres, uma maiúscula, um número e um caractere especial.
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.36)' }}>NOVA SENHA</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={12} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.24)', pointerEvents: 'none' }}/>
                  <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" required
                    style={{ ...inp, paddingLeft: 34, paddingRight: 40 }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#e84719'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,71,25,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}/>
                  <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)}
                    style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.28)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                    {showPw ? <EyeOff size={14}/> : <Eye size={14}/>}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: mismatch ? '#fca5a5' : 'rgba(255,255,255,0.36)' }}>CONFIRMAR SENHA</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={12} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: mismatch ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.24)', pointerEvents: 'none' }}/>
                  <input type={showPw ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••" required
                    style={{ ...inp, paddingLeft: 34, paddingRight: 12, borderColor: mismatch ? 'rgba(239,68,68,0.5)' : undefined, boxShadow: mismatch ? '0 0 0 3px rgba(239,68,68,0.08)' : undefined }}
                    onFocus={e => { e.currentTarget.style.borderColor = mismatch ? 'rgba(239,68,68,0.7)' : '#e84719'; e.currentTarget.style.boxShadow = mismatch ? '0 0 0 3px rgba(239,68,68,0.12)' : '0 0 0 3px rgba(232,71,25,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = mismatch ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.09)'; e.currentTarget.style.boxShadow = mismatch ? '0 0 0 3px rgba(239,68,68,0.08)' : 'none'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}/>
                </div>
                {mismatch && (
                  <span style={{ fontSize: 11.5, color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <span>⚠</span> As senhas não se parecem
                  </span>
                )}
              </div>

              {error && (
                <div style={{ borderRadius: 8, padding: '8px 12px', fontSize: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span>⚠</span> {error}
                </div>
              )}

              <button type="submit" disabled={busy || !token || mismatch} style={{
                width: '100%', height: 46, borderRadius: 10, marginTop: 2,
                fontWeight: 700, fontSize: 13, color: '#fff', border: 'none',
                cursor: (busy || !token || mismatch) ? 'not-allowed' : 'pointer',
                background: 'linear-gradient(135deg, #e84719, #c43612)',
                opacity: (busy || !token || mismatch) ? 0.6 : 1, transition: 'opacity .2s',
                boxShadow: (busy || !token || mismatch) ? 'none' : '0 4px 16px rgba(232,71,25,0.3)',
              }}>
                {busy ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}