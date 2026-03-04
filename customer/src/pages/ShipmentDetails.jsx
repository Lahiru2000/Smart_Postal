import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Package, MapPin, User, Phone, Truck, Clock,
  CheckCircle, Box, FileText, Shield, Scale, Tag, Calendar,
  Copy, CheckCheck, Video, Link2, AlertCircle, RefreshCw, X, XCircle
} from 'lucide-react';
import { getShipmentById, initiateVideoCall, getCustomerVerificationLink, getVerificationLinks } from '../services/api';

const ShipmentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [callLoading, setCallLoading] = useState(false);
  const [verificationLink, setVerificationLink] = useState(null);
  const [latestVerification, setLatestVerification] = useState(null);

  useEffect(() => {
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
    fetchShipment();
  }, [id, navigate]);

  // Poll for pending verification link from courier
  useEffect(() => {
    if (!shipment) return;
    const checkVLink = async () => {
      try {
        const res = await getCustomerVerificationLink(shipment.id);
        setVerificationLink(res.data); // null if none pending
      } catch { /* ignore */ }
    };
    checkVLink();
    const interval = setInterval(checkVLink, 8000);
    return () => clearInterval(interval);
  }, [shipment?.id]);

  // Poll for latest AI verification result
  useEffect(() => {
    if (!shipment) return;
    const fetchLinks = async () => {
      try {
        const res = await getVerificationLinks(shipment.id);
        const links = res.data || [];
        const withResult = links.find(l => l.verdict || l.status === 'verified' || l.status === 'processing' || l.status === 'completed');
        if (withResult) setLatestVerification(withResult);
      } catch { /* ignore */ }
    };
    fetchLinks();
    const interval = setInterval(fetchLinks, 6000);
    return () => clearInterval(interval);
  }, [shipment?.id]);

  const copyTracking = async () => {
    if (!shipment) return;
    try {
      await navigator.clipboard.writeText(shipment.tracking_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const handleVideoCall = async () => {
    if (!shipment?.courier_id) return;
    setCallLoading(true);
    try {
      const res = await initiateVideoCall({
        callee_id: shipment.courier_id,
        shipment_id: shipment.id,
      });
      navigate(`/video-call/${res.data.room_id}?role=caller`);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to start video call');
    } finally {
      setCallLoading(false);
    }
  };

  const statusConfig = {
    'Pending':    { color: 'text-[#FFC000]', bg: 'bg-[#FFC000]/10 border-[#FFC000]/20', icon: <Clock className="w-5 h-5" /> },
    'In Transit': { color: 'text-blue-400',  bg: 'bg-blue-500/10 border-blue-500/20',    icon: <Truck className="w-5 h-5" /> },
    'Delivered':  { color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20',  icon: <CheckCircle className="w-5 h-5" /> },
  };

  const voiceStatusConfig = {
    pending:  { color: 'text-yellow-400', label: 'Pending' },
    approved: { color: 'text-green-400',  label: 'Approved' },
    failed:   { color: 'text-red-400',    label: 'Failed' },
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

            {/* Status Badge */}
            <div className="flex items-center gap-3">
              {shipment.courier_id && shipment.status !== 'Delivered' && (
                <button
                  onClick={handleVideoCall}
                  disabled={callLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                >
                  <Video className="w-4 h-4" />
                  Call Courier
                </button>
              )}
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border ${sc.bg} ${sc.color}`}>
                {sc.icon}
                {shipment.status}
              </div>
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

        {/* Verification Link Banner */}
        {verificationLink && (
          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-2xl p-5 mb-6 animate-pulse-slow">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Link2 className="w-6 h-6 text-cyan-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-bold text-lg">Verification Required</h3>
                <p className="text-gray-400 text-sm mt-1">
                  Your courier{verificationLink.courier_name ? ` (${verificationLink.courier_name})` : ''} has requested identity verification for this shipment. Please record or upload a short video.
                </p>
                {verificationLink.expires_at && (
                  <p className="text-gray-500 text-xs mt-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Expires {new Date(verificationLink.expires_at).toLocaleTimeString()}
                  </p>
                )}
                <button
                  onClick={() => navigate(`/verification/${verificationLink.token}`)}
                  className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl transition-colors text-sm"
                >
                  <Video className="w-4 h-4" />
                  Open Verification
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ AI Verification Result Card ═══ */}
        {latestVerification && (latestVerification.verdict || latestVerification.status === 'processing' || latestVerification.status === 'completed') && (
          <div className={`rounded-2xl border p-6 mb-6 ${
            latestVerification.verdict
              ? (latestVerification.ai_match ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30')
              : 'bg-blue-500/5 border-blue-500/30'
          }`}>
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              Identity Verification Result
            </h2>

            {/* Processing */}
            {!latestVerification.verdict && (
              <div className="flex items-center gap-3 text-blue-400">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span className="font-bold">AI is analyzing your face and voice...</span>
              </div>
            )}

            {/* Results */}
            {latestVerification.verdict && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {latestVerification.ai_match
                      ? <CheckCircle className="w-8 h-8 text-green-400" />
                      : <XCircle className="w-8 h-8 text-red-400" />
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

                <p className="text-gray-500 text-xs text-center">
                  {latestVerification.ai_match
                    ? '✓ Your identity has been verified. The courier can proceed with delivery.'
                    : '✗ Identity could not be verified. Please contact your courier.'}
                </p>
              </div>
            )}

            {latestVerification.ai_error && !latestVerification.verdict && (
              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-red-400 text-sm">{latestVerification.ai_error}</p>
              </div>
            )}
          </div>
        )}

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

          {/* Receiver Info — Customer sees who they're sending to */}
          <div className="bg-[#1A1A1A] rounded-2xl border border-[#333333] p-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-[#FFC000]" />
              Receiver
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Name</p>
                <p className="text-white font-medium">{shipment.receiver_name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Phone</p>
                <p className="text-white font-medium">{shipment.receiver_phone || '—'}</p>
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

          {/* Sender Info — Customer sees their own info */}
          <div className="bg-[#1A1A1A] rounded-2xl border border-[#333333] p-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-400" />
              Sender (You)
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Name</p>
                <p className="text-white font-medium">{shipment.sender_name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Phone</p>
                <p className="text-white font-medium">{shipment.sender_phone || '—'}</p>
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

        {/* Voice Verification & Image Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Voice Verification Status */}
          {shipment.voice_verification_required && (
            <div className="bg-[#1A1A1A] rounded-2xl border border-[#333333] p-6">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-400" />
                Voice Verification
              </h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-500">Required:</span>
                  <span className="text-[#FFC000] font-bold">Yes</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-500">Status:</span>
                  {shipment.voice_verification_status ? (
                    <span className={`font-bold ${(voiceStatusConfig[shipment.voice_verification_status] || {}).color || 'text-gray-400'}`}>
                      {(voiceStatusConfig[shipment.voice_verification_status] || {}).label || shipment.voice_verification_status}
                    </span>
                  ) : (
                    <span className="text-gray-500">Not started</span>
                  )}
                </div>
                {shipment.voice_verification_status === 'approved' && (
                  <div className="mt-2 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm font-medium flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Voice identity verified successfully
                  </div>
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

      </div>
    </div>
  );
};

export default ShipmentDetails;
