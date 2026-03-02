import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Package, MapPin, User, Phone as PhoneIcon, Weight, FileText,
  Clock, Truck, CheckCircle, Video, Copy, Check, AlertCircle, Shield, Link, Send,
} from 'lucide-react';
import { getShipmentById, updateShipment, initiateCall, getShipmentLatestSession, sendAsyncVerificationLink, getAsyncVerifications } from '../services/api';

const OrderDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [latestSession, setLatestSession] = useState(null);
  const [asyncLinkStatus, setAsyncLinkStatus] = useState(null); // null | 'sending' | 'sent' | 'exists' | 'error'
  const [asyncLinkToken, setAsyncLinkToken] = useState(null);
  const currentUserId = parseInt(localStorage.getItem('userId'));

  useEffect(() => {
    fetchShipment();
    fetchLatestSession();
    fetchAsyncLinkStatus();
  }, [id]);

  const fetchShipment = async () => {
    try {
      const res = await getShipmentById(id);
      setShipment(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load shipment');
      if (err.response?.status === 401) navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchLatestSession = async () => {
    try {
      const res = await getShipmentLatestSession(id);
      if (res.data) {
        setLatestSession(res.data);
      }
    } catch (err) {
      // Ignore errors - session might not exist yet
      console.log('No call session found for this shipment');
    }
  };

  const fetchAsyncLinkStatus = async () => {
    try {
      const res = await getAsyncVerifications(id);
      const tokens = res.data || [];
      // Highest-priority status first: submitted > exists(pending) > none
      const submitted = tokens.find((t) => t.status === 'submitted');
      if (submitted) {
        setAsyncLinkStatus('submitted');
        setAsyncLinkToken(submitted.token);
        return;
      }
      const pending = tokens.find((t) => t.status === 'pending');
      if (pending) {
        setAsyncLinkStatus('exists');
        setAsyncLinkToken(pending.token);
      }
    } catch (_) {}
  };

  const handleSendVerificationLink = async () => {
    setAsyncLinkStatus('sending');
    try {
      const res = await sendAsyncVerificationLink({
        shipment_id: Number(id),
        call_session_id: latestSession?.id || null,
      });
      setAsyncLinkStatus('sent');
      setAsyncLinkToken(res.data.token);
    } catch (err) {
      const detail = err.response?.data?.detail || '';
      if (detail.toLowerCase().includes('pending')) {
        setAsyncLinkStatus('exists');
      } else {
        setAsyncLinkStatus('error');
        alert(detail || 'Failed to send verification link');
      }
    }
  };

  const copyTracking = () => {
    navigator.clipboard.writeText(shipment.tracking_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAccept = async () => {
    setActionLoading('accept');
    try {
      await updateShipment(shipment.id, { status: 'In Transit' });
      await fetchShipment();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to accept shipment');
    } finally {
      setActionLoading('');
    }
  };

  const handleDeliver = async () => {
    setActionLoading('deliver');
    try {
      await updateShipment(shipment.id, { status: 'Delivered' });
      await fetchShipment();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to mark as delivered');
    } finally {
      setActionLoading('');
    }
  };

  const handleVerify = async () => {
    setActionLoading('verify');
    try {
      const res = await initiateCall(shipment.id);
      navigate(`/video-call/${res.data.session_token}`);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to start verification call');
      setActionLoading('');
    }
  };

  const statusConfig = {
    'Pending': { color: 'text-[#FFC000]', bg: 'bg-[#FFC000]/10', border: 'border-[#FFC000]/20', icon: <Clock size={18} /> },
    'In Transit': { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: <Truck size={18} /> },
    'Delivered': { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', icon: <CheckCircle size={18} /> },
    'Awaiting Verification': { color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: <Video size={18} /> },
    'Awaiting Decision': { color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', icon: <Shield size={18} /> },
    'Verification Failed': { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: <AlertCircle size={18} /> },
    'Async Verification Pending': { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: <Clock size={18} /> },
    'Async Verification Submitted': { color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: <Shield size={18} /> },
    'Return Requested': { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: <AlertCircle size={18} /> },
    'Neighbor Delivery': { color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', icon: <MapPin size={18} /> },
    'Locker Delivery': { color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20', icon: <Package size={18} /> },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#FFC000] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !shipment) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 text-red-400" size={48} />
          <p className="text-white text-xl font-bold mb-2">Shipment Not Found</p>
          <p className="text-gray-400 mb-6">{error}</p>
          <button onClick={() => navigate('/dashboard')} className="px-6 py-3 bg-[#FFC000] text-black font-bold rounded-xl">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const sc = statusConfig[shipment.status] || statusConfig['Pending'];

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate('/dashboard')} className="p-2.5 bg-[#1A1A1A] rounded-xl border border-[#333333] hover:bg-[#252525] transition-colors">
            <ArrowLeft size={20} className="text-gray-400" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Order Details</h1>
            <p className="text-gray-400 text-sm">Manage delivery for this shipment</p>
          </div>

          {/* Video Call & Verification Actions - ALIGNMENT FIXED HERE */}
          {shipment.courier_id && shipment.courier_id === currentUserId && (
            <div className="flex flex-wrap items-center gap-3">
              {/* Call Customer Button */}
              <button
                onClick={handleVerify}
                disabled={actionLoading === 'verify'}
                className="px-4 py-2.5 bg-green-500 text-white rounded-xl font-bold text-sm hover:bg-green-600 transition-colors disabled:opacity-50"
              >
                {actionLoading === 'verify' ? 'Connecting...' : 'Call Customer'}
              </button>

              {/* Send Verification Link / Review Submission */}
              {asyncLinkStatus === 'submitted' ? (
                <button
                  onClick={() => navigate(`/async-review/${asyncLinkToken}`)}
                  className="px-4 py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 bg-purple-500 text-white hover:bg-purple-400"
                >
                  <Shield size={16} /> Review Submission
                </button>
              ) : (
                <button
                  onClick={handleSendVerificationLink}
                  disabled={asyncLinkStatus === 'sending' || asyncLinkStatus === 'exists' || asyncLinkStatus === 'sent'}
                  className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 ${
                    asyncLinkStatus === 'sent' || asyncLinkStatus === 'exists'
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30 cursor-default'
                      : 'bg-orange-500 text-white hover:bg-orange-400 disabled:opacity-50'
                  }`}
                >
                  {asyncLinkStatus === 'sent' || asyncLinkStatus === 'exists' ? (
                    <><CheckCircle size={16} /> Link Sent</>
                  ) : asyncLinkStatus === 'sending' ? (
                    <><Send size={16} className="animate-pulse" /> Sending...</>
                  ) : (
                    <><Link size={16} /> Send Verify Link</>
                  )}
                </button>
              )}

              {/* View Verification Button */}
              {latestSession && (
                <button
                  onClick={() => navigate(`/verify/${latestSession.session_token}`)}
                  className="px-4 py-2.5 bg-purple-500 text-white rounded-xl font-bold text-sm hover:bg-purple-600 transition-colors"
                >
                  View Verification
                </button>
              )}
            </div>
          )}
        </div>

        {/* Status + Tracking */}
        <div className="bg-[#1A1A1A] rounded-2xl border border-[#333333] p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className={`px-4 py-2 rounded-xl ${sc.bg} ${sc.color} border ${sc.border} flex items-center gap-2 font-bold text-sm`}>
                {sc.icon} {shipment.status}
              </div>
            </div>
            <div className="flex items-center gap-2 bg-black rounded-xl px-4 py-2.5 border border-[#333333]">
              <span className="text-gray-400 text-sm">Tracking:</span>
              <span className="text-[#FFC000] font-mono font-bold">{shipment.tracking_number}</span>
              <button onClick={copyTracking} className="ml-1 p-1 hover:bg-[#252525] rounded-lg transition-colors">
                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-gray-400" />}
              </button>
            </div>
          </div>

          {/* Timeline */}
          <div className="flex items-center gap-0 mb-2">
            {['Pending', 'In Transit', 'Delivered'].map((step, i) => {
              const steps = ['Pending', 'In Transit', 'Delivered'];
              const currentIdx = steps.indexOf(shipment.status);
              const active = i <= currentIdx;
              return (
                <React.Fragment key={step}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${active ? 'bg-[#FFC000] text-black' : 'bg-[#333333] text-gray-500'}`}>
                    {i + 1}
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`flex-1 h-1 ${active && i < currentIdx ? 'bg-[#FFC000]' : 'bg-[#333333]'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Pending</span>
            <span>In Transit</span>
            <span>Delivered</span>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Sender Info */}
          <div className="bg-[#1A1A1A] rounded-2xl border border-[#333333] p-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Sender Information</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#252525] rounded-xl flex items-center justify-center">
                  <User size={18} className="text-[#FFC000]" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Name</p>
                  <p className="text-white font-medium">{shipment.sender_name || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#252525] rounded-xl flex items-center justify-center">
                  <PhoneIcon size={18} className="text-[#FFC000]" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Phone</p>
                  <p className="text-white font-medium">{shipment.sender_phone || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#252525] rounded-xl flex items-center justify-center">
                  <MapPin size={18} className="text-[#FFC000]" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Pickup Address</p>
                  <p className="text-white font-medium">{shipment.pickup_address}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Receiver Info */}
          <div className="bg-[#1A1A1A] rounded-2xl border border-[#333333] p-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Receiver Information</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#252525] rounded-xl flex items-center justify-center">
                  <User size={18} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Name</p>
                  <p className="text-white font-medium">{shipment.receiver_name || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#252525] rounded-xl flex items-center justify-center">
                  <PhoneIcon size={18} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Phone</p>
                  <p className="text-white font-medium">{shipment.receiver_phone || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#252525] rounded-xl flex items-center justify-center">
                  <MapPin size={18} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Delivery Address</p>
                  <p className="text-white font-medium">{shipment.delivery_address}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Package Info */}
        <div className="bg-[#1A1A1A] rounded-2xl border border-[#333333] p-6 mb-6">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Package Details</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-black rounded-xl p-4 border border-[#333333]">
              <Weight size={18} className="text-[#FFC000] mb-2" />
              <p className="text-xs text-gray-500">Weight</p>
              <p className="text-white font-bold">{shipment.package_weight ? `${shipment.package_weight} kg` : '—'}</p>
            </div>
            <div className="bg-black rounded-xl p-4 border border-[#333333]">
              <Package size={18} className="text-[#FFC000] mb-2" />
              <p className="text-xs text-gray-500">Type</p>
              <p className="text-white font-bold">{shipment.package_type || 'Standard'}</p>
            </div>
            <div className="bg-black rounded-xl p-4 border border-[#333333]">
              <Clock size={18} className="text-[#FFC000] mb-2" />
              <p className="text-xs text-gray-500">Created</p>
              <p className="text-white font-bold">{new Date(shipment.created_at).toLocaleDateString()}</p>
            </div>
            <div className="bg-black rounded-xl p-4 border border-[#333333]">
              <FileText size={18} className="text-[#FFC000] mb-2" />
              <p className="text-xs text-gray-500">ID</p>
              <p className="text-white font-bold">#{shipment.id}</p>
            </div>
          </div>
          {shipment.description && (
            <div className="mt-4 bg-black rounded-xl p-4 border border-[#333333]">
              <p className="text-xs text-gray-500 mb-1">Description</p>
              <p className="text-gray-300">{shipment.description}</p>
            </div>
          )}
        </div>

        {/* Async Verification Status Banner */}
        {asyncLinkStatus === 'submitted' && asyncLinkToken && (
          <div className="mb-6 bg-purple-500/5 border border-purple-500/20 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center shrink-0">
                <Shield className="text-purple-400" size={20} />
              </div>
              <div className="flex-1">
                <p className="text-white font-bold mb-1">Customer Has Submitted Verification</p>
                <p className="text-gray-400 text-sm mb-3">
                  The customer has recorded their face video. Review it, run the AI analysis, and make your verification decision.
                </p>
                <button
                  onClick={() => navigate(`/async-review/${asyncLinkToken}`)}
                  className="px-5 py-2.5 bg-purple-500 text-white font-bold rounded-xl text-sm hover:bg-purple-400 transition-colors"
                >
                  Open Review Page
                </button>
              </div>
            </div>
          </div>
        )}
        {(asyncLinkStatus === 'sent' || asyncLinkStatus === 'exists') && asyncLinkToken && (
          <div className="mb-6 bg-orange-500/5 border border-orange-500/20 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center shrink-0">
                <Shield className="text-orange-400" size={20} />
              </div>
              <div>
                <p className="text-white font-bold mb-1">Verification Link Sent</p>
                <p className="text-gray-400 text-sm">
                  The customer has been asked to record a short face video for identity verification.
                  Once submitted, you can run the AI analysis from the{' '}
                  {latestSession ? (
                    <button
                      onClick={() => navigate(`/verify/${latestSession.session_token}`)}
                      className="text-purple-400 underline hover:text-purple-300 font-medium"
                    >
                      Verification Dashboard
                    </button>
                  ) : 'Verification Dashboard'}.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <button onClick={() => navigate('/dashboard')} className="px-6 py-3 bg-[#1A1A1A] border border-[#333333] rounded-xl font-bold text-sm hover:bg-[#252525] transition-colors">
            Back to Dashboard
          </button>
          {shipment.status === 'Pending' && (
            <button
              onClick={handleAccept}
              disabled={actionLoading === 'accept'}
              className="px-6 py-3 bg-[#FFC000] text-black rounded-xl font-bold text-sm hover:bg-[#e6ad00] transition-colors disabled:opacity-50"
            >
              {actionLoading === 'accept' ? 'Accepting...' : 'Accept Shipment'}
            </button>
          )}
          {shipment.status === 'In Transit' && shipment.courier_id === currentUserId && (
            <button
              onClick={handleDeliver}
              disabled={actionLoading === 'deliver'}
              className="px-6 py-3 bg-green-500 text-black rounded-xl font-bold text-sm hover:bg-green-400 transition-colors disabled:opacity-50"
            >
              {actionLoading === 'deliver' ? 'Updating...' : 'Mark Delivered'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderDetails;