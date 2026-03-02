import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, PhoneOff, User, Package } from 'lucide-react';
import { getIncomingCalls, answerVideoCall, declineVideoCall } from '../services/api';

const IncomingCallOverlay = () => {
  const navigate = useNavigate();
  const [incomingCall, setIncomingCall] = useState(null);
  const [answering, setAnswering] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const poll = async () => {
      try {
        const res = await getIncomingCalls();
        if (res.data && res.data.length > 0) {
          setIncomingCall(res.data[0]);
        } else {
          setIncomingCall(null);
        }
      } catch {
        // Ignore errors (not logged in, etc.)
      }
    };

    poll();
    pollRef.current = setInterval(poll, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleAnswer = async () => {
    if (!incomingCall) return;
    setAnswering(true);
    try {
      await answerVideoCall(incomingCall.room_id);
      setIncomingCall(null);
      navigate(`/video-call/${incomingCall.room_id}?role=callee`);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to answer call');
    } finally {
      setAnswering(false);
    }
  };

  const handleDecline = async () => {
    if (!incomingCall) return;
    try {
      await declineVideoCall(incomingCall.room_id);
      setIncomingCall(null);
    } catch {
      setIncomingCall(null);
    }
  };

  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4">
        {/* Animated ring effect */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative">
            <div className="absolute inset-0 w-28 h-28 rounded-full bg-green-500/20 animate-ping" />
            <div className="absolute inset-0 w-28 h-28 rounded-full bg-green-500/10 animate-pulse" />
            <div className="relative w-28 h-28 bg-[#1A1A1A] rounded-full flex items-center justify-center border-2 border-green-500/30">
              <User className="w-14 h-14 text-[#FFC000]" />
            </div>
          </div>
        </div>

        {/* Call info */}
        <div className="text-center mb-8">
          <h2 className="text-white text-2xl font-bold mb-1">{incomingCall.caller_name}</h2>
          <p className="text-gray-400 text-sm animate-pulse">Incoming video call...</p>
          {incomingCall.shipment_tracking && (
            <div className="flex items-center justify-center gap-1.5 mt-3 text-gray-500 text-xs">
              <Package className="w-3.5 h-3.5" />
              <span>Shipment: {incomingCall.shipment_tracking}</span>
            </div>
          )}
        </div>

        {/* Answer / Decline buttons */}
        <div className="flex items-center justify-center gap-12">
          {/* Decline */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleDecline}
              className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center text-white hover:bg-red-700 transition-all shadow-lg shadow-red-600/30"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
            <span className="text-gray-400 text-xs">Decline</span>
          </div>

          {/* Answer */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleAnswer}
              disabled={answering}
              className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center text-white hover:bg-green-400 transition-all shadow-lg shadow-green-500/30 disabled:opacity-50"
            >
              <Phone className="w-7 h-7" />
            </button>
            <span className="text-gray-400 text-xs">Answer</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallOverlay;
