import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, CheckCircle, XCircle, Shield, AlertTriangle, ArrowRight, Volume2, RefreshCw } from 'lucide-react';
import { getEnrollmentStatus, startEnrollment, submitEnrollmentSample, resetVoiceProfile } from '../services/api';

// ─────────────────────────────────────────────────────────────
//  SINHALA SENTENCES POOL
//  Each sentence is ~15 seconds of natural speech at a moderate pace.
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
//  SINHALA SENTENCES POOL
//
//  Target: ~15 seconds of natural speech per sentence.
//  Sinhala average pace ≈ 120–140 words/min → need ~30–35 words.
//  Each sentence below has been written to hit that range.
// ─────────────────────────────────────────────────────────────
export const SINHALA_SENTENCES = [
    {
    // ~34 words
    si: 'අද උදෑසන ආරම්භ කළ වැඩ කටයුතු මධ්‍යහනය වනවිට සාර්ථකව අවසන් කළ හැකි බව මා විශ්වාස කරමි. අවශ්‍ය සියලු තොරතුරු නිවැරදිව සකස් කර ඇති බැවින් වැඩ කටයුතු ඉතා සුමටව සිදු වේ.',
    translit: 'Ada udæsana ārambha kaḷa væḍa kaṭayuthu madhyahanya vanavita sārthakava avasan kaḷa hæki bava mā viśvāsa karami. Avaśya siyalu thorathuru niværadivā sakas kara æti bævin væḍa kaṭayuthu itā sumaṭava sidu vē.',
  },
  {
    // ~33 words
    si: 'පරිගණක පද්ධතිය නිවැරදිව ක්‍රියාත්මක වන බව තහවුරු කිරීම සඳහා මම සෑම දිනකම පරීක්ෂා කරමි. කිසියම් දෝෂයක් හඳුනා ගන්නේ නම් එය වහාම නිවැරදි කිරීමට කටයුතු කරමි.',
    translit: 'Parigaṇaka paddhathiya niværadivā kriyāthmaka vana bava thahavuru kirīma sandahā mama sæma dinakama parīkṣā karami. Kisiyam dōṣayak haḍunā gannē nam eya vahāma niværadi kirīmata kaṭayuthu karami.',
  },
  {
    // ~35 words
    si: 'සවස වෙලාවට නිවසට පැමිණෙන විට, අද දිනයේ සිදු කළ සියලු කාර්යයන් පිළිබඳව සමාලෝචනය කිරීම මට පුරුද්දක් වී ඇත. මෙය ඉදිරි දිනවල වැඩ සැලසුම් කිරීමට උපකාරී වේ.',
    translit: 'Savas velāvata nivasata pæmiṇena viṭa, ada dinayē sidu kaḷa siyalu kāryayan piḷibandava samālōchanaya kirīma mata puruddak vī æta. Meya idirī dinavala væḍa sælasum kirīmata upakārī vē.',
  },
  {
    // ~34 words
    si: 'මෙම සේවාව භාවිතා කිරීමෙන් කාලය ඉතිරි කර ගත හැකි අතර, වැඩ කටයුතු ඉතා කාර්යක්ෂම ලෙස කළ හැක. ඔබට අවශ්‍ය ඕනෑම වෙලාවක පහසුවෙන් ප්‍රවේශ විය හැකි වේ.',
    translit: 'Mema sēvāva bhāvithā kirīmen kālaya ithiri kara gatha hæki athara, væḍa kaṭayuthu itā kāryakṣhama lesa kaḷa hæka. Obaṭa avaśya ōnæma velāvak pahasuven pravēśa viya hæki vē.',
  },
  {
    // ~33 words
    si: 'හෙට දිනට සැලසුම් කර ඇති වැඩසටහන සඳහා අවශ්‍ය සියලු සම්පත් සකස් කර ඇත. කණ්ඩායමේ සියලු සාමාජිකයන් සමඟ සම්බන්ධ වී ඒවා නිවැරදිව ක්‍රියාත්මක කිරීම වැදගත් වේ.',
    translit: 'Heṭa dinata sælasum kara æti væḍasaṭahana sandahā avaśya siyalu sampath sakas kara æta. Kaṇḍāyame siyalu sāmājikayan samaṅa sambandha vī ēvā niværadivā kriyāthmaka kirīma vædagath vē.',
  },
  {
    // ~35 words
    si: 'මගේ දිනචරියාව තුළ නියමිත වේලාවට කටයුතු කිරීම මට ඉතා වැදගත් වේ. එමඟින් වැඩ කාර්යක්ෂමතාව වැඩි වන අතර, මාගේ ඉලක්ක සාර්ථකව ලබා ගැනීමට හැකි වේ.',
    translit: 'Magē dinachariyāva thuḷa niyamitha velāvata kaṭayuthu kirīma mata itā vædagath vē. Emagin væḍa kāryakṣhamathā væḍi vana athara, māgē ilakka sārthakava labā gæṇīmata hæki vē.',
  },
  {
    // ~34 words
    si: 'ඔබ ලබා දෙන තොරතුරු නිවැරදිව සහ පැහැදිලිව ඇතුළත් කිරීම ඉතා වැදගත් ය. එවිට ක්‍රියාවලිය කඩිනමින් සහ ගැටළු රහිතව ඉදිරියට ගෙන යා හැකි වේ.',
    translit: 'Oba labā dena thorathuru niværadivā saha pæhædilivā ætuḷath kirīma itā vædagath ya. Evita kriyāvaliya kaḍinamīn saha gæṭaḷu rahithava idiriyata gena yā hæki vē.',
  },
  {
    // ~33 words
    si: 'නව තාක්ෂණික විසඳුම් භාවිතා කිරීමෙන් අපගේ දෛනික වැඩ කටයුතු ඉතා පහසු වේ. එමඟින් කාලය ඉතිරි වන අතර, නිෂ්පාදන හැකියාව ද සැලකිය යුතු ලෙස ඉහළ යයි.',
    translit: 'Nava thākṣhaṇika visadum bhāvithā kirīmen apagē dainika væḍa kaṭayuthu itā pahasu vē. Emagin kālaya ithiri vana athara, niṣpādana hækiyāva da sælakiyā yuthu lesa ihaḷa yai.',
  },
  {
    // ~35 words
    si: 'පරිශීලකයාගේ අවශ්‍යතා අනුව සේවාව අභිරුචිකරණය කිරීම ඉතා වැදගත් වේ. එමඟින් හොඳ අත්දැකීමක් ලබා දීමට හැකි වන අතර, භාවිතය තවත් පහසු වේ.',
    translit: 'Pariśīlakayāgē avaśyathā anuva sēvāva abhiruchikaraṇaya kirīma itā vædagath vē. Emagin hoṇḍa athdækīmaka labā dīmata hæki vana athara, bhāvithaya thawath pahasu vē.',
  },
  {
    // ~34 words
    si: 'කණ්ඩායම් ලෙස එක්ව වැඩ කිරීමෙන් අපට වැඩි සාර්ථකත්වයක් ලබා ගත හැකි වේ. එකිනෙකාගේ අදහස් ගෞරවයෙන් පිළිගැනීම මඟින් හොඳ ප්‍රතිඵල ලබා ගැනීමට හැකි වේ.',
    translit: 'Kaṇḍāyam lesa ekva væḍa kirīmen apata væḍi sārthakathvayak labā gatha hæki vē. Ekinēkāgē adahas gauravayen piḷigæṇīma magin hoṇḍa prathiphala labā gæṇīmata hæki vē.',
  },
];

