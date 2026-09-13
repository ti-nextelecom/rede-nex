import { useEffect, useRef, useState } from 'react';
import { apiPatch } from './apiClient';

const KEY = 'app_dark_mode';

function applyDark(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

function readLocal(): boolean {
  return localStorage.getItem(KEY) === '1';
}

// Apply saved preference immediately on module load
applyDark(readLocal());

export function useDarkMode(serverDark?: boolean) {
  const [dark, setDark] = useState(readLocal);
  const syncedRef = useRef(false);

  // One-time sync from server after auth loads
  useEffect(() => {
    if (serverDark !== undefined && !syncedRef.current) {
      syncedRef.current = true;
      if (serverDark !== dark) {
        setDark(serverDark);
      }
    }
  }, [serverDark]);

  useEffect(() => {
    applyDark(dark);
    localStorage.setItem(KEY, dark ? '1' : '0');
    localStorage.setItem('chat_dark_mode', dark ? '1' : '0');
  }, [dark]);

  function toggle() {
    setDark(prev => {
      const next = !prev;
      apiPatch('/users/me/dark-mode', { dark_mode: next }).catch(() => {});
      return next;
    });
  }

  return { dark, toggle };
}