import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

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
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message || 'Erro ao enviar e-mail');
      }
      setSent(true);
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

        {sent ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center', padding: '8px 0' }}>
            <CheckCircle size={48} color="#22c55e" strokeWidth={1.5}/>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f0f6ff', marginBottom: 8 }}>E-mail enviado!</h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                Se o e-mail <strong style={{ color: '#e8f0fe' }}>{email}</strong> estiver cadastrado,
                você receberá um link para redefinir sua senha em instantes.
              </p>
            </div>
            <Link to="/login" style={{ fontSize: 13, color: '#e84719', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
              <ArrowLeft size={14}/> Voltar ao login
            </Link>
          </div>
        ) : (
          <>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: '#f0f6ff', marginBottom: 5 }}>Esqueceu sua senha?</h1>
              <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.34)', lineHeight: 1.5 }}>
                Informe seu e-mail corporativo e enviaremos um link para redefinir sua senha.
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.36)' }}>E-MAIL</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={12} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.24)', pointerEvents: 'none' }}/>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="usuario@nexcorporativo.net.br"
                    required autoComplete="email"
                    style={{ ...inp, paddingLeft: 34, paddingRight: 12 }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#e84719'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,71,25,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}/>
                </div>
              </div>

              {error && (
                <div style={{ borderRadius: 8, padding: '8px 12px', fontSize: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span>⚠</span> {error}
                </div>
              )}

              <button type="submit" disabled={busy} style={{
                width: '100%', height: 46, borderRadius: 10, marginTop: 2,
                fontWeight: 700, fontSize: 13, color: '#fff', border: 'none',
                cursor: busy ? 'not-allowed' : 'pointer',
                background: 'linear-gradient(135deg, #e84719, #c43612)',
                opacity: busy ? 0.6 : 1, transition: 'opacity .2s',
                boxShadow: busy ? 'none' : '0 4px 16px rgba(232,71,25,0.3)',
              }}>
                {busy ? 'Enviando...' : 'Enviar link de redefinição'}
              </button>
            </form>

            <Link to="/login" style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}>
              <ArrowLeft size={12}/> Voltar ao login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
