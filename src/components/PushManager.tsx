import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { useAuth } from '../lib/auth';

export function PushManager() {
  const { user } = useAuth();

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user) return;
    PushNotifications.requestPermissions().then(perm => {
      if (perm.receive !== 'granted') return;
      PushNotifications.register();
    });
    PushNotifications.addListener('registration', token => {
      fetch('/api/devices/fcm-token', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.value }),
      }).catch(() => {});
    });
    PushNotifications.addListener('pushNotificationActionPerformed', action => {
      const cid = action.notification.data?.conversationId;
      if (cid) window.location.href = '/bate-papo?conversa=' + cid;
    });
    return () => { PushNotifications.removeAllListeners(); };
  }, [user?.id]);

  return null;
}
