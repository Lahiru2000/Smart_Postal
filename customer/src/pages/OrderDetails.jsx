import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Package, MapPin, User, Phone, Weight, FileText,
  Clock, Truck, CheckCircle, Video, Copy, Check, AlertCircle, Shield,
} from 'lucide-react';
import { getShipmentById, getPendingCalls, initiateCall, getAsyncVerifications } from '../services/api';

const OrderDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [pendingCall, setPendingCall] = useState(null);
  const [callLoading, setCallLoading] = useState(false);
  const [pendingVerifyToken, setPendingVerifyToken] = useState(null);

  useEffect(() => {
    fetchShipment();
    fetchPendingCall();
    fetchPendingVerifyToken();
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

  const fetchPendingCall = async () => {
    try {
      const res = await getPendingCalls();
      const call = res.data.find((c) => c.shipment_id === Number(id));
      if (call) setPendingCall(call);
    } catch (_) {}
  };

  const fetchPendingVerifyToken = async () => {
    try {
      const res = await getAsyncVerifications(id);
      const tokens = res.data || [];
      // Show submitted-awaiting-review first, then pending-needs-action
      const submitted = tokens.find((t) => t.status === 'submitted');
      if (submitted) { setPendingVerifyToken(submitted); return; }
      const pending = tokens.find((t) => t.status === 'pending');
      if (pending) setPendingVerifyToken(pending);
    } catch (_) {}
  };

  const copyTracking = () => {
    navigator.clipboard.writeText(shipment.tracking_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCall = async () => {
    if (pendingCall) {
      navigate(`/video-call/${pendingCall.session_token}`);
      return;
    }
    setCallLoading(true);
    try {
      const res = await initiateCall(shipment.id);
      navigate(`/video-call/${res.data.session_token}`);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to start call');
      setCallLoading(false);
    }
  };

  const statusConfig = {
    'Pending': { color: 'text-[#FFC000]', bg: 'bg-[#FFC000]/10', border: 'border-[#FFC000]/20', icon: <Clock size={18} /> },
    'In Transit': { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: <Truck size={18} /> },
    'Delivered': { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', icon: <CheckCircle size={18} /> },
    'Awaiting Verification': { color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: <Video size={18} /> },
    'Async Verification Pending': { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: <Shield size={18} /> },
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
            <p className="text-gray-400 text-sm">View your shipment information</p>
          </div>
        </div>

        {/* Async Identity Verification Banner */}
        {pendingVerifyToken && pendingVerifyToken.status === 'pending' && (
          <div className="mb-6 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/30 rounded-2xl p-5">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                  <Shield className="text-orange-400" size={24} />
                </div>
                <div>
                  <p className="text-white font-bold">Identity Verification Required</p>
                  <p className="text-gray-400 text-sm">The courier needs to verify your identity. Open your camera and record a short video.</p>
                </div>
              </div>
              <button
                onClick={() => navigate(`/async-verify/${pendingVerifyToken.token}`)}
                className="px-8 py-3 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-400 transition-all flex items-center gap-2 shadow-lg shadow-orange-500/25 whitespace-nowrap"
              >
                <Shield size={18} />
                Verify Identity
              </button>
            </div>
          </div>
        )}
        {pendingVerifyToken && pendingVerifyToken.status === 'submitted' && (
          <div className="mb-6 bg-purple-500/10 border border-purple-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <Shield className="text-purple-400" size={24} />
              </div>
              <div>
                <p className="text-white font-bold">Verification Submitted — Awaiting Courier Review</p>
                <p className="text-gray-400 text-sm">Your face recording has been submitted. The courier will review and confirm your identity shortly.</p>
              </div>
            </div>
          </div>
        )}

        {/* Video Call Banner — always active when courier is assigned */}
        {shipment.courier_id && (
          <div className="mb-6 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-2xl p-5">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                  <Video className="text-green-400" size={24} />
                </div>
                <div>
                  <p className="text-white font-bold">{pendingCall ? 'Active Call Available' : 'Video Call'}</p>
                  <p className="text-gray-400 text-sm">{pendingCall ? 'Join the ongoing verification call' : 'Call the courier about this shipment'}</p>
                </div>
              </div>
              <button
                onClick={handleCall}
                disabled={callLoading}
                className="px-8 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-400 transition-all flex items-center gap-2 shadow-lg shadow-green-500/25 whitespace-nowrap disabled:opacity-50"
              >
                <Phone size={18} />
                {callLoading ? 'Connecting...' : pendingCall ? 'Join Call' : 'Call Courier'}
              </button>
            </div>
          </div>
        )}

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

          {/* Timeline visual */}
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
                  <Phone size={18} className="text-[#FFC000]" />
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
                  <Phone size={18} className="text-blue-400" />
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

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <button onClick={() => navigate('/dashboard')} className="px-6 py-3 bg-[#1A1A1A] border border-[#333333] rounded-xl font-bold text-sm hover:bg-[#252525] transition-colors">
            Back to Dashboard
          </button>
          {shipment.status === 'Pending' && (
            <button onClick={() => navigate(`/edit-shipment/${shipment.id}`)} className="px-6 py-3 bg-[#FFC000] text-black rounded-xl font-bold text-sm hover:bg-[#e6ad00] transition-colors">
              Edit Shipment
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderDetails;
