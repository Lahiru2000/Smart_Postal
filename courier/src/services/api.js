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

// ─────────────────────────────────────────────────────────────────────────────
// DELIVERY — Postman Location
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Broadcast the postman's current GPS position.
 * Called every ~10 s by a Geolocation watchPosition() in the component.
 *
 * @param {{ lat, lng, accuracy_m?, heading?, speed_kmh?, is_available }} payload
 */
export const updatePostmanLocation = (payload) =>
  api.put("/delivery/location", payload);

/**
 * Fetch postmen within `radiusKm` km of a given point.
 * Used to populate the "Hand off" selector.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {number} radiusKm  - default 10 km
 */
export const getNearbyPostmen = (lat, lng, radiusKm = 10) =>
  api.get("/delivery/postmen/nearby", {
    params: { lat, lng, radius: radiusKm },
  });

// ─────────────────────────────────────────────────────────────────────────────
// DELIVERY — Sessions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start a new delivery session.
 *
 * @param {{
 *   route_data: Array<{name, lat, lng, priority}>,
 *   google_maps_url?: string,
 *   total_distance_m?: number,
 *   total_duration_s?: number
 * }} payload
 */
export const startDeliverySession = (payload) =>
  api.post("/delivery/sessions", payload);

/** Get full details for a specific session. */
export const getDeliverySession = (sessionId) =>
  api.get(`/delivery/sessions/${sessionId}`);

/** Get the caller's currently active session (if any). Returns null body when none. */
export const getMyActiveSession = () => api.get("/delivery/sessions/active/me");

/**
 * Mark one stop as delivered.
 *
 * @param {number} sessionId
 * @param {number} stopIndex   - 0-based index in route_data
 */
export const completeStop = (sessionId, stopIndex) =>
  api.patch(`/delivery/sessions/${sessionId}/stop/${stopIndex}/complete`);

/**
 * End a session.
 *
 * @param {number} sessionId
 * @param {'completed'|'abandoned'} sessionStatus
 */
export const endDeliverySession = (sessionId, sessionStatus = "completed") =>
  api.patch(`/delivery/sessions/${sessionId}/end`, { status: sessionStatus });

// ─────────────────────────────────────────────────────────────────────────────
// DELIVERY — Disruptions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Report a road disruption. Triggers re-routing in the UI.
 *
 * @param {{
 *   session_id: number,
 *   stop_index: number,
 *   stop_name?: string,
 *   disruption_type: 'closure'|'accident'|'flooding'|'construction',
 *   lat?: number,
 *   lng?: number
 * }} payload
 */
export const reportDisruption = (payload) =>
  api.post("/delivery/disruptions", payload);

/** List all disruptions for a session. */
export const getSessionDisruptions = (sessionId) =>
  api.get(`/delivery/sessions/${sessionId}/disruptions`);

/**
 * Resolve or bypass a disruption.
 *
 * @param {number} disruptionId
 * @param {{ status: 'resolved'|'bypassed', resolution_note?: string }} payload
 */
export const resolveDisruption = (disruptionId, payload) =>
  api.patch(`/delivery/disruptions/${disruptionId}/resolve`, payload);

// ─────────────────────────────────────────────────────────────────────────────
// DELIVERY — Redirections
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hand off a stop to another postman.
 *
 * @param {{
 *   session_id:    number,
 *   stop_index:    number,
 *   stop_name?:    string,
 *   stop_lat?:     number,
 *   stop_lng?:     number,
 *   to_postman_id: number,
 *   reason:        string
 * }} payload
 */
export const createRedirection = (payload) =>
  api.post("/delivery/redirections", payload);

/** List all redirections for a session. */
export const getSessionRedirections = (sessionId) =>
  api.get(`/delivery/sessions/${sessionId}/redirections`);

/**
 * The receiving postman confirms they have accepted the handoff.
 *
 * @param {number} redirectionId
 */
export const acceptRedirection = (redirectionId) =>
  api.patch(`/delivery/redirections/${redirectionId}/accept`);

export default api;
