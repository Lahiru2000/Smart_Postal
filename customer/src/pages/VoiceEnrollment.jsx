import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, CheckCircle, XCircle, Shield, AlertTriangle, ArrowRight, Volume2 } from 'lucide-react';
import { getEnrollmentStatus, startEnrollment, submitEnrollmentSample } from '../services/api';

const VoiceEnrollment = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null); // enrollment status from API
  const [enrollmentId, setEnrollmentId] = useState(null);
  const [verifiedSamples, setVerifiedSamples] = useState(0);
  const [requiredSamples, setRequiredSamples] = useState(3);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info'); // info, success, error
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const res = await getEnrollmentStatus();
      const data = res.data;
      setEnrolled(data.enrolled);
      if (data.enrolled) {
        setStatus('completed');
        setVerifiedSamples(data.verified_samples);
        setRequiredSamples(data.required_samples);
      } else if (data.status === 'pending') {
        setStatus('pending');
        setEnrollmentId(data.enrollment_id);
        setVerifiedSamples(data.verified_samples);
        setRequiredSamples(data.required_samples);
      }
    } catch (err) {
      if (err.response?.status === 401) navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEnrollment = async () => {
    setMessage('');
    try {
      const res = await startEnrollment();
      setEnrollmentId(res.data.enrollment_id);
      setVerifiedSamples(0);
      setRequiredSamples(res.data.required_samples);
      setStatus('pending');
      setMessage('Enrollment started! Record your first voice sample.');
      setMessageType('info');
    } catch (err) {
      setMessage(err.response?.data?.detail || 'Failed to start enrollment');
      setMessageType('error');
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
        await submitSample(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setMessage('Recording... Speak naturally for 5-10 seconds, then stop.');
      setMessageType('info');
    } catch (err) {
      setMessage('Microphone access denied. Please allow microphone access.');
      setMessageType('error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const submitSample = async (audioBlob) => {
    setIsProcessing(true);
    setMessage('Analyzing voice sample... This may take a moment.');
    setMessageType('info');

    try {
      const file = new File([audioBlob], 'voice_sample.webm', { type: 'audio/webm' });
      const res = await submitEnrollmentSample(enrollmentId, file);
      const data = res.data;

      setVerifiedSamples(data.verified_samples);

      if (data.enrollment_complete) {
        setEnrolled(true);
        setStatus('completed');
        setMessage('Voice enrollment completed successfully! You can now use voice verification for deliveries.');
        setMessageType('success');
      } else {
        setMessage(data.message);
        setMessageType('success');
      }
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to process voice sample';
      setMessage(detail);
      setMessageType('error');

      // If enrollment was denied, reset
      if (detail.includes('denied') || detail.includes('Enrollment')) {
        setStatus(null);
        setEnrollmentId(null);
        setVerifiedSamples(0);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 font-sans selection:bg-[#FFC000] selection:text-black">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-[#FFC000] rounded-xl text-black">
              <Shield size={28} strokeWidth={2.5} />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Voice Authentication</h1>
          </div>
          <p className="text-gray-400">Secure your deliveries with AI-powered voice verification.</p>
        </div>

        {/* Already Enrolled */}
        {enrolled && (
          <div className="bg-[#1A1A1A] rounded-2xl p-8 border border-green-500/30">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-green-500/10 rounded-xl">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Voice Enrolled</h2>
                <p className="text-gray-400 text-sm">Your voice profile is active and ready for delivery verification.</p>
              </div>
            </div>
            <div className="bg-black/40 rounded-xl p-4 border border-[#333333]">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Voice Samples</span>
                <span className="text-green-400 font-bold">{verifiedSamples}/{requiredSamples} verified</span>
              </div>
              <div className="mt-2 h-2 bg-black rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="mt-6 w-full py-3 bg-[#FFC000] text-black font-bold rounded-xl hover:bg-[#E5AC00] transition-colors flex items-center justify-center gap-2"
            >
              Back to Dashboard <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* Not Started */}
        {!enrolled && !status && (
          <div className="bg-[#1A1A1A] rounded-2xl p-8 border border-[#333333]">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-[#FFC000]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Volume2 className="w-10 h-10 text-[#FFC000]" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Enroll Your Voice</h2>
              <p className="text-gray-400 max-w-md mx-auto">
                Register your voice to enable secure delivery verification. You'll need to provide <strong className="text-white">3 voice samples</strong> to complete enrollment.
              </p>
            </div>

            <div className="space-y-4 mb-8">
              {[
                'Each voice sample is checked by AI to ensure it is a real human voice',
                'AI-generated or synthetic voices will be immediately rejected',
                'All 3 samples must come from the same speaker',
                'Your voice profile enables secure package delivery verification',
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-3 text-sm text-gray-300 bg-black/30 p-3 rounded-xl border border-[#333333]">
                  <CheckCircle className="w-5 h-5 text-[#FFC000] flex-shrink-0 mt-0.5" />
                  <span>{text}</span>
                </div>
              ))}
            </div>

            <button
              onClick={handleStartEnrollment}
              className="w-full py-4 bg-[#FFC000] text-black font-bold rounded-xl hover:bg-[#E5AC00] transition-colors text-lg shadow-lg shadow-[#FFC000]/20"
            >
              Start Enrollment
            </button>
          </div>
        )}

        {/* Enrollment In Progress */}
        {!enrolled && status === 'pending' && (
          <div className="space-y-6">
            {/* Progress */}
            <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-[#333333]">
              <h2 className="text-lg font-bold mb-4">Enrollment Progress</h2>
              <div className="flex items-center gap-4 mb-3">
                {[1, 2, 3].map((s) => (
                  <div key={s} className="flex-1">
                    <div className={`h-3 rounded-full transition-all ${
                      s <= verifiedSamples
                        ? 'bg-green-500'
                        : s === verifiedSamples + 1
                        ? 'bg-[#FFC000] animate-pulse'
                        : 'bg-[#333333]'
                    }`}></div>
                    <p className={`text-xs mt-1 text-center ${
                      s <= verifiedSamples ? 'text-green-400' : 'text-gray-500'
                    }`}>
                      Sample {s} {s <= verifiedSamples ? '✓' : ''}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-400 text-center">
                {verifiedSamples}/{requiredSamples} samples verified
              </p>
            </div>

            {/* Recording Area */}
            <div className="bg-[#1A1A1A] rounded-2xl p-8 border border-[#333333] text-center">
              <h3 className="text-lg font-bold mb-2">
                Record Voice Sample {verifiedSamples + 1}
              </h3>
              <p className="text-gray-400 text-sm mb-6">
                Speak naturally for 5-10 seconds. Say anything — for example, read a sentence aloud.
              </p>

              {/* Mic Button */}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
                className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto transition-all shadow-2xl ${
                  isRecording
                    ? 'bg-red-500 hover:bg-red-600 animate-pulse shadow-red-500/30'
                    : isProcessing
                    ? 'bg-gray-700 cursor-not-allowed'
                    : 'bg-[#FFC000] hover:bg-[#E5AC00] shadow-[#FFC000]/20 hover:scale-105'
                }`}
              >
                {isProcessing ? (
                  <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : isRecording ? (
                  <MicOff className="w-10 h-10 text-white" />
                ) : (
                  <Mic className="w-10 h-10 text-black" />
                )}
              </button>

              <p className="mt-4 text-sm font-medium">
                {isProcessing ? (
                  <span className="text-[#FFC000]">Analyzing...</span>
                ) : isRecording ? (
                  <span className="text-red-400">Recording — tap to stop</span>
                ) : (
                  <span className="text-gray-400">Tap to start recording</span>
                )}
              </p>
            </div>

            {/* Message */}
            {message && (
              <div className={`rounded-xl p-4 border flex items-start gap-3 ${
                messageType === 'success'
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : messageType === 'error'
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-[#FFC000]/10 border-[#FFC000]/30 text-[#FFC000]'
              }`}>
                {messageType === 'success' ? (
                  <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                ) : messageType === 'error' ? (
                  <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                <span className="text-sm">{message}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceEnrollment;
