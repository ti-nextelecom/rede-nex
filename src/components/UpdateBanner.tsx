import { useVersionCheck } from '../lib/useVersionCheck';

export function UpdateBanner() {
  const updateAvailable = useVersionCheck();
  if (!updateAvailable) return null;
  return (
    <div className="update-banner" role="status" aria-live="polite">
      <span>Nova versão disponível — correção de bugs e melhorias.</span>
      <button type="button" onClick={() => window.location.reload()}>Atualizar agora</button>
    </div>
  );
}
