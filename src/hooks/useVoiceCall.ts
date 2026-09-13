import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { wsEventBus } from '../lib/wsEventBus';

export type CallState = 'idle' | 'calling' | 'incoming' | 'active';
export type CallType = 'audio' | 'video';

export interface CallPeer {
  id: string;
  name: string;
  photo_url?: string;
}

export interface VoiceCallOptions {
  localUser?: CallPeer;
  onCallEnded?: (peerId: string, durationSec: number, callType: CallType, answered: boolean) => void;
}

export interface VoiceCallControls {
  callState: CallState;
  callType: CallType;
  remotePeer: CallPeer | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  muted: boolean;
  videoOff: boolean;
  durationSec: number;
  localVideoRef: RefObject<HTMLVideoElement>;
  remoteVideoRef: RefObject<HTMLVideoElement>;
  startCall: (peer: CallPeer, type?: CallType) => void;
  acceptCall: () => void;
  rejectCall: () => void;
  hangUp: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function useVoiceCall(options: VoiceCallOptions = {}): VoiceCallControls {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const peerIdRef = useRef<string | null>(null);
  const callStateRef = useRef<CallState>('idle');
  const callTypeRef = useRef<CallType>('audio');
  const answeredRef = useRef(false);
  const startTimeRef = useRef<number | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const getLocalStreamPromiseRef = useRef<Promise<MediaStream> | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const [callState, setCallStateRaw] = useState<CallState>('idle');
  const [callType, setCallType] = useState<CallType>('audio');
  const [remotePeer, setRemotePeer] = useState<CallPeer | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [durationSec, setDurationSec] = useState(0);

  function setCallState(s: CallState) {
    callStateRef.current = s;
    setCallStateRaw(s);
  }

  function startDurationTimer() {
    startTimeRef.current = Date.now();
    durationTimerRef.current = setInterval(() => {
      setDurationSec(Math.floor((Date.now() - (startTimeRef.current ?? Date.now())) / 1000));
    }, 1000);
  }

  function stopDurationTimer() {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }

  function closePc() {
    getLocalStreamPromiseRef.current = null;
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    remoteStreamRef.current = null;
    pendingCandidatesRef.current = [];
  }

  function reset(answered = false) {
    const duration = startTimeRef.current
      ? Math.floor((Date.now() - startTimeRef.current) / 1000)
      : 0;
    const peerId = peerIdRef.current;
    const type = callTypeRef.current;

    stopDurationTimer();
    closePc();
    setCallState('idle');
    setRemotePeer(null);
    setLocalStream(null);
    setRemoteStream(null);
    setMuted(false);
    setVideoOff(false);
    setDurationSec(0);
    peerIdRef.current = null;
    answeredRef.current = false;
    startTimeRef.current = null;

    if (peerId && optionsRef.current.onCallEnded) {
      optionsRef.current.onCallEnded(peerId, duration, type, answered);
    }
  }

  async function getLocalStream(): Promise<MediaStream> {
    if (localStreamRef.current) return localStreamRef.current;
    if (getLocalStreamPromiseRef.current) return getLocalStreamPromiseRef.current;
    const wantVideo = callTypeRef.current === 'video';
    const p = (async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: wantVideo });
      } catch (err) {
        if (wantVideo) {
          console.warn('[Call] video unavailable, falling back to audio:', err);
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          callTypeRef.current = 'audio';
          setCallType('audio');
        } else {
          throw err;
        }
      }
      localStreamRef.current = stream;
      setLocalStream(stream);
      if (localVideoRef.current && callTypeRef.current === 'video') {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
      }
      return stream;
    })();
    getLocalStreamPromiseRef.current = p;
    p.catch(() => {}).finally(() => { getLocalStreamPromiseRef.current = null; });
    return p;
  }

  function applyRemoteStream(stream: MediaStream) {
    remoteStreamRef.current = stream;
    setRemoteStream(stream);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
    }
  }

  function createPc(): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 10 });

    pc.onicecandidate = e => {
      if (pcRef.current !== pc) return;
      if (e.candidate && peerIdRef.current) {
        wsEventBus.send({ type: 'call:ice', to: peerIdRef.current, candidate: e.candidate.toJSON() });
      }
    };

    pc.ontrack = e => {
      if (pcRef.current !== pc) return;
      applyRemoteStream(e.streams[0]);
    };

    pc.onconnectionstatechange = () => {
      if (pcRef.current !== pc) return;
      if (pc.connectionState === 'connected') {
        answeredRef.current = true;
        startDurationTimer();
        setCallState('active');
        const capturedPc = pc;
        setTimeout(() => {
          if (pcRef.current !== capturedPc) return;
          if (remoteVideoRef.current && remoteStreamRef.current) {
            remoteVideoRef.current.srcObject = remoteStreamRef.current;
          }
          if (localVideoRef.current && localStreamRef.current && callTypeRef.current === 'video') {
            localVideoRef.current.srcObject = localStreamRef.current;
            localVideoRef.current.muted = true;
          }
        }, 100);
      }
      if (['failed', 'closed'].includes(pc.connectionState)) {
        reset(answeredRef.current);
      }
    };

    return pc;
  }

  async function addPendingCandidates(pc: RTCPeerConnection) {
    for (const c of pendingCandidatesRef.current) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
    pendingCandidatesRef.current = [];
  }

  const handleMessage = useCallback(async (msg: Record<string, unknown>) => {
    const type = msg.type as string;
    const from = msg.from as string | undefined;

    if (type === 'ping' || type === 'pong' || type === 'call:auth_ok' || type === 'call:auth_error') return;

    if (type === 'call:request') {
      if (callStateRef.current !== 'idle') { wsEventBus.send({ type: 'call:busy', to: from }); return; }
      if (!from) return;
      peerIdRef.current = from;
      const incomingType = (msg.callType as CallType) || 'audio';
      callTypeRef.current = incomingType;
      setCallType(incomingType);
      setRemotePeer({ id: from, name: String(msg.callerName || 'Desconhecido'), photo_url: msg.callerPhoto as string | undefined });
      setCallState('incoming');
      if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
        const callerName = String(msg.callerName || 'Alguém');
        const icon = (msg.callerPhoto as string) ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(callerName)}&size=96&background=0057b8&color=fff`;
        navigator.serviceWorker.getRegistration().then(reg => {
          reg?.showNotification(`📞 Chamada de ${incomingType === 'video' ? 'vídeo' : 'voz'}`, {
            body: `${callerName} está ligando...`,
            icon,
            tag: 'incoming-call',
            requireInteraction: true,
          } as NotificationOptions);
        }).catch(() => {});
      }
      return;
    }

    if (type === 'call:accept') {
      if (callStateRef.current !== 'calling' || !peerIdRef.current) return;
      try {
        const stream = await getLocalStream();
        if (!peerIdRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
        const pc = createPc();
        stream.getTracks().forEach(t => pc.addTrack(t, stream));
        pcRef.current = pc;
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: callTypeRef.current === 'video' });
        await pc.setLocalDescription(offer);
        wsEventBus.send({ type: 'call:offer', to: peerIdRef.current, sdp: pc.localDescription, callType: callTypeRef.current });
      } catch (e) {
        console.error('[Call] offer error:', e);
        reset(false);
      }
      return;
    }

    if (type === 'call:offer') {
      if (!peerIdRef.current) return;
      if (msg.callType) { callTypeRef.current = msg.callType as CallType; setCallType(msg.callType as CallType); }
      try {
        const stream = await getLocalStream();
        if (!peerIdRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
        const pc = createPc();
        stream.getTracks().forEach(t => pc.addTrack(t, stream));
        pcRef.current = pc;
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp as RTCSessionDescriptionInit));
        await addPendingCandidates(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        wsEventBus.send({ type: 'call:answer', to: peerIdRef.current, sdp: pc.localDescription });
      } catch (e) {
        console.error('[Call] answer error:', e);
        reset(false);
      }
      return;
    }

    if (type === 'call:answer') {
      if (!pcRef.current) return;
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.sdp as RTCSessionDescriptionInit));
        await addPendingCandidates(pcRef.current);
      } catch (e) {
        console.error('[Call] setRemote error:', e);
        reset(false);
      }
      return;
    }

    if (type === 'call:ice') {
      const candidate = msg.candidate as RTCIceCandidateInit;
      if (!candidate) return;
      if (pcRef.current?.remoteDescription) {
        try { await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
      return;
    }

    if (type === 'call:reject' || type === 'call:busy' || type === 'call:end') {
      reset(answeredRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to shared WS event bus
  useEffect(() => {
    return wsEventBus.subscribe(handleMessage);
  }, [handleMessage]);

  // Stop media tracks and close PC when component unmounts (e.g. navigating away during a call)
  useEffect(() => {
    return () => { closePc(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn before page close during active call
  useEffect(() => {
    if (callState === 'idle') return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [callState]);

  const startCall = useCallback((peer: CallPeer, type: CallType = 'audio') => {
    if (callStateRef.current !== 'idle') return;
    peerIdRef.current = peer.id;
    callTypeRef.current = type;
    setCallType(type);
    setRemotePeer(peer);
    setCallState('calling');
    const local = optionsRef.current.localUser;
    wsEventBus.send({
      type: 'call:request',
      to: peer.id,
      callerName: local?.name ?? 'Desconhecido',
      callerPhoto: local?.photo_url,
      callType: type,
    });
    getLocalStream().catch(err => console.warn('[Call] pre-acquire failed:', err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const acceptCall = useCallback(() => {
    if (callStateRef.current !== 'incoming' || !peerIdRef.current) return;
    getLocalStream().catch(err => console.warn('[Call] pre-acquire on accept failed:', err));
    wsEventBus.send({ type: 'call:accept', to: peerIdRef.current });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rejectCall = useCallback(() => {
    if (peerIdRef.current) wsEventBus.send({ type: 'call:reject', to: peerIdRef.current });
    reset(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hangUp = useCallback(() => {
    if (peerIdRef.current) wsEventBus.send({ type: 'call:end', to: peerIdRef.current });
    reset(answeredRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const tracks = localStreamRef.current.getAudioTracks();
    const next = !tracks[0]?.enabled;
    tracks.forEach(t => { t.enabled = next; });
    setMuted(!next);
  }, []);

  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return;
    const tracks = localStreamRef.current.getVideoTracks();
    const next = !tracks[0]?.enabled;
    tracks.forEach(t => { t.enabled = next; });
    setVideoOff(!next);
  }, []);

  return { callState, callType, remotePeer, localStream, remoteStream, muted, videoOff, durationSec, localVideoRef, remoteVideoRef, startCall, acceptCall, rejectCall, hangUp, toggleMute, toggleVideo };
}

