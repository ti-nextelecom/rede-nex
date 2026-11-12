import {useEffect,useLayoutEffect,useRef} from 'react';
import {Capacitor} from '@capacitor/core';
import {PushNotifications} from '@capacitor/push-notifications';
import {App} from '@capacitor/app';
import {useNavigate} from 'react-router-dom';
import {toast, Toaster} from 'sonner';
import {useAuth} from '../lib/auth';
import {apiPost} from '../lib/apiClient';
import {startNativePushRegistration} from '../../shared/nativePushRegistration.mjs';
export function PushManager() {
  const {user}=useAuth();const navigate=useNavigate();const userId=user?.id,mustChange=user?.must_change_password;const navigateRef=useRef(navigate);
  useLayoutEffect(()=>{navigateRef.current=navigate;},[navigate]);
  useEffect(()=>{
    if(Capacitor.getPlatform()!=='android'||!userId||mustChange)return;
    let reported=false,explicit=false;
    const controller=startNativePushRegistration({push:PushNotifications,app:App,navigate:path=>navigateRef.current(path),
      saveToken:token=>apiPost('/devices/fcm-token',{token},undefined,{'X-Nex-User-Id':userId}),
      onError:()=>{if(!reported){reported=true;toast.error('Não foi possível ativar as notificações. Verifique a conexão e tente novamente no perfil.');}},
      onDenied:()=>{if(!reported){reported=true;toast.info('Notificações desativadas no Android. Habilite a permissão do Rede NEX nas configurações do aparelho.');}},
      onSaved:()=>{reported=false;if(explicit){explicit=false;toast.success('Aparelho registrado para notificações.');}}
    });
    const retry=()=>{explicit=true;void controller.retry();};
    const online=()=>{void controller.retry();};
    window.addEventListener('nex:android-push-enable',retry);window.addEventListener('online',online);
    return()=>{controller.stop();window.removeEventListener('nex:android-push-enable',retry);window.removeEventListener('online',online);};
  },[userId,mustChange]);
  return Capacitor.getPlatform()==='android' ? <Toaster position="top-center" duration={3000} closeButton richColors /> : null;
}
