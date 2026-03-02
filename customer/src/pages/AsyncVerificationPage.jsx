import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle, XCircle, AlertTriangle, Loader2,
  Shield, Clock, Camera, RefreshCw,
} from 'lucide-react';
import { getAsyncVerification, submitAsyncVerification } from '../services/api';

/* â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const PRE_RECORD_COUNTDOWN = 3;    // seconds before recording starts
const RECORD_DURATION      = 7;    // seconds of recording
const FRAME_INTERVAL_MS    = 1500; // capture a frame every N ms

/* â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function captureFrameFromVideo(videoEl) {
  if (!videoEl || videoEl.readyState < 2) return null;
  const canvas = document.createElement('canvas');
  canvas.width  = videoEl.videoWidth  || 640;
  canvas.height = videoEl.videoHeight || 480;
  canvas.getContext('2d').drawImage(videoEl, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

const AsyncVerificationPage = () => {
  const { token } = useParams();
  const navigate  = useNavigate();

  /* â”€â”€ Data â”€â”€ */
  const [verificationData, setVerificationData] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  /* â”€â”€ Pipeline phase â”€â”€
     'idle' | 'starting-camera' | 'countdown' | 'recording' | 'submitting' | 'done'
  */
  const [phase, setPhase] = useState('idle');

  const [countdown,      setCountdown]      = useState(0);
  const [recSeconds,     setRecSeconds]     = useState(0);
  const [capturedFrames, setCapturedFrames] = useState([]);
  const [previewFrame,   setPreviewFrame]   = useState(null);
  const [submitResult,   setSubmitResult]   = useState(null);

  /* â”€â”€ Refs â”€â”€ */
  const videoRef          = useRef(null);
  const streamRef         = useRef(null);
  const countdownTimerRef = useRef(null);
  const recTimerRef       = useRef(null);
  const frameTimerRef     = useRef(null);
  const framesAccRef      = useRef([]);

  /* â”€â”€ Cleanup â”€â”€ */
  useEffect(() => {
    return () => { stopCamera(); clearTimers(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* â”€â”€ Fetch + auto-start â”€â”€ */
  useEffect(() => {
    fetchVerification();
  }, [token]);

  const fetchVerification = async () => {
    try {
      const res = await getAsyncVerification(token);
      setVerificationData(res.data);
      if (res.data.status === 'pending') {
        setTimeout(() => startCamera(), 600);
      } else {
        setPhase('done');
        setSubmitResult(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Verification link not found or expired.');
    } finally {
      setLoading(false);
    }
  };

  /* â”€â”€ Camera â”€â”€ */
  const startCamera = useCallback(async () => {
    setPhase('starting-camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          beginCountdown();
        };
      } else {
        beginCountdown();
      }
    } catch {
      setError('Camera access is required for verification. Please allow camera access and refresh the page.');
      setPhase('idle');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const clearTimers = () => {
    clearInterval(countdownTimerRef.current);
    clearInterval(recTimerRef.current);
    clearInterval(frameTimerRef.current);
  };

  /* â”€â”€ Pre-record countdown â”€â”€ */
  const beginCountdown = useCallback(() => {
    setPhase('countdown');
    setCountdown(PRE_RECORD_COUNTDOWN);
    let c = PRE_RECORD_COUNTDOWN;
    countdownTimerRef.current = setInterval(() => {
      c -= 1;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(countdownTimerRef.current);
        startRecording();
      }
    }, 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* â”€â”€ Recording â”€â”€ */
  const startRecording = useCallback(() => {
    setPhase('recording');
    framesAccRef.current = [];
    setCapturedFrames([]);
    setRecSeconds(0);

    let elapsed = 0;
    recTimerRef.current = setInterval(() => {
      elapsed += 1;
      setRecSeconds(elapsed);
      if (elapsed >= RECORD_DURATION) {
        clearInterval(recTimerRef.current);
        clearInterval(frameTimerRef.current);
        finishRecording();
      }
    }, 1000);

    frameTimerRef.current = setInterval(() => {
      const frame = captureFrameFromVideo(videoRef.current);
      if (frame) {
        framesAccRef.current.push(frame);
        setPreviewFrame(frame);
        setCapturedFrames(prev => [...prev, frame]);
      }
    }, FRAME_INTERVAL_MS);

    // First frame immediately
    setTimeout(() => {
      const frame = captureFrameFromVideo(videoRef.current);
      if (frame) {
        framesAccRef.current.unshift(frame);
        setPreviewFrame(frame);
        setCapturedFrames([frame]);
      }
    }, 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* â”€â”€ Finish + submit â”€â”€ */
  const finishRecording = useCallback(() => {
    stopCamera();
    setPhase('submitting');
    const frames = [...framesAccRef.current];
    if (frames.length === 0) {
      setError('No frames were captured. Please try again.');
      setPhase('idle');
      return;
    }
    submitFrames(frames);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopCamera]);

  const submitFrames = async (frames) => {
    try {
      const videoData = frames.join('||');
      const res = await submitAsyncVerification(token, { video_data: videoData });
      setSubmitResult(res.data);
      setVerificationData(res.data);
      setPhase('done');
    } catch (err) {
      setError(err.response?.data?.detail || 'Submission failed. Please try again.');
      setPhase('idle');
    }
  };

  const handleRetry = () => {
    setError('');
    setCapturedFrames([]);
    framesAccRef.current = [];
    setPreviewFrame(null);
    setRecSeconds(0);
    setCountdown(0);
    setPhase('idle');
    startCamera();
  };

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
     Render
     â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#FFC000] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && phase === 'idle' && !verificationData) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertTriangle size={48} className="text-red-400 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-3">Verification Unavailable</h2>
          <p className="text-gray-400 mb-8">{error}</p>
          <button onClick={() => navigate('/dashboard')} className="px-8 py-3 bg-[#FFC000] text-black font-bold rounded-xl hover:bg-[#e6ad00]">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  /* â”€â”€ Result screen â”€â”€ */
  if (phase === 'done' && submitResult) {
    const statusConfig = {
      verified:     { icon: <CheckCircle size={64} />,  color: 'text-green-400',  title: 'Verification Successful',   desc: 'Your identity has been verified. You can now choose a delivery option from your dashboard.' },
      rejected:     { icon: <XCircle size={64} />,       color: 'text-red-400',    title: 'Verification Failed',        desc: 'Unfortunately, the AI could not verify your identity. Please contact support.' },
      submitted:    { icon: <Clock size={64} />,          color: 'text-[#FFC000]',  title: 'Verification Submitted',     desc: 'Your verification has been submitted and is being reviewed.' },
      inconclusive: { icon: <AlertTriangle size={64} />, color: 'text-orange-400', title: 'Verification Inconclusive',   desc: 'The AI result was inconclusive. The courier will review your submission manually.' },
    };
    const cfg = statusConfig[submitResult.status] || statusConfig.submitted;

    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="text-center max-w-lg bg-[#1A1A1A] rounded-3xl border border-[#333] p-10">
          <div className={`${cfg.color} mb-6 flex justify-center`}>{cfg.icon}</div>
          <h2 className="text-2xl font-bold mb-3">{cfg.title}</h2>
          <p className="text-gray-400 mb-4">{cfg.desc}</p>

          {submitResult.ai_confidence != null && (
            <div className="inline-flex items-center gap-2 bg-black rounded-xl px-4 py-2 border border-[#333] mb-6">
              <Shield size={14} className="text-[#FFC000]" />
              <span className="text-sm text-gray-300">
                AI Confidence: <span className="text-[#FFC000] font-bold">{submitResult.ai_confidence}%</span>
              </span>
            </div>
          )}

          {capturedFrames.length > 0 && (
            <div className="mt-2 mb-6">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{capturedFrames.length} frames captured</p>
              <div className="flex gap-2 justify-center flex-wrap">
                {capturedFrames.slice(0, 5).map((f, i) => (
                  <img key={i} src={f} alt={`Frame ${i + 1}`} className="w-14 h-14 rounded-lg object-cover border border-[#333] opacity-70" style={{ transform: 'scaleX(-1)' }} />
                ))}
              </div>
            </div>
          )}

          <button onClick={() => navigate('/dashboard')} className="px-8 py-3 bg-[#FFC000] text-black font-bold rounded-xl hover:bg-[#e6ad00]">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  /* â”€â”€ Active recording screen â”€â”€ */
  const progressPct = Math.min(100, (recSeconds / RECORD_DURATION) * 100);

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <div className="max-w-xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate('/dashboard')} className="p-2.5 bg-[#1A1A1A] rounded-xl border border-[#333] hover:bg-[#252525] transition-colors text-gray-400 text-lg leading-none">
            â†
          </button>
          <div>
            <h1 className="text-2xl font-bold">Identity Verification</h1>
            <p className="text-gray-400 text-sm">Shipment #{verificationData?.shipment_id}</p>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Instructions */}
        <div className="bg-[#1A1A1A] rounded-2xl border border-[#333] p-5 mb-5">
          <div className="flex items-start gap-3">
            <Shield size={22} className="text-[#FFC000] mt-0.5 shrink-0" />
            <div>
              <p className="font-bold mb-1">Automatic Identity Recording</p>
              <p className="text-gray-400 text-sm">
                Your camera starts automatically. After a short countdown, a {RECORD_DURATION}-second
                face video is recorded and sent to the AI for identity verification. No action needed.
              </p>
            </div>
          </div>
        </div>

        {/* Camera viewport */}
        <div className="bg-[#1A1A1A] rounded-2xl border border-[#333] overflow-hidden mb-5">
          <div className="aspect-video relative bg-black">

            {/* Live feed */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transition-opacity duration-500 ${
                phase === 'idle' || phase === 'starting-camera' ? 'opacity-0' : 'opacity-100'
              }`}
              style={{ transform: 'scaleX(-1)' }}
            />

            {/* Still frame while submitting */}
            {previewFrame && phase === 'submitting' && (
              <img src={previewFrame} alt="Last frame" className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
            )}

            {/* Idle / starting overlay */}
            {(phase === 'idle' || phase === 'starting-camera') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                {phase === 'starting-camera' ? (
                  <>
                    <div className="w-10 h-10 border-4 border-[#FFC000] border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-400 text-sm">Starting cameraâ€¦</p>
                  </>
                ) : (
                  <>
                    <Camera size={44} className="text-gray-600" />
                    <p className="text-gray-500">Camera not active</p>
                    <button onClick={startCamera} className="mt-2 px-5 py-2.5 bg-[#FFC000] text-black font-bold rounded-xl text-sm hover:bg-[#e6ad00]">
                      Start Camera Manually
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Countdown overlay */}
            {phase === 'countdown' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
                <p className="text-gray-300 text-lg mb-2 font-medium">Recording starts in</p>
                <p className="text-[#FFC000] text-8xl font-black tabular-nums">{countdown}</p>
                <p className="text-gray-400 text-sm mt-4">Centre your face in the frame</p>
              </div>
            )}

            {/* Recording badge */}
            {phase === 'recording' && (
              <>
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-500/90 backdrop-blur px-3 py-1.5 rounded-full animate-pulse z-10">
                  <div className="w-2.5 h-2.5 bg-white rounded-full" />
                  <span className="text-white text-sm font-bold">REC  {recSeconds}s / {RECORD_DURATION}s</span>
                </div>
                <div className="absolute top-4 right-4 bg-black/70 backdrop-blur px-3 py-1.5 rounded-full z-10">
                  <span className="text-[#FFC000] text-xs font-bold">{capturedFrames.length} frames</span>
                </div>
              </>
            )}

            {/* Submitting overlay */}
            {phase === 'submitting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
                <Loader2 size={44} className="text-[#FFC000] animate-spin mb-3" />
                <p className="text-white font-bold">Analysing with AIâ€¦</p>
                <p className="text-gray-400 text-sm mt-1">{capturedFrames.length} frames sent</p>
              </div>
            )}
          </div>

          {/* Recording progress bar */}
          {phase === 'recording' && (
            <div className="h-1.5 bg-[#252525]">
              <div
                className="h-full bg-red-500 transition-all duration-1000 ease-linear"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}
        </div>

        {/* Step indicators */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Camera',    done: ['countdown','recording','submitting','done'].includes(phase) },
            { label: 'Recording', done: ['submitting','done'].includes(phase) },
            { label: 'AI Check',  done: phase === 'done' },
          ].map((step, i) => (
            <div key={i} className={`bg-[#1A1A1A] rounded-xl border p-3 text-center ${step.done ? 'border-green-500/30' : 'border-[#333]'}`}>
              <div className={`mx-auto mb-1.5 w-7 h-7 rounded-full flex items-center justify-center ${step.done ? 'bg-green-500/20' : 'bg-[#252525]'}`}>
                {step.done
                  ? <CheckCircle size={16} className="text-green-400" />
                  : <span className="text-gray-500 text-xs font-bold">{i + 1}</span>}
              </div>
              <p className="text-xs font-bold text-gray-300">{step.label}</p>
            </div>
          ))}
        </div>

        {/* Retry (idle after error) */}
        {phase === 'idle' && (
          <button
            onClick={handleRetry}
            className="w-full py-3.5 bg-[#FFC000] text-black font-bold rounded-xl hover:bg-[#e6ad00] flex items-center justify-center gap-2"
          >
            <RefreshCw size={18} />
            Retry Verification
          </button>
        )}
      </div>
    </div>
  );
};

export default AsyncVerificationPage;
