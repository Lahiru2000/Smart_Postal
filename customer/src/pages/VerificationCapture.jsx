import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Video, VideoOff, Upload, CheckCircle, XCircle, Clock,
  Camera, StopCircle, RotateCcw, Send, Package, User, AlertTriangle,
  ScanFace, Loader2, Mic, MicOff, Home, PackageX, CornerDownRight, Lock, Undo2
} from 'lucide-react';
import { getVerificationLinkPublic, submitVerificationVideo, submitVerificationScan, getVerificationResult, submitDeliveryPreference } from '../services/api';

const VerificationCapture = () => {
  const { token } = useParams();

  // Link info
  const [linkInfo, setLinkInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Mode: 'choose' | 'record' | 'upload' | 'preview' | 'submitting' | 'done' | 'failed' | 'scan'
  const [mode, setMode] = useState('choose');

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedUrl, setRecordedUrl] = useState(null);
  const [recordDuration, setRecordDuration] = useState(0);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState(null); // separate audio track
  const audioRecorderRef = useRef(null);       // separate audio MediaRecorder
  const audioChunksRef = useRef([]);            // separate audio chunks

  // Upload state
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedUrl, setUploadedUrl] = useState(null);

  // Scan state
  const [scanStatus, setScanStatus] = useState(''); // '' | 'scanning' | 'analyzing'
  const [scanResult, setScanResult] = useState(null);
  const [scanAudioBlob, setScanAudioBlob] = useState(null);
  const scanMediaRecorderRef = useRef(null);
  const scanAudioChunksRef = useRef([]);

  // Audio track state
  const [hasAudioTrack, setHasAudioTrack] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const audioAnimRef = useRef(null);

  // Submission
  const [submitError, setSubmitError] = useState('');

  // AI Verification result
  const [aiResult, setAiResult] = useState(null);
  const resultPollRef = useRef(null);

  // Delivery preference state (shown after successful verification)
  const [showDeliveryOptions, setShowDeliveryOptions] = useState(false);
  const [selectedPreference, setSelectedPreference] = useState(null);
  const [deliveryMessage, setDeliveryMessage] = useState('');
  const [preferenceSubmitting, setPreferenceSubmitting] = useState(false);
  const [preferenceSubmitted, setPreferenceSubmitted] = useState(false);

  // Refs
  const videoRef = useRef(null);
  const previewRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);
  const scanVideoRef = useRef(null);

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
      if (resultPollRef.current) clearInterval(resultPollRef.current);
    };
  }, [token]);

  // ── Camera ─────────────────────────────────────────────
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      // Validate audio tracks are present and enabled
      const audioTracks = stream.getAudioTracks();
      const audioOk = audioTracks.length > 0 && audioTracks[0].enabled;
      setHasAudioTrack(audioOk);

      if (audioOk) {
        // Start audio level monitoring for visual feedback
        // Use a CLONED audio track so the AudioContext doesn't interfere with MediaRecorder
        try {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const monitorTrack = audioTracks[0].clone();
          const monitorStream = new MediaStream([monitorTrack]);
          const source = audioCtx.createMediaStreamSource(monitorStream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.5;
          source.connect(analyser);
          // Do NOT connect to audioCtx.destination — no playback, just analysis
          audioContextRef.current = audioCtx;
          analyserRef.current = analyser;

          const updateLevel = () => {
            if (!analyserRef.current) return;
            const data = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(data);
            const avg = data.reduce((a, b) => a + b, 0) / data.length;
            setAudioLevel(Math.min(avg / 128, 1)); // normalize 0-1
            audioAnimRef.current = requestAnimationFrame(updateLevel);
          };
          updateLevel();
        } catch (e) {
          console.warn('Audio level monitoring not available:', e);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setMode('record');
    } catch {
      setSubmitError('Camera/microphone access denied. Please allow permissions and try again.');
    }
  };

  const stopCamera = () => {
    if (audioAnimRef.current) {
      cancelAnimationFrame(audioAnimRef.current);
      audioAnimRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
      analyserRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setHasAudioTrack(false);
    setAudioLevel(0);
  };

  // ── Recording ──────────────────────────────────────────
  const startRecording = () => {
    if (!streamRef.current) return;

    const audioTracks = streamRef.current.getAudioTracks();
    const videoTracks = streamRef.current.getVideoTracks();

    // Ensure audio tracks are enabled
    audioTracks.forEach(t => { t.enabled = true; });

    chunksRef.current = [];
    audioChunksRef.current = [];
    setRecordDuration(0);
    setRecordedAudioBlob(null);

    // ─── Video MediaRecorder (video + audio combined) ───────────────────
    const recordingStream = new MediaStream([...videoTracks, ...audioTracks]);

    const videoCodecs = [
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9,opus',
      'video/webm',
      'video/mp4',
    ];
    let selectedVideoMime = '';
    for (const mime of videoCodecs) {
      if (MediaRecorder.isTypeSupported(mime)) { selectedVideoMime = mime; break; }
    }

    let videoRecorder;
    try {
      videoRecorder = selectedVideoMime
        ? new MediaRecorder(recordingStream, { mimeType: selectedVideoMime, videoBitsPerSecond: 2500000 })
        : new MediaRecorder(recordingStream);
    } catch {
      videoRecorder = new MediaRecorder(recordingStream);
    }

    videoRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    videoRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: videoRecorder.mimeType || 'video/webm' });
      console.log('[Recording] Video blob size:', blob.size, 'type:', blob.type);
      setRecordedBlob(blob);
      setRecordedUrl(URL.createObjectURL(blob));
    };
    mediaRecorderRef.current = videoRecorder;

    // ─── SEPARATE Audio-only MediaRecorder (GUARANTEED audio capture) ───
    // This is the key fix: browsers sometimes silently drop audio from
    // combined video+audio MediaRecorder. Recording audio separately
    // ensures we always have a voice track.
    if (audioTracks.length > 0) {
      const audioOnlyStream = new MediaStream(audioTracks.map(t => t.clone()));
      const audioCodecs = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      let selectedAudioMime = '';
      for (const mime of audioCodecs) {
        if (MediaRecorder.isTypeSupported(mime)) { selectedAudioMime = mime; break; }
      }

      let audioRecorder;
      try {
        audioRecorder = selectedAudioMime
          ? new MediaRecorder(audioOnlyStream, { mimeType: selectedAudioMime, audioBitsPerSecond: 128000 })
          : new MediaRecorder(audioOnlyStream);
      } catch {
        audioRecorder = new MediaRecorder(audioOnlyStream);
      }
      console.log('[Recording] Separate audio recorder MIME:', audioRecorder.mimeType);

      audioRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      audioRecorder.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: audioRecorder.mimeType || 'audio/webm'
          });
          console.log('[Recording] Separate audio blob size:', audioBlob.size, 'type:', audioBlob.type);
          setRecordedAudioBlob(audioBlob);
        }
      };
      audioRecorderRef.current = audioRecorder;
      audioRecorder.start(500);
    }

    videoRecorder.start(1000);
    setIsRecording(true);

    timerRef.current = setInterval(() => {
      setRecordDuration(prev => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (!isRecording) return;
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Stop the separate audio recorder first
    if (audioRecorderRef.current && audioRecorderRef.current.state !== 'inactive') {
      audioRecorderRef.current.stop();
    }
    // Stop video recorder (its onstop sets the blob & triggers preview)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Transition to preview after a short delay so both onstop handlers fire
    setTimeout(() => {
      setMode('preview');
      stopCamera();
    }, 200);
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

      // Send separate audio track alongside video (if available)
      await submitVerificationVideo(token, videoFile, recordedAudioBlob);
      setMode('done');

      // Start polling for AI verification result
      resultPollRef.current = setInterval(async () => {
        try {
          const res = await getVerificationResult(token);
          const data = res.data;
          if (data.verdict || data.status === 'verified') {
            setAiResult(data);
            clearInterval(resultPollRef.current);
            resultPollRef.current = null;
          } else if (data.ai_error) {
            setAiResult(data);
            clearInterval(resultPollRef.current);
            resultPollRef.current = null;
          }
        } catch { /* ignore */ }
      }, 4000);
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
    setScanStatus('');
    setScanResult(null);
    setScanAudioBlob(null);
    setRecordedAudioBlob(null);
    setMode('choose');
  };

  // ── Live Camera Scan ───────────────────────────────────
  const startScan = async () => {
    try {
      // Request BOTH video AND audio — voice is recorded during face scan
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      setMode('scan');
      setScanStatus('scanning');
      setScanResult(null);
      setScanAudioBlob(null);
      setSubmitError('');

      // Start recording audio for voice verification
      scanAudioChunksRef.current = [];
      const audioTracks = stream.getAudioTracks();
      console.log('[Scan] Audio tracks:', audioTracks.length, audioTracks.map(t => `${t.label} enabled=${t.enabled}`));
      if (audioTracks.length > 0 && audioTracks[0].enabled) {
        try {
          // Use cloned tracks so the scan's video element doesn't interfere
          const clonedAudioTracks = audioTracks.map(t => t.clone());
          const audioStream = new MediaStream(clonedAudioTracks);
          // Try codecs in order: opus (webm), then aac (mp4/Safari), then bare fallback
          const audioCandidates = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4;codecs=aac',
            'audio/mp4',
          ];
          let selectedAudioMime = '';
          for (const mime of audioCandidates) {
            if (MediaRecorder.isTypeSupported(mime)) {
              selectedAudioMime = mime;
              break;
            }
          }
          console.log('[Scan] Selected audio MIME:', selectedAudioMime || '(browser default)');

          let audioRecorder;
          const audioRecOptions = {
            ...(selectedAudioMime ? { mimeType: selectedAudioMime } : {}),
            audioBitsPerSecond: 128000,
          };
          try {
            audioRecorder = new MediaRecorder(audioStream, audioRecOptions);
          } catch {
            audioRecorder = new MediaRecorder(audioStream);
          }
          console.log('[Scan] Audio MediaRecorder mimeType:', audioRecorder.mimeType);
          audioRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) scanAudioChunksRef.current.push(e.data);
          };
          scanMediaRecorderRef.current = audioRecorder;
          audioRecorder.start(500); // collect audio data every 500ms
        } catch (audioErr) {
          console.warn('Audio recording during scan failed, proceeding with face-only:', audioErr);
        }
      } else {
        console.warn('No audio track available during scan — voice verification will be skipped.');
      }

      // Wait for the video element to mount and attach stream
      setTimeout(() => {
        if (scanVideoRef.current) {
          scanVideoRef.current.srcObject = stream;
        }
      }, 100);

      // Capture 8 frames over ~3 seconds, then send for AI analysis
      const snapshots = [];
      const captureFrame = () => {
        const video = scanVideoRef.current;
        if (!video || video.videoWidth === 0) return null;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.9);
      };

      // Wait a bit for camera to stabilize
      await new Promise(resolve => setTimeout(resolve, 1500));

      for (let i = 0; i < 8; i++) {
        await new Promise(resolve => setTimeout(resolve, 400));
        const frame = captureFrame();
        if (frame) snapshots.push(frame);
      }

      // Wait extra time for voice recording (need at least 3-5 seconds of speech)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Stop audio recording
      let audioBlob = null;
      if (scanMediaRecorderRef.current && scanMediaRecorderRef.current.state !== 'inactive') {
        await new Promise((resolve) => {
          scanMediaRecorderRef.current.onstop = () => {
            if (scanAudioChunksRef.current.length > 0) {
              audioBlob = new Blob(scanAudioChunksRef.current, {
                type: scanMediaRecorderRef.current.mimeType || 'audio/webm'
              });
              setScanAudioBlob(audioBlob);
            }
            resolve();
          };
          scanMediaRecorderRef.current.stop();
        });
      }

      if (snapshots.length === 0) {
        setSubmitError('Could not capture frames from camera. Please try again.');
        stopCamera();
        setMode('choose');
        setScanStatus('');
        return;
      }

      // Send to AI (face frames + audio)
      setScanStatus('analyzing');
      try {
        const res = await submitVerificationScan(token, snapshots, audioBlob);
        setScanResult(res.data);
        setScanStatus('');
        stopCamera();
      } catch (err) {
        setSubmitError(err.response?.data?.detail || 'Face scan failed. Please try again.');
        setScanStatus('');
        stopCamera();
        setMode('choose');
      }
    } catch {
      setSubmitError('Camera/microphone access denied. Please allow permissions and try again.');
      setMode('choose');
    }
  };

  // ── Helpers ────────────────────────────────────────────
  const formatTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  // ── Delivery preference submission ──────────────────────
  const handleDeliveryPreference = async (preference) => {
    setSelectedPreference(preference);
    setPreferenceSubmitting(true);
    try {
      await submitDeliveryPreference(token, preference, deliveryMessage);
      setPreferenceSubmitted(true);
    } catch (err) {
      console.error('Failed to submit delivery preference:', err);
      alert(err.response?.data?.detail || 'Failed to save preference. Please try again.');
    } finally {
      setPreferenceSubmitting(false);
    }
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
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6 px-4">
        {/* Still waiting for AI */}
        {!aiResult ? (
          <>
            <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-green-400" />
            </div>
            <h1 className="text-white text-2xl font-bold">Video Submitted!</h1>
            <div className="w-full max-w-sm space-y-3">
              <div className="flex items-center justify-center gap-3 text-blue-400">
                <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                <span className="font-medium text-sm">AI is verifying your identity...</span>
              </div>
              <p className="text-gray-500 text-center text-xs">Comparing face and voice with your reference video. This may take a moment.</p>
            </div>
          </>
        ) : aiResult.ai_match ? (
          /* ═══ VERIFICATION SUCCESS ═══ */
          <>
            {!preferenceSubmitted ? (
              <div className="w-full max-w-md space-y-6">
                {/* Success header */}
                <div className="text-center">
                  <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-10 h-10 text-green-400" />
                  </div>
                  <h1 className="text-white text-2xl font-bold mb-1">Identity Verified!</h1>
                  <p className="text-gray-400 text-sm">Please choose how you'd like your package delivered</p>
                </div>

                {/* Score summary (compact) */}
                <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-green-400 text-sm font-semibold">{aiResult.verdict}</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      aiResult.confidence === 'HIGH' ? 'bg-green-500/20 text-green-400' :
                      aiResult.confidence === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>{aiResult.confidence}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    {aiResult.face_available && <span>Face: <span className="text-white font-bold">{(aiResult.face_score * 100).toFixed(1)}%</span></span>}
                    {aiResult.voice_available && <span>Voice: <span className="text-white font-bold">{(aiResult.voice_score * 100).toFixed(1)}%</span></span>}
                    <span>Overall: <span className="text-white font-bold">{(aiResult.combined_score * 100).toFixed(1)}%</span></span>
                  </div>
                </div>

                {/* Delivery Options */}
                <div className="space-y-3">
                  <h2 className="text-white font-bold text-lg">Delivery Options</h2>

                  <button
                    onClick={() => handleDeliveryPreference('deliver_to_neighbor')}
                    disabled={preferenceSubmitting}
                    className="w-full bg-[#1A1A1A] rounded-2xl border border-[#333333] hover:border-[#FFC000]/50 p-5 transition-all group disabled:opacity-50 text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#FFC000]/10 rounded-xl flex items-center justify-center border border-[#FFC000]/20 group-hover:bg-[#FFC000]/20 transition-colors flex-shrink-0">
                        <Home className="w-6 h-6 text-[#FFC000]" />
                      </div>
                      <div>
                        <h3 className="text-white font-bold">Deliver to Neighbor</h3>
                        <p className="text-gray-500 text-sm">Leave the package with a trusted neighbor</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleDeliveryPreference('place_in_locker')}
                    disabled={preferenceSubmitting}
                    className="w-full bg-[#1A1A1A] rounded-2xl border border-[#333333] hover:border-cyan-500/50 p-5 transition-all group disabled:opacity-50 text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center border border-cyan-500/20 group-hover:bg-cyan-500/20 transition-colors flex-shrink-0">
                        <Lock className="w-6 h-6 text-cyan-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-bold">Place in Locker</h3>
                        <p className="text-gray-500 text-sm">Place the package in a secure parcel locker</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleDeliveryPreference('return_order')}
                    disabled={preferenceSubmitting}
                    className="w-full bg-[#1A1A1A] rounded-2xl border border-[#333333] hover:border-orange-500/50 p-5 transition-all group disabled:opacity-50 text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center border border-orange-500/20 group-hover:bg-orange-500/20 transition-colors flex-shrink-0">
                        <Undo2 className="w-6 h-6 text-orange-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-bold">Return Order</h3>
                        <p className="text-gray-500 text-sm">Return the package to sender</p>
                      </div>
                    </div>
                  </button>
                </div>

                {preferenceSubmitting && (
                  <div className="flex items-center justify-center gap-2 text-[#FFC000]">
                    <div className="w-4 h-4 border-2 border-[#FFC000] border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm font-medium">Saving your preference...</span>
                  </div>
                )}
              </div>
            ) : (
              /* Preference submitted confirmation */
              <div className="w-full max-w-md text-center space-y-5">
                <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-10 h-10 text-green-400" />
                </div>
                <h1 className="text-white text-2xl font-bold">All Set!</h1>
                <div className="bg-[#1A1A1A] border border-[#333333] rounded-2xl p-5 space-y-3">
                  <p className="text-gray-400 text-sm">Your delivery preference has been saved:</p>
                  <div className="flex items-center justify-center gap-3">
                    {selectedPreference === 'deliver_to_neighbor' && <Home className="w-6 h-6 text-[#FFC000]" />}
                    {selectedPreference === 'place_in_locker' && <Lock className="w-6 h-6 text-cyan-400" />}
                    {selectedPreference === 'return_order' && <Undo2 className="w-6 h-6 text-orange-400" />}
                    <span className="text-white font-bold text-lg">
                      {selectedPreference === 'deliver_to_neighbor' && 'Deliver to Neighbor'}
                      {selectedPreference === 'place_in_locker' && 'Place in Locker'}
                      {selectedPreference === 'return_order' && 'Return Order'}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs">The courier has been notified of your choice.</p>
                </div>
                {linkInfo?.shipment_tracking && (
                  <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
                    <Package className="w-4 h-4" />
                    Shipment: {linkInfo.shipment_tracking}
                  </div>
                )}
              </div>
            )}
          </>
        ) : aiResult.verdict ? (
          /* ═══ VERIFICATION FAILED — ORDER REVERSED ═══ */
          <div className="w-full max-w-md text-center space-y-6">
            <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
              <PackageX className="w-12 h-12 text-red-400" />
            </div>
            <h1 className="text-white text-2xl font-bold">Order Reversed</h1>

            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-center gap-2 text-red-400">
                <XCircle className="w-5 h-5" />
                <span className="font-bold">{aiResult.verdict}</span>
              </div>

              <p className="text-gray-400 text-sm leading-relaxed">
                Identity verification did not match. For your security, this order has been 
                <span className="text-red-400 font-bold"> automatically reversed</span>. 
                No delivery will be attempted.
              </p>

              {/* Score Breakdown */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/30 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">Face</p>
                  {aiResult.face_available ? (
                    <>
                      <p className="text-white font-bold">{(aiResult.face_score * 100).toFixed(1)}%</p>
                      <div className="w-full bg-[#333333] rounded-full h-1.5 mt-1">
                        <div className={`h-1.5 rounded-full ${aiResult.face_score > 0.6 ? 'bg-green-500' : aiResult.face_score > 0.4 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${aiResult.face_score * 100}%` }} />
                      </div>
                    </>
                  ) : (
                    <p className="text-gray-600 text-xs">Not detected</p>
                  )}
                </div>
                <div className="bg-black/30 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">Voice</p>
                  {aiResult.voice_available ? (
                    <>
                      <p className="text-white font-bold">{(aiResult.voice_score * 100).toFixed(1)}%</p>
                      <div className="w-full bg-[#333333] rounded-full h-1.5 mt-1">
                        <div className={`h-1.5 rounded-full ${aiResult.voice_score > 0.6 ? 'bg-green-500' : aiResult.voice_score > 0.4 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${aiResult.voice_score * 100}%` }} />
                      </div>
                    </>
                  ) : (
                    <p className="text-gray-600 text-xs">Not detected</p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-4 text-left space-y-2">
              <p className="text-white font-semibold text-sm">What happens next?</p>
              <ul className="text-gray-400 text-sm space-y-1.5">
                <li className="flex items-start gap-2">
                  <CornerDownRight className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                  The courier has been notified and will not deliver this package
                </li>
                <li className="flex items-start gap-2">
                  <CornerDownRight className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                  The order is being returned to the sender
                </li>
                <li className="flex items-start gap-2">
                  <CornerDownRight className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                  If you believe this is an error, please contact support
                </li>
              </ul>
            </div>

            {linkInfo?.shipment_tracking && (
              <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
                <Package className="w-4 h-4" />
                Shipment: {linkInfo.shipment_tracking}
              </div>
            )}
          </div>
        ) : aiResult.ai_error ? (
          <div className="w-full max-w-sm text-center space-y-4">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-10 h-10 text-red-400" />
            </div>
            <h1 className="text-white text-xl font-bold">Verification Error</h1>
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <p className="text-red-400 text-sm">Verification encountered an error. The courier has been notified.</p>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            <p className="text-gray-400 text-center max-w-sm">Your verification video has been sent to the courier.</p>
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
            {/* Live Camera Scan */}
            <button onClick={startScan}
              className="w-full bg-[#1A1A1A] rounded-2xl border border-[#333333] hover:border-green-500/50 p-6 transition-colors group">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-green-500/10 rounded-xl flex items-center justify-center border border-green-500/20 group-hover:bg-green-500/20 transition-colors">
                  <ScanFace className="w-7 h-7 text-green-400" />
                </div>
                <div className="text-left">
                  <h3 className="text-white font-bold text-lg">Live Face & Voice Scan</h3>
                  <p className="text-gray-500 text-sm">Open your camera and speak for instant AI face + voice verification</p>
                </div>
              </div>
            </button>

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

              {/* Recording indicator with audio status */}
              {isRecording && (
                <div className="absolute top-4 left-4 flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-red-600/90 px-3 py-1.5 rounded-full">
                    <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                    <span className="text-white text-sm font-bold">{formatTime(recordDuration)}</span>
                  </div>
                  {/* Audio level indicator */}
                  <div className="flex items-center gap-1.5 bg-black/70 px-3 py-1.5 rounded-full">
                    <Mic className="w-4 h-4 text-green-400" />
                    <div className="flex items-end gap-0.5 h-4">
                      {[0.15, 0.3, 0.45, 0.6, 0.8].map((threshold, i) => (
                        <div
                          key={i}
                          className={`w-1 rounded-full transition-all duration-100 ${
                            audioLevel > threshold ? 'bg-green-400' : 'bg-gray-600'
                          }`}
                          style={{ height: `${(i + 1) * 20}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* No-audio warning overlay */}
              {!hasAudioTrack && !isRecording && (
                <div className="absolute bottom-4 left-4 right-4 flex items-center gap-2 bg-yellow-600/90 px-3 py-2 rounded-lg">
                  <MicOff className="w-4 h-4 text-white flex-shrink-0" />
                  <span className="text-white text-xs font-medium">Microphone not detected — voice will NOT be recorded. Please allow mic permissions.</span>
                </div>
              )}

              {/* Audio ready indicator before recording starts */}
              {hasAudioTrack && !isRecording && (
                <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-green-600/80 px-3 py-1.5 rounded-full">
                  <Mic className="w-4 h-4 text-white" />
                  <span className="text-white text-xs font-medium">Microphone ready</span>
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
              🎤 Speak clearly — say your <strong>full name</strong>. Both your face and voice are recorded for verification.
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

        {/* ── Scan Mode ───────────────────────────────────── */}
        {mode === 'scan' && (
          <div className="space-y-4">
            {/* Camera + scanning overlay */}
            {!scanResult && (
              <>
                <div className="relative rounded-2xl overflow-hidden border border-[#333333] bg-black aspect-video">
                  <video ref={scanVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

                  {/* Scanning overlay animation */}
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Corner brackets */}
                    <div className="absolute top-6 left-6 w-12 h-12 border-t-2 border-l-2 border-green-400 rounded-tl-lg" />
                    <div className="absolute top-6 right-6 w-12 h-12 border-t-2 border-r-2 border-green-400 rounded-tr-lg" />
                    <div className="absolute bottom-6 left-6 w-12 h-12 border-b-2 border-l-2 border-green-400 rounded-bl-lg" />
                    <div className="absolute bottom-6 right-6 w-12 h-12 border-b-2 border-r-2 border-green-400 rounded-br-lg" />

                    {/* Scanning line animation */}
                    {scanStatus === 'scanning' && (
                      <div className="absolute left-8 right-8 h-0.5 bg-gradient-to-r from-transparent via-green-400 to-transparent animate-[scan_2s_ease-in-out_infinite]" 
                           style={{ animation: 'scan 2s ease-in-out infinite' }} />
                    )}
                  </div>

                  {/* Audio recording indicator */}
                  {scanStatus === 'scanning' && (
                    <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/70 px-3 py-1.5 rounded-full">
                      <Mic className="w-4 h-4 text-green-400 animate-pulse" />
                      <span className="text-green-400 text-xs font-medium">Recording voice</span>
                    </div>
                  )}

                  {/* Status badge */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                    <div className={`px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium ${
                      scanStatus === 'scanning'
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    }`}>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {scanStatus === 'scanning' ? 'Scanning face & recording voice...' : 'Analyzing with AI...'}
                    </div>
                  </div>
                </div>

                <button onClick={() => { stopCamera(); handleRetake(); }}
                  className="w-full px-5 py-3 bg-[#1A1A1A] text-gray-400 border border-[#333333] font-bold rounded-xl hover:bg-[#252525] transition-colors">
                  Cancel
                </button>
              </>
            )}

            {/* Scan Result */}
            {scanResult && (
              <div className="space-y-4">
                {scanResult.success && scanResult.ai_match ? (
                  /* ═══ SCAN SUCCESS — Delivery Options ═══ */
                  !preferenceSubmitted ? (
                    <div className="space-y-4">
                      {/* Compact success banner */}
                      <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-400" />
                            <span className="text-green-400 font-bold">{scanResult.verdict}</span>
                          </div>
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                            scanResult.confidence === 'HIGH' ? 'bg-green-500/20 text-green-400' :
                            scanResult.confidence === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>{scanResult.confidence}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>Face: <span className="text-white font-bold">{scanResult.face_score}%</span></span>
                          {scanResult.voice_available && <span>Voice: <span className="text-white font-bold">{scanResult.voice_score}%</span></span>}
                        </div>
                      </div>

                      <h2 className="text-white font-bold text-lg">Choose Delivery Option</h2>

                      <button onClick={() => handleDeliveryPreference('deliver_to_neighbor')} disabled={preferenceSubmitting}
                        className="w-full bg-[#1A1A1A] rounded-2xl border border-[#333333] hover:border-[#FFC000]/50 p-4 transition-all group disabled:opacity-50 text-left">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#FFC000]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Home className="w-5 h-5 text-[#FFC000]" />
                          </div>
                          <div>
                            <h3 className="text-white font-bold text-sm">Deliver to Neighbor</h3>
                            <p className="text-gray-500 text-xs">Leave with a trusted neighbor</p>
                          </div>
                        </div>
                      </button>

                      <button onClick={() => handleDeliveryPreference('place_in_locker')} disabled={preferenceSubmitting}
                        className="w-full bg-[#1A1A1A] rounded-2xl border border-[#333333] hover:border-cyan-500/50 p-4 transition-all group disabled:opacity-50 text-left">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Lock className="w-5 h-5 text-cyan-400" />
                          </div>
                          <div>
                            <h3 className="text-white font-bold text-sm">Place in Locker</h3>
                            <p className="text-gray-500 text-xs">Place in a secure parcel locker</p>
                          </div>
                        </div>
                      </button>

                      <button onClick={() => handleDeliveryPreference('return_order')} disabled={preferenceSubmitting}
                        className="w-full bg-[#1A1A1A] rounded-2xl border border-[#333333] hover:border-orange-500/50 p-4 transition-all group disabled:opacity-50 text-left">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Undo2 className="w-5 h-5 text-orange-400" />
                          </div>
                          <div>
                            <h3 className="text-white font-bold text-sm">Return Order</h3>
                            <p className="text-gray-500 text-xs">Return the package to sender</p>
                          </div>
                        </div>
                      </button>

                      {preferenceSubmitting && (
                        <div className="flex items-center justify-center gap-2 text-[#FFC000]">
                          <div className="w-4 h-4 border-2 border-[#FFC000] border-t-transparent rounded-full animate-spin" />
                          <span className="text-sm font-medium">Saving...</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Preference saved */
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle className="w-8 h-8 text-green-400" />
                      </div>
                      <h2 className="text-white text-xl font-bold">Preference Saved!</h2>
                      <div className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-4">
                        <div className="flex items-center justify-center gap-2">
                          {selectedPreference === 'deliver_to_neighbor' && <Home className="w-5 h-5 text-[#FFC000]" />}
                          {selectedPreference === 'place_in_locker' && <Lock className="w-5 h-5 text-cyan-400" />}
                          {selectedPreference === 'return_order' && <Undo2 className="w-5 h-5 text-orange-400" />}
                          <span className="text-white font-bold">
                            {selectedPreference === 'deliver_to_neighbor' && 'Deliver to Neighbor'}
                            {selectedPreference === 'place_in_locker' && 'Place in Locker'}
                            {selectedPreference === 'return_order' && 'Return Order'}
                          </span>
                        </div>
                        <p className="text-gray-500 text-xs mt-2">The courier has been notified.</p>
                      </div>
                    </div>
                  )
                ) : scanResult.success && !scanResult.ai_match ? (
                  /* ═══ SCAN FAILED — Order Reversed ═══ */
                  <div className="space-y-4">
                    <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 text-center space-y-3">
                      <PackageX className="w-10 h-10 text-red-400 mx-auto" />
                      <h2 className="text-white text-xl font-bold">Order Reversed</h2>
                      <p className="text-gray-400 text-sm">
                        Identity verification did not match. This order has been 
                        <span className="text-red-400 font-bold"> automatically reversed</span>.
                      </p>
                      <div className="flex items-center justify-center gap-3 text-xs text-gray-500 pt-2">
                        <span>Face: <span className="text-white font-bold">{scanResult.face_score}%</span></span>
                        {scanResult.voice_available && <span>Voice: <span className="text-white font-bold">{scanResult.voice_score}%</span></span>}
                      </div>
                    </div>
                    <div className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-4 text-left space-y-1.5">
                      <p className="text-white font-semibold text-sm">What happens next?</p>
                      <ul className="text-gray-400 text-sm space-y-1">
                        <li className="flex items-start gap-2"><CornerDownRight className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />The courier will not deliver this package</li>
                        <li className="flex items-start gap-2"><CornerDownRight className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />The order is being returned to sender</li>
                        <li className="flex items-start gap-2"><CornerDownRight className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />Contact support if you believe this is an error</li>
                      </ul>
                    </div>
                  </div>
                ) : scanResult.success === false ? (
                  <div className="rounded-2xl border p-5 bg-yellow-500/10 border-yellow-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-6 h-6 text-yellow-400" />
                      <span className="text-yellow-400 font-bold">Scan Failed</span>
                    </div>
                    <p className="text-gray-400 text-sm">{scanResult.error}</p>
                  </div>
                ) : null}

                {/* Show Try Again for failures only, not for successful verifications */}
                {(scanResult.success === false || (scanResult.success && !scanResult.ai_match)) && !preferenceSubmitted && (
                  <button onClick={handleRetake}
                    className="w-full px-5 py-3 bg-[#1A1A1A] text-gray-400 border border-[#333333] font-bold rounded-xl hover:bg-[#252525] transition-colors flex items-center justify-center gap-2">
                    <RotateCcw className="w-4 h-4" />
                    Try Again
                  </button>
                )}
              </div>
            )}

            {/* CSS animation for scanning line */}
            <style>{`
              @keyframes scan {
                0%, 100% { top: 10%; }
                50% { top: 85%; }
              }
            `}</style>
          </div>
        )}

      </div>
    </div>
  );
};

export default VerificationCapture;
