import { FormEvent, useState } from 'react';
import { LockKeyhole, CheckCircle2, Circle } from 'lucide-react';
import { useAuth } from '../../lib/auth';

function validateComplexity(password: string) {
  if (password.length < 8) return 'A nova senha precisa ter pelo menos 8 caracteres.';
  if (!/[A-Z]/.test(password)) return 'A nova senha precisa ter pelo menos uma letra maiúscula.';
  if (!/[0-9]/.test(password)) return 'A nova senha precisa ter pelo menos um número.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'A nova senha precisa ter pelo menos um caractere especial (!@#$%...).';
  return null;
}

function Rule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs ${ok ? 'text-emerald-600' : 'text-slate-400'}`}>
      {ok ? <CheckCircle2 size={12} /> : <Circle size={12} />}
      {label}
    </div>
  );
}

export function PasswordChangeGate() {
  const { user, changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!user?.must_change_password) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    const complexityError = validateComplexity(newPassword);
    if (complexityError) { setError(complexityError); return; }
    if (newPassword !== confirmPassword) { setError('As senhas novas não conferem.'); return; }

    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
    } catch (err) {
      const raw = (err as Error).message || '';
      const msg = raw.replace(/^API \d+:\s*/, '');
      setError(msg || 'Não foi possível alterar a senha. Verifique a senha atual.');
    } finally {
      setSubmitting(false);
    }
  }

  const hasMinLen = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="h-11 w-11 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
            <LockKeyhole size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Troque sua senha</h2>
            <p className="text-sm text-slate-500">Obrigatório no primeiro acesso.</p>
          </div>
        </div>

        <label className="text-sm font-semibold text-slate-700">Senha atual</label>
        <input
          type="password"
          value={currentPassword}
          onChange={event => setCurrentPassword(event.target.value)}
          className="mt-1 mb-3 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-orange-400"
          required
        />

        <label className="text-sm font-semibold text-slate-700">Nova senha</label>
        <input
          type="password"
          value={newPassword}
          onChange={event => setNewPassword(event.target.value)}
          className="mt-1 mb-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-orange-400"
          required
        />

        {newPassword.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 px-1">
            <Rule ok={hasMinLen} label="8+ caracteres" />
            <Rule ok={hasUpper} label="Letra maiúscula" />
            <Rule ok={hasNumber} label="Número" />
            <Rule ok={hasSpecial} label="Caractere especial" />
          </div>
        )}

        <label className="text-sm font-semibold text-slate-700">Confirmar nova senha</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={event => setConfirmPassword(event.target.value)}
          className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-orange-400"
          required
        />

        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 h-10 w-full rounded-lg bg-orange-500 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-70"
        >
          {submitting ? 'Salvando...' : 'Salvar nova senha'}
        </button>
      </form>
    </div>
  );
}
