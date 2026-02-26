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

// Voice Auth APIs
export const getEnrollmentStatus = () => api.get('/voice-auth/enrollment/status');
export const startEnrollment = () => api.post('/voice-auth/enrollment/start');
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

export default api;
