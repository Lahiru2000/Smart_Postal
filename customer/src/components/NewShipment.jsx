import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Package, MapPin, User, Upload, ArrowRight, ArrowLeft, CheckCircle,
  Camera, X, Shield, Video, Image, StopCircle, RotateCcw, Play, Pause,
  Mic, MicOff
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createShipment, uploadShipmentMedia } from '../services/api';

const NewShipment = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    senderName: '', senderPhone: '', senderAddress: '',
    receiverName: '', receiverPhone: '', receiverAddress: '',
    packageWeight: '', packageType: 'Standard', description: '',
    receiverImage: null,
    receiverImageFile: null,  // actual File for image upload
    receiverVideo: null,      // blob URL for video
    receiverVideoFile: null,  // actual File/Blob for upload
    mediaType: null,           // 'image' | 'video'
    voiceVerification: false,
  });

  // Media mode: null | 'image' | 'uploadVideo' | 'recordVideo'
  const [mediaMode, setMediaMode] = useState(null);

  // Camera recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [hasAudioTrack, setHasAudioTrack] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState(null);  // separate audio

  const cameraVideoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const audioAnimRef = useRef(null);
  const audioRecorderRef = useRef(null);      // separate audio MediaRecorder
  const audioChunksRef = useRef([]);           // separate audio chunks

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, receiverImage: URL.createObjectURL(file), receiverImageFile: file, receiverVideo: null, receiverVideoFile: null, mediaType: 'image' });
      setMediaMode(null);
    }
  };

  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, receiverVideo: URL.createObjectURL(file), receiverVideoFile: file, receiverImage: null, mediaType: 'video' });
      setMediaMode(null);
    }
  };

  const removeMedia = () => {
    stopCamera();
    setFormData({ ...formData, receiverImage: null, receiverImageFile: null, receiverVideo: null, receiverVideoFile: null, mediaType: null });
    setRecordedAudioBlob(null);
    setMediaMode(null);
    setIsRecording(false);
    setRecordDuration(0);
    setCameraReady(false);
  };

  // ── Camera helpers ──────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      // Validate audio tracks
      const audioTracks = stream.getAudioTracks();
      const audioOk = audioTracks.length > 0 && audioTracks[0].enabled;
      setHasAudioTrack(audioOk);

      if (audioOk) {
        // Use a CLONED audio track for monitoring so AudioContext doesn't interfere with MediaRecorder
        try {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const monitorTrack = audioTracks[0].clone();
          const monitorStream = new MediaStream([monitorTrack]);
          const source = audioCtx.createMediaStreamSource(monitorStream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.5;
          source.connect(analyser);
          // Do NOT connect to audioCtx.destination
          audioContextRef.current = audioCtx;
          analyserRef.current = analyser;

          const updateLevel = () => {
            if (!analyserRef.current) return;
            const data = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(data);
            const avg = data.reduce((a, b) => a + b, 0) / data.length;
            setAudioLevel(Math.min(avg / 128, 1));
            audioAnimRef.current = requestAnimationFrame(updateLevel);
          };
          updateLevel();
        } catch (e) {
          console.warn('Audio level monitoring not available:', e);
        }
      }

      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
      }
      setCameraReady(true);
    } catch (err) {
      alert('Could not access camera/microphone. Please allow permissions.');
      setMediaMode(null);
    }
  }, []);

  const stopCamera = useCallback(() => {
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
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCameraReady(false);
    setHasAudioTrack(false);
    setAudioLevel(0);
  }, []);

  const startRecording = () => {
    chunksRef.current = [];
    audioChunksRef.current = [];
    setRecordedAudioBlob(null);
    const stream = streamRef.current;
    if (!stream) return;

    const audioTracks = stream.getAudioTracks();
    const videoTracks = stream.getVideoTracks();
    audioTracks.forEach(t => { t.enabled = true; });

    // ─── Video MediaRecorder ───────────────────────────────────────
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

    let recorder;
    try {
      recorder = selectedVideoMime
        ? new MediaRecorder(recordingStream, { mimeType: selectedVideoMime, videoBitsPerSecond: 2500000 })
        : new MediaRecorder(recordingStream);
    } catch {
      recorder = new MediaRecorder(recordingStream);
    }
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
      const url = URL.createObjectURL(blob);
      console.log('[NewShipment] Video blob:', blob.size, blob.type);
      setFormData(prev => ({ ...prev, receiverVideo: url, receiverVideoFile: blob, receiverImage: null, mediaType: 'video' }));
    };

    // ─── SEPARATE Audio-only MediaRecorder (GUARANTEED audio capture) ───
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
      console.log('[NewShipment] Separate audio recorder MIME:', audioRecorder.mimeType);

      audioRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      audioRecorder.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: audioRecorder.mimeType || 'audio/webm' });
          console.log('[NewShipment] Separate audio blob:', audioBlob.size, audioBlob.type);
          setRecordedAudioBlob(audioBlob);
        }
      };
      audioRecorderRef.current = audioRecorder;
      audioRecorder.start(500);
    }

    recorder.start(300);
    setIsRecording(true);
    setRecordDuration(0);
    timerRef.current = setInterval(() => setRecordDuration(d => d + 1), 1000);
  };

  const stopRecording = () => {
    // Stop separate audio recorder first
    if (audioRecorderRef.current && audioRecorderRef.current.state !== 'inactive') {
      audioRecorderRef.current.stop();
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    // Allow onstop handlers 300ms to finish before cleaning up UI
    setTimeout(() => {
      stopCamera();
      setMediaMode(null);
      setIsRecording(false);
      setRecordDuration(0);
    }, 300);
  };

  // Start camera when recordVideo mode selected
  useEffect(() => {
    if (mediaMode === 'recordVideo') {
      startCamera();
    }
    return () => {
      if (mediaMode === 'recordVideo') stopCamera();
    };
  }, [mediaMode, startCamera, stopCamera]);

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      let imageUrl = null;
      let videoUrl = null;
      let audioUrl = null;
      let mediaTypeVal = null;

      // Upload image file if present
      if (formData.mediaType === 'image' && formData.receiverImageFile) {
        const uploadRes = await uploadShipmentMedia(formData.receiverImageFile, 'image');
        imageUrl = uploadRes.data.url;
        mediaTypeVal = 'image';
      }

      // Upload video file if present (with separate audio if available)
      if (formData.mediaType === 'video' && formData.receiverVideoFile) {
        const file = formData.receiverVideoFile instanceof Blob && !(formData.receiverVideoFile instanceof File)
          ? new File([formData.receiverVideoFile], 'recorded_video.webm', { type: formData.receiverVideoFile.type || 'video/webm' })
          : formData.receiverVideoFile;

        // Prepare separate audio file if captured
        let audioFile = null;
        if (recordedAudioBlob) {
          audioFile = new File([recordedAudioBlob], 'recorded_audio.webm', { type: recordedAudioBlob.type || 'audio/webm' });
          console.log('[NewShipment] Sending separate audio file:', audioFile.size, audioFile.type);
        }

        const uploadRes = await uploadShipmentMedia(file, 'video', audioFile);
        videoUrl = uploadRes.data.url;
        audioUrl = uploadRes.data.audio_url || null;
        mediaTypeVal = 'video';
      }

      const payload = {
        sender_name: formData.senderName,
        sender_phone: formData.senderPhone,
        pickup_address: formData.senderAddress,
        receiver_name: formData.receiverName,
        receiver_phone: formData.receiverPhone,
        delivery_address: formData.receiverAddress,
        package_weight: formData.packageWeight ? parseFloat(formData.packageWeight) : null,
        package_type: formData.packageType,
        description: formData.description || null,
        image_url: imageUrl,
        video_url: videoUrl,
        audio_url: audioUrl,
        media_type: mediaTypeVal,
        voice_verification_required: formData.voiceVerification,
      };
      await createShipment(payload);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create shipment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 font-sans selection:bg-[#FFC000] selection:text-black">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Create New Shipment</h1>
          <p className="text-gray-400">Fill in the details below to schedule a pickup.</p>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center justify-between mb-8 relative">
          <div className="absolute top-1/2 left-0 w-full h-1 bg-[#333333] -z-10 rounded-full"></div>
          <div 
            className="absolute top-1/2 left-0 h-1 bg-[#FFC000] -z-10 rounded-full transition-all duration-500" 
            style={{ width: `${((step - 1) / 3) * 100}%` }}
          ></div>
          
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-4 transition-all ${step >= s ? 'bg-[#FFC000] border-black text-black' : 'bg-[#1A1A1A] border-black text-gray-500'}`}>
              {step > s ? <CheckCircle size={20} /> : s}
            </div>
          ))}
        </div>

        {/* Form Container */}
        <div className="bg-[#1A1A1A] rounded-[2rem] p-6 md:p-10 border border-[#333333] shadow-2xl">
          
          {/* Step 1: Sender Details */}
          {step === 1 && (
            <div className="space-y-6 animate-fadeIn">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <div className="p-2 bg-[#FFC000] rounded-lg text-black"><User size={24} /></div>
                Sender Details
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Full Name</label>
                  <input type="text" name="senderName" value={formData.senderName} onChange={handleChange} placeholder="Your Name" className="w-full bg-black border border-[#333333] rounded-xl p-4 text-white focus:border-[#FFC000] focus:outline-none transition-colors" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Phone Number</label>
                  <input type="tel" name="senderPhone" value={formData.senderPhone} onChange={handleChange} placeholder="+94 77 123 4567" className="w-full bg-black border border-[#333333] rounded-xl p-4 text-white focus:border-[#FFC000] focus:outline-none transition-colors" />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Pickup Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                    <input type="text" name="senderAddress" value={formData.senderAddress} onChange={handleChange} placeholder="Street address, City" className="w-full bg-black border border-[#333333] rounded-xl p-4 pl-12 text-white focus:border-[#FFC000] focus:outline-none transition-colors" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Receiver Details */}
          {step === 2 && (
            <div className="space-y-6 animate-fadeIn">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <div className="p-2 bg-[#FFC000] rounded-lg text-black"><MapPin size={24} /></div>
                Receiver Details
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Receiver Name</label>
                  <input type="text" name="receiverName" value={formData.receiverName} onChange={handleChange} placeholder="Receiver Name" className="w-full bg-black border border-[#333333] rounded-xl p-4 text-white focus:border-[#FFC000] focus:outline-none transition-colors" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Receiver Phone</label>
                  <input type="tel" name="receiverPhone" value={formData.receiverPhone} onChange={handleChange} placeholder="+94 77 123 4567" className="w-full bg-black border border-[#333333] rounded-xl p-4 text-white focus:border-[#FFC000] focus:outline-none transition-colors" />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Delivery Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                    <input type="text" name="receiverAddress" value={formData.receiverAddress} onChange={handleChange} placeholder="Street address, City" className="w-full bg-black border border-[#333333] rounded-xl p-4 pl-12 text-white focus:border-[#FFC000] focus:outline-none transition-colors" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Package Info */}
          {step === 3 && (
            <div className="space-y-6 animate-fadeIn">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <div className="p-2 bg-[#FFC000] rounded-lg text-black"><Package size={24} /></div>
                Package Information
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Weight (kg)</label>
                  <input type="number" name="packageWeight" value={formData.packageWeight} onChange={handleChange} placeholder="0.5" className="w-full bg-black border border-[#333333] rounded-xl p-4 text-white focus:border-[#FFC000] focus:outline-none transition-colors" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Type</label>
                  <select name="packageType" value={formData.packageType} onChange={handleChange} className="w-full bg-black border border-[#333333] rounded-xl p-4 text-white focus:border-[#FFC000] focus:outline-none transition-colors">
                    <option>Standard</option>
                    <option>Fragile</option>
                    <option>Electronics</option>
                    <option>Documents</option>
                  </select>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Description</label>
                  <textarea rows="3" name="description" value={formData.description} onChange={handleChange} placeholder="Brief description of contents..." className="w-full bg-black border border-[#333333] rounded-xl p-4 text-white focus:border-[#FFC000] focus:outline-none transition-colors resize-none"></textarea>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Verification (Image / Video Upload / Record) */}
          {step === 4 && (
            <div className="space-y-6 animate-fadeIn">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <div className="p-2 bg-[#FFC000] rounded-lg text-black"><Camera size={24} /></div>
                Delivery Verification
              </h2>
              
              <p className="text-gray-400 text-sm leading-relaxed bg-black/50 p-4 rounded-xl border border-[#333333]">
                <strong className="text-[#FFC000]">Secure Delivery:</strong> Upload a photo or video of the authorized receiver, or use your camera to record a short video with audio for identity verification.
              </p>

              {/* Voice Verification Toggle */}
              <div className="mt-4 p-4 bg-black/50 rounded-xl border border-[#333333]">
                <label className="flex items-center justify-between cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#FFC000]/10 rounded-lg group-hover:bg-[#FFC000]/20 transition-colors">
                      <Shield size={20} className="text-[#FFC000]" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">Voice Verification</p>
                      <p className="text-gray-500 text-xs">Require voice identity check upon delivery</p>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={formData.voiceVerification}
                      onChange={(e) => setFormData({ ...formData, voiceVerification: e.target.checked })}
                      className="sr-only"
                    />
                    <div className={`w-12 h-6 rounded-full transition-colors ${formData.voiceVerification ? 'bg-[#FFC000]' : 'bg-[#333333]'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform mt-0.5 ${formData.voiceVerification ? 'translate-x-6.5 ml-1' : 'translate-x-0.5'}`}></div>
                    </div>
                  </div>
                </label>
                {formData.voiceVerification && (
                  <p className="mt-3 text-xs text-[#FFC000] bg-[#FFC000]/10 p-2 rounded-lg">
                    The courier will send a voice verification link before completing delivery. You must verify your identity with your registered voice.
                  </p>
                )}
              </div>

              {/* ── Media Section ───────────────────────────────── */}
              <div className="mt-4">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 block">Upload Reference Media (Owner/Neighbor)</label>

                {/* Already have media uploaded/recorded → show preview */}
                {(formData.receiverImage || formData.receiverVideo) && !mediaMode ? (
                  <div className="relative w-full rounded-2xl overflow-hidden border border-[#333333] group">
                    {formData.mediaType === 'image' && formData.receiverImage && (
                      <img src={formData.receiverImage} alt="Receiver Reference" className="w-full h-64 object-cover" />
                    )}
                    {formData.mediaType === 'video' && formData.receiverVideo && (
                      <video src={formData.receiverVideo} controls className="w-full h-64 object-cover bg-black" />
                    )}
                    <button 
                      onClick={removeMedia}
                      className="absolute top-4 right-4 p-2 bg-red-500 text-white rounded-lg shadow-lg hover:bg-red-600 transition-colors z-10"
                    >
                      <X size={20} />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm p-3 text-center">
                      <p className="text-[#FFC000] font-bold text-sm flex items-center justify-center gap-2">
                        <CheckCircle size={16} /> {formData.mediaType === 'image' ? 'Image' : 'Video'} Uploaded Successfully
                      </p>
                    </div>
                  </div>
                ) : mediaMode === 'recordVideo' ? (
                  /* ── Camera recording view ── */
                  <div className="relative w-full rounded-2xl overflow-hidden border border-[#333333] bg-black">
                    <video
                      ref={cameraVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-72 object-cover"
                    />

                    {/* Recording indicator with audio status */}
                    {isRecording && (
                      <div className="absolute top-4 left-4 flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-red-600/90 px-3 py-1.5 rounded-full">
                          <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                          <span className="text-white text-xs font-bold">{formatTime(recordDuration)}</span>
                        </div>
                        {hasAudioTrack && (
                          <div className="flex items-center gap-1.5 bg-black/70 px-3 py-1.5 rounded-full">
                            <Mic className="w-3.5 h-3.5 text-green-400" />
                            <div className="flex items-end gap-0.5 h-3.5">
                              {[0.15, 0.3, 0.45, 0.6, 0.8].map((threshold, i) => (
                                <div
                                  key={i}
                                  className={`w-0.5 rounded-full transition-all duration-100 ${
                                    audioLevel > threshold ? 'bg-green-400' : 'bg-gray-600'
                                  }`}
                                  style={{ height: `${(i + 1) * 20}%` }}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* No-audio warning */}
                    {!hasAudioTrack && cameraReady && (
                      <div className="absolute top-4 left-4 flex items-center gap-2 bg-yellow-600/90 px-3 py-1.5 rounded-full">
                        <MicOff className="w-3.5 h-3.5 text-white" />
                        <span className="text-white text-xs font-bold">No mic</span>
                      </div>
                    )}

                    {/* Mic ready indicator */}
                    {hasAudioTrack && !isRecording && cameraReady && (
                      <div className="absolute top-4 left-4 flex items-center gap-2 bg-green-600/80 px-3 py-1.5 rounded-full">
                        <Mic className="w-3.5 h-3.5 text-white" />
                        <span className="text-white text-xs font-bold">Mic ready</span>
                      </div>
                    )}

                    {/* Camera controls */}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center gap-4">
                      {!isRecording ? (
                        <>
                          <button
                            onClick={() => { setMediaMode(null); stopCamera(); }}
                            className="px-4 py-2 text-gray-400 hover:text-white text-sm font-bold transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={startRecording}
                            disabled={!cameraReady}
                            className="px-6 py-2.5 bg-red-500 hover:bg-red-400 text-white font-bold rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50"
                          >
                            <div className="w-3 h-3 bg-white rounded-full" />
                            Start Recording
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={stopRecording}
                          className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl flex items-center gap-2 transition-colors animate-pulse"
                        >
                          <StopCircle size={18} />
                          Stop Recording ({formatTime(recordDuration)})
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  /* ── Choose method (3 options) ── */
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Upload Image */}
                    <label className="flex flex-col items-center justify-center h-52 border-2 border-[#333333] border-dashed rounded-2xl cursor-pointer bg-black hover:border-[#FFC000] hover:bg-[#FFC000]/5 transition-all group">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <div className="p-3 bg-[#1A1A1A] rounded-full mb-3 group-hover:scale-110 transition-transform">
                          <Image className="w-7 h-7 text-gray-400 group-hover:text-[#FFC000]" />
                        </div>
                        <p className="text-sm font-bold text-[#FFC000] mb-1">Upload Image</p>
                        <p className="text-xs text-gray-500">PNG, JPG, GIF (5MB)</p>
                      </div>
                      <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>

                    {/* Upload Video */}
                    <label className="flex flex-col items-center justify-center h-52 border-2 border-[#333333] border-dashed rounded-2xl cursor-pointer bg-black hover:border-purple-400 hover:bg-purple-500/5 transition-all group">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <div className="p-3 bg-[#1A1A1A] rounded-full mb-3 group-hover:scale-110 transition-transform">
                          <Upload className="w-7 h-7 text-gray-400 group-hover:text-purple-400" />
                        </div>
                        <p className="text-sm font-bold text-purple-400 mb-1">Upload Video</p>
                        <p className="text-xs text-gray-500">MP4, WebM, MOV (100MB)</p>
                      </div>
                      <input type="file" className="hidden" accept="video/mp4,video/webm,video/quicktime,video/x-matroska" onChange={handleVideoUpload} />
                    </label>

                    {/* Record Video */}
                    <button
                      type="button"
                      onClick={() => setMediaMode('recordVideo')}
                      className="flex flex-col items-center justify-center h-52 border-2 border-[#333333] border-dashed rounded-2xl cursor-pointer bg-black hover:border-cyan-400 hover:bg-cyan-500/5 transition-all group"
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <div className="p-3 bg-[#1A1A1A] rounded-full mb-3 group-hover:scale-110 transition-transform">
                          <Video className="w-7 h-7 text-gray-400 group-hover:text-cyan-400" />
                        </div>
                        <p className="text-sm font-bold text-cyan-400 mb-1">Record Video</p>
                        <p className="text-xs text-gray-500">Camera + Microphone</p>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-10 pt-6 border-t border-[#333333]">
            {step > 1 ? (
              <button 
                onClick={prevStep}
                className="px-6 py-3 rounded-xl font-bold text-white hover:text-[#FFC000] transition-colors flex items-center gap-2"
              >
                <ArrowLeft size={20} /> Back
              </button>
            ) : (
              <div></div>
            )}

            {step < 4 ? (
              <button 
                onClick={nextStep}
                className="px-8 py-3 bg-[#FFC000] text-black font-bold rounded-xl hover:bg-[#E5AC00] transition-colors shadow-lg shadow-[#FFC000]/20 flex items-center gap-2"
              >
                Next Step <ArrowRight size={20} />
              </button>
            ) : (
              <button 
                onClick={handleSubmit}
                disabled={loading}
                className="px-8 py-3 bg-green-500 text-black font-bold rounded-xl hover:bg-green-400 transition-colors shadow-lg shadow-green-500/20 flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Confirm Shipment'} <CheckCircle size={20} />
              </button>
            )}
            {error && (
              <p className="text-red-400 text-sm mt-2">{error}</p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default NewShipment;