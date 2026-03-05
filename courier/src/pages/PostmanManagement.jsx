import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  UserPlus,
  Trash2,
  RefreshCw,
  ArrowLeftRight,
  MapPin,
  Radio,
  CheckCircle,
  XCircle,
  Clock,
  Phone,
  Mail,
  Car,
  Package,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  BarChart2,
  Eye,
  EyeOff,
} from "lucide-react";
import api from "../services/api";

// Local wrappers — safe even if api.js is an older version
const getAllPostmen = () => api.get("/delivery/postmen");
const createPostman = (payload) => api.post("/delivery/postmen", payload);
const deletePostman = (postmanId) =>
  api.delete(`/delivery/postmen/${postmanId}`);
const getAllRedirections = (params = {}) =>
  api.get("/delivery/redirections", { params });
const getRedirectionStats = () => api.get("/delivery/redirections/stats");

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmtTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString();
};
const fmtAgo = (iso) => {
  if (!iso) return "never";
  const secs = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
};
const STATUS_COLORS = {
  transferred: {
    text: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    label: "Transferred",
  },
  accepted: {
    text: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    label: "Accepted",
  },
  rejected: {
    text: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    label: "Rejected",
  },
  pending: {
    text: "text-gray-400",
    bg: "bg-gray-500/10",
    border: "border-gray-500/30",
    label: "Pending",
  },
};

// ─── sub-components ──────────────────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-2xl p-5 flex items-center gap-4">
    <div
      className={`w-11 h-11 rounded-xl flex items-center justify-center ${color.bg}`}
    >
      <Icon className={`w-5 h-5 ${color.text}`} />
    </div>
    <div>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className={`text-2xl font-bold ${color.text}`}>{value}</p>
    </div>
  </div>
);

