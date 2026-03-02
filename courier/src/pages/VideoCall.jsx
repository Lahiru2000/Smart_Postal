import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Phone, PhoneOff, Mic, MicOff, Video, VideoOff,
  RotateCcw, Maximize2, Minimize2, User
} from 'lucide-react';
import { getVideoCall, endVideoCall, getVideoCallWsUrl } from '../services/api';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const VideoCall = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Determine role from URL query param (?role=caller or ?role=callee)
  const roleFromUrl = new URLSearchParams(location.search).get('role');

  // Call info
  const [callInfo, setCallInfo] = useState(null);
  const [callStatus, setCallStatus] = useState('connecting');
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState('');
  const [hasRemoteStream, setHasRemoteStream] = useState(false);

  // Media state
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const wsRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const containerRef = useRef(null);
  const isCallerRef = useRef(roleFromUrl === 'caller');
  const callEndedRef = useRef(false);

  // ── Init ───────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const res = await getVideoCall(roomId);
        setCallInfo(res.data);

        // Fallback: if no URL param, try localStorage
        if (!roleFromUrl) {
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            const user = JSON.parse(storedUser);
            isCallerRef.current = user.id === res.data.caller_id;
          }
        }

        if (res.data.status === 'ringing') {
          setCallStatus('ringing');
        } else {
          setCallStatus('connecting');
        }

        await startMedia();
        connectSignaling();
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to join call');
        setCallStatus('ended');
      }
    };
    init();

    return () => cleanup();
  }, [roomId]);

  // ── Duration timer ─────────────────────────────────────
  useEffect(() => {
    if (callStatus === 'active' && !durationIntervalRef.current) {
      durationIntervalRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    };
  }, [callStatus]);

  // ── Auto-navigate away when call ends ──────────────────
  useEffect(() => {
    if (callStatus === 'ended' && !error) {
      const timer = setTimeout(() => navigate(-1), 2000);
      return () => clearTimeout(timer);
    }
  }, [callStatus, error, navigate]);

  // ── Media ──────────────────────────────────────────────
  const startMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Media access error:', err);
      setError('Camera/microphone access denied. Please allow permissions.');
    }
  };

  // ── WebRTC ─────────────────────────────────────────────
  const createPeerConnection = useCallback(() => {
    // Close existing connection if any
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setHasRemoteStream(true);
        setCallStatus('active');
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate,
        }));
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log('ICE state:', state);
      if (state === 'connected' || state === 'completed') {
        setCallStatus('active');
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        if (!callEndedRef.current) {
          callEndedRef.current = true;
          setCallStatus('ended');
          cleanup();
        }
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, []);

  // ── Signaling WebSocket ────────────────────────────────
  const connectSignaling = useCallback(() => {
    const wsUrl = getVideoCallWsUrl(roomId);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Signaling connected (role:', isCallerRef.current ? 'caller' : 'callee', ')');
    };

    ws.onmessage = async (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'peer-joined': {
          console.log('Peer joined, peer count:', message.peerCount);
          // Only the CALLER creates the offer when the callee joins
          if (isCallerRef.current) {
            console.log('Creating offer...');
            const pc = createPeerConnection();
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            ws.send(JSON.stringify({ type: 'offer', sdp: pc.localDescription }));
          }
          break;
        }

        case 'offer': {
          console.log('Received offer, creating answer...');
          const pc = createPeerConnection();
          await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: 'answer', sdp: pc.localDescription }));
          break;
        }

        case 'answer': {
          console.log('Received answer');
          if (peerConnectionRef.current) {
            await peerConnectionRef.current.setRemoteDescription(
              new RTCSessionDescription(message.sdp)
            );
          }
          break;
        }

        case 'ice-candidate': {
          if (peerConnectionRef.current && message.candidate) {
            try {
              await peerConnectionRef.current.addIceCandidate(
                new RTCIceCandidate(message.candidate)
              );
            } catch (e) {
              console.error('ICE candidate error:', e);
            }
          }
          break;
        }

        case 'hang-up':
        case 'peer-left': {
          console.log('Remote peer ended the call');
          if (!callEndedRef.current) {
            callEndedRef.current = true;
            setCallStatus('ended');
            cleanup();
          }
          break;
        }

        default:
          break;
      }
    };

    ws.onclose = () => {
      console.log('Signaling disconnected');
    };

    ws.onerror = (err) => {
      console.error('Signaling error:', err);
    };
  }, [roomId, createPeerConnection]);

  // ── Cleanup ────────────────────────────────────────────
  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) {
      wsRef.current.close();
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  };

  // ── Controls ───────────────────────────────────────────
  const toggleMute = () => {
    if (localStreamRef.current) {
      const enabled = !isMuted;
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !enabled;
      });
      setIsMuted(enabled);
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const off = !isCameraOff;
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !off;
      });
      setIsCameraOff(off);
    }
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement && containerRef.current) {
      await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else if (document.fullscreenElement) {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleHangUp = async () => {
    if (callEndedRef.current) return;
    callEndedRef.current = true;

    // Notify remote peer via WebSocket
    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'hang-up' }));
      }
    } catch { /* ignore */ }

    // End call in database
    try { await endVideoCall(roomId); } catch { /* ignore */ }

    setCallStatus('ended');
    cleanup();
  };

  const switchCamera = async () => {
    if (!localStreamRef.current) return;
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (!videoTrack) return;

    try {
      const currentFacing = videoTrack.getSettings().facingMode;
      const newFacing = currentFacing === 'user' ? 'environment' : 'user';
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing }, audio: false,
      });
      const newTrack = newStream.getVideoTracks()[0];

      const sender = peerConnectionRef.current?.getSenders().find(s => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(newTrack);

      localStreamRef.current.removeTrack(videoTrack);
      videoTrack.stop();
      localStreamRef.current.addTrack(newTrack);
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
    } catch (err) {
      console.error('Switch camera error:', err);
    }
  };

  const formatDuration = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const peerName = callInfo
    ? (isCallerRef.current ? callInfo.callee_name : callInfo.caller_name) || 'Unknown'
    : '';

  // ── Error screen ───────────────────────────────────────
  if (error && callStatus === 'ended') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-2">
          <PhoneOff className="w-10 h-10 text-red-400" />
        </div>
        <p className="text-red-400 text-lg font-bold">{error}</p>
        <button onClick={() => navigate(-1)} className="px-6 py-2 bg-[#1A1A1A] text-white rounded-xl border border-[#333333] hover:border-[#FFC000] transition-colors">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-black flex flex-col relative overflow-hidden font-sans selection:bg-[#FFC000] selection:text-black">
      {/* Remote Video — full-screen background */}
      <div className="absolute inset-0 bg-[#0A0A0A]">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-cover ${hasRemoteStream ? '' : 'hidden'}`}
        />

        {/* Overlay: shown when NOT active, OR active but no remote stream yet */}
        {(callStatus !== 'active' || !hasRemoteStream) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
            <div className="w-24 h-24 bg-[#1A1A1A] rounded-full flex items-center justify-center border-2 border-[#333333] mb-4">
              <User className="w-12 h-12 text-[#FFC000]" />
            </div>
            <h2 className="text-white text-2xl font-bold mb-2">{peerName}</h2>
            <p className="text-gray-400 animate-pulse">
              {callStatus === 'ended' ? 'Call Ended'
                : callStatus === 'ringing' ? 'Ringing...'
                : 'Connecting...'}
            </p>
            {callStatus === 'ended' && callDuration > 0 && (
              <p className="text-gray-500 text-sm mt-1">{formatDuration(callDuration)}</p>
            )}
          </div>
        )}
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent">
        <div>
          <p className="text-white font-bold text-lg">{peerName}</p>
        </div>
        <div className="flex items-center gap-3">
          {callStatus === 'active' && (
            <span className="text-green-400 text-sm font-mono bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20">
              {formatDuration(callDuration)}
            </span>
          )}
          <button onClick={toggleFullscreen} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            {isFullscreen
              ? <Minimize2 className="w-5 h-5 text-white" />
              : <Maximize2 className="w-5 h-5 text-white" />}
          </button>
        </div>
      </div>

      {/* Local Video — picture-in-picture */}
      <div className="absolute top-20 right-4 z-20 w-32 h-44 sm:w-40 sm:h-56 rounded-2xl overflow-hidden border-2 border-[#333333] shadow-2xl bg-[#1A1A1A]">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${isCameraOff ? 'hidden' : ''}`}
        />
        {isCameraOff && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#1A1A1A]">
            <VideoOff className="w-8 h-8 text-gray-500" />
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="relative z-10 mt-auto">
        <div className="bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-16 pb-8 px-4">
          <div className="flex items-center justify-center gap-4 max-w-md mx-auto">
            <button onClick={toggleMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                isMuted ? 'bg-red-500/20 border-2 border-red-500/40 text-red-400' : 'bg-white/10 border-2 border-white/20 text-white hover:bg-white/20'
              }`} title={isMuted ? 'Unmute' : 'Mute'}>
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>

            <button onClick={toggleCamera}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                isCameraOff ? 'bg-red-500/20 border-2 border-red-500/40 text-red-400' : 'bg-white/10 border-2 border-white/20 text-white hover:bg-white/20'
              }`} title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}>
              {isCameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
            </button>

            <button onClick={handleHangUp}
              disabled={callEndedRef.current}
              className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center text-white hover:bg-red-700 transition-all shadow-lg shadow-red-600/30"
              title="End call">
              <PhoneOff className="w-7 h-7" />
            </button>

            <button onClick={switchCamera}
              className="w-14 h-14 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all"
              title="Switch camera">
              <RotateCcw className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoCall;