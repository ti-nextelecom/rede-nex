import { useEffect, useRef, useState } from 'react';
import type { ProjectUser } from '../lib/projectsApi';

interface Props {
  users: ProjectUser[];
  // Controlled mode (ProjectEditModal)
  value?: string;
  onChange?: (text: string, user: ProjectUser | null) => void;
  // Uncontrolled form mode
  name?: string;
  valueType?: 'name' | 'id';
  defaultValue?: string;
  // Common
  placeholder?: string;
  required?: boolean;
  allowFreeText?: boolean;
}

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

export function UserSearchCombobox({
  users,
  value,
  onChange,
  name,
  valueType = 'name',
  defaultValue = '',
  placeholder = 'Buscar ou digitar nome…',
  required,
  allowFreeText: _allowFreeText = true,
}: Props) {
  const isControlled = value !== undefined;
  const [text, setText] = useState(isControlled ? (value ?? '') : defaultValue);
  const [open, setOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ProjectUser | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync controlled value
  useEffect(() => {
    if (isControlled) setText(value ?? '');
  }, [isControlled, value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = text.trim()
    ? users.filter((u) =>
        u.name.toLowerCase().includes(text.toLowerCase()) ||
        (u.role_name ?? '').toLowerCase().includes(text.toLowerCase()) ||
        (u.department_name ?? '').toLowerCase().includes(text.toLowerCase())
      )
    : users;

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setText(v);
    setSelectedUser(null);
    setOpen(true);
    onChange?.(v, null);
  };

  const handleSelect = (u: ProjectUser) => {
    setText(u.name);
    setSelectedUser(u);
    setOpen(false);
    onChange?.(u.name, u);
  };

  const hiddenValue = valueType === 'id' ? (selectedUser?.id ?? '') : text;

  return (
    <div className="user-search-combobox" ref={containerRef}>
      <input
        ref={inputRef}
        type="text"
        name={valueType === 'name' ? name : undefined}
        value={text}
        onChange={handleInput}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
        placeholder={placeholder}
        required={required && valueType === 'name'}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
      />
      {name && valueType === 'id' && (
        <input type="hidden" name={name} value={hiddenValue} />
      )}
      {open && filtered.length > 0 && (
        <ul className="user-search-dropdown" role="listbox">
          {filtered.map((u) => (
            <li
              key={u.id}
              role="option"
              className="user-search-option"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(u); }}
            >
              {u.photo_url ? (
                <img src={u.photo_url} className="user-search-avatar" alt="" />
              ) : (
                <span className="user-search-initials">{getInitials(u.name)}</span>
              )}
              <span className="user-search-name">{u.name}</span>
              {(u.role_name || u.department_name) && (
                <span className="user-search-role">{u.role_name || u.department_name}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
