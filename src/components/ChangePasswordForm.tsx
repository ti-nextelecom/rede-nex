import { useId, useRef, useState, type FormEvent } from 'react';
import { Eye, EyeOff, LockKeyhole, Save } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { validatePasswordComplexity } from '../../shared/passwordPolicy.mjs';

export function ChangePasswordForm() {
  const { changePassword } = useAuth();
  const id = useId();
  const busy = useRef(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    setSaved(false);
    const problem = validatePasswordComplexity(next)
      || (next !== confirmation ? 'As novas senhas não conferem.' : null)
      || (next === current ? 'Escolha uma senha diferente da atual.' : null);
    if (problem) { setError(problem); return; }
    setError('');
    busy.current = true;
    setSubmitting(true);
    try {
      await changePassword(current, next);
      setCurrent(''); setNext(''); setConfirmation(''); setVisible(false);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message.replace(/^API \d+:\s*/, '') : 'Não foi possível alterar a senha. Tente novamente.');
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }

  const fields = [
    { name: 'current', label: 'Senha atual', value: current, update: setCurrent, autoComplete: 'current-password' },
    { name: 'next', label: 'Nova senha', value: next, update: setNext, autoComplete: 'new-password' },
    { name: 'confirmation', label: 'Confirmar nova senha', value: confirmation, update: setConfirmation, autoComplete: 'new-password' },
  ];

  return (
    <section className="mb-7 rounded-xl border border-border bg-card p-4 sm:p-5" aria-labelledby={`${id}-title`}>
      <div className="mb-4 flex items-start gap-3">
        <LockKeyhole size={21} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <h3 id={`${id}-title`} className="font-bold text-foreground">Alterar senha</h3>
          <p className="mt-1 text-sm text-muted-foreground">Atualize sua senha de acesso ao Rede NEX.</p>
        </div>
      </div>
      <form onSubmit={submit} aria-busy={submitting}>
        <fieldset disabled={submitting} className="min-w-0 space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {fields.map(field => (
              <div key={field.name} className="min-w-0">
                <label htmlFor={`${id}-${field.name}`} className="mb-1.5 block text-sm font-semibold text-foreground">{field.label}</label>
                <input id={`${id}-${field.name}`} name={field.name} type={visible ? 'text' : 'password'}
                  autoComplete={field.autoComplete} required maxLength={128} minLength={field.name === 'current' ? undefined : 8}
                  aria-describedby={field.name === 'current' ? undefined : `${id}-rules`}
                  value={field.value} onChange={event => { field.update(event.target.value); setError(''); setSaved(false); }}
                  className="h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
            ))}
          </div>
          <p id={`${id}-rules`} className="text-xs leading-5 text-muted-foreground">Use de 8 a 128 caracteres, com pelo menos uma letra maiúscula, um número e um caractere especial.</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" aria-pressed={visible} onClick={() => setVisible(value => !value)} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
              {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
              {visible ? 'Ocultar senhas' : 'Mostrar senhas'}
            </button>
            <button type="submit" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60 sm:w-auto">
              <Save size={17} aria-hidden="true" />{submitting ? 'Alterando...' : 'Salvar nova senha'}
            </button>
          </div>
        </fieldset>
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        {saved && <p role="status" className="mt-3 text-sm" style={{ color: 'var(--nex-success-ink)' }}>Senha alterada com sucesso.</p>}
      </form>
    </section>
  );
}