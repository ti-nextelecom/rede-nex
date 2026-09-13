import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission().catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Remove splash screen after React mounts
const splash = document.getElementById('splash');
if (splash) {
  setTimeout(() => {
    splash.classList.add('fade-out');
    setTimeout(() => splash.remove(), 500);
  }, 250);
}