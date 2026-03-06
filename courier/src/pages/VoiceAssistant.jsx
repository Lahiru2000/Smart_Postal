import React from 'react';
import { Mic, MicOff } from 'lucide-react';
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
  const { isConnected, isSpeaking, connect, disconnect, status } = useLiveAPI();

  return (
    <div className="min-h-screen bg-black pt-24 pb-12 px-4 flex items-start justify-center">
      <div className="w-full max-w-md">
        <div className="bg-[#111111] border border-[#222222] rounded-3xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="bg-linear-to-br from-[#FFC000] to-[#E5AC00] p-8 text-center">
            <h1 className="text-2xl font-bold text-black">Smart Postal Assistant</h1>
            <p className="text-sm text-black/60 mt-1">Real-time Voice Tracking (Sinhala)</p>
            <div className="mt-4">
              <span
                className={`inline-block px-4 py-1 rounded-full text-xs font-bold ${
                  isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
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

            <div className="mt-8 w-full bg-[#1A1A1A] border border-[#333333] rounded-2xl p-5">
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-3">
                What you can ask
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>📦 Track a parcel — &quot;TRK 1001 එකේ status එක දෙන්නද?&quot;</li>
                <li>💰 Shipping rates — &quot;කොළඹ ඉඳන් කුරුණෑගල කිලෝ 2&quot;</li>
                <li>📅 Reschedule — &quot;TRK 1002 එක හෙට දිනට වෙනස් කරන්න&quot;</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceAssistant;
