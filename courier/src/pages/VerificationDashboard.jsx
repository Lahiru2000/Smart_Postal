import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ShieldCheck, ShieldX, Send, Image, Clock,
  CheckCircle, XCircle, AlertTriangle, User, Loader2,
  Camera, Eye, Link2, Cpu, Zap, ChevronLeft, ChevronRight,
  GitCompare, Fingerprint, Activity,
} from 'lucide-react';
import {
  getVerificationDashboard, verifyCustomer, sendAsyncVerificationLink,
  runAICheck,
} from '../services/api';

const VerificationDashboard = () => {
  const { sessionToken } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [verifyNotes, setVerifyNotes] = useState('');
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [selectedCapture, setSelectedCapture] = useState(null);
  const [linkSent, setLinkSent] = useState(false);
  const [verificationDone, setVerificationDone] = useState(false);

  // Face comparison state
  const [compareIdx, setCompareIdx] = useState(0); // index into captures[] for the live panel

  // AI analysis state
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    fetchDashboard();
  }, [sessionToken]);

  const fetchDashboard = async () => {
    try {
      const res = await getVerificationDashboard(sessionToken);
      setData(res.data);
      if (res.data.verification) {
        setVerificationDone(true);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load verification data');
      if (err.response?.status === 401) navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (isVerified) => {
    setActionLoading(isVerified ? 'verify' : 'reject');
    try {
      await verifyCustomer({
        call_session_id: data.session.id,
        is_verified: isVerified,
        notes: verifyNotes || null,
      });
      setVerificationDone(true);
      await fetchDashboard();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to submit verification');
    } finally {
      setActionLoading('');
      setShowRejectConfirm(false);
    }
  };

  const handleSendLink = async () => {
    setActionLoading('link');
    try {
      await sendAsyncVerificationLink({
        shipment_id: data.shipment_id,
        call_session_id: data.session.id,
      });
      setLinkSent(true);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to send verification link');
    } finally {
      setActionLoading('');
    }
  };

  // ── AI analysis ──────────────────────────────────────────────────────────
  const handleRunAI = async () => {
    setAiLoading(true);
    setAiError('');
    setAiResult(null);
    try {
      const res = await runAICheck(sessionToken);
      setAiResult(res.data);
      // Pre-fill notes with AI result summary
      const pct = Math.round((res.data.confidence || 0) * 100);
      const verdict = res.data.is_match ? 'PASS' : 'FAIL';
      setVerifyNotes(`AI Check: ${verdict} — Confidence ${pct}%, Similarity ${(res.data.avg_similarity || 0).toFixed(3)}, Liveness ${(res.data.avg_liveness || 0).toFixed(3)}`);
    } catch (err) {
      setAiError(err.response?.data?.detail || 'AI analysis failed. Make sure the AI module is installed.');
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#FFC000] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto mb-4 text-red-400" size={48} />
          <p className="text-white text-xl font-bold mb-2">Error</p>
          <p className="text-gray-400 mb-6">{error}</p>
          <button onClick={() => navigate('/dashboard')} className="px-6 py-3 bg-[#FFC000] text-black font-bold rounded-xl">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const { session, captures, verification } = data;
  // Registration photo from the shipment — used as primary AI reference
  const refImageUrl = data.reference_image_url || null;
  // nav helpers
  const liveMin = refImageUrl ? 0 : (captures.length > 1 ? 1 : 0);
  const liveMax = captures.length - 1;
  const effectiveIdx = Math.min(liveMax, Math.max(liveMin, compareIdx));
  const showNav = refImageUrl ? captures.length > 1 : captures.length > 2;

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate('/dashboard')} className="p-2.5 bg-[#1A1A1A] rounded-xl border border-[#333] hover:bg-[#252525] transition-colors">
            <ArrowLeft size={20} className="text-gray-400" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Customer Verification</h1>
            <p className="text-gray-400 text-sm">Shipment #{data.shipment_id} — Review captured frames and verify identity</p>
          </div>
          {verification && (
            <div className={`px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-sm ${
              verification.is_verified
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {verification.is_verified ? <ShieldCheck size={18} /> : <ShieldX size={18} />}
              {verification.is_verified ? 'Verified' : 'Rejected'}
            </div>
          )}
        </div>

        {/* Session Info */}
        <div className="bg-[#1A1A1A] rounded-2xl border border-[#333] p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-[#252525] rounded-2xl flex items-center justify-center">
                <Camera size={24} className="text-[#FFC000]" />
              </div>
              <div>
                <p className="text-white font-bold text-lg">Video Call Session</p>
                <p className="text-gray-500 text-sm">
                  {new Date(session.created_at).toLocaleString()} — Status: <span className="text-[#FFC000]">{session.status}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-black rounded-xl px-4 py-2 border border-[#333]">
                <span className="text-gray-500 text-xs">Captured Frames</span>
                <p className="text-[#FFC000] font-bold text-lg">{captures.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Captured Frames Grid */}
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Image size={20} className="text-[#FFC000]" />
            Captured Verification Frames
          </h2>
          {captures.length === 0 ? (
            <div className="bg-[#1A1A1A] rounded-2xl border border-[#333] p-12 text-center">
              <Camera size={48} className="text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg font-medium mb-2">No frames captured</p>
              <p className="text-gray-600 text-sm">Frames are captured during the video call for verification</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {captures.map((capture, index) => (
                <button
                  key={capture.id}
                  onClick={() => setSelectedCapture(capture)}
                  className="group relative bg-[#1A1A1A] rounded-2xl border border-[#333] overflow-hidden hover:border-[#FFC000]/50 transition-all aspect-[4/3]"
                >
                  {capture.encrypted_data ? (
                    <img
                      src={capture.encrypted_data}
                      alt={`Frame ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#252525]">
                      <User size={40} className="text-gray-600" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                    <Eye size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="absolute bottom-2 left-2 right-2">
                    <div className="bg-black/70 backdrop-blur rounded-lg px-2 py-1 flex items-center gap-1.5">
                      <Clock size={10} className="text-gray-400" />
                      <span className="text-[10px] text-gray-300">
                        {new Date(capture.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Full-screen image viewer */}
        {selectedCapture && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setSelectedCapture(null)}
          >
            <div className="max-w-4xl max-h-[90vh] relative" onClick={(e) => e.stopPropagation()}>
              {selectedCapture.encrypted_data ? (
                <img
                  src={selectedCapture.encrypted_data}
                  alt="Captured frame"
                  className="max-w-full max-h-[85vh] object-contain rounded-2xl border border-[#333]"
                />
              ) : (
                <div className="w-96 h-72 bg-[#1A1A1A] rounded-2xl flex items-center justify-center">
                  <User size={64} className="text-gray-600" />
                </div>
              )}
              <button
                onClick={() => setSelectedCapture(null)}
                className="absolute top-4 right-4 w-10 h-10 bg-black/80 rounded-full flex items-center justify-center text-white hover:bg-black transition-colors"
              >
                ✕
              </button>
              <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur rounded-xl px-4 py-2">
                <p className="text-xs text-gray-400">Captured at {new Date(selectedCapture.created_at).toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Face Comparison Preview ─────────────────────────────────────── */}
        {captures.length > 0 && (
          <div className="bg-[#1A1A1A] rounded-2xl border border-[#333] p-6 mb-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 bg-[#FFC000]/10 rounded-xl flex items-center justify-center">
                <GitCompare size={20} className="text-[#FFC000]" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Face Comparison Preview</h2>
                <p className="text-gray-500 text-xs">
                  {refImageUrl
                    ? `Registration photo vs ${captures.length} captured frame${captures.length !== 1 ? 's' : ''}`
                    : captures.length === 1
                    ? 'Single captured frame — checking for face presence'
                    : `Frame 1 used as reference · Use arrows to browse ${captures.length - 1} comparison frame${captures.length > 2 ? 's' : ''}`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
              {/* Reference frame — shipment registration photo (primary) or first call capture (fallback) */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-[#FFC000] inline-block" />
                  <span className="text-xs font-bold text-[#FFC000] uppercase tracking-wider">
                    {refImageUrl ? 'Registration Photo' : 'Reference Frame'}
                  </span>
                </div>
                <div className="relative rounded-2xl overflow-hidden border-2 border-[#FFC000]/30 bg-[#252525] aspect-[4/3] flex items-center justify-center">
                  {(refImageUrl || captures[0]?.encrypted_data) ? (
                    <img
                      src={refImageUrl || captures[0].encrypted_data}
                      alt="Reference"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User size={48} className="text-gray-600" />
                  )}
                  <div className="absolute top-2 left-2 bg-black/70 backdrop-blur rounded-lg px-2 py-1 text-[10px] text-[#FFC000] font-bold">
                    {refImageUrl ? 'REG PHOTO' : 'FRAME 1'}
                  </div>
                  {!refImageUrl && captures[0] && (
                    <div className="absolute bottom-2 left-2 right-2 bg-black/70 backdrop-blur rounded-lg px-2 py-1 text-[10px] text-gray-400 text-center">
                      {new Date(captures[0].created_at).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </div>

              {/* Center VS column */}
              <div className="flex flex-col items-center justify-center gap-3 px-1 min-w-[60px]">
                {/* Animated connector lines */}
                <div className={`flex-1 w-px transition-colors duration-500 ${
                  aiResult
                    ? aiResult.is_match ? 'bg-green-500/60' : 'bg-red-500/60'
                    : 'bg-[#333]'
                }`} />
                <div className={`w-11 h-11 rounded-full border-2 flex items-center justify-center text-xs font-black transition-all duration-500 ${
                  aiResult
                    ? aiResult.is_match
                      ? 'border-green-500 text-green-400 bg-green-500/10 shadow-lg shadow-green-500/20'
                      : 'border-red-500 text-red-400 bg-red-500/10 shadow-lg shadow-red-500/20'
                    : 'border-[#444] text-gray-500 bg-[#252525]'
                }`}>
                  {aiResult
                    ? aiResult.is_match ? '✓' : '✗'
                    : 'VS'}
                </div>
                <div className={`flex-1 w-px transition-colors duration-500 ${
                  aiResult
                    ? aiResult.is_match ? 'bg-green-500/60' : 'bg-red-500/60'
                    : 'bg-[#333]'
                }`} />
              </div>

              {/* Live / comparison frame */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full inline-block transition-colors duration-500 ${
                      aiResult ? (aiResult.is_match ? 'bg-green-400' : 'bg-red-400') : 'bg-blue-400'
                    }`} />
                    <span className={`text-xs font-bold uppercase tracking-wider transition-colors duration-500 ${
                      aiResult ? (aiResult.is_match ? 'text-green-400' : 'text-red-400') : 'text-blue-400'
                    }`}>
                      {captures.length === 0 ? 'No Frames' : 'Captured Frame'}
                    </span>
                  </div>
                  {showNav && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCompareIdx(i => Math.max(liveMin, i - 1))}
                        disabled={effectiveIdx <= liveMin}
                        className="w-6 h-6 rounded-lg bg-[#333] flex items-center justify-center hover:bg-[#444] disabled:opacity-30 transition-all"
                      >
                        <ChevronLeft size={12} />
                      </button>
                      <span className="text-[10px] text-gray-500 font-mono w-8 text-center">
                        {effectiveIdx + (refImageUrl ? 1 : 0)}/{refImageUrl ? captures.length : captures.length - 1}
                      </span>
                      <button
                        onClick={() => setCompareIdx(i => Math.min(liveMax, i + 1))}
                        disabled={effectiveIdx >= liveMax}
                        className="w-6 h-6 rounded-lg bg-[#333] flex items-center justify-center hover:bg-[#444] disabled:opacity-30 transition-all"
                      >
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  )}
                </div>
                <div className={`relative rounded-2xl overflow-hidden border-2 bg-[#252525] aspect-[4/3] flex items-center justify-center transition-all duration-500 ${
                  aiResult
                    ? aiResult.is_match
                      ? 'border-green-500/50 shadow-lg shadow-green-500/10'
                      : 'border-red-500/50 shadow-lg shadow-red-500/10'
                    : 'border-blue-500/30'
                }`}>
                  {captures[effectiveIdx]?.encrypted_data ? (
                    <img
                      src={captures[effectiveIdx].encrypted_data}
                      alt="Comparison"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User size={48} className="text-gray-600" />
                  )}
                  <div className={`absolute top-2 left-2 backdrop-blur rounded-lg px-2 py-1 text-[10px] font-bold transition-colors duration-500 ${
                    aiResult
                      ? aiResult.is_match ? 'bg-green-500/80 text-black' : 'bg-red-500/80 text-white'
                      : 'bg-black/70 text-blue-300'
                  }`}>
                    FRAME {effectiveIdx + 1}
                  </div>
                  {aiResult && (
                    <div className={`absolute bottom-0 inset-x-0 py-2 flex items-center justify-center gap-1.5 text-xs font-bold transition-all duration-500 ${
                      aiResult.is_match
                        ? 'bg-green-500/80 text-black'
                        : 'bg-red-500/80 text-white'
                    }`}>
                      {aiResult.is_match ? <CheckCircle size={12} /> : <XCircle size={12} />}
                      {aiResult.is_match ? 'MATCH' : 'NO MATCH'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* AI score bars — shown inline in comparison panel when result available */}
            {aiResult && (
              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { label: 'Confidence',  value: aiResult.confidence,     icon: <Fingerprint size={13} />, color: aiResult.is_match ? 'bg-green-500' : 'bg-red-500',   glow: aiResult.is_match ? 'shadow-green-500/20' : 'shadow-red-500/20' },
                  { label: 'Similarity',  value: aiResult.avg_similarity,  icon: <GitCompare size={13} />,  color: 'bg-blue-500',    glow: 'shadow-blue-500/20' },
                  { label: 'Liveness',    value: aiResult.avg_liveness,    icon: <Activity size={13} />,    color: 'bg-purple-500',  glow: 'shadow-purple-500/20' },
                ].map(({ label, value, icon, color, glow }) => {
                  const pct = Math.min(100, (value || 0) * 100);
                  return (
                    <div key={label} className={`bg-black rounded-xl p-4 border border-[#333] shadow-lg ${glow}`}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-gray-400">{icon}</span>
                        <span className="text-xs text-gray-500 font-medium flex-1">{label}</span>
                        <span className="text-sm font-bold text-white">{pct.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-[#222] rounded-full overflow-hidden">
                        <div
                          className={`h-full ${color} rounded-full transition-all duration-700 ease-out`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── AI Analysis Panel ────────────────────────────────────────────── */}
        {captures.length > 0 && !verificationDone && (
          <div className="bg-[#1A1A1A] rounded-2xl border border-[#333] p-6 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <Cpu size={22} className="text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">AI Face Analysis</h2>
                  <p className="text-gray-500 text-xs">
                    {refImageUrl
                      ? `Compares registration photo vs ${captures.length} captured frame${captures.length !== 1 ? 's' : ''}`
                      : captures.length === 1
                      ? 'Single frame — checks for face presence'
                      : `Compares ${captures.length} frames for face consistency`}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleRunAI}
                  disabled={aiLoading}
                  className="px-5 py-2.5 bg-purple-500 text-white rounded-xl font-bold text-sm hover:bg-purple-400 transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-purple-500/20"
                >
                  {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                  {aiLoading ? 'Analyzing...' : aiResult ? 'Re-run AI' : 'Run AI Check'}
                </button>
              </div>
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
                {/* Verdict banner */}
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
                  <div className="flex-1">
                    <p className={`font-bold text-lg ${aiResult.is_match ? 'text-green-400' : 'text-red-400'}`}>
                      {aiResult.is_match ? 'AI: Face Consistent — Likely Same Person' : 'AI: Face Inconsistent — Manual Review Recommended'}
                    </p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      Analysed {aiResult.frames_analysed ?? aiResult.frame_count} of {aiResult.frame_count} frame{aiResult.frame_count !== 1 ? 's' : ''}
                      {aiResult.error && ` · ${aiResult.error}`}
                    </p>
                  </div>
                </div>

                {/* Courier recommendation from AI */}
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
                  AI analysis is a decision aid. The final verification decision remains with the courier.
                </p>
              </div>
            )}

            {!aiResult && !aiLoading && !aiError && (
              <p className="text-gray-600 text-sm text-center py-4">
                Click "Run AI Check" to analyse captured frames for face consistency.
                The comparison preview above will update with match/no-match results.
              </p>
            )}
          </div>
        )}

        {/* Verification Actions */}
        {!verificationDone && (
          <div className="bg-[#1A1A1A] rounded-2xl border border-[#333] p-6 mb-6">
            <h2 className="text-lg font-bold mb-2">Verification Decision</h2>
            <p className="text-gray-400 text-sm mb-6">
              Review the captured frames above and decide whether the customer's identity can be verified.
            </p>

            {/* Notes */}
            <div className="mb-6">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={verifyNotes}
                onChange={(e) => setVerifyNotes(e.target.value)}
                rows="2"
                placeholder="Any observations about the verification..."
                className="w-full bg-black border border-[#333] rounded-xl p-3 text-white placeholder-gray-600 focus:border-[#FFC000] focus:outline-none transition-colors resize-none text-sm"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              {/* Verify Button */}
              <button
                onClick={() => handleVerify(true)}
                disabled={actionLoading === 'verify' || captures.length === 0}
                className="flex-1 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 bg-green-500 text-black hover:bg-green-400 transition-all shadow-lg shadow-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === 'verify' ? (
                  <Loader2 size={22} className="animate-spin" />
                ) : (
                  <ShieldCheck size={22} />
                )}
                {actionLoading === 'verify' ? 'Verifying...' : 'Verify Customer'}
              </button>

              {/* Reject Button */}
              {!showRejectConfirm ? (
                <button
                  onClick={() => setShowRejectConfirm(true)}
                  className="flex-1 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-all"
                >
                  <ShieldX size={22} />
                  Cannot Verify
                </button>
              ) : (
                <div className="flex-1 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <p className="text-red-400 text-sm mb-3 font-medium">Are you sure? The customer will need async verification.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleVerify(false)}
                      disabled={actionLoading === 'reject'}
                      className="flex-1 py-2 rounded-lg bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-all disabled:opacity-50"
                    >
                      {actionLoading === 'reject' ? 'Rejecting...' : 'Confirm Reject'}
                    </button>
                    <button
                      onClick={() => setShowRejectConfirm(false)}
                      className="flex-1 py-2 rounded-lg bg-[#333] text-gray-300 font-bold text-sm hover:bg-[#444] transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Verification Result */}
        {verificationDone && verification && (
          <div className={`rounded-2xl border p-6 mb-6 ${
            verification.is_verified
              ? 'bg-green-500/5 border-green-500/20'
              : 'bg-red-500/5 border-red-500/20'
          }`}>
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                verification.is_verified ? 'bg-green-500/20' : 'bg-red-500/20'
              }`}>
                {verification.is_verified ? (
                  <CheckCircle size={28} className="text-green-400" />
                ) : (
                  <XCircle size={28} className="text-red-400" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold">
                  {verification.is_verified ? 'Customer Verified' : 'Verification Failed'}
                </h3>
                <p className="text-gray-400 text-sm">
                  {verification.is_verified
                    ? 'The customer has been verified. They can now choose a delivery option.'
                    : 'The customer could not be verified via video call. Send an async verification link.'}
                </p>
              </div>
            </div>
            {verification.notes && (
              <p className="text-gray-500 text-sm bg-black/50 rounded-xl p-3 mt-2">
                Notes: {verification.notes}
              </p>
            )}
          </div>
        )}

        {/* Send Async Verification Link — shown after rejection */}
        {verificationDone && verification && !verification.is_verified && !linkSent && (
          <div className="bg-[#1A1A1A] rounded-2xl border border-[#333] p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <Link2 size={22} className="text-purple-400" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Send Async Verification Link</h3>
                <p className="text-gray-400 text-sm">
                  Send a link to the customer to record a video and voice sample for AI verification
                </p>
              </div>
            </div>
            <button
              onClick={handleSendLink}
              disabled={actionLoading === 'link'}
              className="w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 bg-purple-500 text-white hover:bg-purple-400 transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50"
            >
              {actionLoading === 'link' ? (
                <Loader2 size={22} className="animate-spin" />
              ) : (
                <Send size={22} />
              )}
              {actionLoading === 'link' ? 'Sending...' : 'Send Verification Link to Customer'}
            </button>
          </div>
        )}

        {/* Link Sent Confirmation */}
        {linkSent && (
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-6 mb-6 text-center">
            <CheckCircle size={48} className="text-purple-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Verification Link Sent</h3>
            <p className="text-gray-400 text-sm mb-4">
              The customer will receive a notification to complete async verification.
              They'll need to record a video and provide a voice sample for AI comparison.
            </p>
            <p className="text-gray-600 text-xs">
              You'll be notified once the customer completes the verification.
            </p>
          </div>
        )}

        {/* Back Button */}
        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/order/${data.shipment_id}`)}
            className="px-6 py-3 bg-[#FFC000] text-black rounded-xl font-bold text-sm hover:bg-[#e6ad00] transition-colors"
          >
            View Shipment
          </button>
        </div>
      </div>

    </div>
  );
};

export default VerificationDashboard;
