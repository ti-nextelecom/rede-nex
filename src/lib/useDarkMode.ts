import { useEffect } from 'react';

// Always dark mode — no toggle
function applyDark() {
  document.documentElement.classList.add('dark');
  document.documentElement.style.colorScheme = 'dark';
}

// Apply immediately on module load
applyDark();

export function useDarkMode() {
  useEffect(() => { applyDark(); }, []);
  return { dark: true as const, toggle: () => {} };
}
