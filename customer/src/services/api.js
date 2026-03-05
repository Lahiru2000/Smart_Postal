import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach Bearer token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auth ──────────────────────────────────────────────────────────────────────
export const registerUser = (data) => api.post("/auth/register", data);
export const loginUser = (data) => api.post("/auth/login", data);

// ── Shipments ─────────────────────────────────────────────────────────────────
export const getShipments = () => api.get("/shipments/");
export const getShipmentById = (id) => api.get(`/shipments/${id}`);
export const updateShipment = (id, data) => api.put(`/shipments/${id}`, data);

// ── Voice Verification ────────────────────────────────────────────────────────
export const startVoiceVerification = (shipmentId) =>
  api.post("/voice-auth/verification/start", { shipment_id: shipmentId });
export const getVerificationStatus = (verificationId) =>
  api.get(`/voice-auth/verification/${verificationId}/status`);

// ── Postman Location ──────────────────────────────────────────────────────────
export const updatePostmanLocation = (payload) =>
  api.put("/delivery/location", payload);

export const getNearbyPostmen = (lat, lng, radiusKm = 10) =>
  api.get("/delivery/postmen/nearby", {
    params: { lat, lng, radius: radiusKm },
  });

// ── Delivery Sessions ─────────────────────────────────────────────────────────
export const startDeliverySession = (payload) =>
  api.post("/delivery/sessions", payload);

export const getDeliverySession = (sessionId) =>
  api.get(`/delivery/sessions/${sessionId}`);

export const getMyActiveSession = () => api.get("/delivery/sessions/active/me");

export const completeStop = (sessionId, stopIndex) =>
  api.patch(`/delivery/sessions/${sessionId}/stop/${stopIndex}/complete`);

export const endDeliverySession = (sessionId, sessionStatus = "completed") =>
  api.patch(`/delivery/sessions/${sessionId}/end`, { status: sessionStatus });

// ── Disruptions ───────────────────────────────────────────────────────────────
export const reportDisruption = (payload) =>
  api.post("/delivery/disruptions", payload);

export const getSessionDisruptions = (sessionId) =>
  api.get(`/delivery/sessions/${sessionId}/disruptions`);

export const resolveDisruption = (disruptionId, payload) =>
  api.patch(`/delivery/disruptions/${disruptionId}/resolve`, payload);

// ── Redirections ──────────────────────────────────────────────────────────────
export const createRedirection = (payload) =>
  api.post("/delivery/redirections", payload);

export const getSessionRedirections = (sessionId) =>
  api.get(`/delivery/sessions/${sessionId}/redirections`);

export const acceptRedirection = (redirectionId) =>
  api.patch(`/delivery/redirections/${redirectionId}/accept`);

// ── Postman Management ────────────────────────────────────────────────────────
export const getAllPostmen = () => api.get("/delivery/postmen");

export const createPostman = (payload) =>
  api.post("/delivery/postmen", payload);

export const deletePostman = (postmanId) =>
  api.delete(`/delivery/postmen/${postmanId}`);

// ── Handoff Event Management ──────────────────────────────────────────────────
export const getAllRedirections = (params = {}) =>
  api.get("/delivery/redirections", { params });

export const getRedirectionStats = () =>
  api.get("/delivery/redirections/stats");

// ── Default export must be last ───────────────────────────────────────────────
export default api;
