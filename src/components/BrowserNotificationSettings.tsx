import { useEffect,useState } from 'react';
import { BellRing } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { desktopSupported,disableDesktopNotifications,enableDesktopNotifications,syncDesktopNotifications } from '../lib/browserNotifications';
export function BrowserNotificationSettings() {
  const {user}=useAuth();
  const [enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    if(!user?.id) return;
    let alive=true;
    const sync=()=>{void syncDesktopNotifications(user.id).then(value=>{if(alive)setEnabled(value);}).catch(()=>{if(alive)setEnabled(false);});};
    sync();window.addEventListener('nex-desktop-notifications',sync);
    return()=>{alive=false;window.removeEventListener('nex-desktop-notifications',sync);};
  },[user?.id]);
  return <div className='border-b border-border p-4 text-sm'>
    <div className='flex items-center gap-2 font-semibold'><BellRing size={17}/> Neste dispositivo</div>
    <p className='my-2 text-xs text-muted-foreground'>Receba mensagens, tarefas, projetos e os demais avisos mesmo com a aba fechada, enquanto o navegador permitir.</p>
    <button className='min-h-10 w-full rounded-lg border border-border px-3 text-left hover:bg-muted disabled:opacity-50' disabled={busy || !user || !desktopSupported()} onClick={async()=>{
      if(!user)return;setBusy(true);setError('');
      try{if(enabled){await disableDesktopNotifications();setEnabled(false);}else{await enableDesktopNotifications(user.id);setEnabled(true);}}
      catch(e){setError(e instanceof Error?e.message:'Não foi possível ativar');}finally{setBusy(false);}
    }}><BellRing size={15} className='mr-2 inline'/>{busy?'Aguarde…':enabled?'Desativar neste navegador':'Ativar notificações neste dispositivo'}</button>
    {!desktopSupported() && <p className='mt-2 text-xs text-muted-foreground'>É necessário HTTPS e um navegador compatível.</p>}
    {error && <p role='alert' className='mt-2 text-xs text-orange-400'>{error}</p>}
  </div>;
}
