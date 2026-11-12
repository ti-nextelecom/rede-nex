import { useEffect, useLayoutEffect, useRef } from 'react';
import { Capacitor, SystemBars, SystemBarsStyle, type PluginListenerHandle } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';
import { useLocation, useNavigate } from 'react-router-dom';
import { nativeBackAction } from '../../shared/nativeNavigation.mjs';
import { useAppearance } from '../lib/appearance';

export function NativeAppShell() {
  const location = useLocation(), navigate = useNavigate();
  const current = useRef({ location, navigate });
  const { palette } = useAppearance();
  useLayoutEffect(() => { current.current = { location, navigate }; }, [location, navigate]);
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    void SystemBars.setStyle({ style: palette.dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => undefined);
  }, [palette.dark]);

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    const root = document.documentElement;
    root.dataset.nativeApp = 'android';
    let stopped = false, frame = 0, keyboardOpen = false;
    const handles: PluginListenerHandle[] = [];
    function keep(listener: Promise<PluginListenerHandle>) {
      void listener.then(handle => { if (stopped) void handle.remove().catch(() => undefined); else handles.push(handle); }).catch(() => undefined);
    }
    function updateViewport() {
      frame = 0;
      if (stopped) return;
      root.style.setProperty('--nex-visible-height', `${window.visualViewport?.height || window.innerHeight}px`);
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(updateViewport); }
    function keyboard(visible: boolean) { keyboardOpen = visible; root.dataset.nativeKeyboard = String(visible); schedule(); }
    updateViewport();
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    keep(Keyboard.addListener('keyboardWillShow', () => keyboard(true)));
    keep(Keyboard.addListener('keyboardDidShow', () => {
      keyboard(true);
      requestAnimationFrame(() => { if (!stopped && document.activeElement instanceof HTMLElement) document.activeElement.scrollIntoView({ block: 'nearest', inline: 'nearest' }); });
    }));
    keep(Keyboard.addListener('keyboardWillHide', () => keyboard(false)));
    keep(Keyboard.addListener('keyboardDidHide', () => keyboard(false)));
    keep(NativeApp.addListener('backButton', ({ canGoBack }) => {
      if (stopped) return;
      if (keyboardOpen) { void Keyboard.hide().catch(() => undefined); return; }
      const overlays = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper] > [data-state="open"]'))
        .filter(element => element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true' && element.getAttribute('data-state') !== 'closed');
      const overlay = overlays.at(-1);
      if (overlay) { overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true })); return; }
      const chatBack = document.querySelector<HTMLButtonElement>('.chat-shell[data-mobile-view="messages"] [aria-label="Voltar às conversas"]');
      if (chatBack) { chatBack.click(); return; }
      const action = nativeBackAction({ pathname: current.current.location.pathname, historyIndex: window.history.state?.idx, canGoBack });
      if (action === 'history') current.current.navigate(-1);
      else if (action === 'home') current.current.navigate('/', { replace: true });
      else void NativeApp.minimizeApp().catch(() => undefined);
    }));
    return () => {
      stopped = true; cancelAnimationFrame(frame);
      handles.forEach(handle => { void handle.remove(); });
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      delete root.dataset.nativeApp; delete root.dataset.nativeKeyboard; root.style.removeProperty('--nex-visible-height');
    };
  }, []);
  return null;
}
