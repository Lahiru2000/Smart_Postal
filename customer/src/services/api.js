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
export const createShipment = (data) => api.post('/shipments/', data);
export const getShipments = () => api.get('/shipments/');
export const getShipmentById = (id) => api.get(`/shipments/${id}`);
export const trackShipment = (trackingNumber) => api.get(`/shipments/track/${trackingNumber}`);
export const updateShipment = (id, data) => api.put(`/shipments/${id}`, data);
export const deleteShipment = (id) => api.delete(`/shipments/${id}`);
export const uploadShipmentMedia = (file, mediaType, audioFile = null) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('media_type', mediaType);
  if (audioFile) {
    formData.append('audio_file', audioFile);
  }
  return api.post('/shipments/upload-media', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// Voice Auth APIs
export const getEnrollmentStatus = () => api.get('/voice-auth/enrollment/status');
export const startEnrollment = () => api.post('/voice-auth/enrollment/start');
export const resetVoiceProfile = () => api.delete('/voice-auth/enrollment/reset');
export const submitEnrollmentSample = (enrollmentId, audioFile) => {
  const formData = new FormData();
  formData.append('audio', audioFile);
  return api.post(`/voice-auth/enrollment/${enrollmentId}/sample`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const getVerificationStatus = (verificationId) =>
  api.get(`/voice-auth/verification/${verificationId}/status`);
export const submitVerification = (verificationId, audioFile) => {
  const formData = new FormData();
  formData.append('audio', audioFile);
  return api.post(`/voice-auth/verification/${verificationId}/submit`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

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

// Verification Link APIs (public – no auth needed)
export const getVerificationLinkPublic = (token) => api.get(`/verification-link/public/${token}`);
export const submitVerificationVideo = (token, videoFile, audioBlob = null) => {
  const formData = new FormData();
  formData.append('video', videoFile);
  // Send separate audio track if available (guaranteed voice capture)
  if (audioBlob) {
    const audioFile = new File([audioBlob], 'voice_recording.webm', { type: audioBlob.type || 'audio/webm' });
    formData.append('audio', audioFile);
  }
  return api.post(`/verification-link/public/${token}/submit`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const submitVerificationScan = (token, snapshots, audioBlob = null) => {
  const formData = new FormData();
  formData.append('scan_data', JSON.stringify({ snapshots }));
  if (audioBlob) {
    const audioFile = new File([audioBlob], 'voice_scan.webm', { type: audioBlob.type || 'audio/webm' });
    formData.append('audio', audioFile);
  }
  return api.post(`/verification-link/public/${token}/scan`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const getVerificationResult = (token) => api.get(`/verification-link/result/${token}`);

// Customer – check for pending verification link on a shipment
export const getCustomerVerificationLink = (shipmentId) =>
  api.get(`/verification-link/customer/shipment/${shipmentId}`);

// Verification Links for a shipment (authenticated)
export const getVerificationLinks = (shipmentId) => api.get(`/verification-link/shipment/${shipmentId}`);

export default api;
