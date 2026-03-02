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
// When a 401 comes back, attempt to refresh transparently using the stored
// refresh token.  If the refresh succeeds the original request is retried.
// If it fails the user is redirected to login.
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

    // Only intercept 401s that are NOT from the refresh/login endpoints themselves
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/login')
    ) {
      if (isRefreshing) {
        // Another refresh is in-flight — queue this request
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
export const getShipments = () => api.get('/shipments/');
export const getShipmentById = (id) => api.get(`/shipments/${id}`);
export const updateShipment = (id, data) => api.put(`/shipments/${id}`, data);

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

// Verification APIs
export const getVerificationDashboard = (sessionToken) => api.get(`/verification/dashboard/${sessionToken}`);
export const getSessionCaptures = (sessionToken) => api.get(`/verification/captures/${sessionToken}`);
export const verifyCustomer = (data) => api.post('/verification/verify', data);
export const sendAsyncVerificationLink = (data) => api.post('/verification/send-link', data);
export const getVerificationStatus = (shipmentId) => api.get(`/verification/status/${shipmentId}`);
export const getAsyncVerifications = (shipmentId) => api.get(`/verification/async-pending/${shipmentId}`);
export const getShipmentLatestSession = (shipmentId) => api.get(`/verification/session/${shipmentId}`);

// AI Verification APIs
export const runAICheck = (sessionToken) => api.post(`/verification/ai-check/${sessionToken}`);
export const getCapturesBySessionId = (sessionId) => api.get(`/verification/captures-by-id/${sessionId}`);

// Async Verification (courier review flow)
export const getAsyncVerification = (token) => api.get(`/verification/async/${token}`);
export const getAsyncVerificationFrames = (token) => api.get(`/verification/async/${token}/frames`);
export const analyzeAsyncVerification = (token) => api.post(`/verification/async/${token}/analyze`);
export const decideAsyncVerification = (token, data) => api.post(`/verification/async/${token}/decide`, data);

export default api;
