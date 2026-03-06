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

  const sessionRef = useRef(null);
  const recorderRef = useRef(null);
  const playerRef = useRef(null);
  const speakingTimerRef = useRef(null);
  const connectedRef = useRef(false);

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
          onclose: (e) => { console.warn('Live API closed:', e?.reason ?? e); disconnect(); },
        },
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } },
          systemInstruction:
            'ඔබ Smart Postal හි මිත්‍රශීලී සිංහල හඬ සහායකයෙකි. සිංහලෙන් පමණක් කතා කරන්න. ' +
            'ස්වභාවිකව, පැහැදිලිව, උණුසුමින් කතා කරන්න. පිළිතුරු කෙටි කරන්න — වාක්‍ය 1-2ක් පමණි. ' +
            '\n\nසුබපැතුම් කළ විට: "ආයුබෝවන්! Smart Postal සේවයට සාදරයෙන් පිළිගනිමු. මට ඔබට කොහොමද උදව් කරන්නේ?" ලෙස පිළිතුරු දෙන්න.' +
            '\n\nTracking ID ලැබුණු විට get_tracking_status භාවිතා කරන්න. ' +
            'පරිශීලකයා TRK 1001 හෝ TRK-1001 හෝ සිංහලෙන් "ටී ආර් කේ එක්දහස් එක" කිව්වොත් tracking_id parameter එකට "TRK-1001" ලෙස යවන්න. ' +
            'හැම විටම TRK- prefix එක සමඟ dash එකක් යොදන්න.' +
            '\n\nබෙදාහැරීම් නැවත සැලසුම් කිරීමේදී අතීත දිනයකට කළ නොහැක. අද: ' + new Date().toISOString().split('T')[0],
          tools: [
            {
              functionDeclarations: [
                { name: 'get_tracking_status', description: 'Lookup a Smart Postal tracking ID and return its latest status', parameters: { type: 'OBJECT', properties: { tracking_id: { type: 'STRING', description: 'Tracking number in format TRK-XXXX (e.g. TRK-1001, TRK-1002). Always include the dash after TRK.' } }, required: ['tracking_id'] } },
                { name: 'calculate_shipping_rate', description: 'Calculate parcel shipping cost in LKR', parameters: { type: 'OBJECT', properties: { origin_city: { type: 'STRING', description: 'Pickup city' }, destination_city: { type: 'STRING', description: 'Drop-off city' }, weight_kg: { type: 'NUMBER', description: 'Weight in kg' } }, required: ['origin_city', 'destination_city', 'weight_kg'] } },
                { name: 'reschedule_delivery', description: 'Reschedule a delivery date (YYYY-MM-DD)', parameters: { type: 'OBJECT', properties: { tracking_id: { type: 'STRING', description: 'Tracking number' }, new_date: { type: 'STRING', description: 'New date (YYYY-MM-DD)' } }, required: ['tracking_id', 'new_date'] } },
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
  return { isConnected, isConnecting, isSpeaking, error, connect, disconnect, status };
}
