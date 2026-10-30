import { useRef, useState } from 'react';

export function ChatCaptionInput({ value, onChange, participants, group, onNeedParticipants, onSend, onCancel, disabled }: {
  value: string; onChange(value: string): void; participants: { id: string; name: string }[]; group: boolean;
  disabled?: boolean; onNeedParticipants(): void; onSend(): void; onCancel(): void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [closed, setClosed] = useState(false);
  const [index, setIndex] = useState(0);
  const at = value.lastIndexOf('@');
  const query = at >= 0 && (at === 0 || /\s/.test(value[at - 1])) ? value.slice(at + 1).toLocaleLowerCase('pt-BR') : null;
  const candidates = query === null || closed || disabled ? [] : [...(group && 'todos'.startsWith(query) ? [{ id: '__todos__', name: 'todos' }] : []), ...participants.filter(person => person.name.toLocaleLowerCase('pt-BR').includes(query)).slice(0, 6)];
  function choose(name: string) { onChange(value.slice(0, at) + '@' + name + ' '); setClosed(true); input.current?.focus(); }
  return <div className="chat-caption-input">
    {!!candidates.length && <div className="chat-caption-mentions" role="listbox" aria-label="Mencionar na legenda">{candidates.map((person, position) => <button key={person.id} type="button" role="option" aria-selected={position === index} onMouseDown={event => { event.preventDefault(); choose(person.name); }}>@{person.name}</button>)}</div>}
    <input disabled={disabled} ref={input} autoFocus value={value} maxLength={8000} placeholder="Legenda… use @ para mencionar" aria-label="Legenda da mídia"
      onChange={event => { onChange(event.target.value); setClosed(false); setIndex(0); if (event.target.value.includes('@')) onNeedParticipants(); }}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return;
        if (candidates.length && ['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); setIndex(position => (position + (event.key === 'ArrowDown' ? 1 : -1) + candidates.length) % candidates.length); }
        else if (event.key === 'Enter') { event.preventDefault(); if (candidates.length) choose(candidates[index]?.name || candidates[0].name); else onSend(); }
        else if (event.key === 'Escape') { if (candidates.length) setClosed(true); else onCancel(); }
      }} />
  </div>;
}
