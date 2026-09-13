import { useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { useVoiceCall } from '../hooks/useVoiceCall';
import { VoiceCallOverlay } from './VoiceCallOverlay';
import { callStore } from '../lib/callStore';
import { getConversations, sendChatMessage } from '../lib/chatApi';

export function GlobalCallOverlay() {
  const { user } = useAuth();

  const controls = useVoiceCall({
    localUser: user ? { id: user.id, name: user.name, photo_url: user.photo_url } : undefined,
    onCallEnded: async (peerId, durationSec, callType, answered) => {
      try {
        const convs = await getConversations();
        const conv = convs.find(c => c.type === 'direct' && c.other_participant?.id === peerId);
        if (!conv) return;
        const icon = callType === 'video' ? '📹' : '📞';
        let text: string;
        if (!answered) {
          text = `${icon} Chamada perdida`;
        } else {
          const m = Math.floor(durationSec / 60);
          const s = durationSec % 60;
          const dur = m > 0 ? `${m}min ${s}s` : `${s}s`;
          text = `${icon} Chamada de ${callType === 'video' ? 'vídeo' : 'voz'} encerrada — ${dur}`;
        }
        await sendChatMessage(conv.id, text);
      } catch {}
    },
  });

  useEffect(() => {
    callStore.register(controls.startCall);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    callStore.setState(controls.callState);
  }, [controls.callState]);

  if (!user) return null;
  return <VoiceCallOverlay {...controls} />;
}
