import React, { useEffect } from 'react';
import { Mic, MicOff, X, ExternalLink } from 'lucide-react';
import { useLiveAPI } from '../hooks/useLiveAPI';

const speakingKeyframes = `
@keyframes pulse-ring {
  0%   { transform: scale(1);   opacity: 0.6; }
  70%  { transform: scale(1.5); opacity: 0; }
  100% { transform: scale(1.5); opacity: 0; }
}
@keyframes pulse-ring-2 {
  0%   { transform: scale(1);   opacity: 0.4; }
  70%  { transform: scale(1.8); opacity: 0; }
  100% { transform: scale(1.8); opacity: 0; }
}
@keyframes pulse-core {
  0%   { box-shadow: 0 0 0 0 rgba(255,192,0,0.5); }
  70%  { box-shadow: 0 0 0 18px rgba(255,192,0,0); }
  100% { box-shadow: 0 0 0 0 rgba(255,192,0,0); }
}
`;

const VoiceAssistant = () => {
  const { isConnected, isSpeaking, connect, disconnect, status, notification, clearNotification } = useLiveAPI();

  // Auto-dismiss notification after 15 seconds
  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => clearNotification(), 15000);
      return () => clearTimeout(t);
    }
  }, [notification, clearNotification]);

  return (
    <div className="min-h-screen bg-black pt-24 pb-12 px-4 flex items-start justify-center">
      {/* WhatsApp Registration Link Toast */}
      {notification?.type === 'registration_link' && (
        <div className="fixed top-6 right-6 z-50 w-96 bg-[#1A1A1A] border border-[#25D366] rounded-2xl shadow-2xl p-5 animate-[slideIn_0.3s_ease-out]">
          <style>{`@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📱</span>
              <h3 className="text-white font-bold text-sm">Registration Link Ready</h3>
            </div>
            <button onClick={clearNotification} className="text-gray-500 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
          <p className="text-gray-400 text-xs mb-3">
            Phone: <span className="text-white font-mono">{notification.phone}</span>
          </p>
          <div className="flex gap-2">
            <a
              href={notification.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] text-white text-sm font-bold py-2.5 px-4 rounded-xl hover:bg-[#20bd5a] transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.613.613l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.315 0-4.458-.768-6.178-2.064l-.43-.334-2.665.893.893-2.665-.334-.43A9.955 9.955 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
              Send via WhatsApp
            </a>
            <a
              href={notification.registrationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 bg-[#FFC000] text-black text-sm font-bold py-2.5 px-4 rounded-xl hover:bg-[#E5AC00] transition-colors"
            >
              <ExternalLink size={14} />
              Open
            </a>
          </div>
        </div>
      )}
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-[#111111] border border-[#222222] rounded-3xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="bg-linear-to-br from-[#FFC000] to-[#E5AC00] p-8 text-center">
            <h1 className="text-2xl font-bold text-black">Smart Postal Assistant</h1>
            <p className="text-sm text-black/60 mt-1">Real-time Voice Tracking (Sinhala)</p>
            <div className="mt-4">
              <span
                className={`inline-block px-4 py-1 rounded-full text-xs font-bold ${
                  isConnected
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {isConnected ? '🟢 Live' : '🔴 Standby'}
              </span>
            </div>
          </div>

          {/* Body */}
          <div className="p-10 flex flex-col items-center">
            <style>{speakingKeyframes}</style>
            {/* Mic Button with speaking animation */}
            <div className="relative flex items-center justify-center" style={{ width: 180, height: 180 }}>
              {/* Pulse rings — only when speaking */}
              {isSpeaking && (
                <>
                  <span
                    className="absolute rounded-full"
                    style={{
                      width: 128, height: 128,
                      border: '2px solid #FFC000',
                      animation: 'pulse-ring 1.4s cubic-bezier(0.215,0.61,0.355,1) infinite',
                    }}
                  />
                  <span
                    className="absolute rounded-full"
                    style={{
                      width: 128, height: 128,
                      border: '2px solid #FFC000',
                      animation: 'pulse-ring-2 1.4s cubic-bezier(0.215,0.61,0.355,1) 0.4s infinite',
                    }}
                  />
                </>
              )}
              <button
                onClick={isConnected ? disconnect : connect}
                className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 ${
                  isConnected
                    ? 'bg-[#FFC000]/20 shadow-[0_0_32px_rgba(255,192,0,0.35)] hover:bg-[#FFC000]/30'
                    : 'bg-[#1A1A1A] hover:bg-[#222222]'
                }`}
                style={isSpeaking ? { animation: 'pulse-core 1.4s infinite' } : {}}
              >
                {isConnected ? (
                  <Mic size={52} className="text-[#FFC000]" />
                ) : (
                  <MicOff size={52} className="text-gray-500" />
                )}
              </button>
            </div>

            <p className="mt-7 text-gray-400 font-medium text-center text-sm">
              {status || (isConnected ? 'Tap to stop listening' : 'Tap to speak in Sinhala')}
            </p>

            {/* Help Text */}
            <div className="mt-8 w-full bg-[#1A1A1A] border border-[#333333] rounded-2xl p-5">
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-3">
                What you can ask
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>📦 Track a parcel — &quot;TRK 1001 එකේ status එක දෙන්නද?&quot;</li>
                <li>💰 Shipping rates — &quot;කොළඹ ඉඳන් කුරුණෑගල කිලෝ 2&quot;</li>
                <li>📅 Reschedule — &quot;TRK 1002 එක හෙට දිනට වෙනස් කරන්න&quot;</li>
                <li>📝 Register — &quot;ලියාපදිංචි වෙන්නේ කොහොමද?&quot;</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceAssistant;
