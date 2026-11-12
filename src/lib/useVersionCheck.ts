import { useEffect, useState } from 'react';

export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  useEffect(() => {
    let initial: number | null = null;
    async function check() {
      try {
        const r = await fetch('/version.json?_=' + Date.now(), { cache: 'no-store' });
        if (!r.ok) return;
        const { ts } = await r.json() as { ts: number };
        if (initial === null) { initial = ts; return; }
        if (ts !== initial) setUpdateAvailable(true);
      } catch { /* network error — ignore */ }
    }
    check();
    const id = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
  return updateAvailable;
}
