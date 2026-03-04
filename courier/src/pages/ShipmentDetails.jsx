import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Package, MapPin, User, Phone, Truck, Clock,
  CheckCircle, Box, FileText, Shield, Scale, Tag, Calendar,
  Copy, CheckCheck, Send, RefreshCw, X, Navigation, ExternalLink, Video, Link2
} from 'lucide-react';
import { getShipmentById, updateShipment, startVoiceVerification, getVerificationStatus, initiateVideoCall, generateVerificationLink, getVerificationLinkStatus, getVerificationLinks } from '../services/api';

const ShipmentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [callLoading, setCallLoading] = useState(false);

  // Voice verification modal state
  const [verifyModal, setVerifyModal] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const pollRef = useRef(null);

  // Video verification link modal state
  const [vLinkModal, setVLinkModal] = useState(null);
  const [vLinkCopied, setVLinkCopied] = useState(false);
  const [vLinkLoading, setVLinkLoading] = useState(false);
  const vLinkPollRef = useRef(null);

  // Latest AI verification result (shown on the page)
  const [latestVerification, setLatestVerification] = useState(null);

  useEffect(() => {
    fetchShipment();
  }, [id]);

  // Fetch latest verification links for this shipment
  useEffect(() => {
    if (!shipment) return;
    const fetchLinks = async () => {
      try {
        const res = await getVerificationLinks(shipment.id);
        const links = res.data || [];
        // Find the latest link that has AI results
        const withResult = links.find(l => l.verdict || l.status === 'verified' || l.status === 'processing' || l.status === 'completed');
        if (withResult) setLatestVerification(withResult);
      } catch { /* ignore */ }
    };
    fetchLinks();
    const interval = setInterval(fetchLinks, 6000);
    return () => clearInterval(interval);
  }, [shipment?.id]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (vLinkPollRef.current) clearInterval(vLinkPollRef.current);
    };
  }, []);

  const fetchShipment = async () => {
    try {
      const res = await getShipmentById(id);
      setShipment(res.data);
    } catch (err) {
      if (err.response?.status === 401) return navigate('/login');
      if (err.response?.status === 404) setError('Shipment not found.');
      else setError('Failed to load shipment details.');
    } finally {
      setLoading(false);
    }
  };

  const copyTracking = async () => {
    if (!shipment) return;
    try {
      await navigator.clipboard.writeText(shipment.tracking_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  // ── Actions ────────────────────────────────────────────
  const handleAccept = async () => {
    setActionLoading(true);
    try {
      await updateShipment(id, { status: 'In Transit' });
      await fetchShipment();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to accept shipment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeliver = async () => {
    setActionLoading(true);
    try {
      await updateShipment(id, { status: 'Delivered' });
      await fetchShipment();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to mark as delivered');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Voice Verification ─────────────────────────────────
  const handleSendVoiceVerification = async () => {
    setActionLoading(true);
    try {
      const res = await startVoiceVerification(shipment.id);
      const { verification_id, verification_link, challenge_phrase, expires_in_seconds } = res.data;
      const expiresAt = new Date(Date.now() + expires_in_seconds * 1000);
      setVerifyModal({ verificationId: verification_id, link: verification_link, challengePhrase: challenge_phrase, status: 'pending', expiresAt });
      startPolling(verification_id);
      await fetchShipment();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to start voice verification');
    } finally {
      setActionLoading(false);
    }
  };

  const startPolling = useCallback((verificationId) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await getVerificationStatus(verificationId);
        const status = res.data.status;
        setVerifyModal(prev => prev ? { ...prev, status } : prev);
        if (['approved', 'failed', 'expired'].includes(status)) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          fetchShipment();
        }
      } catch { /* ignore */ }
    }, 5000);
  }, []);

  const closeModal = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setVerifyModal(null);
    setLinkCopied(false);
  };

  const copyLink = async () => {
    if (!verifyModal?.link) return;
    try {
      await navigator.clipboard.writeText(verifyModal.link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch { /* ignore */ }
  };

  // ── Video Verification Link ─────────────────────────
  const handleSendVerificationLink = async () => {
    setVLinkLoading(true);
    try {
      const res = await generateVerificationLink({ shipment_id: shipment.id });
      setVLinkModal({
        token: res.data.token,
        link: res.data.link,
        status: 'pending',
        expiresAt: res.data.expires_at ? new Date(res.data.expires_at) : null,
      });
      startVLinkPolling(res.data.token);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to generate verification link');
    } finally {
      setVLinkLoading(false);
    }
  };

  const startVLinkPolling = useCallback((token) => {
    if (vLinkPollRef.current) clearInterval(vLinkPollRef.current);
    vLinkPollRef.current = setInterval(async () => {
      try {
        const res = await getVerificationLinkStatus(token);
        const data = res.data;
        setVLinkModal(prev => prev ? {
          ...prev,
          status: data.status,
          ai_match: data.ai_match,
          face_score: data.face_score,
          voice_score: data.voice_score,
          combined_score: data.combined_score,
          confidence: data.confidence,
          verdict: data.verdict,
          face_available: data.face_available,
          voice_available: data.voice_available,
          ai_error: data.ai_error,
        } : prev);
        // Stop polling when AI result is ready or link expired/failed
        if (['verified', 'expired', 'failed'].includes(data.status)) {
          clearInterval(vLinkPollRef.current);
          vLinkPollRef.current = null;
        }
      } catch { /* ignore */ }
    }, 4000);
  }, []);

  const closeVLinkModal = () => {
    if (vLinkPollRef.current) { clearInterval(vLinkPollRef.current); vLinkPollRef.current = null; }
    setVLinkModal(null);
    setVLinkCopied(false);
  };

  const copyVLink = async () => {
    if (!vLinkModal?.link) return;
    try {
      await navigator.clipboard.writeText(vLinkModal.link);
      setVLinkCopied(true);
      setTimeout(() => setVLinkCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const handleVideoCall = async () => {
    if (!shipment?.sender_id) return;
    setCallLoading(true);
    try {
      const res = await initiateVideoCall({
        callee_id: shipment.sender_id,
        shipment_id: shipment.id,
      });
      navigate(`/video-call/${res.data.room_id}?role=caller`);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to start video call');
    } finally {
      setCallLoading(false);
    }
  };

  // ── Config ─────────────────────────────────────────────
  const statusConfig = {
    'Pending':    { color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', icon: <Clock className="w-5 h-5" /> },
    'In Transit': { color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',     icon: <Truck className="w-5 h-5" /> },
    'Delivered':  { color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20',   icon: <CheckCircle className="w-5 h-5" /> },
  };

  const voiceStatusConfig = {
    pending:  { color: 'text-yellow-400', label: 'Pending',  icon: <RefreshCw className="w-4 h-4 animate-spin" /> },
    approved: { color: 'text-green-400',  label: 'Approved', icon: <CheckCircle className="w-4 h-4" /> },
    failed:   { color: 'text-red-400',    label: 'Failed',   icon: <X className="w-4 h-4" /> },
  };

  const verificationModalConfig = {
    pending:  { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', label: 'Waiting for Customer...',   icon: <RefreshCw className="w-5 h-5 animate-spin" /> },
    approved: { color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/30',   label: 'Verification Passed!',       icon: <CheckCircle className="w-5 h-5" /> },
    failed:   { color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30',       label: 'Verification Failed',        icon: <X className="w-5 h-5" /> },
    expired:  { color: 'text-gray-400',   bg: 'bg-gray-500/10 border-gray-500/30',     label: 'Session Expired',            icon: <Clock className="w-5 h-5" /> },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-400 text-lg">Loading shipment details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <p className="text-red-400 text-lg">{error}</p>
        <Link to="/dashboard" className="text-[#FFC000] hover:underline font-bold">Back to Dashboard</Link>
      </div>
    );
  }

  const sc = statusConfig[shipment.status] || statusConfig['Pending'];
  const isCourierAssigned = !!shipment.courier_id;

  return (
    <div className="min-h-screen bg-black font-sans selection:bg-[#FFC000] selection:text-black">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Back Button */}
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-gray-400 hover:text-[#FFC000] transition-colors mb-6 group">
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to Dashboard</span>
        </Link>

        {/* Header Card */}
        <div className="bg-[#1A1A1A] rounded-2xl border border-[#333333] p-6 sm:p-8 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-black rounded-xl flex items-center justify-center border border-[#333333]">
                <Package className="w-7 h-7 text-[#FFC000]" strokeWidth={2} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-white tracking-tight">{shipment.tracking_number}</h1>
                  <button onClick={copyTracking} className="p-1.5 hover:bg-[#252525] rounded-lg transition-colors" title="Copy tracking number">
                    {copied ? <CheckCheck className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-500" />}
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                  <Calendar className="w-3.5 h-3.5" />
                  Created {new Date(shipment.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>
            </div>
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border ${sc.bg} ${sc.color}`}>
              {sc.icon}
              {shipment.status}
            </div>
          </div>

          {/* Progress Tracker */}
          <div className="flex items-center gap-0">
            {['Pending', 'In Transit', 'Delivered'].map((step, i, arr) => {
              const done = arr.indexOf(shipment.status) >= i;
              const active = shipment.status === step;
              return (
                <React.Fragment key={step}>
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                      done ? 'bg-[#FFC000] border-[#FFC000] text-black' : 'bg-black border-[#333333] text-gray-600'
                    } ${active ? 'ring-4 ring-[#FFC000]/20' : ''}`}>
                      {statusConfig[step]?.icon || <Clock className="w-5 h-5" />}
                    </div>
                    <span className={`text-xs mt-2 font-bold ${done ? 'text-[#FFC000]' : 'text-gray-600'}`}>{step}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 mt-[-20px] ${arr.indexOf(shipment.status) > i ? 'bg-[#FFC000]' : 'bg-[#333333]'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* ── Courier Action Bar ─────────────────────────── */}
        <div className="bg-[#1A1A1A] rounded-2xl border border-[#FFC000]/30 p-6 mb-6">
          <h2 className="text-sm font-bold text-[#FFC000] uppercase tracking-wider mb-4">Actions</h2>
          <div className="flex flex-wrap gap-3">
            {/* Video Call */}
            {shipment.status !== 'Delivered' && shipment.sender_id && (
              <button onClick={handleVideoCall} disabled={callLoading}
                className="px-5 py-3 bg-green-500/10 text-green-400 border border-green-500/20 font-bold rounded-xl hover:bg-green-500/20 transition-colors disabled:opacity-50 flex items-center gap-2">
                <Video className="w-5 h-5" />
                Call Customer
              </button>
            )}

            {/* Accept job */}
            {shipment.status === 'Pending' && (
              <button onClick={handleAccept} disabled={actionLoading}
                className="px-6 py-3 bg-[#FFC000] text-black font-bold rounded-xl hover:bg-[#E5AC00] transition-colors disabled:opacity-50 flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Accept & Pick Up
              </button>
            )}

            {/* In Transit actions */}
            {shipment.status === 'In Transit' && isCourierAssigned && (
              <>
                {/* Voice verification */}
                {shipment.voice_verification_required && shipment.voice_verification_status !== 'approved' && (
                  <button onClick={handleSendVoiceVerification} disabled={actionLoading}
                    className="px-5 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-500 transition-colors disabled:opacity-50 flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    {shipment.voice_verification_status === 'pending' ? 'Resend Verification' : 'Send Voice Verification'}
                  </button>
                )}

                {/* Video Verification Link */}
                <button onClick={handleSendVerificationLink} disabled={vLinkLoading}
                  className="px-5 py-3 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold rounded-xl hover:bg-cyan-500/20 transition-colors disabled:opacity-50 flex items-center gap-2">
                  <Link2 className="w-5 h-5" />
                  {vLinkLoading ? 'Generating...' : 'Send Verification Link'}
                </button>

                {/* Mark delivered */}
                <button onClick={handleDeliver} disabled={actionLoading}
                  className="px-6 py-3 bg-green-500 text-black font-bold rounded-xl hover:bg-green-400 transition-colors disabled:opacity-50 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Mark as Delivered
                </button>
              </>
            )}

            {shipment.status === 'Delivered' && (
              <div className="flex items-center gap-2 text-green-400 font-bold">
                <CheckCircle className="w-5 h-5" />
                Delivery completed
              </div>
            )}
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

          {/* Sender Info — Courier sees sender contact info for pickup */}
          <div className="bg-[#1A1A1A] rounded-2xl border border-[#333333] p-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-400" />
              Sender (Pickup From)
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Name</p>
                <p className="text-white font-medium">{shipment.sender_name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Phone</p>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-blue-400" />
                  <a href={`tel:${shipment.sender_phone}`} className="text-blue-400 hover:underline font-medium">{shipment.sender_phone || '—'}</a>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Pickup Address</p>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-white font-medium">{shipment.pickup_address}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Receiver Info — Courier sees receiver contact for delivery */}
          <div className="bg-[#1A1A1A] rounded-2xl border border-[#333333] p-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-[#FFC000]" />
              Receiver (Deliver To)
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Name</p>
                <p className="text-white font-medium">{shipment.receiver_name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Phone</p>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-[#FFC000]" />
                  <a href={`tel:${shipment.receiver_phone}`} className="text-[#FFC000] hover:underline font-medium">{shipment.receiver_phone || '—'}</a>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Delivery Address</p>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-[#FFC000] mt-0.5 flex-shrink-0" />
                  <p className="text-white font-medium">{shipment.delivery_address}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Package Details */}
        <div className="bg-[#1A1A1A] rounded-2xl border border-[#333333] p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Box className="w-4 h-4 text-[#FFC000]" />
            Package Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Scale className="w-3 h-3" /> Weight</p>
              <p className="text-white font-medium text-lg">{shipment.package_weight ? `${shipment.package_weight} kg` : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Tag className="w-3 h-3" /> Type</p>
              <p className="text-white font-medium text-lg">{shipment.package_type || 'Standard'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><FileText className="w-3 h-3" /> Description</p>
              <p className="text-white font-medium">{shipment.description || '—'}</p>
            </div>
          </div>
        </div>

        {/* Voice Verification + Image */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Voice Verification Status */}
          {shipment.voice_verification_required && (
            <div className="bg-[#1A1A1A] rounded-2xl border border-purple-500/20 p-6">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-400" />
                Voice Verification
              </h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-500">Required:</span>
                  <span className="text-purple-400 font-bold">Yes</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-500">Status:</span>
                  {shipment.voice_verification_status ? (() => {
                    const vc = voiceStatusConfig[shipment.voice_verification_status] || {};
                    return (
                      <span className={`font-bold flex items-center gap-1.5 ${vc.color || 'text-gray-400'}`}>
                        {vc.icon} {vc.label || shipment.voice_verification_status}
                      </span>
                    );
                  })() : (
                    <span className="text-gray-500">Not started</span>
                  )}
                </div>
                {shipment.voice_verification_status === 'approved' && (
                  <div className="mt-2 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm font-medium flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Customer identity verified — safe to deliver
                  </div>
                )}
                {(!shipment.voice_verification_status || shipment.voice_verification_status === 'failed') && shipment.status === 'In Transit' && (
                  <p className="text-xs text-yellow-400/80 mt-2">
                    ⚠ Voice verification must pass before this shipment can be marked as delivered.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Verification Media */}
          {(shipment.image_url || shipment.video_url) && (
            <div className="bg-[#1A1A1A] rounded-2xl border border-[#333333] p-6">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#FFC000]" />
                Verification {shipment.media_type === 'video' ? 'Video' : 'Image'}
              </h2>
              {shipment.media_type === 'video' && shipment.video_url ? (
                <video
                  src={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${shipment.video_url}`}
                  controls
                  className="w-full rounded-xl border border-[#333333] max-h-64 bg-black"
                />
              ) : shipment.image_url && !shipment.image_url.startsWith('blob:') ? (
                <img
                  src={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${shipment.image_url}`}
                  alt="Verification"
                  className="w-full rounded-xl border border-[#333333] object-cover max-h-48"
                />
              ) : null}
            </div>
          )}
        </div>

        {/* ═══ AI Verification Result Card ═══ */}
        {latestVerification && (latestVerification.verdict || latestVerification.status === 'processing' || latestVerification.status === 'completed') && (
          <div className={`rounded-2xl border p-6 mb-6 ${
            latestVerification.verdict
              ? (latestVerification.ai_match ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30')
              : 'bg-blue-500/5 border-blue-500/30'
          }`}>
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              AI Identity Verification Result
            </h2>

            {/* Processing state */}
            {!latestVerification.verdict && (
              <div className="flex items-center gap-3 text-blue-400">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span className="font-bold">AI is analyzing face and voice...</span>
              </div>
            )}

            {/* Results */}
            {latestVerification.verdict && (
              <div className="space-y-4">
                {/* Verdict + Confidence */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {latestVerification.ai_match
                      ? <CheckCircle className="w-8 h-8 text-green-400" />
                      : <X className="w-8 h-8 text-red-400" />
                    }
                    <div>
                      <p className={`text-xl font-bold ${latestVerification.ai_match ? 'text-green-400' : 'text-red-400'}`}>
                        {latestVerification.verdict}
                      </p>
                      <p className="text-gray-500 text-sm">Combined Score: {(latestVerification.combined_score * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                    latestVerification.confidence === 'HIGH' ? 'bg-green-500/20 text-green-400' :
                    latestVerification.confidence === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {latestVerification.confidence}
                  </span>
                </div>

                {/* Score Bars */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/30 rounded-xl p-4 border border-[#333333]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500 font-bold uppercase">Face</span>
                      {latestVerification.face_available
                        ? <span className="text-white font-bold">{(latestVerification.face_score * 100).toFixed(1)}%</span>
                        : <span className="text-gray-600 text-xs">N/A</span>
                      }
                    </div>
                    {latestVerification.face_available && (
                      <div className="w-full bg-[#333333] rounded-full h-2">
                        <div className={`h-2 rounded-full transition-all ${latestVerification.face_score > 0.6 ? 'bg-green-500' : latestVerification.face_score > 0.4 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${latestVerification.face_score * 100}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="bg-black/30 rounded-xl p-4 border border-[#333333]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500 font-bold uppercase">Voice</span>
                      {latestVerification.voice_available
                        ? <span className="text-white font-bold">{(latestVerification.voice_score * 100).toFixed(1)}%</span>
                        : <span className="text-gray-600 text-xs">N/A</span>
                      }
                    </div>
                    {latestVerification.voice_available && (
                      <div className="w-full bg-[#333333] rounded-full h-2">
                        <div className={`h-2 rounded-full transition-all ${latestVerification.voice_score > 0.6 ? 'bg-green-500' : latestVerification.voice_score > 0.4 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${latestVerification.voice_score * 100}%` }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* AI Error */}
            {latestVerification.ai_error && !latestVerification.verdict && (
              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-red-400 text-sm">{latestVerification.ai_error}</p>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ═══ Voice Verification Modal ═══ */}
      {verifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={closeModal}>
          <div className="bg-[#1A1A1A] rounded-2xl border border-[#333333] w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-[#333333]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white">Voice Verification</h3>
                  <p className="text-xs text-gray-500">{shipment.tracking_number}</p>
                </div>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-[#252525] rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Live Status */}
              {(() => {
                const cfg = verificationModalConfig[verifyModal.status] || verificationModalConfig.pending;
                return (
                  <div className={`flex items-center gap-3 p-4 rounded-xl border ${cfg.bg}`}>
                    <span className={cfg.color}>{cfg.icon}</span>
                    <span className={`font-bold text-sm ${cfg.color}`}>{cfg.label}</span>
                  </div>
                );
              })()}

              {/* Challenge Phrase */}
              <div className="bg-black/50 rounded-xl p-4 border border-[#FFC000]/20">
                <p className="text-xs text-[#FFC000] font-bold uppercase tracking-wider mb-1">Challenge Phrase</p>
                <p className="text-white text-lg font-medium italic">"{verifyModal.challengePhrase}"</p>
                <p className="text-gray-500 text-xs mt-2">The customer must speak this phrase during verification.</p>
              </div>

              {/* Verification Link */}
              <div>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Customer Verification Link</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-black/50 rounded-lg px-3 py-2.5 border border-[#333333] text-sm text-gray-300 truncate font-mono">
                    {verifyModal.link}
                  </div>
                  <button onClick={copyLink}
                    className={`px-3 py-2.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 ${
                      linkCopied ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-[#FFC000] text-black hover:bg-[#E5AC00]'
                    }`}>
                    {linkCopied ? <><CheckCheck className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">Share this link with the customer to complete voice verification.</p>
              </div>

              {/* Expiry */}
              {verifyModal.expiresAt && verifyModal.status === 'pending' && (
                <p className="text-xs text-gray-500 text-center">Expires at {verifyModal.expiresAt.toLocaleTimeString()}</p>
              )}

              {/* Result Actions */}
              {verifyModal.status === 'approved' && (
                <button onClick={closeModal} className="w-full py-3 bg-green-500 text-black font-bold rounded-xl hover:bg-green-400 transition-colors">
                  Done — Deliver Package
                </button>
              )}
              {verifyModal.status === 'failed' && (
                <div className="space-y-2">
                  <p className="text-sm text-red-400 text-center">Verification failed. You can try again.</p>
                  <button onClick={() => { closeModal(); handleSendVoiceVerification(); }}
                    className="w-full py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-500 transition-colors flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4" /> Resend Verification
                  </button>
                </div>
              )}
              {verifyModal.status === 'expired' && (
                <button onClick={() => { closeModal(); handleSendVoiceVerification(); }}
                  className="w-full py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-500 transition-colors flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Send New Verification
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Video Verification Link Modal ═══ */}
      {vLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={closeVLinkModal}>
          <div className="bg-[#1A1A1A] rounded-2xl border border-[#333333] w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-[#333333]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-cyan-600 rounded-xl flex items-center justify-center">
                  <Link2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white">Video Verification Link</h3>
                  <p className="text-xs text-gray-500">{shipment.tracking_number}</p>
                </div>
              </div>
              <button onClick={closeVLinkModal} className="p-2 hover:bg-[#252525] rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Status */}
              {(() => {
                const statuses = {
                  pending:    { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', label: 'Waiting for Customer...', icon: <RefreshCw className="w-5 h-5 animate-spin" /> },
                  completed:  { color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/30',     label: 'Video Received — AI Analyzing...', icon: <RefreshCw className="w-5 h-5 animate-spin" /> },
                  processing: { color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/30',     label: 'AI Verification in Progress...', icon: <RefreshCw className="w-5 h-5 animate-spin" /> },
                  verified:   { color: vLinkModal.ai_match ? 'text-green-400' : 'text-red-400', bg: vLinkModal.ai_match ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30', label: vLinkModal.verdict || 'Verification Complete', icon: vLinkModal.ai_match ? <CheckCircle className="w-5 h-5" /> : <X className="w-5 h-5" /> },
                  expired:    { color: 'text-gray-400',   bg: 'bg-gray-500/10 border-gray-500/30',     label: 'Link Expired',           icon: <Clock className="w-5 h-5" /> },
                  failed:     { color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30',       label: 'Submission Failed',      icon: <X className="w-5 h-5" /> },
                };
                const cfg = statuses[vLinkModal.status] || statuses.pending;
                return (
                  <div className={`flex items-center gap-3 p-4 rounded-xl border ${cfg.bg}`}>
                    <span className={cfg.color}>{cfg.icon}</span>
                    <span className={`font-bold text-sm ${cfg.color}`}>{cfg.label}</span>
                  </div>
                );
              })()}

              {/* AI Verification Results */}
              {vLinkModal.status === 'verified' && vLinkModal.verdict && (
                <div className="space-y-3">
                  {/* Verdict Banner */}
                  <div className={`p-4 rounded-xl border ${vLinkModal.ai_match ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-lg font-bold ${vLinkModal.ai_match ? 'text-green-400' : 'text-red-400'}`}>
                        {vLinkModal.verdict}
                      </span>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                        vLinkModal.confidence === 'HIGH' ? 'bg-green-500/20 text-green-400' :
                        vLinkModal.confidence === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {vLinkModal.confidence} confidence
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm">
                      Combined Score: <span className="text-white font-bold">{(vLinkModal.combined_score * 100).toFixed(1)}%</span>
                    </p>
                  </div>

                  {/* Individual Scores */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-black/50 rounded-xl p-3 border border-[#333333]">
                      <p className="text-xs text-gray-500 mb-1">Face Match</p>
                      {vLinkModal.face_available ? (
                        <>
                          <p className="text-white font-bold text-lg">{(vLinkModal.face_score * 100).toFixed(1)}%</p>
                          <div className="w-full bg-[#333333] rounded-full h-1.5 mt-1">
                            <div className={`h-1.5 rounded-full ${vLinkModal.face_score > 0.6 ? 'bg-green-500' : vLinkModal.face_score > 0.4 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${vLinkModal.face_score * 100}%` }} />
                          </div>
                        </>
                      ) : (
                        <p className="text-gray-500 text-sm">No face detected</p>
                      )}
                    </div>
                    <div className="bg-black/50 rounded-xl p-3 border border-[#333333]">
                      <p className="text-xs text-gray-500 mb-1">Voice Match</p>
                      {vLinkModal.voice_available ? (
                        <>
                          <p className="text-white font-bold text-lg">{(vLinkModal.voice_score * 100).toFixed(1)}%</p>
                          <div className="w-full bg-[#333333] rounded-full h-1.5 mt-1">
                            <div className={`h-1.5 rounded-full ${vLinkModal.voice_score > 0.6 ? 'bg-green-500' : vLinkModal.voice_score > 0.4 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${vLinkModal.voice_score * 100}%` }} />
                          </div>
                        </>
                      ) : (
                        <p className="text-gray-500 text-sm">No audio detected</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* AI Error */}
              {vLinkModal.status === 'verified' && vLinkModal.ai_error && !vLinkModal.verdict && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                  <p className="text-red-400 text-sm font-bold mb-1">AI Verification Error</p>
                  <p className="text-gray-400 text-xs">{vLinkModal.ai_error}</p>
                </div>
              )}

              {/* Instructions (only show when pending) */}
              {vLinkModal.status === 'pending' && (
                <div className="bg-black/50 rounded-xl p-4 border border-cyan-500/20">
                  <p className="text-xs text-cyan-400 font-bold uppercase tracking-wider mb-1">How It Works</p>
                  <p className="text-gray-300 text-sm">Send this one-time link to the customer. They can record a video with their camera or upload an existing video for identity verification.</p>
                </div>
              )}

              {/* Link */}
              <div>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Verification Link (Single Use)</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-black/50 rounded-lg px-3 py-2.5 border border-[#333333] text-sm text-gray-300 truncate font-mono">
                    {vLinkModal.link}
                  </div>
                  <button onClick={copyVLink}
                    className={`px-3 py-2.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 ${
                      vLinkCopied ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-[#FFC000] text-black hover:bg-[#E5AC00]'
                    }`}>
                    {vLinkCopied ? <><CheckCheck className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">⚠ This link can only be used once. If it fails or expires, generate a new one.</p>
              </div>

              {/* Expiry */}
              {vLinkModal.expiresAt && vLinkModal.status === 'pending' && (
                <p className="text-xs text-gray-500 text-center">Expires at {new Date(vLinkModal.expiresAt).toLocaleTimeString()}</p>
              )}

              {/* Action Buttons */}
              {vLinkModal.status === 'verified' && (
                <button onClick={closeVLinkModal} className={`w-full py-3 font-bold rounded-xl transition-colors ${
                  vLinkModal.ai_match
                    ? 'bg-green-500 text-black hover:bg-green-400'
                    : 'bg-[#333333] text-white hover:bg-[#444444]'
                }`}>
                  {vLinkModal.ai_match ? 'Done — Identity Verified ✓' : 'Close'}
                </button>
              )}
              {(vLinkModal.status === 'completed' || vLinkModal.status === 'processing') && (
                <div className="text-center text-gray-500 text-sm">
                  <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />
                  AI is analyzing face and voice... This may take a moment.
                </div>
              )}
              {(vLinkModal.status === 'expired' || vLinkModal.status === 'failed') && (
                <button onClick={() => { closeVLinkModal(); handleSendVerificationLink(); }}
                  className="w-full py-3 bg-cyan-600 text-white font-bold rounded-xl hover:bg-cyan-500 transition-colors flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Generate New Link
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShipmentDetails;
