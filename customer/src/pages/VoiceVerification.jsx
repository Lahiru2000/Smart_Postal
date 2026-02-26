import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mic, MicOff, CheckCircle, XCircle, Shield, AlertTriangle, Package } from 'lucide-react';
import { getVerificationStatus, submitVerification } from '../services/api';

const VoiceVerification = () => {
  const { verificationId } = useParams();
  const navigate = useNavigate();
  const [verification, setVerification] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null); // 'approved', 'failed'
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    fetchStatus();
  }, [verificationId]);

  const fetchStatus = async () => {
    try {
      const res = await getVerificationStatus(verificationId);
      setVerification(res.data);
      if (res.data.status === 'approved') {
        setResult('approved');
        setMessage('Voice verification already passed. Delivery approved!');
      } else if (res.data.status === 'failed') {
        setResult('failed');
        setMessage('Voice verification has failed.');
      } else if (res.data.status === 'expired') {
        setResult('failed');
        setMessage('Verification session has expired. Ask the courier to resend.');
      }
    } catch (err) {
      if (err.response?.status === 401) {
        navigate('/login');
      } else {
        setMessage(err.response?.data?.detail || 'Failed to load verification');
      }
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await handleSubmit(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setMessage('Recording... Speak the challenge phrase clearly.');
    } catch (err) {
      setMessage('Microphone access denied. Please allow microphone access.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSubmit = async (audioBlob) => {
    setIsProcessing(true);
    setMessage('Verifying your voice... This may take a moment.');

    try {
      const file = new File([audioBlob], 'verification.webm', { type: 'audio/webm' });
      const res = await submitVerification(verificationId, file);
      const data = res.data;

      if (data.delivery_approved) {
        setResult('approved');
        setMessage('Voice verification passed! Your delivery has been approved.');
      } else {
        setResult('failed');
        setMessage(data.message || 'Voice verification failed.');
      }
    } catch (err) {
      const detail = err.response?.data?.detail || 'Verification failed';
      setResult('failed');
      setMessage(detail);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-400">Loading verification...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 font-sans selection:bg-[#FFC000] selection:text-black">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#FFC000] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#FFC000]/20">
            <Shield size={32} className="text-black" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Delivery Verification</h1>
          <p className="text-gray-400 text-sm">Verify your identity to receive your package</p>
        </div>

        {/* Verification Info Card */}
        {verification && (
          <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-[#333333] mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-[#FFC000]/10 rounded-lg">
                <Package size={20} className="text-[#FFC000]" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Shipment</p>
                <p className="font-bold">#{verification.shipment_id}</p>
              </div>
            </div>

            {verification.challenge_phrase && result !== 'approved' && (
              <div className="bg-black/50 rounded-xl p-4 border border-[#FFC000]/20">
                <p className="text-xs text-[#FFC000] font-bold uppercase tracking-wider mb-1">Challenge Phrase</p>
                <p className="text-white text-lg font-medium italic">"{verification.challenge_phrase}"</p>
                <p className="text-gray-500 text-xs mt-2">Please speak this phrase clearly into your microphone.</p>
              </div>
            )}
          </div>
        )}

        {/* Result States */}
        {result === 'approved' && (
          <div className="bg-green-500/10 rounded-2xl p-8 border border-green-500/30 text-center">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-green-400 mb-2">Verification Passed!</h2>
            <p className="text-gray-400 text-sm">{message}</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="mt-6 px-8 py-3 bg-green-500 text-black font-bold rounded-xl hover:bg-green-400 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        )}

        {result === 'failed' && (
          <div className="bg-red-500/10 rounded-2xl p-8 border border-red-500/30 text-center">
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-400 mb-2">Verification Failed</h2>
            <p className="text-gray-400 text-sm">{message}</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="mt-6 px-8 py-3 bg-[#333333] text-white font-bold rounded-xl hover:bg-[#444444] transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        )}

        {/* Recording UI */}
        {!result && (
          <div className="bg-[#1A1A1A] rounded-2xl p-8 border border-[#333333] text-center">
            <p className="text-gray-400 text-sm mb-6">
              Record yourself speaking the challenge phrase above. Your voice will be verified to confirm your identity.
            </p>

            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing}
              className={`w-28 h-28 rounded-full flex items-center justify-center mx-auto transition-all shadow-2xl ${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600 animate-pulse shadow-red-500/30'
                  : isProcessing
                  ? 'bg-gray-700 cursor-not-allowed'
                  : 'bg-[#FFC000] hover:bg-[#E5AC00] shadow-[#FFC000]/20 hover:scale-105'
              }`}
            >
              {isProcessing ? (
                <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : isRecording ? (
                <MicOff className="w-12 h-12 text-white" />
              ) : (
                <Mic className="w-12 h-12 text-black" />
              )}
            </button>

            <p className="mt-4 text-sm font-medium">
              {isProcessing ? (
                <span className="text-[#FFC000]">Verifying your voice...</span>
              ) : isRecording ? (
                <span className="text-red-400">Recording — tap to stop</span>
              ) : (
                <span className="text-gray-400">Tap to start recording</span>
              )}
            </p>

            {message && !isProcessing && (
              <div className="mt-6 p-3 rounded-xl bg-[#FFC000]/10 border border-[#FFC000]/20">
                <p className="text-sm text-[#FFC000]">{message}</p>
              </div>
            )}
          </div>
        )}

        {/* Info */}
        <div className="mt-6 p-4 bg-[#1A1A1A] rounded-xl border border-[#333333]">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#FFC000] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400">
              This verification uses AI-powered voice detection to ensure your voice is genuine.
              AI-generated, synthetic, or replayed audio will be rejected.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceVerification;
