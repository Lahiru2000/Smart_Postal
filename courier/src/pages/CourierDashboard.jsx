import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Package, Truck, CheckCircle, Clock, Zap, Calendar, Shield, Send, X, Copy, RefreshCw, ExternalLink, CheckCheck, Navigation, Filter, ChevronDown } from 'lucide-react';
import { getShipments, updateShipment, startVoiceVerification, getVerificationStatus } from '../services/api';

const CourierDashboard = () => {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verificationLoading, setVerificationLoading] = useState({});
  const [activeFilter, setActiveFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);

  // Verification modal state
  const [verifyModal, setVerifyModal] = useState(null); // { shipmentId, verificationId, link, challengePhrase, status, expiresAt }
  const [copied, setCopied] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    fetchShipments();
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const fetchShipments = async () => {
    try {
      const res = await getShipments();
      setShipments(res.data);
    } catch (err) {
      console.error('Failed to fetch shipments', err);
      if (err.response?.status === 401) navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (id) => {
    try {
      await updateShipment(id, { status: 'In Transit' });
      fetchShipments();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to accept shipment');
    }
  };

  const handleDeliver = async (id) => {
    try {
      await updateShipment(id, { status: 'Delivered' });
      fetchShipments();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to mark as delivered');
    }
  };

  // ── Send verification link to customer ────────────────────
  const handleSendVoiceVerification = async (shipmentId) => {
    setVerificationLoading(prev => ({ ...prev, [shipmentId]: true }));
    try {
      const res = await startVoiceVerification(shipmentId);
      const { verification_id, verification_link, challenge_phrase, expires_in_seconds } = res.data;

      const expiresAt = new Date(Date.now() + expires_in_seconds * 1000);
      setVerifyModal({
        shipmentId,
        verificationId: verification_id,
        link: verification_link,
        challengePhrase: challenge_phrase,
        status: 'pending',
        expiresAt,
      });
      startPolling(verification_id);
      fetchShipments();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to start voice verification');
    } finally {
      setVerificationLoading(prev => ({ ...prev, [shipmentId]: false }));
    }
  };

  // ── Poll verification status every 5s ─────────────────────
  const startPolling = useCallback((verificationId) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await getVerificationStatus(verificationId);
        const status = res.data.status;
        setVerifyModal(prev => prev ? { ...prev, status } : prev);
        if (status === 'approved' || status === 'failed' || status === 'expired') {
          clearInterval(pollRef.current);
          pollRef.current = null;
          fetchShipments();
        }
      } catch {
        // ignore polling errors
      }
    }, 5000);
  }, []);

  const closeModal = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setVerifyModal(null);
    setCopied(false);
  };

  const copyLink = async () => {
    if (!verifyModal?.link) return;
    try {
      await navigator.clipboard.writeText(verifyModal.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = verifyModal.link;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ── Counts ─────────────────────────────────────────────────
  const activeCount = shipments.filter(s => s.status === 'In Transit' && s.courier_id).length;
  const deliveredCount = shipments.filter(s => s.status === 'Delivered').length;
  const pendingCount = shipments.filter(s => s.status === 'Pending').length;
  const totalCount = shipments.length;

  const filterOptions = [
    { key: 'all', label: 'All', count: totalCount, icon: <Package className="w-4 h-4" />, color: 'text-gray-400', activeBg: 'bg-white/10', activeBorder: 'border-white/20' },
    { key: 'In Transit', label: 'Active Deliveries', count: activeCount, icon: <Truck className="w-4 h-4" />, color: 'text-[#FFC000]', activeBg: 'bg-[#FFC000]/10', activeBorder: 'border-[#FFC000]/30' },
    { key: 'Delivered', label: 'Completed', count: deliveredCount, icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-400', activeBg: 'bg-green-500/10', activeBorder: 'border-green-500/30' },
    { key: 'Pending', label: 'Pending Pickup', count: pendingCount, icon: <Clock className="w-4 h-4" />, color: 'text-orange-400', activeBg: 'bg-orange-500/10', activeBorder: 'border-orange-500/30' },
  ];

  const filteredShipments = shipments.filter((s) => {
    if (activeFilter === 'all') return true;
    return s.status === activeFilter;
  });

  const currentFilter = filterOptions.find(f => f.key === activeFilter) || filterOptions[0];

  const statusStyles = {
    'In Transit': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'Delivered': 'bg-green-500/10 text-green-400 border-green-500/20',
    'Pending': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    'Reversed': 'bg-red-500/10 text-red-400 border-red-500/20',
    'Return Requested': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };

  const verificationStatusConfig = {
    pending:  { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', label: 'Waiting for Customer...',   icon: <RefreshCw className="w-5 h-5 animate-spin" /> },
    approved: { color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/30',   label: 'Verification Passed!',       icon: <CheckCircle className="w-5 h-5" /> },
    failed:   { color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30',       label: 'Verification Failed',        icon: <X className="w-5 h-5" /> },
    expired:  { color: 'text-gray-400',   bg: 'bg-gray-500/10 border-gray-500/30',     label: 'Session Expired',            icon: <Clock className="w-5 h-5" /> },
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-[#FFC000] rounded-xl flex items-center justify-center shadow-lg shadow-[#FFC000]/20">
                <Zap className="w-6 h-6 text-black" strokeWidth={2.5} />
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
            </div>
            <p className="text-gray-400 font-medium">Overview for {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/route-optimizer" className="px-5 py-2.5 bg-[#1A1A1A] hover:bg-[#252525] text-white border border-[#333333] rounded-xl font-bold text-sm transition-all flex items-center gap-2">
               <Navigation className="w-4 h-4 text-[#FFC000]" />
               Route Optimizer
            </Link>
            <button className="px-5 py-2.5 bg-[#1A1A1A] hover:bg-[#252525] text-white border border-[#333333] rounded-xl font-bold text-sm transition-all flex items-center gap-2">
               <Calendar className="w-4 h-4 text-[#FFC000]" />
               View Schedule
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mb-8">
          {/* Desktop: Pill filters */}
          <div className="hidden sm:flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 mr-2 text-gray-500">
              <Filter className="w-4 h-4" />
              <span className="text-sm font-semibold">Filter:</span>
            </div>
            {filterOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setActiveFilter(opt.key)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-200 ${
                  activeFilter === opt.key
                    ? `${opt.activeBg} ${opt.color} ${opt.activeBorder} shadow-lg`
                    : 'bg-[#1A1A1A] text-gray-400 border-[#333333] hover:border-[#555] hover:text-white'
                }`}
              >
                {opt.icon}
                {opt.label}
                <span className={`ml-1 text-xs font-bold px-1.5 py-0.5 rounded-md ${
                  activeFilter === opt.key ? 'bg-white/10' : 'bg-black/40'
                }`}>
                  {opt.count}
                </span>
              </button>
            ))}
            {activeFilter !== 'all' && (
              <button
                onClick={() => setActiveFilter('all')}
                className="ml-1 p-2 rounded-lg text-gray-500 hover:text-white hover:bg-[#1A1A1A] transition-colors"
                title="Clear filter"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Mobile: Dropdown */}
          <div className="sm:hidden relative">
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className="w-full flex items-center justify-between px-4 py-3 bg-[#1A1A1A] border border-[#333333] rounded-xl text-sm font-semibold text-white"
            >
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#FFC000]" />
                <span>{currentFilter.label}</span>
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-white/10 text-gray-300">{currentFilter.count}</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
            </button>
            {filterOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#1A1A1A] border border-[#333333] rounded-xl shadow-2xl z-30 overflow-hidden">
                {filterOptions.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => { setActiveFilter(opt.key); setFilterOpen(false); }}
                    className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold transition-colors ${
                      activeFilter === opt.key
                        ? `${opt.activeBg} ${opt.color}`
                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {opt.icon}
                      {opt.label}
                    </div>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${
                      activeFilter === opt.key ? 'bg-white/10' : 'bg-black/40'
                    }`}>
                      {opt.count}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          {/* Shipments List */}
          <div className="bg-[#1A1A1A] rounded-2xl border border-[#333333] overflow-hidden">
            <div className="p-6 border-b border-[#333333] flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">Shipments</h2>
            </div>
            {loading ? (
              <div className="p-12 text-center text-gray-400">Loading shipments...</div>
            ) : filteredShipments.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">{activeFilter === 'all' ? 'No shipments available.' : `No ${currentFilter.label.toLowerCase()} shipments.`}</p>
                {activeFilter !== 'all' && (
                  <button onClick={() => setActiveFilter('all')} className="mt-3 text-sm text-[#FFC000] hover:text-white font-semibold transition-colors">
                    Clear filter
                  </button>
                )}
              </div>
            ) : (
            <div className="divide-y divide-[#333333]">
              {filteredShipments.map((delivery) => (
                <div key={delivery.id} onClick={() => navigate(`/shipment/${delivery.id}`)} className="p-5 hover:bg-white/5 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[#252525] rounded-lg text-[#FFC000]">
                        <Package className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm">{delivery.tracking_number}</p>
                        <p className="text-xs text-gray-500">{new Date(delivery.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${statusStyles[delivery.status] || 'bg-gray-800 text-gray-400'}`}>
                          {delivery.status}
                      </span>

                      {/* Pending → Accept */}
                      {delivery.status === 'Pending' && (
                        <button onClick={(e) => { e.stopPropagation(); handleAccept(delivery.id); }} className="px-3 py-1 bg-[#FFC000] text-black text-xs font-bold rounded-lg hover:bg-[#E5AC00] transition-colors">
                          Accept
                        </button>
                      )}

                      {/* In Transit → Verification + Deliver */}
                      {delivery.status === 'In Transit' && delivery.courier_id && (
                        <>
                          {/* Send Voice Verification: show for ANY In-Transit shipment that isn't already approved */}
                          {delivery.voice_verification_status !== 'approved' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSendVoiceVerification(delivery.id); }}
                              disabled={verificationLoading[delivery.id]}
                              className="px-3 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-500 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <Send className="w-3 h-3" />
                              {verificationLoading[delivery.id] ? 'Sending...' : delivery.voice_verification_status === 'pending' ? 'Resend Verification' : 'Send Verification'}
                            </button>
                          )}

                          {/* Verified badge */}
                          {delivery.voice_verification_status === 'approved' && (
                            <span className="px-2.5 py-1 bg-green-500/10 text-green-400 text-xs font-bold rounded-lg border border-green-500/20 flex items-center gap-1">
                              <Shield className="w-3.5 h-3.5" /> Verified
                            </span>
                          )}

                          {/* Deliver button */}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeliver(delivery.id); }}
                            className="px-3 py-1 bg-green-500 text-black text-xs font-bold rounded-lg hover:bg-green-400 transition-colors"
                          >
                            Delivered
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Addresses + Voice Status */}
                  <div className="pl-12 space-y-2">
                     <div className="flex items-center gap-2 text-sm text-gray-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-600"></div>
                        <span className="truncate">{delivery.pickup_address}</span>
                     </div>
                     <div className="flex items-center gap-2 text-sm text-gray-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#FFC000]"></div>
                        <span className="truncate text-gray-200">{delivery.delivery_address}</span>
                     </div>
                     {delivery.voice_verification_status && (
                        <div className="flex items-center gap-2 text-xs mt-1">
                          <Shield className="w-3.5 h-3.5 text-purple-400" />
                          <span className={`font-bold ${
                            delivery.voice_verification_status === 'approved' ? 'text-green-400' :
                            delivery.voice_verification_status === 'failed' ? 'text-red-400' :
                            delivery.voice_verification_status === 'pending' ? 'text-yellow-400' :
                            'text-purple-400'
                          }`}>
                            Voice: {delivery.voice_verification_status.charAt(0).toUpperCase() + delivery.voice_verification_status.slice(1)}
                          </span>
                        </div>
                     )}
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>


        </div>
      </div>

      {/* ═══ Voice Verification Modal ═══ */}
      {verifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={closeModal}>
          <div className="bg-[#1A1A1A] rounded-2xl border border-[#333333] w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-[#333333]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white">Voice Verification</h3>
                  <p className="text-xs text-gray-500">Shipment #{verifyModal.shipmentId}</p>
                </div>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-[#252525] rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Live Status */}
              {(() => {
                const cfg = verificationStatusConfig[verifyModal.status] || verificationStatusConfig.pending;
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
                  <button
                    onClick={copyLink}
                    className={`px-3 py-2.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 ${
                      copied
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-[#FFC000] text-black hover:bg-[#E5AC00]'
                    }`}
                  >
                    {copied ? <><CheckCheck className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Share this link with the customer. They will open it in their browser, speak the challenge phrase, and submit their voice for verification.
                </p>
              </div>

              {/* Expiry */}
              {verifyModal.expiresAt && verifyModal.status === 'pending' && (
                <p className="text-xs text-gray-500 text-center">
                  Expires at {verifyModal.expiresAt.toLocaleTimeString()}
                </p>
              )}

              {/* Action buttons depending on status */}
              {verifyModal.status === 'approved' && (
                <button
                  onClick={closeModal}
                  className="w-full py-3 bg-green-500 text-black font-bold rounded-xl hover:bg-green-400 transition-colors"
                >
                  Done — Deliver Package
                </button>
              )}
              {verifyModal.status === 'failed' && (
                <div className="space-y-2">
                  <p className="text-sm text-red-400 text-center">The customer's voice did not pass verification.</p>
                  <button
                    onClick={() => { closeModal(); handleSendVoiceVerification(verifyModal.shipmentId); }}
                    className="w-full py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-500 transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" /> Resend Verification
                  </button>
                </div>
              )}
              {verifyModal.status === 'expired' && (
                <button
                  onClick={() => { closeModal(); handleSendVoiceVerification(verifyModal.shipmentId); }}
                  className="w-full py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-500 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> Send New Verification
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourierDashboard;