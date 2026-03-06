import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Truck, Star, CheckCircle, Clock, DollarSign, Award, TrendingUp, Shield, MapPin, Calendar, Loader2, Mail, Phone, Edit, X, Save, Lock } from 'lucide-react';
import { getProfile, updateProfile } from '../services/api';

export default function CourierProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: '', phone: '', password: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const navigate = useNavigate();

  const fetchProfile = async () => {
    try {
      const res = await getProfile();
      const p = res.data;
      setUser({
        name: p.full_name,
        email: p.email,
        phone: p.phone || '—',
        id: `DVR-${p.id}`,
        role: p.role,
      });
      localStorage.setItem('user', JSON.stringify({
        id: p.id, email: p.email, full_name: p.full_name, phone: p.phone, role: p.role,
      }));
    } catch {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        setUser({
          name: parsed.full_name,
          email: parsed.email,
          phone: parsed.phone || '—',
          id: `DVR-${parsed.id}`,
          role: parsed.role,
        });
      } else {
        navigate('/login');
      }
    }
  };

  useEffect(() => {
    fetchProfile().finally(() => setLoading(false));
  }, [navigate]);

  const openEdit = () => {
    setEditForm({ full_name: user.name, phone: user.phone === '—' ? '' : user.phone, password: '' });
    setEditError('');
    setEditSuccess('');
    setEditOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError('');
    setEditSuccess('');
    try {
      const payload = {};
      if (editForm.full_name) payload.full_name = editForm.full_name;
      if (editForm.phone) payload.phone = editForm.phone;
      if (editForm.password) payload.password = editForm.password;

      await updateProfile(payload);
      setEditSuccess('Profile updated successfully!');
      await fetchProfile();
      setTimeout(() => { setEditOpen(false); setEditSuccess(''); }, 1200);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setEditError(typeof detail === 'string' ? detail : 'Failed to update profile.');
    } finally {
      setEditLoading(false);
    }
  };

  // Stats kept as placeholder — these would come from a real stats API
  const stats = {
    vehicle: "TVS King (Three Wheeler)",
    plate: "ABC-1234",
    rating: 4.8,
    totalDeliveries: 1240,
    onlineHours: 45,
    earnings: "Rs. 85,000",
    joinDate: "Jan 2024"
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#FFC000] animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 font-sans selection:bg-[#FFC000] selection:text-black">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-white tracking-tight">Driver Profile</h1>
            <button
              onClick={openEdit}
              className="px-5 py-2.5 bg-[#1A1A1A] hover:bg-[#252525] border border-[#333333] hover:border-[#FFC000] rounded-xl text-sm font-bold transition-all flex items-center gap-2"
            >
                <Edit size={16} /> Edit Profile
            </button>
        </div>

        {/* Header Card */}
        <div className="bg-[#1A1A1A] p-6 md:p-10 rounded-3xl border border-[#333333] mb-8 relative overflow-hidden group">
          {/* Decorative Blur */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#FFC000] rounded-full blur-[100px] opacity-5 group-hover:opacity-10 transition-opacity"></div>

          <div className="relative flex flex-col md:flex-row items-center md:items-start gap-8">
            {/* Avatar */}
            <div className="relative">
              <div className="w-32 h-32 bg-[#FFC000] rounded-3xl flex items-center justify-center text-black shadow-2xl shadow-[#FFC000]/20 ring-4 ring-black">
                <User size={56} strokeWidth={2} />
              </div>
              <div className="absolute -bottom-3 -right-3 bg-green-500 text-black px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-lg font-bold text-xs border-[3px] border-[#1A1A1A]">
                <CheckCircle size={14} strokeWidth={3} />
                <span>VERIFIED</span>
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left space-y-4">
              <div>
                <h2 className="text-4xl font-bold text-white mb-2 tracking-tight">{user.name}</h2>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                    <span className="px-3 py-1 rounded-lg bg-black border border-[#333333] text-gray-400 font-mono text-sm">
                        ID: <span className="text-[#FFC000] font-bold">{user.id}</span>
                    </span>
                    <span className="px-3 py-1 rounded-lg bg-[#FFC000]/10 border border-[#FFC000]/20 text-[#FFC000] text-sm font-bold flex items-center gap-2">
                        <Star size={14} fill="currentColor" />
                        Top Rated Driver
                    </span>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <Truck size={18} className="text-[#FFC000]" />
                  <span className="text-white font-medium">{stats.vehicle}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#333333]"></div>
                  <span className="font-mono">{stats.plate}</span>
                </div>
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-[#333333]"></div>
                   <Calendar size={16} />
                   <span>Joined {stats.joinDate}</span>
                </div>
              </div>
            </div>

            {/* Rating Box */}
            <div className="bg-black/50 backdrop-blur-sm p-5 rounded-2xl border border-[#333333] flex flex-col items-center min-w-[120px]">
                <span className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Rating</span>
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-3xl font-bold text-white">{stats.rating}</span>
                    <Star size={24} className="text-[#FFC000] fill-[#FFC000]" />
                </div>
                <div className="flex gap-1">
                    {[1,2,3,4,5].map((s) => (
                        <div key={s} className={`h-1.5 w-4 rounded-full ${s <= Math.round(stats.rating) ? 'bg-[#FFC000]' : 'bg-gray-800'}`}></div>
                    ))}
                </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          {[
            { label: 'Total Deliveries', value: stats.totalDeliveries, icon: <CheckCircle size={24} />, color: 'text-green-400', bg: 'bg-green-400/10' },
            { label: 'Online Hours', value: `${stats.onlineHours}h`, icon: <Clock size={24} />, color: 'text-blue-400', bg: 'bg-blue-400/10' },
            { label: 'Month Earnings', value: stats.earnings, icon: <DollarSign size={24} />, color: 'text-[#FFC000]', bg: 'bg-[#FFC000]/10' },
          ].map((stat, i) => (
             <div key={i} className="bg-[#1A1A1A] p-6 rounded-2xl border border-[#333333] hover:border-[#FFC000]/30 transition-all group">
                <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                        {React.cloneElement(stat.icon, { strokeWidth: 3 })}
                    </div>
                    <div className="p-2 rounded-lg bg-black border border-[#333333] group-hover:border-[#FFC000]/20 transition-colors">
                        <TrendingUp size={16} className="text-gray-400" />
                    </div>
                </div>
                <p className="text-3xl font-bold text-white mb-1">{stat.value}</p>
                <p className="text-gray-500 font-medium text-sm">{stat.label}</p>
             </div>
          ))}
        </div>

        {/* Performance Metrics */}
        <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-[#1A1A1A] p-8 rounded-3xl border border-[#333333]">
            <h3 className="font-bold text-xl text-white mb-6 flex items-center gap-3">
                <TrendingUp className="w-6 h-6 text-[#FFC000]" strokeWidth={2.5} />
                Performance Metrics
            </h3>
            <div className="space-y-6">
                {[
                    { label: "Delivery Success Rate", val: "98%", color: "bg-green-500" },
                    { label: "On-Time Delivery", val: "96%", color: "bg-[#FFC000]" },
                    { label: "Customer Satisfaction", val: "94%", color: "bg-blue-500" }
                ].map((metric, i) => (
                    <div key={i}>
                        <div className="flex justify-between mb-2 text-sm">
                            <span className="text-gray-400 font-bold">{metric.label}</span>
                            <span className={`font-bold ${metric.color === 'bg-[#FFC000]' ? 'text-[#FFC000]' : metric.color.replace('bg-', 'text-')}`}>{metric.val}</span>
                        </div>
                        <div className="w-full bg-black rounded-full h-2.5 overflow-hidden border border-[#333333]">
                            <div className={`${metric.color} h-full rounded-full`} style={{ width: metric.val }}></div>
                        </div>
                    </div>
                ))}
            </div>
            </div>

            {/* Vehicle Info / Verification */}
            <div className="bg-[#1A1A1A] p-8 rounded-3xl border border-[#333333]">
            <h3 className="font-bold text-xl text-white mb-6 flex items-center gap-3">
                <Shield className="w-6 h-6 text-[#FFC000]" strokeWidth={2.5} />
                Vehicle & Documents
            </h3>
            <div className="space-y-3">
                {['Driving License', 'Insurance Policy', 'Vehicle Registration', 'Background Check'].map((doc, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-[#333333] hover:border-green-500/30 transition-colors">
                        <span className="text-gray-300 font-medium">{doc}</span>
                        <div className="flex items-center gap-2 text-green-500 text-sm font-bold bg-green-500/10 px-3 py-1 rounded-lg border border-green-500/20">
                            <CheckCircle size={14} strokeWidth={3} />
                            Verified
                        </div>
                    </div>
                ))}
            </div>
            </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1A1A1A] rounded-2xl border border-[#333333] w-full max-w-md shadow-2xl relative overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Edit size={18} className="text-[#FFC000]" /> Edit Profile
              </h2>
              <button
                onClick={() => setEditOpen(false)}
                className="p-2 rounded-lg hover:bg-[#252525] text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-5">
              {editError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm font-medium">
                  {editError}
                </div>
              )}
              {editSuccess && (
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm font-medium flex items-center gap-2">
                  <CheckCircle size={16} /> {editSuccess}
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Full Name</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-gray-500 group-focus-within:text-[#FFC000] transition-colors" />
                  </div>
                  <input
                    type="text"
                    value={editForm.full_name}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                    className="w-full pl-11 pr-4 py-3 bg-black border border-[#333333] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#FFC000] focus:ring-1 focus:ring-[#FFC000] transition-all text-sm font-medium"
                    placeholder="Your full name"
                    required
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Phone</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Phone className="h-4 w-4 text-gray-500 group-focus-within:text-[#FFC000] transition-colors" />
                  </div>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full pl-11 pr-4 py-3 bg-black border border-[#333333] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#FFC000] focus:ring-1 focus:ring-[#FFC000] transition-all text-sm font-medium"
                    placeholder="+94 77 123 4567"
                  />
                </div>
              </div>

              {/* New Password (optional) */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  New Password <span className="text-gray-600 normal-case">(leave blank to keep current)</span>
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-gray-500 group-focus-within:text-[#FFC000] transition-colors" />
                  </div>
                  <input
                    type="password"
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    className="w-full pl-11 pr-4 py-3 bg-black border border-[#333333] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#FFC000] focus:ring-1 focus:ring-[#FFC000] transition-all text-sm font-medium"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Email <span className="text-gray-600 normal-case">(cannot be changed)</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-gray-600" />
                  </div>
                  <input
                    type="email"
                    value={user.email}
                    disabled
                    className="w-full pl-11 pr-4 py-3 bg-black/50 border border-[#252525] rounded-xl text-gray-500 text-sm font-medium cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="flex-1 py-3 px-4 bg-[#252525] text-gray-300 rounded-xl hover:bg-[#333333] transition-colors text-sm font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 py-3 px-4 bg-[#FFC000] text-black rounded-xl hover:bg-[#E5AC00] transition-colors text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-[#FFC000]/20"
                >
                  {editLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}