const PostmanRow = ({ postman, onDelete }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const progress = postman.total_stops
    ? Math.round((postman.completed_stops / postman.total_stops) * 100)
    : 0;

  return (
    <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-4 flex flex-col gap-3 hover:border-[#333] transition-colors">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-[#FFC000]/10 border border-[#FFC000]/20 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-[#FFC000]">
              {postman.name?.[0]?.toUpperCase() || "P"}
            </span>
          </div>
          <div>
            <p className="text-sm font-bold text-white">{postman.name}</p>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Mail className="w-3 h-3" /> {postman.email}
            </p>
          </div>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {postman.on_delivery ? (
            <span className="flex items-center gap-1.5 text-xs font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-lg">
              <Radio className="w-3 h-3 animate-pulse" /> On Route
            </span>
          ) : postman.is_available ? (
            <span className="flex items-center gap-1.5 text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-lg">
              <CheckCircle className="w-3 h-3" /> Available
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-bold text-gray-400 bg-gray-500/10 border border-gray-500/20 px-2.5 py-1 rounded-lg">
              <Clock className="w-3 h-3" /> Offline
            </span>
          )}
        </div>
      </div>

      {/* Info row */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-black/30 rounded-xl p-2.5 flex flex-col gap-0.5">
          <span className="text-gray-600">Location</span>
          <span className="text-white font-medium">
            {postman.lat
              ? `${postman.lat.toFixed(4)}, ${postman.lng.toFixed(4)}`
              : "No GPS"}
          </span>
        </div>
        <div className="bg-black/30 rounded-xl p-2.5 flex flex-col gap-0.5">
          <span className="text-gray-600">Last Seen</span>
          <span className="text-white font-medium">
            {fmtAgo(postman.last_seen)}
          </span>
        </div>
        <div className="bg-black/30 rounded-xl p-2.5 flex flex-col gap-0.5">
          <span className="text-gray-600">Speed</span>
          <span className="text-white font-medium">
            {postman.speed_kmh != null
              ? `${Math.round(postman.speed_kmh)} km/h`
              : "—"}
          </span>
        </div>
      </div>

      {/* Delivery progress */}
      {postman.on_delivery && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span className="flex items-center gap-1">
              <Package className="w-3 h-3" /> Delivery Progress
            </span>
            <span className="font-bold text-white">
              {postman.completed_stops}/{postman.total_stops} stops
            </span>
          </div>
          <div className="h-2 bg-[#222] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#FFC000] rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-[#1f1f1f]">
        <span className="text-xs text-gray-600">ID #{postman.id}</span>
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-400">Confirm delete?</span>
            <button
              onClick={() => {
                onDelete(postman.id);
                setConfirmDelete(false);
              }}
              className="text-xs px-2.5 py-1 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg font-bold hover:bg-red-500/20 transition-colors"
            >
              Yes
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs px-2.5 py-1 bg-[#222] border border-[#333] text-gray-400 rounded-lg font-bold hover:bg-[#2a2a2a] transition-colors"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-gray-600 hover:text-red-400 transition-colors p-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

const HandoffRow = ({ event, index }) => {
  const [expanded, setExpanded] = useState(false);
  const s = STATUS_COLORS[event.status] || STATUS_COLORS.pending;

  return (
    <div
      className={`border rounded-xl overflow-hidden transition-all ${s.border} ${s.bg}`}
    >
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Index badge */}
        <div className="w-6 h-6 rounded-md bg-black/30 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-gray-400">{index + 1}</span>
        </div>

        {/* From → To */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white truncate">
              {event.from_postman_name}
            </span>
            <ArrowLeftRight className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
            <span className="text-sm font-bold text-white truncate">
              {event.to_postman_name}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {event.stop_name?.split(",")[0] || `Stop ${event.stop_index + 1}`} ·{" "}
            {fmtTime(event.created_at)}
          </p>
        </div>

        {/* Status */}
        <span
          className={`text-xs font-bold px-2.5 py-1 rounded-lg border flex-shrink-0 ${s.text} ${s.bg} ${s.border}`}
        >
          {s.label}
        </span>

        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 grid grid-cols-2 gap-3 border-t border-black/20 pt-3">
          {[
            { label: "Handoff ID", value: `#${event.id}` },
            { label: "Session", value: `#${event.session_id}` },
            { label: "From", value: event.from_postman_name },
            { label: "To", value: event.to_postman_name },
            {
              label: "Stop",
              value:
                event.stop_name?.split(",")[0] ||
                `Stop ${event.stop_index + 1}`,
            },
            { label: "Reason", value: event.reason },
            { label: "Created", value: fmtTime(event.created_at) },
            { label: "Accepted At", value: fmtTime(event.accepted_at) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-black/20 rounded-xl p-2.5">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-xs text-white font-medium mt-0.5">
                {value || "—"}
              </p>
            </div>
          ))}
          {event.stop_lat && (
            <div className="col-span-2 bg-black/20 rounded-xl p-2.5">
              <p className="text-xs text-gray-500">Stop Coordinates</p>
              <p className="text-xs text-white font-medium mt-0.5">
                {event.stop_lat?.toFixed(5)}, {event.stop_lng?.toFixed(5)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

const PostmanManagement = () => {
  // ── Data state ──
  const [postmen, setPostmen] = useState([]);
  const [handoffs, setHandoffs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loadingPostmen, setLoadingPostmen] = useState(false);
  const [loadingHandoffs, setLoadingHandoffs] = useState(false);
  const [error, setError] = useState(null);

  // ── Tab ──
  const [activeTab, setActiveTab] = useState("postmen"); // postmen | handoffs

  // ── Add postman form ──
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
  });
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // ── Filters ──
  const [searchPostman, setSearchPostman] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [handoffPage, setHandoffPage] = useState(0);
  const HANDOFF_PAGE_SIZE = 20;

  // ── Load data ──
  const loadPostmen = useCallback(async () => {
    setLoadingPostmen(true);
    setError(null);
    try {
      const { data } = await getAllPostmen();
      setPostmen(data);
    } catch (e) {
      setError(
        "Failed to load postmen: " + (e.response?.data?.detail || e.message),
      );
    } finally {
      setLoadingPostmen(false);
    }
  }, []);

  const loadHandoffs = useCallback(async () => {
    setLoadingHandoffs(true);
    try {
      const params = {
        limit: HANDOFF_PAGE_SIZE,
        offset: handoffPage * HANDOFF_PAGE_SIZE,
      };
      if (filterStatus) params.status = filterStatus;
      const { data } = await getAllRedirections(params);
      setHandoffs(data);
    } catch (e) {
      setError(
        "Failed to load handoffs: " + (e.response?.data?.detail || e.message),
      );
    } finally {
      setLoadingHandoffs(false);
    }
  }, [filterStatus, handoffPage]);

  const loadStats = useCallback(async () => {
    try {
      const { data } = await getRedirectionStats();
      setStats(data);
    } catch {
      /* stats are non-critical */
    }
  }, []);

  useEffect(() => {
    loadPostmen();
    loadStats();
  }, []);
  useEffect(() => {
    if (activeTab === "handoffs") loadHandoffs();
  }, [activeTab, loadHandoffs]);

  // ── Actions ──
  const handleDelete = async (id) => {
    try {
      await deletePostman(id);
      setPostmen((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setError("Delete failed: " + (e.response?.data?.detail || e.message));
    }
  };

  const handleAddPostman = async () => {
    setFormError(null);
    if (!form.full_name.trim()) {
      setFormError("Full name is required");
      return;
    }
    if (!form.email.trim()) {
      setFormError("Email is required");
      return;
    }
    if (form.password.length < 6) {
      setFormError("Password must be at least 6 characters");
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await createPostman(form);
      setPostmen((prev) => [
        ...prev,
        {
          id: data.id,
          name: data.name,
          email: data.email,
          role: data.role,
          phone: data.phone,
          is_available: true,
          on_delivery: false,
          lat: null,
          lng: null,
          last_seen: null,
          completed_stops: 0,
          total_stops: 0,
          session_id: null,
        },
      ]);
      setForm({ full_name: "", email: "", password: "", phone: "" });
      setShowAddForm(false);
    } catch (e) {
      setFormError(e.response?.data?.detail || "Failed to create postman");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Derived ──
  const filteredPostmen = postmen.filter((p) => {
    if (!searchPostman) return true;
    const q = searchPostman.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q)
    );
  });

  const onlineCount = postmen.filter(
    (p) => p.last_seen && Date.now() - new Date(p.last_seen) < 5 * 60 * 1000,
  ).length;
  const activeCount = postmen.filter((p) => p.on_delivery).length;
  const availableCount = postmen.filter(
    (p) => p.is_available && !p.on_delivery,
  ).length;

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ── HEADER ── */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#FFC000] rounded-xl flex items-center justify-center shadow-lg shadow-[#FFC000]/20">
              <Users className="w-6 h-6 text-black" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                Postman Management
              </h1>
              <p className="text-gray-500 text-sm">
                Manage couriers and track handoff events
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#FFC000] hover:bg-[#E5AC00] text-black font-bold text-sm rounded-xl transition-all shadow-lg shadow-[#FFC000]/20"
          >
            <UserPlus className="w-4 h-4" /> Add Postman
          </button>
        </div>

        {/* ── ERROR ── */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-400"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── ADD POSTMAN FORM ── */}
        {showAddForm && (
          <div className="mb-6 bg-[#1A1A1A] border border-[#FFC000]/30 rounded-2xl p-6">
            <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#FFC000]" /> New Postman
              Account
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  key: "full_name",
                  label: "Full Name",
                  placeholder: "e.g. Kasun Perera",
                  type: "text",
                },
                {
                  key: "email",
                  label: "Email",
                  placeholder: "kasun@smartpostal.lk",
                  type: "email",
                },
                {
                  key: "phone",
                  label: "Phone (opt.)",
                  placeholder: "+94 77 123 4567",
                  type: "tel",
                },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    {label}
                  </label>
                  <input
                    type={type}
                    placeholder={placeholder}
                    value={form[key]}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 bg-black border border-[#333] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#FFC000] focus:ring-1 focus:ring-[#FFC000] text-sm"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 6 characters"
                    value={form.password}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, password: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 bg-black border border-[#333] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#FFC000] focus:ring-1 focus:ring-[#FFC000] text-sm pr-10"
                  />
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {formError && (
              <p className="mt-3 text-sm text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> {formError}
              </p>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={handleAddPostman}
                disabled={submitting}
                className="px-6 py-2.5 bg-[#FFC000] hover:bg-[#E5AC00] text-black font-bold text-sm rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" /> Create Postman
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setFormError(null);
                }}
                className="px-6 py-2.5 bg-[#1f1f1f] hover:bg-[#252525] text-gray-400 border border-[#333] font-bold text-sm rounded-xl transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── STAT CARDS ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={Users}
            label="Total Postmen"
            value={postmen.length}
            color={{ text: "text-[#FFC000]", bg: "bg-[#FFC000]/10" }}
          />
          <StatCard
            icon={Radio}
            label="On Delivery"
            value={activeCount}
            color={{ text: "text-green-400", bg: "bg-green-500/10" }}
          />
          <StatCard
            icon={CheckCircle}
            label="Available"
            value={availableCount}
            color={{ text: "text-blue-400", bg: "bg-blue-500/10" }}
          />
          <StatCard
            icon={ArrowLeftRight}
            label="Total Handoffs"
            value={stats?.total ?? "—"}
            color={{ text: "text-purple-400", bg: "bg-purple-500/10" }}
          />
        </div>

        {/* ── TABS ── */}
        <div className="flex gap-1 bg-[#111] border border-[#222] rounded-xl p-1 mb-6 w-fit">
          {[
            { id: "postmen", label: "Postmen", icon: Users },
            { id: "handoffs", label: "Handoff Events", icon: ArrowLeftRight },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === id
                  ? "bg-[#FFC000] text-black shadow"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {/* ══ POSTMEN TAB ══════════════════════════════════════════════════════ */}
        {activeTab === "postmen" && (
          <div>
            {/* Toolbar */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchPostman}
                  onChange={(e) => setSearchPostman(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-[#111] border border-[#222] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#FFC000] text-sm"
                />
              </div>
              <button
                onClick={loadPostmen}
                disabled={loadingPostmen}
                className="px-4 py-2.5 bg-[#1A1A1A] border border-[#333] text-gray-400 hover:text-white rounded-xl text-sm flex items-center gap-2 transition-all"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loadingPostmen ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>

            {loadingPostmen ? (
              <div className="flex items-center justify-center py-20 gap-3 text-gray-500">
                <RefreshCw className="w-5 h-5 animate-spin" /> Loading
                postmen...
              </div>
            ) : filteredPostmen.length === 0 ? (
              <div className="text-center py-20 text-gray-600">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-base font-medium">No postmen found</p>
                <p className="text-sm mt-1">
                  Click "Add Postman" to create the first one.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPostmen.map((p) => (
                  <PostmanRow key={p.id} postman={p} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ HANDOFFS TAB ═════════════════════════════════════════════════════ */}
        {activeTab === "handoffs" && (
          <div>
            {/* Stats row */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  { label: "Total", value: stats.total, color: "text-white" },
                  {
                    label: "Transferred",
                    value: stats.transferred,
                    color: "text-yellow-400",
                  },
                  {
                    label: "Accepted",
                    value: stats.accepted,
                    color: "text-green-400",
                  },
                  {
                    label: "Rejected",
                    value: stats.rejected,
                    color: "text-red-400",
                  },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="bg-[#111] border border-[#222] rounded-xl p-3 text-center"
                  >
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className={`text-xl font-bold mt-0.5 ${color}`}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Top receivers */}
            {stats?.top_receivers?.length > 0 && (
              <div className="bg-[#111] border border-[#222] rounded-2xl p-4 mb-5">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <BarChart2 className="w-3.5 h-3.5" /> Top Handoff Receivers
                </h3>
                <div className="space-y-2">
                  {stats.top_receivers.map((r, i) => (
                    <div key={r.postman_id} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-600 w-5">
                        #{i + 1}
                      </span>
                      <div className="flex-1 bg-[#1a1a1a] rounded-lg overflow-hidden h-6 relative">
                        <div
                          className="h-full bg-purple-500/20 rounded-lg"
                          style={{
                            width: `${(r.count / stats.top_receivers[0].count) * 100}%`,
                          }}
                        />
                        <span className="absolute inset-0 flex items-center px-2.5 text-xs text-white font-medium">
                          {r.name}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-purple-400 w-8 text-right">
                        {r.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filter + Refresh toolbar */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-2 bg-[#111] border border-[#222] rounded-xl px-3 py-2">
                <Filter className="w-3.5 h-3.5 text-gray-500" />
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setHandoffPage(0);
                  }}
                  className="bg-transparent text-sm text-white focus:outline-none"
                >
                  <option value="">All statuses</option>
                  <option value="transferred">Transferred</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <button
                onClick={loadHandoffs}
                disabled={loadingHandoffs}
                className="px-4 py-2 bg-[#1A1A1A] border border-[#333] text-gray-400 hover:text-white rounded-xl text-sm flex items-center gap-2 transition-all"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loadingHandoffs ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>

            {loadingHandoffs ? (
              <div className="flex items-center justify-center py-20 gap-3 text-gray-500">
                <RefreshCw className="w-5 h-5 animate-spin" /> Loading
                handoffs...
              </div>
            ) : (handoffs.items?.length ?? 0) === 0 ? (
              <div className="text-center py-20 text-gray-600">
                <ArrowLeftRight className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-base font-medium">No handoff events yet</p>
                <p className="text-sm mt-1">
                  Events appear here when postmen hand off stops.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2 mb-5">
                  {handoffs.items.map((e, i) => (
                    <HandoffRow
                      key={e.id}
                      event={e}
                      index={handoffPage * HANDOFF_PAGE_SIZE + i}
                    />
                  ))}
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    Showing {handoffPage * HANDOFF_PAGE_SIZE + 1}–
                    {Math.min(
                      (handoffPage + 1) * HANDOFF_PAGE_SIZE,
                      handoffs.total,
                    )}{" "}
                    of {handoffs.total}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setHandoffPage((p) => Math.max(0, p - 1))}
                      disabled={handoffPage === 0}
                      className="px-4 py-2 bg-[#1A1A1A] border border-[#333] text-gray-400 hover:text-white rounded-xl text-sm disabled:opacity-40 transition-all"
                    >
                      ← Prev
                    </button>
                    <button
                      onClick={() => setHandoffPage((p) => p + 1)}
                      disabled={
                        (handoffPage + 1) * HANDOFF_PAGE_SIZE >=
                        (handoffs.total || 0)
                      }
                      className="px-4 py-2 bg-[#1A1A1A] border border-[#333] text-gray-400 hover:text-white rounded-xl text-sm disabled:opacity-40 transition-all"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PostmanManagement;
