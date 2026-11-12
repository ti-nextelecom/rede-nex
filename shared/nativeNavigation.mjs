export function nativeBackAction({ pathname, historyIndex, canGoBack }) {
  if (pathname === '/' || pathname === '/login') return 'minimize';
  if (Number.isInteger(historyIndex) && historyIndex > 0 && canGoBack) return 'history';
  return 'home';
}
