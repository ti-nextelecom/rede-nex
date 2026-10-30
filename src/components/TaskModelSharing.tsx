import { useState } from 'react';
import { Share2, X } from 'lucide-react';
import { AccessibleModal } from './AccessibleModal';
import { TaskPeoplePicker } from './TaskPeoplePicker';
import type { User } from '../types';

export function TaskSharingFields({ users, shared, recipients, onSharedChange, onRecipientsChange }: {
  users: User[]; shared: boolean; recipients: string[]; onSharedChange: (value: boolean) => void; onRecipientsChange: (value: string[]) => void;
}) {
  return <div className='task-model-sharing-fields'><label><input type='checkbox' checked={shared} onChange={e => onSharedChange(e.target.checked)} /> Compartilhar com todos os usuários</label>
    {!shared && <label>Compartilhar com pessoas específicas<TaskPeoplePicker users={users} value={recipients} onChange={onRecipientsChange} label='destinatários do modelo' /></label>}
    <p>{shared ? 'Todos poderão usar e copiar. Só você poderá excluir e gerenciar o compartilhamento.' : recipients.length ? 'Essas pessoas poderão usar e copiar o modelo, sem alterar o seu original.' : 'Sem destinatários: modelo privado, visível somente para você.'}</p>
  </div>;
}

export function TaskModelSharing({ users, title, initialShared = false, initialRecipients = [], onSave, onClose }: {
  users: User[]; title: string; initialShared?: boolean; initialRecipients?: string[];
  onSave: (input: {is_shared: boolean; shared_user_ids: string[]}) => Promise<void>; onClose: () => void;
}) {
  const [shared, setShared] = useState(initialShared), [recipients, setRecipients] = useState(initialRecipients), [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <AccessibleModal title='Compartilhar modelo' onClose={() => { if (!busy) onClose(); }} className='nex-task-create task-sharing-dialog'>
    <form onSubmit={async e => { e.preventDefault(); if (busy) return; setBusy(true); setError(''); try { await onSave({ is_shared: shared, shared_user_ids: recipients }); onClose(); } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível compartilhar.'); } finally { setBusy(false); } }}>
      <header><Share2 size={22} /><h2>Compartilhar modelo</h2><button type='button' disabled={busy} onClick={onClose} aria-label='Fechar compartilhamento'><X size={20} /></button></header>
      <p>{title}</p>{error && <p role='alert' className='task-form-error'>{error}</p>}
      <fieldset disabled={busy}><TaskSharingFields users={users} shared={shared} recipients={recipients} onSharedChange={setShared} onRecipientsChange={setRecipients} /></fieldset>
      <footer><button disabled={busy} type='submit'>{busy ? 'Salvando…' : 'Salvar compartilhamento'}</button></footer>
    </form>
  </AccessibleModal>;
}
