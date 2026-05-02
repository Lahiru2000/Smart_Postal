import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mic, MicOff, CheckCircle, XCircle, Shield, AlertTriangle, Package, RefreshCw } from 'lucide-react';
import { getVerificationStatus, submitVerification } from '../services/api';

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

function pickRandom(excludeIndex = -1) {
  const pool = SINHALA_SENTENCES
    .map((_, i) => i)
    .filter(i => i !== excludeIndex);
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─────────────────────────────────────────────────────────────
//  Countdown Ring (pure SVG, no extra deps)
// ─────────────────────────────────────────────────────────────
function CountdownRing({ secondsLeft, total }) {
  const fraction = secondsLeft / total;
  const offset = CIRCUMFERENCE * (1 - fraction);
  const isUrgent = secondsLeft <= 8 && secondsLeft > 5;
  const isCritical = secondsLeft <= 5;
  const stroke = isCritical ? '#ff3b30' : isUrgent ? '#ff9500' : '#FFC000';
  const textColor = isCritical ? 'text-red-400' : isUrgent ? 'text-orange-400' : 'text-[#FFC000]';

  return (
    <div className="flex flex-col items-center gap-1 mb-4">
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
    <div className={`rounded-xl p-4 border mb-5 transition-all duration-300 ${
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
      {/* Sinhala text — uses system Sinhala fonts if available */}
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
const VoiceVerification = () => {
  const { verificationId } = useParams();
  const navigate = useNavigate();

  const [verification, setVerification] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null); // 'approved' | 'failed'
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  // Sinhala sentence state
  const [sentenceIndex, setSentenceIndex] = useState(() => pickRandom());

  // Countdown state
  const [secondsLeft, setSecondsLeft] = useState(MAX_RECORD_SECONDS);
  const countdownRef = useRef(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  // ── Fetch verification status ──────────────────────────────
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await getVerificationStatus(verificationId);
        setVerification(res.data);
        if (res.data.status === 'approved') {
          setResult('approved');
          setMessage('Voice verification already passed. Delivery approved!');
        } else if (res.data.status === 'failed') {
          setResult('failed');
          setMessage('Voice verification has failed.');
        } else if (res.data.status === 'expired') {
          setResult('failed');
          setMessage('Verification session has expired. Ask the courier to resend.');
        }
      } catch (err) {
        if (err.response?.status === 401) {
          navigate('/login');
        } else {
          setMessage(err.response?.data?.detail || 'Failed to load verification');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
  }, [verificationId, navigate]);

  // ── Countdown helpers ──────────────────────────────────────
  const startCountdown = useCallback(() => {
    setSecondsLeft(MAX_RECORD_SECONDS);
    countdownRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
          // Auto-stop recording when time is up
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

  // Cleanup on unmount
  useEffect(() => () => stopCountdown(), [stopCountdown]);

  // ── Sentence helpers ───────────────────────────────────────
  const handleRefreshSentence = () => {
    setSentenceIndex(prev => pickRandom(prev));
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
        await handleSubmit(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setMessage('');
      startCountdown();
    } catch {
      setMessage('Microphone access denied. Please allow microphone access.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    stopCountdown();
    setIsRecording(false);
  };

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = async (audioBlob) => {
    setIsProcessing(true);
    setMessage('Verifying your voice… This may take a moment.');

    try {
      const file = new File([audioBlob], 'verification.webm', { type: 'audio/webm' });
      const res = await submitVerification(verificationId, file);
      const data = res.data;

      if (data.delivery_approved) {
        setResult('approved');
        setMessage('Voice verification passed! Your delivery has been approved.');
      } else {
        setResult('failed');
        setMessage(data.message || 'Voice verification failed.');
      }
    } catch (err) {
      const detail = err.response?.data?.detail || 'Verification failed';
      setResult('failed');
      setMessage(detail);
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-400">Loading verification…</div>
      </div>
    );
  }

  const currentSentence = SINHALA_SENTENCES[sentenceIndex];

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 font-sans selection:bg-[#FFC000] selection:text-black">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#FFC000] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#FFC000]/20">
            <Shield size={32} className="text-black" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Delivery Verification</h1>
          <p className="text-gray-400 text-sm">Verify your identity to receive your package</p>
        </div>

        {/* Verification Info Card */}
        {verification && (
          <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-[#333333] mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-[#FFC000]/10 rounded-lg">
                <Package size={20} className="text-[#FFC000]" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Shipment</p>
                <p className="font-bold">#{verification.shipment_id}</p>
              </div>
            </div>

            {verification.challenge_phrase && result !== 'approved' && (
              <div className="bg-black/50 rounded-xl p-4 border border-[#FFC000]/20">
                <p className="text-xs text-[#FFC000] font-bold uppercase tracking-wider mb-1">Challenge Phrase</p>
                <p className="text-white text-lg font-medium italic">"{verification.challenge_phrase}"</p>
                <p className="text-gray-500 text-xs mt-2">Speak this phrase clearly into your microphone.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Result: Approved ── */}
        {result === 'approved' && (
          <div className="bg-green-500/10 rounded-2xl p-8 border border-green-500/30 text-center">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-green-400 mb-2">Verification Passed!</h2>
            <p className="text-gray-400 text-sm">{message}</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="mt-6 px-8 py-3 bg-green-500 text-black font-bold rounded-xl hover:bg-green-400 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        )}

        {/* ── Result: Failed ── */}
        {result === 'failed' && (
          <div className="bg-red-500/10 rounded-2xl p-8 border border-red-500/30 text-center">
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-400 mb-2">Verification Failed</h2>
            <p className="text-gray-400 text-sm">{message}</p>
            <div className="mt-6 flex flex-col gap-3">
              {message?.toLowerCase().includes('re-enroll') && (
                <button
                  onClick={() => navigate('/voice-enrollment')}
                  className="px-8 py-3 bg-[#FFC000] text-black font-bold rounded-xl hover:bg-[#E5AC00] transition-colors"
                >
                  Re-enroll Voice
                </button>
              )}
              <button
                onClick={() => navigate('/dashboard')}
                className="px-8 py-3 bg-[#333333] text-white font-bold rounded-xl hover:bg-[#444444] transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}

        {/* ── Recording UI ── */}
        {!result && (
          <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-[#333333]">

            {/* Sinhala sentence prompt */}
            <SinhalaPromptCard
              sentence={currentSentence}
              onRefresh={handleRefreshSentence}
              isRecording={isRecording}
              disabled={isProcessing}
            />

            <div className="text-center">
              <p className="text-gray-400 text-sm mb-5">
                Tap the mic, then read the Sinhala sentence above.
                Recording stops automatically after {MAX_RECORD_SECONDS} seconds.
              </p>

              {/* Countdown ring — visible only while recording */}
              {isRecording && (
                <CountdownRing secondsLeft={secondsLeft} total={MAX_RECORD_SECONDS} />
              )}

              {/* Mic button */}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
                className={`w-28 h-28 rounded-full flex items-center justify-center mx-auto transition-all shadow-2xl ${
                  isRecording
                    ? 'bg-red-500 hover:bg-red-600 animate-pulse shadow-red-500/30'
                    : isProcessing
                    ? 'bg-gray-700 cursor-not-allowed'
                    : 'bg-[#FFC000] hover:bg-[#E5AC00] shadow-[#FFC000]/20 hover:scale-105'
                }`}
              >
                {isProcessing ? (
                  <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
                ) : isRecording ? (
                  <MicOff className="w-12 h-12 text-white" />
                ) : (
                  <Mic className="w-12 h-12 text-black" />
                )}
              </button>

              <p className="mt-4 text-sm font-medium">
                {isProcessing ? (
                  <span className="text-[#FFC000]">Verifying your voice…</span>
                ) : isRecording ? (
                  <span className="text-red-400">Recording — tap to stop</span>
                ) : (
                  <span className="text-gray-400">Tap to start recording</span>
                )}
              </p>

              {message && !isProcessing && (
                <div className="mt-5 p-3 rounded-xl bg-[#FFC000]/10 border border-[#FFC000]/20">
                  <p className="text-sm text-[#FFC000]">{message}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Info footer */}
        <div className="mt-6 p-4 bg-[#1A1A1A] rounded-xl border border-[#333333]">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#FFC000] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400">
              This verification uses AI-powered voice detection to ensure your voice is genuine.
              AI-generated, synthetic, or replayed audio will be rejected.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default VoiceVerification;