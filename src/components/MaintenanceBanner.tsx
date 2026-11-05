import { useEffect, useState } from 'react';

interface MaintenanceInfo {
  active: boolean;
  scheduledAt: string;
  minutesRemaining: number;
  message: string | null;
}

export default function MaintenanceBanner() {
  const [info, setInfo] = useState<MaintenanceInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    async function check() {
      try {
        const res = await fetch('/api/maintenance');
        if (res.ok) {
          const data = await res.json();
          setInfo(data.data ?? null);
        }
      } catch {
        // silent
      }
    }

    check();
    timer = setInterval(check, 30_000);
    return () => clearInterval(timer);
  }, []);

  if (!info || !info.active || dismissed) return null;

  const scheduledDate = new Date(info.scheduledAt);
  const timeStr = scheduledDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: '#f59e0b',
        color: '#1c1917',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        fontFamily: 'inherit',
        fontSize: '14px',
        fontWeight: 500,
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '18px' }}>⚠️</span>
        <span>
          <strong>Manutenção programada</strong> às {timeStr} (em ~{info.minutesRemaining} min).
          O sistema ficará indisponível brevemente para atualização.
          {info.message && <> {info.message}</>}
        </span>
      </span>
      <button
        onClick={() => setDismissed(true)}
        style={{
          background: 'none',
          border: '1px solid rgba(0,0,0,0.3)',
          borderRadius: '4px',
          padding: '2px 10px',
          cursor: 'pointer',
          color: '#1c1917',
          fontWeight: 600,
          fontSize: '13px',
          whiteSpace: 'nowrap',
        }}
      >
        Fechar
      </button>
    </div>
  );
}
