import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { useAuth } from '../lib/auth';
import { chatMessageLink, chatNotificationTarget } from '../../shared/chatMessageLinks.mjs';

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
      const data = action.notification.data;
      if (typeof cid === 'string') { const target = chatNotificationTarget(data?.link); window.location.href = chatMessageLink(cid, typeof data?.messageId === 'string' ? data.messageId : target?.messageId, target?.mention); }
    });
    return () => { PushNotifications.removeAllListeners(); };
  }, [user?.id]);

  return null;
}
