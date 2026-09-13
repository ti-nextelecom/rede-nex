import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, PhoneIncoming } from 'lucide-react';
import type { VoiceCallControls } from '../lib/useVoiceCall';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function useRingtone(active: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);

  useEffect(() => {
    if (active) {
      activeRef.current = true;
      const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      ctxRef.current = new AudioContextCtor();

      function beep() {
        if (!activeRef.current || !ctxRef.current) return;
        const ctx = ctxRef.current;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(880, ctx.currentTime);
        osc2.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.02);
        gain.gain.setValueAtTime(0.25, ctx.currentTime + 0.13);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.15);
        osc2.start(ctx.currentTime + 0.15);
        osc2.stop(ctx.currentTime + 0.3);
        if (activeRef.current) timerRef.current = setTimeout(beep, 1800);
      }

      beep();
    } else {
      activeRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    }

    return () => {
      activeRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      ctxRef.current?.close().catch(() => {});
    };
  }, [active]);
}

interface Props extends VoiceCallControls {}

export function VoiceCallOverlay(props: Props) {
  const { callState, callType, remotePeer, localStream, remoteStream, muted, videoOff, durationSec,
    localVideoRef, remoteVideoRef, acceptCall, rejectCall, hangUp, toggleMute, toggleVideo } = props;

  useRingtone(callState === 'incoming');

  // Apply remote stream to video element whenever either changes.
  // Handles race condition where ontrack fires before the element mounts.
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, remoteVideoRef]);

  // Apply local stream for video preview — element may not be mounted when getLocalStream runs.
  useEffect(() => {
    if (localVideoRef.current && localStream && callType === 'video') {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.muted = true;
    }
  }, [localStream, localVideoRef, callType]);

  if (callState === 'idle') return null;

  const avatar = remotePeer?.photo_url
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(remotePeer?.name || 'N')}&size=200&background=0057b8&color=fff`;

  const isVideo = callType === 'video';
  // Show fullscreen video layout if remote is sending video — even if local fell back to audio (no camera)
  const hasRemoteVideo = !!(remoteStream?.getVideoTracks().some(t => t.readyState === 'live'));
  const isActiveVideo = (isVideo || hasRemoteVideo) && callState === 'active';

  const content = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Remote video — always in DOM so ref is attached for audio playback too */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className={isActiveVideo
          ? 'absolute inset-0 w-full h-full object-cover bg-black'
          : 'hidden'}
      />

      {/* Local video — always in DOM so ref is attached when getLocalStream runs */}
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        className={isActiveVideo
          ? 'absolute top-8 right-4 w-28 h-36 object-cover rounded-2xl border-2 border-white/40 shadow-xl z-20'
          : 'hidden'}
        style={isActiveVideo ? { transform: 'scaleX(-1)' } : undefined}
      />

      {/* Backdrop — pointer-events-none so it never blocks button clicks */}
      <div className={`absolute inset-0 pointer-events-none ${isActiveVideo ? 'bg-black/20' : 'bg-black/75 backdrop-blur-sm'}`} />

      {isActiveVideo ? (
        /* ── Active video call: fullscreen layout with floating controls ── */
        <div className="relative z-10 w-full h-full flex flex-col pointer-events-none">
          {/* Top bar: name + timer */}
          <div className="bg-gradient-to-b from-black/70 to-transparent px-6 pt-8 pb-16 pointer-events-none">
            <p className="text-white text-xl font-bold drop-shadow">{remotePeer?.name}</p>
            <p className="text-white/70 text-sm font-mono mt-0.5">{formatDuration(durationSec)}</p>
          </div>

          {/* Bottom controls */}
          <div className="mt-auto bg-gradient-to-t from-black/70 to-transparent px-6 pb-10 pt-16 pointer-events-auto">
            <div className="flex gap-6 justify-center">
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={toggleMute}
                  className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 ${
                    muted ? 'bg-red-500 hover:bg-red-600' : 'bg-white/25 hover:bg-white/40'
                  }`}
                >
                  {muted ? <MicOff size={22} className="text-white" /> : <Mic size={22} className="text-white" />}
                </button>
                <span className="text-white/70 text-xs">{muted ? 'Mudo' : 'Microfone'}</span>
              </div>

              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={toggleVideo}
                  className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 ${
                    videoOff ? 'bg-amber-500 hover:bg-amber-600' : 'bg-white/25 hover:bg-white/40'
                  }`}
                >
                  {videoOff ? <VideoOff size={22} className="text-white" /> : <Video size={22} className="text-white" />}
                </button>
                <span className="text-white/70 text-xs">{videoOff ? 'Câmera off' : 'Câmera'}</span>
              </div>

              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={hangUp}
                  className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-all active:scale-95"
                >
                  <PhoneOff size={22} className="text-white" />
                </button>
                <span className="text-white/70 text-xs">Encerrar</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── Card layout: incoming / calling / active audio ── */
        <div className="relative z-10 flex flex-col items-center gap-6 p-10 rounded-3xl shadow-2xl w-full max-w-sm mx-4"
          style={{ background: 'linear-gradient(160deg, #003d80 0%, #0057b8 60%, #1a6fd4 100%)' }}
        >
          {/* Status label */}
          <div className="flex items-center gap-2 text-white/70 text-sm font-medium">
            {callState === 'incoming' && <><PhoneIncoming size={15} className="text-emerald-400 animate-bounce" /> Chamada de {isVideo ? 'vídeo' : 'voz'} recebida</>}
            {callState === 'calling' && <><span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" /> Chamando... aguardando resposta</>}
            {callState === 'active' && <><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Em chamada de {isVideo ? 'vídeo' : 'voz'}</>}
          </div>

          {/* Avatar */}
          <div className={`relative ${callState === 'calling' ? 'animate-pulse' : ''}`}>
            {callState === 'incoming' && (
              <>
                <div className="absolute inset-0 rounded-full border-4 border-emerald-400/40 animate-ping scale-110" />
                <div className="absolute inset-0 rounded-full border-4 border-emerald-400/20 animate-ping scale-125" style={{ animationDelay: '0.3s' }} />
              </>
            )}
            <img
              src={avatar}
              alt={remotePeer?.name}
              className="w-32 h-32 rounded-full object-cover ring-4 ring-white/20 shadow-xl"
            />
          </div>

          {/* Name + timer */}
          <div className="text-center">
            <p className="text-white text-2xl font-bold leading-tight">{remotePeer?.name}</p>
            {callState === 'active' && (
              <p className="text-white/70 text-base font-mono mt-1">{formatDuration(durationSec)}</p>
            )}
          </div>

          {/* Controls */}
          {callState === 'incoming' && (
            <div className="flex gap-8 mt-2">
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={rejectCall}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-all active:scale-95"
                >
                  <PhoneOff size={26} className="text-white" />
                </button>
                <span className="text-white/70 text-xs font-medium">Recusar</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={acceptCall}
                  className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center shadow-lg transition-all active:scale-95 animate-bounce"
                >
                  <Phone size={26} className="text-white" />
                </button>
                <span className="text-white/70 text-xs font-medium">Atender</span>
              </div>
            </div>
          )}

          {callState === 'calling' && (
            <button
              onClick={rejectCall}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-all active:scale-95"
            >
              <PhoneOff size={26} className="text-white" />
            </button>
          )}

          {callState === 'active' && (
            <div className="flex gap-5 mt-2 flex-wrap justify-center">
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={toggleMute}
                  className={`w-14 h-14 rounded-full flex items-center justify-center shadow-md transition-all active:scale-95 ${
                    muted ? 'bg-red-500 hover:bg-red-600' : 'bg-white/20 hover:bg-white/30'
                  }`}
                >
                  {muted ? <MicOff size={22} className="text-white" /> : <Mic size={22} className="text-white" />}
                </button>
                <span className="text-white/60 text-xs">{muted ? 'Mudo' : 'Microfone'}</span>
              </div>

              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={hangUp}
                  className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-md transition-all active:scale-95"
                >
                  <PhoneOff size={22} className="text-white" />
                </button>
                <span className="text-white/60 text-xs">Encerrar</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return createPortal(content, document.body);
}
