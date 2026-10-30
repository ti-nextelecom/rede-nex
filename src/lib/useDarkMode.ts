import { useAppearance } from './appearance';
export function useDarkMode() {
  const { palette, update } = useAppearance();
  return { dark: palette.dark, toggle: () => update({ mode: palette.dark ? 'light' : 'dark' }) };
}
