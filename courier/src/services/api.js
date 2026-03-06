import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach token to every request if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth APIs
export const registerUser = (data) => api.post('/auth/register', data);
export const loginUser = (data) => api.post('/auth/login', data);

// Shipment APIs
export const getShipments = () => api.get('/shipments/');
export const getShipmentById = (id) => api.get(`/shipments/${id}`);
export const updateShipment = (id, data) => api.put(`/shipments/${id}`, data);

// Voice Verification APIs
export const startVoiceVerification = (shipmentId) =>
  api.post('/voice-auth/verification/start', { shipment_id: shipmentId });
export const getVerificationStatus = (verificationId) =>
  api.get(`/voice-auth/verification/${verificationId}/status`);

// Video Call APIs
export const initiateVideoCall = (data) => api.post('/video-call/initiate', data);
export const getIncomingCalls = () => api.get('/video-call/incoming');
export const getVideoCall = (roomId) => api.get(`/video-call/${roomId}`);
export const answerVideoCall = (roomId) => api.put(`/video-call/${roomId}/answer`);
export const declineVideoCall = (roomId) => api.put(`/video-call/${roomId}/decline`);
export const endVideoCall = (roomId) => api.put(`/video-call/${roomId}/end`);
export const getVideoCallWsUrl = (roomId) => {
  const token = localStorage.getItem('token');
  const wsBase = API_URL.replace(/^http/, 'ws');
  return `${wsBase}/video-call/ws/${roomId}?token=${token}`;
};

// Verification Link APIs
export const generateVerificationLink = (data) => api.post('/verification-link/generate', data);
export const getVerificationLinks = (shipmentId) => api.get(`/verification-link/shipment/${shipmentId}`);
export const getVerificationLinkStatus = (token) => api.get(`/verification-link/status/${token}`);

// Sinhala Voice Assistant APIs
export const getAssistantTracking = (trackingId) => api.get(`/assistant/tracking/${trackingId}`);
export const postAssistantTextQuery = (text) => api.post('/assistant/query/text', { text });
export const postAssistantVoiceQuery = (formData) =>
  api.post('/assistant/query/voice', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const resetAssistantConversation = () => api.post('/assistant/reset-conversation');

export default api;
