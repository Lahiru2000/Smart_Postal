import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Shield, CheckCircle, XCircle, AlertTriangle, Loader2,
  Camera, Cpu, Zap, User, Clock, Eye,
  GitCompare, ChevronLeft, ChevronRight, Fingerprint, Activity,
} from 'lucide-react';
import {
  getAsyncVerification,
  getAsyncVerificationFrames,
  analyzeAsyncVerification,
  decideAsyncVerification,
  getCapturesBySessionId,
  getShipmentById,
} from '../services/api';

const AsyncReviewPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [tokenData, setTokenData]   = useState(null);
  const [frames, setFrames]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  // Reference captures from the video call session
  const [refCaptures, setRefCaptures] = useState([]);
  const [refIdx, setRefIdx]           = useState(0);
  const [liveIdx, setLiveIdx]         = useState(0);

  // AI analysis state
  const [aiResult, setAiResult]     = useState(null);
  const [aiLoading, setAiLoading]   = useState(false);
  const [aiError, setAiError]       = useState('');

  // Decision state
  const [decideLoading, setDecideLoading] = useState(''); // '' | 'verify' | 'reject'
  const [decideNotes, setDecideNotes]     = useState('');
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [selectedFrame, setSelectedFrame] = useState(null);
  // Registration photo from the shipment — primary reference image
  const [shipmentImage, setShipmentImage] = useState(null);

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tokenRes, framesRes] = await Promise.all([
        getAsyncVerification(token),
        getAsyncVerificationFrames(token).catch(() => ({ data: { frames: [] } })),
      ]);
      setTokenData(tokenRes.data);
      setFrames(framesRes.data.frames || []);

      // Fetch the shipment registration photo (primary reference for AI comparison)
      try {
        const shipRes = await getShipmentById(tokenRes.data.shipment_id);
        if (shipRes.data?.image_url) setShipmentImage(shipRes.data.image_url);
      } catch {
        // Non-fatal — reference falls back to call captures
      }

      // Fetch reference captures from the linked video call session
      if (tokenRes.data.call_session_id) {
        try {
          const capRes = await getCapturesBySessionId(tokenRes.data.call_session_id);
          setRefCaptures((capRes.data || []).filter(c => c.encrypted_data));
        } catch {
          // Non-fatal — reference panel shows placeholder
        }
      }

      // If AI was already run, show previous results
      if (tokenRes.data.ai_confidence != null) {
        setAiResult({
          is_match:        tokenRes.data.ai_result === 'match',
          confidence:      tokenRes.data.ai_confidence / 100,
          avg_similarity:  tokenRes.data.ai_confidence / 100,
          avg_liveness:    1.0,
          frame_count:     framesRes.data.frame_count || 0,
          ai_result:       tokenRes.data.ai_result,
          ai_confidence:   tokenRes.data.ai_confidence,
        });
        // Pre-fill notes
        setDecideNotes(
          `AI: ${tokenRes.data.ai_result?.toUpperCase()} — confidence ${tokenRes.data.ai_confidence}%`
        );
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load verification data');
      if (err.response?.status === 401) navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleRunAI = async () => {
    setAiLoading(true);
    setAiError('');
    try {
      const res = await analyzeAsyncVerification(token);
      setAiResult(res.data);
      setDecideNotes(
        `AI: ${res.data.ai_result?.toUpperCase()} — confidence ${res.data.ai_confidence}%`
      );
      // Refresh token data to get updated ai_confidence / ai_result
      const tr = await getAsyncVerification(token);
      setTokenData(tr.data);
    } catch (err) {
      setAiError(err.response?.data?.detail || 'AI analysis failed.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleDecide = async (isVerified) => {
    setDecideLoading(isVerified ? 'verify' : 'reject');
    try {
      await decideAsyncVerification(token, {
        is_verified: isVerified,
        notes: decideNotes || null,
      });
      await loadData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to submit decision');
    } finally {
      setDecideLoading('');
      setShowRejectConfirm(false);
    }
  };

  /* ─── Loading ─────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#FFC000] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !tokenData) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertTriangle size={48} className="text-red-400 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-3">Error</h2>
          <p className="text-gray-400 mb-8">{error}</p>
          <button onClick={() => navigate('/dashboard')} className="px-8 py-3 bg-[#FFC000] text-black font-bold rounded-xl hover:bg-[#e6ad00]">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const isDone = tokenData?.status === 'verified' || tokenData?.status === 'rejected';
  const isSubmitted = tokenData?.status === 'submitted';
  const isPending = tokenData?.status === 'pending';

  /* ─── Not yet submitted ───────────────────────────────── */
  if (!isSubmitted && !isDone) {
    return (
      <div className="min-h-screen bg-black text-white font-sans">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => navigate(`/order/${tokenData?.shipment_id}`)} className="p-2.5 bg-[#1A1A1A] rounded-xl border border-[#333] hover:bg-[#252525]">
              <ArrowLeft size={20} className="text-gray-400" />
            </button>
            <h1 className="text-2xl font-bold">Async Verification Review</h1>
          </div>
          <div className="bg-[#1A1A1A] rounded-2xl border border-[#333] p-10 text-center">
            <Clock size={48} className="text-[#FFC000] mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Awaiting Customer Submission</h2>
            <p className="text-gray-400 text-sm">
              The customer has not yet recorded their verification video.<br />
              Status: <span className="text-[#FFC000] font-bold">{tokenData?.status}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate(`/order/${tokenData?.shipment_id}`)} className="p-2.5 bg-[#1A1A1A] rounded-xl border border-[#333] hover:bg-[#252525] transition-colors">
            <ArrowLeft size={20} className="text-gray-400" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Async Identity Review</h1>
            <p className="text-gray-400 text-sm">
              Shipment #{tokenData?.shipment_id} — Review submitted face recording
            </p>
          </div>
          {isDone && (
            <div className={`px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-sm ${
              tokenData.status === 'verified'
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {tokenData.status === 'verified' ? <CheckCircle size={18} /> : <XCircle size={18} />}
              {tokenData.status === 'verified' ? 'Verified' : 'Rejected'}
            </div>
          )}
        </div>

        {/* Token Info */}
        <div className="bg-[#1A1A1A] rounded-2xl border border-[#333] p-5 mb-6 flex items-center gap-4 flex-wrap">
          <div className="w-12 h-12 bg-[#252525] rounded-xl flex items-center justify-center shrink-0">
            <Shield size={22} className="text-[#FFC000]" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-white">
              Customer submitted {frames.length} frame{frames.length !== 1 ? 's' : ''}
            </p>
            <p className="text-gray-500 text-sm">
              Submitted {tokenData?.submitted_at
                ? new Date(tokenData.submitted_at).toLocaleString()
                : '—'}
              {tokenData?.ai_result && (
                <span className="ml-3 text-[#FFC000]">
                  AI: {tokenData.ai_result.replace('_', ' ')} ({tokenData.ai_confidence}%)
                </span>
              )}
            </p>
          </div>
        </div>

        {/* ── Side-by-side Face Comparison ─────────────────────────────── */}
        <div className="bg-[#1A1A1A] rounded-2xl border border-[#333] p-6 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 bg-[#FFC000]/10 rounded-xl flex items-center justify-center">
              <GitCompare size={20} className="text-[#FFC000]" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Face Comparison</h2>
              <p className="text-gray-500 text-xs">
                {shipmentImage
                  ? `Registration photo vs ${frames.length} submitted frame${frames.length !== 1 ? 's' : ''}`
                  : refCaptures.length > 0
                  ? `${refCaptures.length} reference frame${refCaptures.length > 1 ? 's' : ''} from video call vs ${frames.length} submitted`
                  : `No reference available — AI will compare submitted frames for self-consistency`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
            {/* Reference frame (video call capture) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#FFC000] inline-block" />
                  <span className="text-xs font-bold text-[#FFC000] uppercase tracking-wider">
                    {shipmentImage ? 'Registration Photo' : 'Reference · Video Call'}
                  </span>
                </div>
                {!shipmentImage && refCaptures.length > 1 && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => setRefIdx(i => Math.max(0, i - 1))} disabled={refIdx <= 0}
                      className="w-5 h-5 rounded bg-[#333] flex items-center justify-center hover:bg-[#444] disabled:opacity-30">
                      <ChevronLeft size={10} />
                    </button>
                    <span className="text-[10px] text-gray-500 font-mono">{refIdx + 1}/{refCaptures.length}</span>
                    <button onClick={() => setRefIdx(i => Math.min(refCaptures.length - 1, i + 1))} disabled={refIdx >= refCaptures.length - 1}
                      className="w-5 h-5 rounded bg-[#333] flex items-center justify-center hover:bg-[#444] disabled:opacity-30">
                      <ChevronRight size={10} />
                    </button>
                  </div>
                )}
              </div>
              <div className="relative rounded-2xl overflow-hidden border-2 border-[#FFC000]/30 bg-[#252525] aspect-[3/4] flex items-center justify-center">
                {(shipmentImage || refCaptures[refIdx]?.encrypted_data) ? (
                  <img
                    src={shipmentImage || refCaptures[refIdx].encrypted_data}
                    alt="Reference"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 p-6 text-center">
                    <Camera size={36} className="text-gray-600" />
                    <p className="text-gray-600 text-xs leading-snug">No registration photo available as reference</p>
                  </div>
                )}
                <div className="absolute top-2 left-2 bg-black/70 backdrop-blur rounded-lg px-2 py-1 text-[10px] text-[#FFC000] font-bold">
                  {shipmentImage ? 'REG PHOTO' : refCaptures.length > 0 ? `CALL FRAME ${refIdx + 1}` : ''}
                </div>
              </div>
            </div>

            {/* Center VS column */}
            <div className="flex flex-col items-center justify-center gap-3 px-1 min-w-[60px]">
              <div className={`flex-1 w-px transition-colors duration-500 ${
                aiResult ? (aiResult.is_match ? 'bg-green-500/60' : 'bg-red-500/60') : 'bg-[#333]'
              }`} />
              <div className={`w-11 h-11 rounded-full border-2 flex items-center justify-center text-xs font-black transition-all duration-500 ${
                aiResult
                  ? aiResult.is_match
                    ? 'border-green-500 text-green-400 bg-green-500/10 shadow-lg shadow-green-500/20'
                    : 'border-red-500 text-red-400 bg-red-500/10 shadow-lg shadow-red-500/20'
                  : 'border-[#444] text-gray-500 bg-[#252525]'
              }`}>
                {aiResult ? (aiResult.is_match ? '✓' : '✗') : 'VS'}
              </div>
              <div className={`flex-1 w-px transition-colors duration-500 ${
                aiResult ? (aiResult.is_match ? 'bg-green-500/60' : 'bg-red-500/60') : 'bg-[#333]'
              }`} />
            </div>

            {/* Submitted (customer) frame */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full inline-block transition-colors duration-500 ${
                    aiResult ? (aiResult.is_match ? 'bg-green-400' : 'bg-red-400') : 'bg-blue-400'
                  }`} />
                  <span className={`text-xs font-bold uppercase tracking-wider transition-colors duration-500 ${
                    aiResult ? (aiResult.is_match ? 'text-green-400' : 'text-red-400') : 'text-blue-400'
                  }`}>Submitted · Customer</span>
                </div>
                {frames.length > 1 && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => setLiveIdx(i => Math.max(0, i - 1))} disabled={liveIdx <= 0}
                      className="w-5 h-5 rounded bg-[#333] flex items-center justify-center hover:bg-[#444] disabled:opacity-30">
                      <ChevronLeft size={10} />
                    </button>
                    <span className="text-[10px] text-gray-500 font-mono">{liveIdx + 1}/{frames.length}</span>
                    <button onClick={() => setLiveIdx(i => Math.min(frames.length - 1, i + 1))} disabled={liveIdx >= frames.length - 1}
                      className="w-5 h-5 rounded bg-[#333] flex items-center justify-center hover:bg-[#444] disabled:opacity-30">
                      <ChevronRight size={10} />
                    </button>
                  </div>
                )}
              </div>
              <div className={`relative rounded-2xl overflow-hidden border-2 bg-[#252525] aspect-[3/4] flex items-center justify-center transition-all duration-500 ${
                aiResult
                  ? aiResult.is_match ? 'border-green-500/50 shadow-lg shadow-green-500/10' : 'border-red-500/50 shadow-lg shadow-red-500/10'
                  : 'border-blue-500/30'
              }`}>
                {frames[liveIdx] ? (
                  <img src={frames[liveIdx]} alt="Submitted" className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                ) : (
                  <User size={48} className="text-gray-600" />
                )}
                {frames.length > 0 && (
                  <div className={`absolute top-2 left-2 backdrop-blur rounded-lg px-2 py-1 text-[10px] font-bold transition-colors duration-500 ${
                    aiResult ? (aiResult.is_match ? 'bg-green-500/80 text-black' : 'bg-red-500/80 text-white') : 'bg-black/70 text-blue-300'
                  }`}>
                    FRAME {liveIdx + 1}
                  </div>
                )}
                {aiResult && (
                  <div className={`absolute bottom-0 inset-x-0 py-2 flex items-center justify-center gap-1.5 text-xs font-bold transition-all duration-500 ${
                    aiResult.is_match ? 'bg-green-500/80 text-black' : 'bg-red-500/80 text-white'
                  }`}>
                    {aiResult.is_match ? <CheckCircle size={12} /> : <XCircle size={12} />}
                    {aiResult.is_match ? 'MATCH' : 'NO MATCH'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Animated score bars — shown inline once AI runs */}
          {aiResult && (
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                { label: 'Confidence', value: aiResult.confidence,    icon: <Fingerprint size={13} />, color: aiResult.is_match ? 'bg-green-500' : 'bg-red-500' },
                { label: 'Similarity', value: aiResult.avg_similarity, icon: <GitCompare size={13} />,  color: 'bg-blue-500' },
                { label: 'Liveness',   value: aiResult.avg_liveness,   icon: <Activity size={13} />,    color: 'bg-purple-500' },
              ].map(({ label, value, icon, color }) => {
                const pct = Math.min(100, (value || 0) * 100);
                return (
                  <div key={label} className="bg-black rounded-xl p-4 border border-[#333]">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-gray-400">{icon}</span>
                      <span className="text-xs text-gray-500 font-medium flex-1">{label}</span>
                      <span className="text-sm font-bold text-white">{pct.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-[#222] rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full transition-all duration-700 ease-out`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Submitted Frames Grid ─────────────────────────────────────────── */}
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Camera size={20} className="text-[#FFC000]" />
            Submitted Face Frames
          </h2>
          {frames.length === 0 ? (
            <div className="bg-[#1A1A1A] rounded-2xl border border-[#333] p-12 text-center">
              <User size={48} className="text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500">No frames to display</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {frames.map((frame, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedFrame(frame)}
                  className="group relative bg-[#1A1A1A] rounded-xl border border-[#333] overflow-hidden hover:border-[#FFC000]/50 transition-all aspect-[3/4]"
                >
                  <img
                    src={frame}
                    alt={`Frame ${i + 1}`}
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                    <Eye size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="absolute bottom-1.5 left-1.5 bg-black/70 backdrop-blur rounded-md px-1.5 py-0.5 text-[10px] text-gray-300">
                    #{i + 1}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Fullscreen viewer */}
        {selectedFrame && (
          <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4" onClick={() => setSelectedFrame(null)}>
            <div className="max-w-2xl max-h-[90vh] relative" onClick={(e) => e.stopPropagation()}>
              <img src={selectedFrame} alt="Frame" className="max-w-full max-h-[85vh] object-contain rounded-2xl border border-[#333]" style={{ transform: 'scaleX(-1)' }} />
              <button onClick={() => setSelectedFrame(null)} className="absolute top-4 right-4 w-10 h-10 bg-black/80 rounded-full flex items-center justify-center text-white hover:bg-black">
                ✕
              </button>
            </div>
          </div>
        )}

        {/* AI Analysis Panel */}
        {!isDone && (
          <div className="bg-[#1A1A1A] rounded-2xl border border-[#333] p-6 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <Cpu size={22} className="text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">AI Face Analysis</h2>
                  <p className="text-gray-500 text-xs">
                    Runs on the server — compares submitted frames against video call captures
                  </p>
                </div>
              </div>
              <button
                onClick={handleRunAI}
                disabled={aiLoading || frames.length === 0}
                className="px-5 py-2.5 bg-purple-500 text-white rounded-xl font-bold text-sm hover:bg-purple-400 transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-purple-500/20"
              >
                {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                {aiLoading ? 'Analysing…' : aiResult ? 'Re-run AI' : 'Run AI Check'}
              </button>
            </div>

            {aiError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
                <p className="text-red-400 text-sm flex items-center gap-2">
                  <AlertTriangle size={16} /> {aiError}
                </p>
              </div>
            )}

            {aiResult && (
              <div className="space-y-4">
                <div className={`rounded-xl p-4 flex items-center gap-4 ${
                  aiResult.is_match
                    ? 'bg-green-500/10 border border-green-500/20'
                    : 'bg-red-500/10 border border-red-500/20'
                }`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    aiResult.is_match ? 'bg-green-500/20' : 'bg-red-500/20'
                  }`}>
                    {aiResult.is_match
                      ? <CheckCircle size={24} className="text-green-400" />
                      : <XCircle size={24} className="text-red-400" />}
                  </div>
                  <div>
                    <p className={`font-bold text-lg ${aiResult.is_match ? 'text-green-400' : 'text-red-400'}`}>
                      {aiResult.is_match ? 'AI: Face Consistent — Likely Same Person' : 'AI: Face Inconsistent — Manual Review Recommended'}
                    </p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {aiResult.frame_count} frame{aiResult.frame_count !== 1 ? 's' : ''} captured,{' '}
                      {aiResult.frames_analysed ?? aiResult.frame_count} compared
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Confidence',  value: aiResult.confidence,      color: 'bg-purple-500' },
                    { label: 'Similarity',  value: aiResult.avg_similarity,   color: 'bg-blue-500' },
                    { label: 'Liveness',    value: aiResult.avg_liveness,     color: 'bg-green-500' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-black rounded-xl p-4 border border-[#333]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500 font-medium">{label}</span>
                        <span className="text-sm font-bold text-white">{(value * 100).toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-2 bg-[#333] rounded-full overflow-hidden">
                        <div
                          className={`h-full ${color} rounded-full transition-all duration-700`}
                          style={{ width: `${Math.min(100, value * 100).toFixed(1)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {aiResult.courier_decision && (
                  <div className={`rounded-xl p-4 border ${
                    aiResult.courier_decision.action === 'deliver'
                      ? 'border-green-500/30 bg-green-500/5'
                      : aiResult.courier_decision.action === 'review_then_deliver'
                      ? 'border-yellow-500/30 bg-yellow-500/5'
                      : 'border-red-500/30 bg-red-500/5'
                  }`}>
                    <p className={`font-bold text-sm mb-1 ${
                      aiResult.courier_decision.action === 'deliver' ? 'text-green-400'
                      : aiResult.courier_decision.action === 'review_then_deliver' ? 'text-yellow-400'
                      : 'text-red-400'
                    }`}>
                      {aiResult.courier_decision.verdict?.replace(/_/g, ' ')}
                    </p>
                    <p className="text-gray-400 text-xs leading-relaxed">
                      {aiResult.courier_decision.recommendation}
                    </p>
                    {aiResult.courier_decision.liveness_warning && (
                      <p className="text-yellow-400 text-xs mt-2 flex items-start gap-1.5">
                        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                        {aiResult.courier_decision.liveness_warning}
                      </p>
                    )}
                    <p className="text-gray-700 text-[10px] mt-2">
                      Engine: {aiResult.courier_decision.engine_used} · Pairs matched: {aiResult.courier_decision.match_pairs}/{aiResult.courier_decision.total_pairs}
                    </p>
                  </div>
                )}

                <p className="text-gray-600 text-xs">
                  AI analysis is a decision aid. The final verification decision is yours.
                </p>
              </div>
            )}

            {!aiResult && !aiLoading && !aiError && (
              <p className="text-gray-600 text-sm text-center py-4">
                Click "Run AI Check" to analyse the submitted frames for face consistency.
              </p>
            )}
          </div>
        )}

        {/* Decision Panel */}
        {!isDone && (
          <div className="bg-[#1A1A1A] rounded-2xl border border-[#333] p-6 mb-6">
            <h2 className="text-lg font-bold mb-2">Your Decision</h2>
            <p className="text-gray-400 text-sm mb-5">
              Review the frames above (and optionally run AI) then confirm or reject the customer's identity.
            </p>

            <div className="mb-5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={decideNotes}
                onChange={(e) => setDecideNotes(e.target.value)}
                rows={2}
                placeholder="Any observations about the verification…"
                className="w-full bg-black border border-[#333] rounded-xl p-3 text-white placeholder-gray-600 focus:border-[#FFC000] focus:outline-none resize-none text-sm"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => handleDecide(true)}
                disabled={!!decideLoading}
                className="flex-1 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 bg-green-500 text-black hover:bg-green-400 transition-all shadow-lg shadow-green-500/20 disabled:opacity-50"
              >
                {decideLoading === 'verify' ? <Loader2 size={22} className="animate-spin" /> : <CheckCircle size={22} />}
                {decideLoading === 'verify' ? 'Verifying…' : 'Verify Customer'}
              </button>

              {!showRejectConfirm ? (
                <button
                  onClick={() => setShowRejectConfirm(true)}
                  disabled={!!decideLoading}
                  className="flex-1 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-all disabled:opacity-50"
                >
                  <XCircle size={22} />
                  Reject
                </button>
              ) : (
                <div className="flex-1 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <p className="text-red-400 text-sm mb-3 font-medium">Confirm rejection?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDecide(false)}
                      disabled={!!decideLoading}
                      className="flex-1 py-2 rounded-lg bg-red-500 text-white font-bold text-sm hover:bg-red-600 disabled:opacity-50"
                    >
                      {decideLoading === 'reject' ? 'Rejecting…' : 'Confirm Reject'}
                    </button>
                    <button onClick={() => setShowRejectConfirm(false)} className="flex-1 py-2 rounded-lg bg-[#333] text-gray-300 font-bold text-sm hover:bg-[#444]">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Result banner */}
        {isDone && (
          <div className={`rounded-2xl border p-6 mb-6 ${
            tokenData.status === 'verified'
              ? 'bg-green-500/5 border-green-500/20'
              : 'bg-red-500/5 border-red-500/20'
          }`}>
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                tokenData.status === 'verified' ? 'bg-green-500/20' : 'bg-red-500/20'
              }`}>
                {tokenData.status === 'verified'
                  ? <CheckCircle size={28} className="text-green-400" />
                  : <XCircle size={28} className="text-red-400" />}
              </div>
              <div>
                <h3 className="text-xl font-bold">
                  {tokenData.status === 'verified' ? 'Customer Verified' : 'Verification Rejected'}
                </h3>
                <p className="text-gray-400 text-sm">
                  {tokenData.status === 'verified'
                    ? 'Customer is verified. Shipment moved to "Awaiting Decision".'
                    : 'Customer was rejected.'}
                  {tokenData.ai_confidence != null && (
                    <span className="ml-2 text-[#FFC000]">AI confidence: {tokenData.ai_confidence}%</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/order/${tokenData?.shipment_id}`)}
            className="px-6 py-3 bg-[#FFC000] text-black rounded-xl font-bold text-sm hover:bg-[#e6ad00]"
          >
            View Shipment
          </button>
        </div>
      </div>
    </div>
  );
};

export default AsyncReviewPage;
