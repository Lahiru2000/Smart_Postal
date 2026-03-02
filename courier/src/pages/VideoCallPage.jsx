import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Video, VideoOff, Mic, MicOff, PhoneOff,
  Camera, Shield, Clock, User, CheckCircle,
} from 'lucide-react';
import { getCallSession, joinCall, endCall, captureFrame } from '../services/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const WS_URL = API_URL.replace(/^http/, 'ws');

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const VideoCallPage = () => {
  const { sessionToken } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [session, setSession] = useState(null);
  const [callStatus, setCallStatus] = useState('loading');
  const [capturedCount, setCapturedCount] = useState(0);

  // Media state
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [remoteConnected, setRemoteConnected] = useState(false);

  // Timer
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef(null);

  // Refs
  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerRef = useRef(null);
  const wsRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaStartedRef = useRef(false);
  const iceCandidateBuffer = useRef([]);
  const cleanedUpRef = useRef(false);

  // --- Cleanup helper ---
  const cleanup = useCallback(() => {
    if (cleanedUpRef.current) return;
    cleanedUpRef.current = true;
    clearInterval(timerRef.current);
    if (peerRef.current) {
      peerRef.current.onicecandidate = null;
      peerRef.current.ontrack = null;
      peerRef.current.onconnectionstatechange = null;
      peerRef.current.close();
      peerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
  }, []);

  // --- Load session info ---
  useEffect(() => {
    let cancelled = false;
    const loadSession = async () => {
      try {
        const res = await getCallSession(sessionToken);
        if (cancelled) return;
        setSession(res.data);
        const s = res.data.status;
        if (s === 'completed' || s === 'expired' || s === 'cancelled') {
          setCallStatus('ended');
        } else if (s === 'ringing') {
          setCallStatus('ringing');
        } else if (s === 'active') {
          setCallStatus('active');
        }
      } catch (err) {
        console.error('Failed to load call session', err);
        if (!cancelled) navigate('/dashboard');
      }
    };
    loadSession();
    return () => { cancelled = true; };
  }, [sessionToken, navigate]);

  // --- Poll while ringing ---
  useEffect(() => {
    if (callStatus !== 'ringing') return;
    const pollInterval = setInterval(async () => {
      try {
        const res = await getCallSession(sessionToken);
        if (res.data.status === 'active') {
          setSession(res.data);
          setCallStatus('active');
        } else if (['cancelled', 'expired', 'completed'].includes(res.data.status)) {
          setCallStatus('ended');
        }
      } catch {}
    }, 1500);
    return () => clearInterval(pollInterval);
  }, [callStatus, sessionToken]);

  // --- Start WebRTC when call becomes active ---
  const startMedia = useCallback(async () => {
    if (mediaStartedRef.current) return;
    mediaStartedRef.current = true;
    cleanedUpRef.current = false;

    try {
      // 1. Get local media — video + audio (Skype-style: both sides send video)
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (mediaErr) {
        console.error('Camera/mic denied, trying audio only:', mediaErr);
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          setVideoEnabled(false);
        } catch (audioErr) {
          console.error('All media access denied:', audioErr);
          mediaStartedRef.current = false;
          setCallStatus('ended');
          return;
        }
      }
      localStreamRef.current = stream;

      // Show local video in PIP
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // 2. Join call on backend
      try {
        await joinCall(sessionToken);
      } catch (joinErr) {
        console.error('Join call failed:', joinErr);
      }

      // 3. Setup peer connection
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerRef.current = pc;

      // Add local tracks — sends video+audio to customer
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      // Remote stream — displays customer's video full-screen
      pc.ontrack = (event) => {
        console.log('[Courier] ontrack fired, track:', event.track.kind);
        if (remoteVideoRef.current) {
          if (event.streams && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
          } else {
            // Fallback: build stream from individual tracks
            const existing = remoteVideoRef.current.srcObject || new MediaStream();
            existing.addTrack(event.track);
            remoteVideoRef.current.srcObject = existing;
          }
        }
      };

      // 4. Connect WebSocket for signaling
      const ws = new WebSocket(`${WS_URL}/ws/call/${sessionToken}?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => console.log('[Courier] WS connected');
      ws.onerror = (e) => console.error('[Courier] WS error', e);

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(msg));
            for (const c of iceCandidateBuffer.current) {
              try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) { console.warn('[Courier] Buffered ICE add failed', e); }
            }
            iceCandidateBuffer.current = [];
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(JSON.stringify(answer));
          } else if (msg.type === 'candidate' && msg.candidate) {
            if (pc.remoteDescription) {
              try { await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch (e) { console.warn('[Courier] ICE add failed', e); }
            } else {
              iceCandidateBuffer.current.push(msg.candidate);
            }
          } else if (msg.type === 'peer-joined') {
            console.log('[Courier] Peer joined, peerCount:', msg.peerCount);
          } else if (msg.type === 'peer-left') {
            setCallStatus('ended');
            cleanup();
          }
        } catch (msgErr) {
          console.error('[Courier] Error handling WS message:', msgErr);
        }
      };

      ws.onclose = (e) => console.log('[Courier] WS closed', e.code, e.reason);

      // ICE candidate relay
      pc.onicecandidate = (event) => {
        if (event.candidate && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        console.log('[Courier] Connection state:', state);
        if (state === 'connected') {
          setRemoteConnected(true);
          if (!timerRef.current) {
            timerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
          }
        } else if (state === 'disconnected' || state === 'failed') {
          setCallStatus('ended');
          cleanup();
        }
      };
    } catch (err) {
      console.error('Call setup failed', err);
      mediaStartedRef.current = false;
      setCallStatus('ended');
    }
  }, [sessionToken, token, cleanup]);

  useEffect(() => {
    if (session && callStatus === 'active' && !mediaStartedRef.current) {
      startMedia();
    }
  }, [callStatus, session, startMedia]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // --- Controls ---
  const toggleAudio = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
      setAudioEnabled((v) => !v);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        videoTracks.forEach((t) => (t.enabled = !t.enabled));
        setVideoEnabled((v) => !v);
      }
    }
  };

  const handleEndCall = async () => {
    try { await endCall(sessionToken); } catch {}
    cleanup();
    setCallStatus('ended');
  };

  const handleCapture = async () => {
    if (!remoteVideoRef.current) return;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvasRef.current = canvas;
    canvas.width = remoteVideoRef.current.videoWidth || 640;
    canvas.height = remoteVideoRef.current.videoHeight || 480;
    canvas.getContext('2d').drawImage(remoteVideoRef.current, 0, 0);
    const imageData = canvas.toDataURL('image/jpeg', 0.7);
    try {
      await captureFrame(sessionToken, imageData);
      setCapturedCount((c) => c + 1);
    } catch (err) {
      console.error('Capture failed', err);
    }
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ─── RENDER ────────────────────────────────────────────────────

  // Ringing screen
  if (callStatus === 'ringing') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a2e1a] to-black text-white font-sans flex flex-col items-center justify-center p-4">
        <div className="w-28 h-28 rounded-full bg-[#1A1A1A] border-2 border-[#333] flex items-center justify-center mb-8">
          <User size={56} className="text-gray-500" />
        </div>
        <p className="text-gray-400 text-sm mb-1">Shipment #{session?.shipment_id}</p>
        <h2 className="text-2xl font-bold mb-2">Calling Customer...</h2>
        <p className="text-gray-500 text-sm mb-10">Ringing</p>
        <div className="flex gap-3 mb-12">
          {[0, 150, 300].map((d, i) => (
            <div key={i} className="w-2.5 h-2.5 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
        <button
          onClick={handleEndCall}
          className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-all shadow-lg shadow-red-500/30"
        >
          <PhoneOff size={28} className="text-white" />
        </button>
        <span className="text-red-400 text-xs mt-3 font-medium">Cancel</span>
      </div>
    );
  }

  // Call ended
  if (callStatus === 'ended') {
    return (
      <div className="min-h-screen bg-black text-white font-sans flex flex-col items-center justify-center p-4">
        <CheckCircle size={48} className="text-green-400 mb-6" />
        <h2 className="text-2xl font-bold mb-2">Call Ended</h2>
        <p className="text-gray-500 mb-2">Duration: {fmt(callDuration)}</p>
        {capturedCount > 0 && (
          <p className="text-[#FFC000] mb-2">{capturedCount} verification frame(s) captured</p>
        )}
        <p className="text-gray-600 text-sm mb-8">
          {capturedCount > 0
            ? 'Review captured frames and verify the customer.'
            : 'No frames were captured during this call.'}
        </p>
        <div className="flex gap-3">
          {capturedCount > 0 && (
            <button
              onClick={() => navigate(`/verify/${sessionToken}`)}
              className="px-8 py-3 bg-green-500 text-black font-bold rounded-xl hover:bg-green-400 shadow-lg shadow-green-500/20"
            >
              Verify Customer
            </button>
          )}
          <button onClick={() => navigate('/dashboard')} className="px-8 py-3 bg-[#FFC000] text-black font-bold rounded-xl hover:bg-[#e6ad00]">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Loading
  if (callStatus === 'loading') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#FFC000] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ─── Active call — Skype-style: remote video full-screen + local PIP ───
  return (
    <div className="fixed inset-0 bg-black text-white font-sans flex flex-col">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent px-6 pt-5 pb-10">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Shield size={14} className="text-green-400" />
              <span className="text-xs text-green-400 font-medium">End-to-end encrypted</span>
            </div>
            <p className="text-white font-bold text-lg">Customer — Shipment #{session?.shipment_id}</p>
          </div>
          <div className="flex items-center gap-3">
            {capturedCount > 0 && (
              <div className="flex items-center gap-1.5 bg-[#FFC000]/20 backdrop-blur px-3 py-1.5 rounded-full">
                <Camera size={13} className="text-[#FFC000]" />
                <span className="text-xs text-[#FFC000] font-bold">{capturedCount}</span>
              </div>
            )}
            <div className="flex items-center gap-2 bg-black/50 backdrop-blur px-3 py-1.5 rounded-full">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <Clock size={13} className="text-red-400" />
              <span className="font-mono text-sm text-red-400 font-bold">{fmt(callDuration)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main video area — customer's remote video (full screen) */}
      <div className="flex-1 relative">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />

        {!remoteConnected && (
          <div className="absolute inset-0 bg-[#1A1A1A] flex flex-col items-center justify-center">
            <div className="w-16 h-16 border-4 border-[#FFC000] border-t-transparent rounded-full animate-spin mb-6" />
            <p className="text-xl font-bold">Connecting to customer...</p>
            <p className="text-gray-500 mt-2">Setting up video call</p>
          </div>
        )}

        {/* Local video PIP — small self-view in bottom-right corner */}
        <div className="absolute bottom-28 right-4 z-30 w-36 h-48 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-[#1A1A1A]">
          {videoEnabled ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User size={40} className="text-gray-500" />
            </div>
          )}
          <div className="absolute bottom-2 left-0 right-0 text-center">
            <span className="text-[10px] text-white/70 bg-black/50 px-2 py-0.5 rounded-full">You</span>
          </div>
        </div>
      </div>

      {/* Bottom controls bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 to-transparent pt-16 pb-10 px-6">
        <div className="flex items-center justify-center gap-5">
          {/* Mute */}
          <button
            onClick={toggleAudio}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              audioEnabled ? 'bg-white/15 backdrop-blur hover:bg-white/25' : 'bg-red-500 shadow-lg shadow-red-500/30'
            }`}
          >
            {audioEnabled ? <Mic size={22} /> : <MicOff size={22} />}
          </button>

          {/* Camera toggle */}
          <button
            onClick={toggleVideo}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              videoEnabled ? 'bg-white/15 backdrop-blur hover:bg-white/25' : 'bg-red-500 shadow-lg shadow-red-500/30'
            }`}
          >
            {videoEnabled ? <Video size={22} /> : <VideoOff size={22} />}
          </button>

          {/* Capture verification frame */}
          <button
            onClick={handleCapture}
            className="w-14 h-14 rounded-full bg-[#FFC000]/20 backdrop-blur border border-[#FFC000]/30 flex items-center justify-center hover:bg-[#FFC000]/30 transition-all"
            title="Capture verification frame"
          >
            <Camera size={22} className="text-[#FFC000]" />
          </button>

          {/* End call */}
          <button
            onClick={handleEndCall}
            className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-all shadow-lg shadow-red-500/30"
          >
            <PhoneOff size={26} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoCallPage;