const MAX_RECORD_SECONDS = 15;
const CIRCUMFERENCE = 2 * Math.PI * 28; // r = 28 → ≈ 175.93

// Pick a random index, optionally excluding one
function pickRandom(excludeIndex = -1) {
  const pool = SINHALA_SENTENCES.map((_, i) => i).filter(i => i !== excludeIndex);
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─────────────────────────────────────────────────────────────
//  Countdown Ring
// ─────────────────────────────────────────────────────────────
function CountdownRing({ secondsLeft, total }) {
  const fraction = secondsLeft / total;
  const offset = CIRCUMFERENCE * (1 - fraction);
  const isCritical = secondsLeft <= 5;
  const isUrgent = secondsLeft <= 8 && !isCritical;
  const stroke = isCritical ? '#ff3b30' : isUrgent ? '#ff9500' : '#FFC000';
  const textColor = isCritical ? 'text-red-400' : isUrgent ? 'text-orange-400' : 'text-[#FFC000]';

  return (
    <div className="flex flex-col items-center gap-1 mb-5">
      <div className="relative w-16 h-16">
        <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="32" cy="32" r="28" fill="none" stroke="#333" strokeWidth="4" />
          <circle
            cx="32" cy="32" r="28"
            fill="none"
            stroke={stroke}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
          />
        </svg>
        <div className={`absolute inset-0 flex items-center justify-center text-lg font-bold ${textColor}`}>
          {secondsLeft}
        </div>
      </div>
      <p className="text-xs text-gray-500">
        {isCritical ? 'almost done!' : 'seconds remaining'}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Sinhala Prompt Card
// ─────────────────────────────────────────────────────────────
function SinhalaPromptCard({ sentence, onRefresh, isRecording, disabled }) {
  return (
    <div className={`rounded-xl p-4 border mb-6 transition-all duration-300 ${
      isRecording
        ? 'bg-red-500/5 border-red-500/30'
        : 'bg-[#FFC000]/5 border-[#FFC000]/20'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-bold uppercase tracking-wider ${
          isRecording ? 'text-red-400' : 'text-[#FFC000]'
        }`}>
          {isRecording ? '🎤 Read aloud now' : '🇱🇰 Read this sentence aloud'}
        </span>
        {!isRecording && (
          <button
            onClick={onRefresh}
            disabled={disabled}
            title="Get a different sentence"
            className="p-1 rounded text-gray-500 hover:text-[#FFC000] hover:bg-[#FFC000]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw size={14} />
          </button>
        )}
      </div>
      <p
        className="text-white text-lg font-semibold leading-relaxed mb-1"
        style={{ fontFamily: "'Iskoola Pota', 'Noto Sans Sinhala', sans-serif" }}
      >
        {sentence.si}
      </p>
      <p className="text-gray-500 text-xs italic leading-relaxed">{sentence.translit}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Main Component
// ─────────────────────────────────────────────────────────────
const VoiceEnrollment = () => {
  const navigate = useNavigate();

  const [status, setStatus] = useState(null);
  const [enrollmentId, setEnrollmentId] = useState(null);
  const [verifiedSamples, setVerifiedSamples] = useState(0);
  const [requiredSamples, setRequiredSamples] = useState(3);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);

  // Sinhala sentence — seeded once; refreshed after each accepted sample
  const [sentenceIndex, setSentenceIndex] = useState(() => pickRandom());
  // Track used indices to avoid repeats within a session
  const usedIndicesRef = useRef([]);

  // Countdown
  const [secondsLeft, setSecondsLeft] = useState(MAX_RECORD_SECONDS);
  const countdownRef = useRef(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  // ── Status check ───────────────────────────────────────────
  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const res = await getEnrollmentStatus();
      const data = res.data;
      setEnrolled(data.enrolled);
      if (data.enrolled) {
        setStatus('completed');
        setVerifiedSamples(data.verified_samples);
        setRequiredSamples(data.required_samples);
      } else if (data.status === 'pending') {
        setStatus('pending');
        setEnrollmentId(data.enrollment_id);
        setVerifiedSamples(data.verified_samples);
        setRequiredSamples(data.required_samples);
      }
    } catch (err) {
      if (err.response?.status === 401) navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  // ── Countdown helpers ──────────────────────────────────────
  const startCountdown = useCallback(() => {
    setSecondsLeft(MAX_RECORD_SECONDS);
    countdownRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
          if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const stopCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setSecondsLeft(MAX_RECORD_SECONDS);
  }, []);

  useEffect(() => () => stopCountdown(), [stopCountdown]);

  // ── Sentence helpers ───────────────────────────────────────
  const handleRefreshSentence = () => {
    setSentenceIndex(prev => pickRandom(prev));
  };

  const advanceSentence = () => {
    setSentenceIndex(prev => {
      usedIndicesRef.current.push(prev);
      // Build pool excluding all recently used (keep last 3 used excluded)
      const recentlyUsed = usedIndicesRef.current.slice(-3);
      const pool = SINHALA_SENTENCES
        .map((_, i) => i)
        .filter(i => !recentlyUsed.includes(i));
      // If pool is exhausted, fall back to just excluding current
      const next = pool.length > 0
        ? pool[Math.floor(Math.random() * pool.length)]
        : pickRandom(prev);
      return next;
    });
  };

  // ── Enrollment actions ─────────────────────────────────────
  const handleStartEnrollment = async () => {
    setMessage('');
    usedIndicesRef.current = [];
    setSentenceIndex(pickRandom());
    try {
      const res = await startEnrollment();
      setEnrollmentId(res.data.enrollment_id);
      setVerifiedSamples(0);
      setRequiredSamples(res.data.required_samples);
      setStatus('pending');
      setEnrolled(false);
      setMessage('Enrollment started! Read the Sinhala sentence aloud for your first sample.');
      setMessageType('info');
    } catch (err) {
      setMessage(err.response?.data?.detail || 'Failed to start enrollment');
      setMessageType('error');
    }
  };

  const handleReEnroll = async () => {
    if (!window.confirm('This will replace your current voice profile. You will need to submit 3 new voice samples. Continue?')) return;
    try {
      await resetVoiceProfile();
    } catch (err) {
      if (err.response?.status !== 400) {
        setMessage(err.response?.data?.detail || 'Failed to reset voice profile');
        setMessageType('error');
        return;
      }
    }
    setEnrolled(false);
    setStatus(null);
    setVerifiedSamples(0);
    setMessage('');
    await handleStartEnrollment();
  };

  // ── Recording ─────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        stopCountdown();
        setIsRecording(false);
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await submitSample(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setMessage('');
      startCountdown();
    } catch {
      setMessage('Microphone access denied. Please allow microphone access.');
      setMessageType('error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    stopCountdown();
    setIsRecording(false);
  };

  // ── Submit sample ──────────────────────────────────────────
  const submitSample = async (audioBlob) => {
    setIsProcessing(true);
    setMessage('Analyzing voice sample… This may take a moment.');
    setMessageType('info');

    try {
      const file = new File([audioBlob], 'voice_sample.webm', { type: 'audio/webm' });
      const res = await submitEnrollmentSample(enrollmentId, file);
      const data = res.data;

      setVerifiedSamples(data.verified_samples);

      if (data.enrollment_complete) {
        setEnrolled(true);
        setStatus('completed');
        setMessage('Voice enrollment completed successfully! You can now use voice verification for deliveries.');
        setMessageType('success');
      } else {
        setMessage(data.message);
        setMessageType('success');
        // Load a fresh sentence for the next sample
        advanceSentence();
      }
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to process voice sample';
      setMessage(detail);
      setMessageType('error');
      if (detail.includes('denied') || detail.includes('Enrollment')) {
        setStatus(null);
        setEnrollmentId(null);
        setVerifiedSamples(0);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-400">Loading…</div>
      </div>
    );
  }

  const currentSentence = SINHALA_SENTENCES[sentenceIndex];

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 font-sans selection:bg-[#FFC000] selection:text-black">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-[#FFC000] rounded-xl text-black">
              <Shield size={28} strokeWidth={2.5} />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Voice Authentication</h1>
          </div>
          <p className="text-gray-400">Secure your deliveries with AI-powered voice verification.</p>
        </div>

        {/* ── Already Enrolled ── */}
        {enrolled && (
          <div className="bg-[#1A1A1A] rounded-2xl p-8 border border-green-500/30">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-green-500/10 rounded-xl">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Voice Enrolled</h2>
                <p className="text-gray-400 text-sm">Your voice profile is active and ready for delivery verification.</p>
              </div>
            </div>
            <div className="bg-black/40 rounded-xl p-4 border border-[#333333]">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Voice Samples</span>
                <span className="text-green-400 font-bold">{verifiedSamples}/{requiredSamples} verified</span>
              </div>
              <div className="mt-2 h-2 bg-black rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="mt-6 w-full py-3 bg-[#FFC000] text-black font-bold rounded-xl hover:bg-[#E5AC00] transition-colors flex items-center justify-center gap-2"
            >
              Back to Dashboard <ArrowRight size={18} />
            </button>
            <button
              onClick={handleReEnroll}
              className="mt-3 w-full py-3 bg-[#333333] text-gray-300 font-bold rounded-xl hover:bg-[#444444] transition-colors text-sm"
            >
              Re-enroll Voice Profile
            </button>
          </div>
        )}

        {/* ── Not Started ── */}
        {!enrolled && !status && (
          <div className="bg-[#1A1A1A] rounded-2xl p-8 border border-[#333333]">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-[#FFC000]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Volume2 className="w-10 h-10 text-[#FFC000]" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Enroll Your Voice</h2>
              <p className="text-gray-400 max-w-md mx-auto">
                Register your voice to enable secure delivery verification. You'll need to provide{' '}
                <strong className="text-white">3 voice samples</strong> to complete enrollment.
              </p>
            </div>

            <div className="space-y-4 mb-8">
              {[
                'Each voice sample is checked by AI to ensure it is a real human voice',
                'AI-generated or synthetic voices will be immediately rejected',
                'All 3 samples must come from the same speaker',
                'Read the displayed Sinhala sentence aloud for each sample (≈15 seconds)',
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-3 text-sm text-gray-300 bg-black/30 p-3 rounded-xl border border-[#333333]">
                  <CheckCircle className="w-5 h-5 text-[#FFC000] flex-shrink-0 mt-0.5" />
                  <span>{text}</span>
                </div>
              ))}
            </div>

            <button
              onClick={handleStartEnrollment}
              className="w-full py-4 bg-[#FFC000] text-black font-bold rounded-xl hover:bg-[#E5AC00] transition-colors text-lg shadow-lg shadow-[#FFC000]/20"
            >
              Start Enrollment
            </button>
          </div>
        )}

        {/* ── Enrollment In Progress ── */}
        {!enrolled && status === 'pending' && (
          <div className="space-y-6">

            {/* Progress bars */}
            <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-[#333333]">
              <h2 className="text-lg font-bold mb-4">Enrollment Progress</h2>
              <div className="flex items-center gap-4 mb-3">
                {[1, 2, 3].map((s) => (
                  <div key={s} className="flex-1">
                    <div className={`h-3 rounded-full transition-all ${
                      s <= verifiedSamples
                        ? 'bg-green-500'
                        : s === verifiedSamples + 1
                        ? 'bg-[#FFC000] animate-pulse'
                        : 'bg-[#333333]'
                    }`} />
                    <p className={`text-xs mt-1 text-center ${
                      s <= verifiedSamples ? 'text-green-400' : 'text-gray-500'
                    }`}>
                      Sample {s} {s <= verifiedSamples ? '✓' : ''}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-400 text-center">
                {verifiedSamples}/{requiredSamples} samples verified
              </p>
            </div>

            {/* Recording area */}
            <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-[#333333]">
              <h3 className="text-lg font-bold mb-1 text-center">
                Record Voice Sample {verifiedSamples + 1}
              </h3>
              <p className="text-gray-400 text-sm text-center mb-5">
                Tap the mic, then read the sentence below. Recording stops automatically after {MAX_RECORD_SECONDS} seconds.
              </p>

              {/* Sinhala sentence prompt */}
              <SinhalaPromptCard
                sentence={currentSentence}
                onRefresh={handleRefreshSentence}
                isRecording={isRecording}
                disabled={isProcessing}
              />

              {/* Countdown ring — only while recording */}
              {isRecording && (
                <CountdownRing secondsLeft={secondsLeft} total={MAX_RECORD_SECONDS} />
              )}

              {/* Mic button */}
              <div className="flex justify-center">
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isProcessing}
                  className={`w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-2xl ${
                    isRecording
                      ? 'bg-red-500 hover:bg-red-600 animate-pulse shadow-red-500/30'
                      : isProcessing
                      ? 'bg-gray-700 cursor-not-allowed'
                      : 'bg-[#FFC000] hover:bg-[#E5AC00] shadow-[#FFC000]/20 hover:scale-105'
                  }`}
                >
                  {isProcessing ? (
                    <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
                  ) : isRecording ? (
                    <MicOff className="w-10 h-10 text-white" />
                  ) : (
                    <Mic className="w-10 h-10 text-black" />
                  )}
                </button>
              </div>

              <p className="mt-4 text-sm font-medium text-center">
                {isProcessing ? (
                  <span className="text-[#FFC000]">Analyzing…</span>
                ) : isRecording ? (
                  <span className="text-red-400">Recording — tap to stop</span>
                ) : (
                  <span className="text-gray-400">Tap to start recording</span>
                )}
              </p>
            </div>

            {/* Message */}
            {message && (
              <div className={`rounded-xl p-4 border flex items-start gap-3 ${
                messageType === 'success'
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : messageType === 'error'
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-[#FFC000]/10 border-[#FFC000]/30 text-[#FFC000]'
              }`}>
                {messageType === 'success' ? (
                  <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                ) : messageType === 'error' ? (
                  <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                <span className="text-sm">{message}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceEnrollment;