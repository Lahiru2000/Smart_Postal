import React, { useEffect } from 'react';
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
  const { isConnected, isSpeaking, connect, disconnect, status, notification, clearNotification, confirmPhoneNumber, cancelPhoneConfirmation } = useLiveAPI();
  const autoDismissRef = React.useRef(null);
  const phoneInputRef = React.useRef(null);

  // Auto-dismiss toast after 20 seconds (not for confirm_phone — user needs time to edit)
  useEffect(() => {
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    if (notification) {
      console.log('[VoiceAssistant] Toast notification received:', notification);
      if (notification.type === 'confirm_phone') {
        setTimeout(() => { if (phoneInputRef.current) phoneInputRef.current.value = notification.phone || ''; }, 50);
      } else {
        autoDismissRef.current = setTimeout(clearNotification, 20000);
      }
    }
    return () => { if (autoDismissRef.current) clearTimeout(autoDismissRef.current); };
  }, [notification, clearNotification]);

  return (
    <div className="min-h-screen bg-black pt-24 pb-12 px-4 flex items-start justify-center">
      {/* Phone Number Confirmation Card */}
      {notification?.type === 'confirm_phone' && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            zIndex: 9999,
            width: 380,
            backgroundColor: '#1A1A1A',
            border: '2px solid #FFC000',
            borderRadius: 16,
            padding: 20,
            boxShadow: '0 8px 32px rgba(255, 192, 0, 0.3)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 24 }}>📞</span>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Confirm Phone Number</span>
            </div>
            <button onClick={clearNotification} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 18 }}>✕</button>
          </div>
          <p style={{ color: '#aaa', fontSize: 12, marginBottom: 8 }}>
            Detected number (edit if wrong):
          </p>
          <input
            ref={phoneInputRef}
            type="tel"
            defaultValue={notification.phone || ''}
            maxLength={10}
            style={{
              width: '100%',
              backgroundColor: '#111',
              border: '2px solid #444',
              borderRadius: 10,
              padding: '10px 14px',
              color: '#fff',
              fontFamily: 'monospace',
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 4,
              textAlign: 'center',
              marginBottom: 12,
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => { e.target.style.borderColor = '#FFC000'; }}
            onBlur={(e) => { e.target.style.borderColor = '#444'; }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => confirmPhoneNumber(phoneInputRef.current?.value || '')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                backgroundColor: '#25D366',
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
                padding: '10px 16px',
                borderRadius: 12,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              ✅ Confirm & Send
            </button>
            <button
              onClick={cancelPhoneConfirmation}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                backgroundColor: '#333',
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
                padding: '10px 16px',
                borderRadius: 12,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              ❌ Wrong
            </button>
          </div>
        </div>
      )}

      {/* WhatsApp Registration Link Toast */}
      {notification?.type === 'registration_link' && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            zIndex: 9999,
            width: 380,
            backgroundColor: '#1A1A1A',
            border: '2px solid #25D366',
            borderRadius: 16,
            padding: 20,
            boxShadow: '0 8px 32px rgba(37, 211, 102, 0.3)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 24 }}>📱</span>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Registration Link Ready</span>
            </div>
            <button onClick={clearNotification} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 18 }}>✕</button>
          </div>
          <p style={{ color: '#aaa', fontSize: 12, marginBottom: 12 }}>
            Phone: <span style={{ color: '#fff', fontFamily: 'monospace', fontWeight: 600 }}>{notification.phone}</span>
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <a
              href={notification.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                backgroundColor: '#25D366',
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
                padding: '10px 16px',
                borderRadius: 12,
                textDecoration: 'none',
              }}
            >
              💬 Send via WhatsApp
            </a>
            <a
              href={notification.registrationUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                backgroundColor: '#FFC000',
                color: '#000',
                fontWeight: 700,
                fontSize: 13,
                padding: '10px 16px',
                borderRadius: 12,
                textDecoration: 'none',
              }}
            >
              🔗 Open
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
