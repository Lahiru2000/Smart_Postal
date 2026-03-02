import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { getIncomingCalls, answerCall, declineCall } from '../services/api';

const IncomingCallOverlay = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [incomingCall, setIncomingCall] = useState(null);
  const [answering, setAnswering] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Don't poll if already on a video call page or unauthenticated pages
    const noPollingPaths = ['/video-call/', '/login', '/register', '/'];
    if (noPollingPaths.some(p => p === '/' ? location.pathname === '/' : location.pathname.startsWith(p))) return;

    const poll = async () => {
      try {
        const res = await getIncomingCalls();
        if (res.data.length > 0) {
          setIncomingCall(res.data[0]);
        } else {
          setIncomingCall(null);
        }
      } catch (err) {
        // Stop polling if unauthorized (token expired/invalid)
        if (err.response?.status === 401) {
          clearInterval(pollRef.current);
          return;
        }
      }
    };

    poll();
    pollRef.current = setInterval(poll, 3000);

    return () => clearInterval(pollRef.current);
  }, [location.pathname]);

  const handleAnswer = async () => {
    if (!incomingCall || answering) return;
    setAnswering(true);
    try {
      const callToken = incomingCall.session_token;
      clearInterval(pollRef.current);
      await answerCall(callToken);
      setIncomingCall(null);
      navigate(`/video-call/${callToken}`);
    } catch (err) {
      console.error('Failed to answer call', err);
      const status = err.response?.status;
      const detail = err.response?.data?.detail || 'Failed to answer call.';
      // If call is no longer ringing (cancelled, expired, already answered), dismiss overlay
      if (status === 400 || status === 410 || status === 404) {
        setIncomingCall(null);
      } else {
        alert(detail + ' Please try again.');
      }
      setAnswering(false);
      pollRef.current = setInterval(async () => {
        try {
          const res = await getIncomingCalls();
          if (res.data.length > 0) setIncomingCall(res.data[0]);
          else setIncomingCall(null);
        } catch {}
      }, 3000);
    }
  };

  const handleDecline = async () => {
    if (!incomingCall) return;
    try {
      await declineCall(incomingCall.session_token);
    } catch {}
    setIncomingCall(null);
  };

  if (!incomingCall) return null;

  const userId = parseInt(localStorage.getItem('userId'));
  const callerLabel = userId === incomingCall.courier_id ? 'Customer' : 'Courier';

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-[#1A1A1A] rounded-3xl border border-[#333333] p-8 max-w-sm w-full mx-4 text-center">
        {/* Ringing Animation */}
        <div className="relative mb-6 flex items-center justify-center">
          <div className="absolute w-24 h-24 bg-green-500/20 rounded-full animate-ping" />
          <div className="absolute w-20 h-20 bg-green-500/30 rounded-full animate-pulse" />
          <div className="relative w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
            <Video className="text-white" size={28} />
          </div>
        </div>

        <h2 className="text-white text-xl font-bold mb-2">Incoming Video Call</h2>
        <p className="text-gray-400 mb-1">Shipment #{incomingCall.shipment_id}</p>
        <p className="text-gray-500 text-sm mb-8">{callerLabel} is calling...</p>

        {/* Ringing dots */}
        <div className="flex justify-center gap-2 mb-8">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-3 h-3 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-3 h-3 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-8">
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleDecline}
              className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg shadow-red-500/30"
            >
              <PhoneOff className="text-white" size={24} />
            </button>
            <span className="text-red-400 text-xs font-medium">Decline</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleAnswer}
              disabled={answering}
              className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center hover:bg-green-600 transition-colors shadow-lg shadow-green-500/30 disabled:opacity-50"
            >
              <Phone className="text-white" size={24} />
            </button>
            <span className="text-green-400 text-xs font-medium">{answering ? 'Connecting...' : 'Answer'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallOverlay;
