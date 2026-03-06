/**
 * useLiveAPI – React hook for Gemini Live API WebSocket (real-time voice).
 *
 * Streams microphone audio to Gemini and plays back audio responses.
 * Tool calls (tracking, shipping rate, reschedule) are proxied to the
 * backend at the standard API_URL used by the rest of the app.
 *
 * Converted from TypeScript to JSX to match group project conventions.
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

  const sessionRef = useRef(null);
  const recorderRef = useRef(null);
  const playerRef = useRef(null);
  const speakingTimerRef = useRef(null);
  const connectedRef = useRef(false);

  const disconnect = useCallback(() => {
    connectedRef.current = false;
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    if (playerRef.current) {
      playerRef.current.stop();
      playerRef.current = null;
    }
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
    if (!apiKey) {
      setError('VITE_GEMINI_API_KEY not set in .env');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey });
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
                session.sendRealtimeInput({
                  media: { data: base64, mimeType: 'audio/pcm;rate=16000' },
                })
              ).catch(() => {});
            });
            recorderRef.current.start();
          },

          onmessage: async (message) => {
            // Audio from model
            const audio = message?.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio && playerRef.current) {
              playerRef.current.playBase64PCM(audio);
              setIsSpeaking(true);
              if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current);
              speakingTimerRef.current = setTimeout(() => setIsSpeaking(false), 600);
            }

            // Turn complete — model finished speaking
            if (message?.serverContent?.turnComplete) {
              setTimeout(() => setIsSpeaking(false), 400);
            }

            // Handle interruption
            if (message?.serverContent?.interrupted && playerRef.current) {
              playerRef.current.stop();
              playerRef.current = new AudioPlayer();
              setIsSpeaking(false);
            }

            // Handle tool calls — proxy to our backend
            const toolCall = message?.toolCall;
            if (toolCall) {
              const responses = [];
              for (const call of toolCall.functionCalls ?? []) {
                try {
                  let data;
                  if (call.name === 'get_tracking_status') {
                    const res = await fetch(
                      `${API_URL}/assistant/tracking/${call.args.tracking_id}`
                    );
                    data = await res.json();
                  } else if (call.name === 'calculate_shipping_rate') {
                    const res = await fetch(`${API_URL}/assistant/shipping-rate`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(call.args),
                    });
                    data = await res.json();
                  } else if (call.name === 'reschedule_delivery') {
                    const res = await fetch(`${API_URL}/assistant/reschedule`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(call.args),
                    });
                    data = await res.json();
                  } else if (call.name === 'send_registration_link') {
                    const phone = (call.args.phone_number || '').replace(/[^0-9+]/g, '');
                    const regUrl = `${window.location.origin}/register`;
                    const waText = encodeURIComponent(
                      `Smart Postal ලියාපදිංචි වීමට මෙම සබැඳිය භාවිතා කරන්න: ${regUrl}`
                    );
                    const waLink = `https://wa.me/${phone.startsWith('0') ? '94' + phone.slice(1) : phone}?text=${waText}`;
                    setNotification({
                      type: 'registration_link',
                      phone,
                      registrationUrl: regUrl,
                      whatsappLink: waLink,
                      timestamp: Date.now(),
                    });
                    data = {
                      success: true,
                      message: `Registration link prepared for ${phone}`,
                      registration_url: regUrl,
                      whatsapp_link: waLink,
                    };
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

          onerror: (err) => {
            console.error('Live API error:', err);
            setError(err.message || 'An error occurred');
            disconnect();
          },

          onclose: (e) => {
            console.warn('Live API closed:', e?.reason ?? e);
            disconnect();
          },
        },

        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Aoede' },
            },
          },
          systemInstruction:
            'ඔබ "ස්මාර්ට් තැපැල් සේවාව" (Smart Postal System) හි AI පාරිභෝගික සේවා හඬ සහායකයෙකි.' +
            '\nභාෂාව: සිංහලෙන් පමණක් කතා කරන්න.' +
            '\nස්වරය: වෘත්තීය, ආචාරශීලී, ඉවසිලිවන්ත, සහ ඉතා උපකාරශීලී. පැහැදිලිව, කෙටියෙන් කතා කරන්න.' +
            '\n\n═══ සුබපැතුම් සහ ආරම්භය ═══' +
            '\n• ආරම්භය: "ආයුබෝවන්, ස්මාර්ට් තැපැල් සේවාව වෙත සාදරයෙන් පිළිගනිමු. මම ඔබේ සහායකයා. අද මම ඔබට කෙසේද උදව් කළ හැක්කේ?"' +
            '\n• සුබපැතුමකට Tracking ID බලහත්කාරයෙන් අසන්න එපා.' +
            '\n\n═══ පාර්සලය Track කිරීම ═══' +
            '\n• පරිශීලකයා: "මට මගේ පාර්සලය ට්‍රැක් කරන්න ඕනේ"' +
            '\n• ඔබ: "බොහොම හොඳයි. කරුණාකර ඔබේ පාර්සල් අංකය මට කියන්න."' +
            '\n• අංකය ලැබුණු පසු get_tracking_status tool call කරන්න.' +
            '\n• TRK-1001, TRK 1001, TRK1001, "ටී ආර් කේ එක්දහස් එක" — ඕනෑම ආකෘතියක් බාරගන්න.' +
            '\n• tracking_id parameter එකට "TRK-XXXX" format (dash සමඟ) යවන්න.' +
            '\n' +
            '\n📦 Result ලැබුණු පසු:' +
            '\n  "ස්තූතියි. අංකය [Number] ලෙස මම සටහන් කරගත්තා.' +
            '\n   ඔබේ පාර්සලය මේ වන විට [package_location] හි පිහිටා තිබෙනවා.' +
            '\n   තත්ත්වය: [status_sinhala].' +
            '\n   එය [estimated_delivery] වන විට ඔබට ලැබෙනු ඇත.' +
            '\n   ලබන්නා: [receiver], [delivery_address].' +
            '\n   බර: කිලෝ [package_weight_kg], [package_type] පාර්සලයක්.' +
            '\n   ගෙවීම: [payment_status].' +
            '\n   වෙනත් යමක් දැනගැනීමට අවශ්‍යද?"' +
            '\n' +
            '\n• Not Found: "කණගාටුයි, එම අංකයට අදාළ පාර්සලයක් මට සොයාගැනීමට නොහැකි වුණා. කරුණාකර අංකය නැවත පරීක්ෂා කර කියන්න පුළුවන්ද?"' +
            '\n• not_answered_count >= 2: "මෙම පාර්සලය බෙදාහැරීමේදී පාරිභෝගිකයා හමු නොවූ අවස්ථා [X] වතාවක් වාර්තා වී ඇත." කියන්න.' +
            '\n\n═══ පාර්සලයක් යැවීම / Shipping Rate ═══' +
            '\n• පරිශීලකයා: "මට පාර්සලයක් යවන්න ඕනේ"' +
            '\n• ඔබ: "පැහැදිලියි. පාර්සලය ලබා ගැනීමට කුරියර් කෙනෙක් එවිය යුත්තේ කුමන ප්‍රදේශයටද?"' +
            '\n• ඉන්පසු: "ඔබ පාර්සලය යවන්නේ කුමන නගරයටද?" සහ "පාර්සලයේ බර කීයද?"' +
            '\n• calculate_shipping_rate tool call කරන්න.' +
            '\n• පළමු 1kg = රු.400 + අතිරේක kg එකකට රු.100. දුරස්ථ ප්‍රදේශ = +රු.150.' +
            '\n• result: "ඔබේ ප්‍රදේශයේ සිට [destination] දක්වා පාර්සලයක් යැවීමට ආසන්න වශයෙන් රුපියල් [amount] ක් වැය වේ."' +
            '\n\n═══ බෙදාහැරීම නැවත සැලසුම් කිරීම ═══' +
            '\n• reschedule_delivery tool call කරන්න. අතීත දිනයකට බැහැ. උපරිම 30 දින.' +
            '\n• සාර්ථක: "ඔබේ [tracking_id] පාර්සලයේ බෙදාහැරීම [date] දිනට වෙනස් කළා."' +
            '\n\n═══ ලියාපදිංචි වීම (Registration) ═══' +
            '\n• පරිශීලකයා ලියාපදිංචි වීම ගැන ඇසුවොත්:' +
            '\n  "Smart Postal සේවාවට ලියාපදිංචි වීම ඉතා පහසුයි. ඔබට අපේ වෙබ් අඩවියට ගොස් Register බොත්තම ඔබන්න.' +
            '\n   ඔබේ සම්පූර්ණ නම, ඊමේල් ලිපිනය, දුරකථන අංකය, සහ මුරපදයක් ඇතුළත් කරන්න. ඉන්පසු Sign Up බොත්තම ඔබන්න.' +
            '\n   ලියාපදිංචි වූ පසු Login පිටුවට ගොස් ඔබේ ඊමේල් සහ මුරපදය පාවිචිචි කර ඇතුල් වන්න.' +
            '\n   ඔබට WhatsApp හරහා ලියාපදිංචි සබැඳිය ලබා ගැනීමට අවශ්‍ය නම්, ඔබේ දුරකථන අංකය මට කියන්න."' +
            '\n\n═══ දෝෂ හැසිරවීම ═══' +
            '\n• නොතේරුණොත්: "මට එය පැහැදිලිව ඇසුණේ නැහැ. කරුණාකර නැවත කියන්න පුළුවන්ද?"' +
            '\n• උදව් කළ නොහැකි නම්: "මට මේ සඳහා ඔබට උදව් කිරීමට අපහසුයි. කරුණාකර රැඳී සිටින්න, මම ඔබව අපගේ පාරිභෝගික සේවා නිලධාරියෙකුට සම්බන්ධ කරන්නම්."' +
            '\n\n═══ ඇමතුම අවසානය ═══' +
            '\n• "ස්මාර්ට් තැපැල් සේවාව ඇමතීම ගැන ස්තූතියි. ඔබට සුබ දවසක්!"' +
            '\n\n═══ වැදගත් නීති ═══' +
            '\n• tracking result: වාක්‍ය 3-4. අනෙකුත්: වාක්‍ය 1-2.' +
            '\n• සිංහලෙන් පමණක් — English mix එපා (නම්, ලිපින ඉංග්‍රීසියෙන් ok).' +
            '\n• දිනය: "2026 මාර්තු 11". මුදල: "රුපියල් 600".' +
            '\n• formal වචන (පූර්වභාග/අපරභාග) එපා — ස්වභාවිකව කතා කරන්න.' +
            '\n• තොරතුරු තහවුරු කරන්න — අංකයක් ලැබුණු විට නැවත කියන්න.' +
            '\n• අද: ' + new Date().toISOString().split('T')[0],
          tools: [
            {
              functionDeclarations: [
                {
                  name: 'get_tracking_status',
                  description: 'Lookup a Smart Postal tracking ID and return its latest status',
                  parameters: {
                    type: 'OBJECT',
                    properties: {
                      tracking_id: {
                        type: 'STRING',
                        description: 'Tracking number in format TRK-XXXX (e.g. TRK-1001, TRK-1002). Always include the dash after TRK.',
                      },
                    },
                    required: ['tracking_id'],
                  },
                },
                {
                  name: 'calculate_shipping_rate',
                  description: 'Calculate parcel shipping cost in LKR. First 1kg = Rs.400, each additional kg = Rs.100. Remote areas (Jaffna, Trincomalee, etc.) have Rs.150 surcharge.',
                  parameters: {
                    type: 'OBJECT',
                    properties: {
                      origin_city: { type: 'STRING', description: 'Pickup city' },
                      destination_city: { type: 'STRING', description: 'Drop-off city' },
                      weight_kg: { type: 'NUMBER', description: 'Weight in kilograms' },
                    },
                    required: ['origin_city', 'destination_city', 'weight_kg'],
                  },
                },
                {
                  name: 'reschedule_delivery',
                  description:
                    'Update a delivery date for an existing tracking ID. ' +
                    'Date must be YYYY-MM-DD, must not be in the past, must be within 30 days, parcel must not be delivered.',
                  parameters: {
                    type: 'OBJECT',
                    properties: {
                      tracking_id: { type: 'STRING', description: 'Tracking number' },
                      new_date: { type: 'STRING', description: 'Preferred delivery date (YYYY-MM-DD)' },
                    },
                    required: ['tracking_id', 'new_date'],
                  },
                },
                {
                  name: 'send_registration_link',
                  description:
                    'Send a Smart Postal registration link to the user via WhatsApp. ' +
                    'Call this when the user wants to receive a registration link on their phone.',
                  parameters: {
                    type: 'OBJECT',
                    properties: {
                      phone_number: {
                        type: 'STRING',
                        description: 'Sri Lankan phone number (e.g. 0771234567 or +94771234567)',
                      },
                    },
                    required: ['phone_number'],
                  },
                },
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

  const status = error
    ? `Error: ${error}`
    : isConnecting
      ? 'Connecting...'
      : isConnected
        ? 'Connected – speak now!'
        : '';

  return { isConnected, isConnecting, isSpeaking, error, connect, disconnect, status, notification, clearNotification };
}
