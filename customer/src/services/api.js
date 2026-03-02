import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Silent refresh interceptor ───────────────────────────────────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/login')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        isRefreshing = false;
        processQueue(error);
        clearAuthAndRedirect();
        return Promise.reject(error);
      }

      try {
        const res = await axios.post(`${API_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token, refresh_token: newRefresh, role, user_id, full_name } = res.data;
        localStorage.setItem('token', access_token);
        localStorage.setItem('refreshToken', newRefresh);
        localStorage.setItem('role', role);
        localStorage.setItem('userId', user_id);
        localStorage.setItem('fullName', full_name || '');

        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        processQueue(null, access_token);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        clearAuthAndRedirect();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

function clearAuthAndRedirect() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('role');
  localStorage.removeItem('userId');
  localStorage.removeItem('fullName');
  if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
    window.location.href = '/login';
  }
}

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

<<<<<<< HEAD
// Video Call APIs
export const initiateCall = (shipmentId) => api.post('/calls/initiate', { shipment_id: shipmentId });
export const getIncomingCalls = () => api.get('/calls/incoming');
export const getPendingCalls = () => api.get('/calls/pending');
export const getCallSession = (sessionToken) => api.get(`/calls/${sessionToken}`);
export const joinCall = (sessionToken) => api.post(`/calls/${sessionToken}/join`);
export const answerCall = (sessionToken) => api.post(`/calls/${sessionToken}/answer`);
export const declineCall = (sessionToken) => api.post(`/calls/${sessionToken}/decline`);
export const endCall = (sessionToken) => api.post(`/calls/${sessionToken}/end`);
export const captureFrame = (sessionToken, imageData) =>
  api.post(`/calls/${sessionToken}/capture`, { image_data: imageData });

// Decision APIs
export const submitDecision = (data) => api.post('/decisions/', data);
export const getDecisions = (shipmentId) => api.get(`/decisions/${shipmentId}`);

// Verification APIs
export const getVerificationStatus = (shipmentId) => api.get(`/verification/status/${shipmentId}`);
export const getAsyncVerification = (token) => api.get(`/verification/async/${token}`);
export const submitAsyncVerification = (token, data) => api.post(`/verification/async/${token}/submit`, data);
export const getMyPendingVerificationLinks = () => api.get('/verification/my-pending-links');
export const getAsyncVerifications = (shipmentId) => api.get(`/verification/async-pending/${shipmentId}`);
=======
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
>>>>>>> 54e2011845a6733081074d04a5f29da037390fd1

export default api;
