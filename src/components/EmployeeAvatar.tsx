import { useState } from 'react';

/** Local fallback: employee names are never sent to a third-party avatar service. */
export function EmployeeAvatar({ name, photo, className = '' }: { name: string; photo?: string | null; className?: string }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = (parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '');
  return <span className={`employee-avatar ${className}`}>
    {photo && failedSource !== photo
      ? <img src={photo} alt="" loading="lazy" onError={() => setFailedSource(photo)} />
      : <span aria-hidden="true">{initials.toLocaleUpperCase('pt-BR')}</span>}
  </span>;
}
