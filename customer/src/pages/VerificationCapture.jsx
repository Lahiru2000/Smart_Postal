import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Video, VideoOff, Upload, CheckCircle, XCircle, Clock,
  Camera, StopCircle, RotateCcw, Send, Package, User, AlertTriangle
} from 'lucide-react';
import { getVerificationLinkPublic, submitVerificationVideo } from '../services/api';

const VerificationCapture = () => {
  const { token } = useParams();

  // Link info
  const [linkInfo, setLinkInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Mode: 'choose' | 'record' | 'upload' | 'preview' | 'submitting' | 'done' | 'failed'
  const [mode, setMode] = useState('choose');

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedUrl, setRecordedUrl] = useState(null);
  const [recordDuration, setRecordDuration] = useState(0);

  // Upload state
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedUrl, setUploadedUrl] = useState(null);

  // Submission
  const [submitError, setSubmitError] = useState('');

  // Refs
  const videoRef = useRef(null);
  const previewRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── Fetch link info ────────────────────────────────────
  useEffect(() => {
    const fetchLink = async () => {
      try {
        const res = await getVerificationLinkPublic(token);
        setLinkInfo(res.data);
      } catch (err) {
        const status = err.response?.status;
        if (status === 410) {
          setError(err.response?.data?.detail || 'This link has already been used or expired.');
        } else if (status === 404) {
          setError('Invalid verification link.');
        } else {
          setError('Failed to load verification. Please try again later.');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchLink();

    return () => {
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [token]);

  // ── Camera ─────────────────────────────────────────────
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setMode('record');
    } catch {
      setSubmitError('Camera/microphone access denied. Please allow permissions and try again.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  // ── Recording ──────────────────────────────────────────
  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    setRecordDuration(0);

    const options = { mimeType: 'video/webm;codecs=vp8,opus' };
    // Fallback if webm not supported
    let recorder;
    try {
      recorder = new MediaRecorder(streamRef.current, options);
    } catch {
      recorder = new MediaRecorder(streamRef.current);
    }

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
      setRecordedBlob(blob);
      setRecordedUrl(URL.createObjectURL(blob));
      setMode('preview');
      stopCamera();
    };

    mediaRecorderRef.current = recorder;
    recorder.start(1000); // collect data every second
    setIsRecording(true);

    timerRef.current = setInterval(() => {
      setRecordDuration(prev => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  // ── File Upload ────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate type
    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'];
    if (!validTypes.includes(file.type)) {
      setSubmitError('Unsupported file type. Please upload an MP4, WebM, or MOV file.');
      return;
    }

    // Validate size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      setSubmitError('File too large. Maximum size is 100 MB.');
      return;
    }

    setSubmitError('');
    setUploadedFile(file);
    setUploadedUrl(URL.createObjectURL(file));
    setMode('preview');
  };

  // ── Submit ─────────────────────────────────────────────
  const handleSubmit = async () => {
    const file = recordedBlob || uploadedFile;
    if (!file) return;

    setMode('submitting');
    setSubmitError('');

    try {
      // If recordedBlob, wrap it as a File object
      const videoFile = recordedBlob
        ? new File([recordedBlob], 'verification.webm', { type: recordedBlob.type })
        : uploadedFile;

      await submitVerificationVideo(token, videoFile);
      setMode('done');
    } catch (err) {
      setSubmitError(err.response?.data?.detail || 'Failed to submit video. Please try again.');
      setMode('preview');
    }
  };

  // ── Reset ──────────────────────────────────────────────
  const handleRetake = () => {
    setRecordedBlob(null);
    setRecordedUrl(null);
    setUploadedFile(null);
    setUploadedUrl(null);
    setSubmitError('');
    setRecordDuration(0);
    setMode('choose');
  };

  // ── Helpers ────────────────────────────────────────────
  const formatTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  // ── Loading ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-400 text-lg animate-pulse">Loading verification...</div>
      </div>
    );
  }

  // ── Error (expired / used / invalid) ───────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center">
          <XCircle className="w-10 h-10 text-red-400" />
        </div>
        <h1 className="text-white text-xl font-bold text-center">Verification Unavailable</h1>
        <p className="text-gray-400 text-center max-w-sm">{error}</p>
        <p className="text-gray-600 text-sm mt-2">Please contact your courier for a new link.</p>
      </div>
    );
  }

  // ── Done ───────────────────────────────────────────────
  if (mode === 'done') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center">
          <CheckCircle className="w-12 h-12 text-green-400" />
        </div>
        <h1 className="text-white text-2xl font-bold">Video Submitted!</h1>
        <p className="text-gray-400 text-center max-w-sm">Your verification video has been sent to the courier. You can close this page now.</p>
        {linkInfo?.shipment_tracking && (
          <div className="flex items-center gap-2 text-gray-500 text-sm mt-2">
            <Package className="w-4 h-4" />
            Shipment: {linkInfo.shipment_tracking}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black font-sans selection:bg-[#FFC000] selection:text-black">
      <div className="max-w-lg mx-auto px-4 py-8">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#1A1A1A] rounded-2xl flex items-center justify-center border border-[#333333] mx-auto mb-4">
            <Video className="w-8 h-8 text-[#FFC000]" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Identity Verification</h1>
          <p className="text-gray-400 text-sm">Record a short video or upload one to verify your identity</p>
        </div>

        {/* Info Card */}
        <div className="bg-[#1A1A1A] rounded-2xl border border-[#333333] p-4 mb-6">
          <div className="flex items-center gap-4">
            {linkInfo?.courier_name && (
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-cyan-400" />
                <span className="text-gray-400">Courier:</span>
                <span className="text-white font-medium">{linkInfo.courier_name}</span>
              </div>
            )}
            {linkInfo?.shipment_tracking && (
              <div className="flex items-center gap-2 text-sm">
                <Package className="w-4 h-4 text-[#FFC000]" />
                <span className="text-gray-400">Shipment:</span>
                <span className="text-white font-medium">{linkInfo.shipment_tracking}</span>
              </div>
            )}
          </div>
          {linkInfo?.expires_at && (
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-3">
              <Clock className="w-3.5 h-3.5" />
              Expires: {new Date(linkInfo.expires_at).toLocaleString()}
            </div>
          )}
        </div>

        {/* Error banner */}
        {submitError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm">{submitError}</p>
          </div>
        )}

        {/* ── Choose Mode ─────────────────────────────────── */}
        {mode === 'choose' && (
          <div className="space-y-4">
            <button onClick={startCamera}
              className="w-full bg-[#1A1A1A] rounded-2xl border border-[#333333] hover:border-cyan-500/50 p-6 transition-colors group">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-cyan-500/10 rounded-xl flex items-center justify-center border border-cyan-500/20 group-hover:bg-cyan-500/20 transition-colors">
                  <Camera className="w-7 h-7 text-cyan-400" />
                </div>
                <div className="text-left">
                  <h3 className="text-white font-bold text-lg">Record Video</h3>
                  <p className="text-gray-500 text-sm">Open your camera and record a short clip with your voice</p>
                </div>
              </div>
            </button>

            <button onClick={() => fileInputRef.current?.click()}
              className="w-full bg-[#1A1A1A] rounded-2xl border border-[#333333] hover:border-[#FFC000]/50 p-6 transition-colors group">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-[#FFC000]/10 rounded-xl flex items-center justify-center border border-[#FFC000]/20 group-hover:bg-[#FFC000]/20 transition-colors">
                  <Upload className="w-7 h-7 text-[#FFC000]" />
                </div>
                <div className="text-left">
                  <h3 className="text-white font-bold text-lg">Upload Video</h3>
                  <p className="text-gray-500 text-sm">Choose an existing video file from your device</p>
                </div>
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        )}

        {/* ── Record Mode ─────────────────────────────────── */}
        {mode === 'record' && (
          <div className="space-y-4">
            <div className="relative rounded-2xl overflow-hidden border border-[#333333] bg-black aspect-video">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

              {/* Recording indicator */}
              {isRecording && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600/90 px-3 py-1.5 rounded-full">
                  <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                  <span className="text-white text-sm font-bold">{formatTime(recordDuration)}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-4">
              {!isRecording ? (
                <button onClick={startRecording}
                  className="px-8 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-500 transition-colors flex items-center gap-2 shadow-lg shadow-red-600/30">
                  <Camera className="w-5 h-5" />
                  Start Recording
                </button>
              ) : (
                <button onClick={stopRecording}
                  className="px-8 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors flex items-center gap-2">
                  <StopCircle className="w-5 h-5" />
                  Stop Recording
                </button>
              )}

              <button onClick={() => { stopCamera(); handleRetake(); }}
                className="px-5 py-3 bg-[#1A1A1A] text-gray-400 border border-[#333333] font-bold rounded-xl hover:bg-[#252525] transition-colors">
                Cancel
              </button>
            </div>

            <p className="text-gray-500 text-xs text-center">
              Record a short video showing your face and state your name clearly.
            </p>
          </div>
        )}

        {/* ── Preview Mode ────────────────────────────────── */}
        {mode === 'preview' && (
          <div className="space-y-4">
            <div className="rounded-2xl overflow-hidden border border-[#333333] bg-black aspect-video">
              <video
                ref={previewRef}
                src={recordedUrl || uploadedUrl}
                controls
                className="w-full h-full object-contain"
              />
            </div>

            {uploadedFile && (
              <div className="bg-[#1A1A1A] rounded-xl border border-[#333333] p-3 flex items-center gap-3">
                <Video className="w-5 h-5 text-[#FFC000]" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{uploadedFile.name}</p>
                  <p className="text-gray-500 text-xs">{(uploadedFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button onClick={handleRetake}
                className="flex-1 px-5 py-3 bg-[#1A1A1A] text-gray-400 border border-[#333333] font-bold rounded-xl hover:bg-[#252525] transition-colors flex items-center justify-center gap-2">
                <RotateCcw className="w-4 h-4" />
                Retake
              </button>
              <button onClick={handleSubmit}
                className="flex-1 px-5 py-3 bg-[#FFC000] text-black font-bold rounded-xl hover:bg-[#E5AC00] transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#FFC000]/20">
                <Send className="w-4 h-4" />
                Submit Video
              </button>
            </div>
          </div>
        )}

        {/* ── Submitting ──────────────────────────────────── */}
        {mode === 'submitting' && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 border-4 border-[#FFC000] border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 font-medium">Uploading your video...</p>
          </div>
        )}

      </div>
    </div>
  );
};

export default VerificationCapture;
