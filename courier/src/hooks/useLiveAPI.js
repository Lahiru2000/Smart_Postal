/**
 * useLiveAPI – React hook for Gemini Live API WebSocket (real-time voice).
 * Courier-side copy — identical logic, uses the shared backend API_URL.
 */
import { useState, useRef, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { AudioRecorder, AudioPlayer } from '../lib/audio';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export function useLiveAPI() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  const clearNotification = useCallback(() => setNotification(null), []);

  const confirmPhoneNumber = useCallback(async (phoneInput) => {
    try {
      let phone = (phoneInput || '').replace(/[^0-9]/g, '');
      if (phone.startsWith('94') && phone.length === 11) {
        phone = '0' + phone.slice(2);
      }
      const isValid = /^0\d{9}$/.test(phone);
      
      if (!isValid) {
        alert('කරුණාකර නිවැරදි දුරකථන අංකයක් ඇතුළත් කරන්න (07X XXXXXXX).');
        return;
      }

      const regUrl = `${window.location.origin}/register`;
      const waText = encodeURIComponent(
        `Smart Postal ලියාපදිංචි වීමට මෙම සබැඳිය භාවිතා කරන්න: ${regUrl}`
      );
      const intlPhone = '94' + phone.slice(1);
      const waLink = `https://wa.me/${intlPhone}?text=${waText}`;

      setNotification({
        type: 'registration_link',
        phone,
        registrationUrl: regUrl,
        whatsappLink: waLink,
        timestamp: Date.now(),
      });

      if (sessionRef.current && connectedRef.current) {
        const session = await sessionRef.current;
        session.sendToolResponse({
          functionResponses: [{
            id: notification?.toolCallId || activeToolCallIdRef.current || 'manual',
            name: 'send_registration_link',
            response: {
              success: true,
              result: "success",
              message: `Registration link has been successfully generated and sent to WhatsApp for ${phone}. The user does not need to confirm anything else. Please tell the user: ලියාපදිංචි සබැඳිය ඔබේ WhatsApp එකට යැව්වා!`,
              registration_url: regUrl,
              whatsapp_link: waLink,
            }
          }]
        });
      }
    } catch (e) {
      console.error('Phone confirmation error:', e);
    }
  }, [notification]);

  const cancelPhoneConfirmation = useCallback(async () => {
    clearNotification();
    if (sessionRef.current && connectedRef.current) {
      const session = await sessionRef.current;
      session.sendToolResponse({
        functionResponses: [{
          id: notification?.toolCallId || activeToolCallIdRef.current || 'manual',
          name: 'send_registration_link',
          response: {
            success: false,
            error: 'user_cancelled',
            message: 'User indicated the phone number was wrong. Please ask for the number again.'
          }
        }]
      });
    }
  }, [clearNotification, notification]);

  const sessionRef = useRef(null);
  const recorderRef = useRef(null);
  const playerRef = useRef(null);
  const speakingTimerRef = useRef(null);
  const connectedRef = useRef(false);
  const activeToolCallIdRef = useRef(null);

  const disconnect = useCallback(() => {
    connectedRef.current = false;
    if (recorderRef.current) { recorderRef.current.stop(); recorderRef.current = null; }
    if (playerRef.current) { playerRef.current.stop(); playerRef.current = null; }
    if (sessionRef.current) {
      sessionRef.current.then((s) => s.close()).catch(() => {});
      sessionRef.current = null;
    }
    if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current);
    setIsConnected(false);
    setIsConnecting(false);
    setIsSpeaking(false);
  }, []);

  const connect = useCallback(async () => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) { setError('VITE_GEMINI_API_KEY not set in .env'); return; }

    setIsConnecting(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: { apiVersion: 'v1alpha' }
      });
      playerRef.current = new AudioPlayer();

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);
            connectedRef.current = true;

            recorderRef.current = new AudioRecorder((base64) => {
              if (!connectedRef.current) return;
              sessionPromise.then((session) =>
                session.sendRealtimeInput({ media: { data: base64, mimeType: 'audio/pcm;rate=16000' } })
              ).catch(() => {});
            });
            recorderRef.current.start();
          },
          onmessage: async (message) => {
            const audio = message?.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio && playerRef.current) {
              playerRef.current.playBase64PCM(audio);
              setIsSpeaking(true);
              if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current);
              speakingTimerRef.current = setTimeout(() => setIsSpeaking(false), 600);
            }
            if (message?.serverContent?.turnComplete) {
              setTimeout(() => setIsSpeaking(false), 400);
            }
            if (message?.serverContent?.interrupted && playerRef.current) {
              playerRef.current.stop();
              playerRef.current = new AudioPlayer();
              setIsSpeaking(false);
            }
            const toolCall = message?.toolCall;
            if (toolCall) {
              const responses = [];
              for (const call of toolCall.functionCalls ?? []) {
                try {
                  let data;
                  if (call.name === 'get_tracking_status') {
                    const res = await fetch(`${API_URL}/assistant/tracking/${call.args.tracking_id}`);
                    data = await res.json();
                  } else if (call.name === 'calculate_shipping_rate') {
                    const res = await fetch(`${API_URL}/assistant/shipping-rate`, {
                      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(call.args),
                    });
                    data = await res.json();
                  } else if (call.name === 'reschedule_delivery') {
                    const res = await fetch(`${API_URL}/assistant/reschedule`, {
                      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(call.args),
                    });
                    data = await res.json();
                  } else if (call.name === 'send_registration_link') {
                    let phone = (call.args.phone_number || '').replace(/[^0-9]/g, '');
                    if (phone.startsWith('94') && phone.length === 11) {
                      phone = '0' + phone.slice(2);
                    }
                    activeToolCallIdRef.current = call.id;
                    setNotification({
                      type: 'confirm_phone',
                      phone: phone,
                      toolCallId: call.id,
                      timestamp: Date.now(),
                    });
                    
                    continue; 
                  } else {
                    data = { error: `Unknown function: ${call.name}` };
                  }
                  responses.push({ id: call.id, name: call.name, response: data });
                } catch (e) {
                  responses.push({ id: call.id, name: call.name, response: { error: e.message } });
                }
              }
              if (responses.length > 0) {
                const session = await sessionPromise;
                session.sendToolResponse({ functionResponses: responses });
              }
            }
          },
          onerror: (err) => { console.error('Live API error:', err); setError(err.message || 'An error occurred'); disconnect(); },
          onclose: (e) => { 
            console.warn('Live API closed:', e?.reason ?? e); 
            if (connectedRef.current) { 
              console.log('Attempting to reconnect...');
              setIsConnecting(true);
              setIsConnected(false);
              setTimeout(() => {
                if (connectedRef.current) connect(); 
              }, 1000);
            } else {
              disconnect();
            }
          },
        },
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } },
          systemInstruction:
            'ඔබ "ස්මාර්ට් තැපැල් සේවාව" (Smart Postal System) හි AI කුරියර් සහායකයෙකි.' +
            '\nභාෂාව: සිංහලෙන් පමණක් කතා කරන්න.' +
            '\nස්වරය: වෘත්තීය, ආචාරශීලී, ඉවසිලිවන්ත, සහ ඉතා උපකාරශීලී. පැහැදිලිව, කෙටියෙන් කතා කරන්න.' +
            '\n\n═══ සුබපැතුම් සහ ආරම්භය ═══' +
            '\n• ආරම්භය: "ආයුබෝවන්, ස්මාර්ට් තැපැල් කුරියර් සේවාව වෙත සාදරයෙන් පිළිගනිමු. මම ඔබේ සහායකයා. අද මම ඔබට කෙසේද උදව් කළ හැක්කේ?"' +
            '\n• සුබපැතුමකට Tracking ID බලහත්කාරයෙන් අසන්න එපා.' +
            '\n\n═══ පාර්සලය Track කිරීම ═══' +
            '\n• tracking number කිව්වොත් get_tracking_status tool call කරන්න.' +
            '\n• TRK-1001, TRK 1001, TRK1001, "ටී ආර් කේ එක්දහස් එක" — ඕනෑම ආකෘතියක් බාරගන්න.' +
            '\n• tracking_id parameter එකට "TRK-XXXX" format (dash සමඟ) යවන්න.' +
            '\n' +
            '\n📦 Result ලැබුණු පසු:' +
            '\n  "ස්තූතියි. අංකය [Number] ලෙස මම සටහන් කරගත්තා.' +
            '\n   ඔබේ පාර්සලය මේ වන විට [package_location] හි පිහිටා තිබෙනවා.' +
            '\n   තත්ත්වය: [status_sinhala].' +
            '\n   එය [estimated_delivery] වන විට ලැබෙනු ඇත.' +
            '\n   ලබන්නා: [receiver], [delivery_address].' +
            '\n   බර: කිලෝ [package_weight_kg], [package_type] පාර්සලයක්.' +
            '\n   ගෙවීම: [payment_status]."' +
            '\n• Not Found: "කණගාටුයි, එම අංකයට අදාළ පාර්සලයක් මට සොයාගැනීමට නොහැකි වුණා."' +
            '\n• not_answered_count >= 2: "මෙම පාර්සලය බෙදාහැරීමේදී පාරිභෝගිකයා හමු නොවූ අවස්ථා [X] වතාවක් වාර්තා වී ඇත." කියන්න.' +
            '\n\n═══ Shipping Rate ═══' +
            '\n• පළමු 1kg = රු.400 + අතිරේක kg එකකට රු.100. දුරස්ථ = +රු.150.' +
            '\n\n═══ ලියාපදිංචි වීම (Registration) ═══' +
            '\n• කුරියර් ලියාපදිංචි වීම ගැන ඇසුවොත්:' +
            '\n  "Smart Postal කුරියර් ලෙස ලියාපදිංචි වීමට, අපේ වෙබ් අඩවියට ගොස් Register බොත්තම ඔබන්න.' +
            '\n   නම, ඊමේල්, දුරකථන අංකය, මුරපදයක් දී Sign Up ඔබන්න."' +
            '\n\n═══ දෝෂ / අවසානය ═══' +
            '\n• නොතේරුණොත්: "මට එය පැහැදිලිව ඇසුණේ නැහැ. කරුණාකර නැවත කියන්න."' +
            '\n• අවසානය: "ස්මාර්ට් තැපැල් සේවාව ඇමතීම ගැන ස්තූතියි. සුබ දවසක්!"' +
            '\n\n═══ නීති ═══' +
            '\n• tracking result: වාක්‍ය 3. අනෙකුත්: වාක්‍ය 1-2.' +
            '\n• සිංහලෙන් පමණක්. දිනය: "මාර්තු 11". මුදල: "රුපියල් 600".' +
            '\n• කෙටියෙන්, ස්වභාවිකව කතා කරන්න.' +
            '\n• අද: ' + new Date().toISOString().split('T')[0],
          tools: [
            {
              functionDeclarations: [
                { name: 'get_tracking_status', description: 'Lookup a Smart Postal tracking ID and return its latest status', parameters: { type: 'OBJECT', properties: { tracking_id: { type: 'STRING', description: 'Tracking number in format TRK-XXXX (e.g. TRK-1001). Always include the dash.' } }, required: ['tracking_id'] } },
                { name: 'calculate_shipping_rate', description: 'Calculate parcel shipping cost in LKR. First 1kg = Rs.400, each additional kg = Rs.100. Remote = +Rs.150.', parameters: { type: 'OBJECT', properties: { origin_city: { type: 'STRING', description: 'Pickup city' }, destination_city: { type: 'STRING', description: 'Drop-off city' }, weight_kg: { type: 'NUMBER', description: 'Weight in kg' } }, required: ['origin_city', 'destination_city', 'weight_kg'] } },
                { name: 'reschedule_delivery', description: 'Reschedule a delivery date (YYYY-MM-DD). Cannot be past or >30 days.', parameters: { type: 'OBJECT', properties: { tracking_id: { type: 'STRING', description: 'Tracking number' }, new_date: { type: 'STRING', description: 'New date (YYYY-MM-DD)' } }, required: ['tracking_id', 'new_date'] } },
                { name: 'send_registration_link', description: 'Send a Smart Postal registration link via WhatsApp to a Sri Lankan mobile number. The phone number MUST be exactly 10 digits starting with 07. Call this only after the user provides their phone number.', parameters: { type: 'OBJECT', properties: { phone_number: { type: 'STRING', description: 'Exactly 10-digit Sri Lankan mobile number starting with 07 (e.g. 0771234567). No spaces or dashes.' } }, required: ['phone_number'] } },
              ],
            },
          ],
        },
      });

      sessionRef.current = sessionPromise;
    } catch (err) {
      console.error('Connection failed:', err);
      setError(err.message || 'Failed to connect');
      setIsConnecting(false);
    }
  }, [disconnect]);

  const status = error ? `Error: ${error}` : isConnecting ? 'Connecting...' : isConnected ? 'Connected – speak now!' : '';
  return { isConnected, isConnecting, isSpeaking, error, connect, disconnect, status, notification, clearNotification, confirmPhoneNumber, cancelPhoneConfirmation };
}
