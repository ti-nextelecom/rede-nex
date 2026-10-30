import { useState } from 'react';
import { ChevronDown, Search, UserRound } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import type { User } from '../types';

export function TaskPeoplePicker({ users, value, onChange, label, single = false, disabled = false }: {
  users: User[]; value: string[]; onChange: (ids: string[]) => void; label: string; single?: boolean; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false), [search, setSearch] = useState('');
  const selected = users.filter(user => value.includes(user.id));
  const unknown = value.filter(id => !users.some(user => user.id === id));
  const query = search.trim().toLocaleLowerCase('pt-BR');
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><button type='button' disabled={disabled} className='task-people-picker' aria-label={`Selecionar ${label}`}>
      <span className='task-people-picker-faces'>{selected.slice(0, 3).map(user => user.photo_url ? <img key={user.id} src={user.photo_url} alt='' /> : <span key={user.id}>{user.name.slice(0, 1)}</span>)}</span>
      <span>{selected.length ? selected.map(user => user.name.split(' ')[0]).join(', ') : unknown.length ? `${unknown.length} usuário(s) indisponível(is)` : label}</span><ChevronDown size={16} />
    </button></PopoverTrigger>
    <PopoverContent className='task-people-popover' align='start' sideOffset={6}>
      <label className='task-people-search'><Search size={16} /><input autoFocus aria-label={`Buscar ${label}`} placeholder='Buscar colaborador…' value={search} onChange={e => setSearch(e.target.value)} /></label>
      <div className='task-people-options'>
        <button type='button' onClick={() => { onChange([]); if (single) setOpen(false); }}>Limpar seleção</button>
        {users.filter(user => !query || `${user.name} ${user.email || ''}`.toLocaleLowerCase('pt-BR').includes(query)).map(user => <button key={user.id} type='button' role='checkbox' aria-checked={value.includes(user.id)} onClick={() => {
          onChange(single ? [user.id] : value.includes(user.id) ? value.filter(id => id !== user.id) : [...value, user.id]);
          if (single) setOpen(false);
        }}>{user.photo_url ? <img src={user.photo_url} alt='' /> : <UserRound size={24} />}<span>{user.name}</span><span aria-hidden='true'>{value.includes(user.id) ? '✓' : ''}</span></button>)}
      </div>
    </PopoverContent>
  </Popover>;
}

export function ChecklistPeopleFields({ users, item, onChange, showResponsible = true }: {
  users: User[]; item: { assignee_id?: string | null; participant_ids?: string[]; observer_ids?: string[] };
  onChange: (input: { assignee_id?: string | null; participant_ids?: string[]; observer_ids?: string[] }) => void; showResponsible?: boolean;
}) {
  return <details className='task-step-people'><summary>Pessoas da etapa <span>{(item.participant_ids?.length || 0) + (item.observer_ids?.length || 0)} envolvida(s)</span></summary>
    <div>{showResponsible && <label>Responsável<TaskPeoplePicker users={users} single value={item.assignee_id ? [item.assignee_id] : []} label='responsável da etapa' onChange={ids => onChange({ assignee_id: ids[0] || null })} /></label>}
      <label>Participantes<TaskPeoplePicker users={users} value={item.participant_ids || []} label='participantes da etapa' onChange={ids => onChange({ participant_ids: ids })} /></label>
      <label>Observadores<TaskPeoplePicker users={users} value={item.observer_ids || []} label='observadores da etapa' onChange={ids => onChange({ observer_ids: ids })} /></label>
    </div><p>As pessoas selecionadas também passam a ter acesso à tarefa conforme seu papel.</p>
  </details>;
}
