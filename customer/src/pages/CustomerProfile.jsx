import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Package, Phone, Mail, Edit, ArrowUpRight, Box, Loader2, X, Save, Lock, CheckCircle } from 'lucide-react';
import { getProfile, updateProfile } from '../services/api';
import api from '../services/api';

export default function CustomerProfile() {
  const [user, setUser] = useState(null);
  const [shipments, setShipments] = useState([]);
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
        role: p.role,
      });
      // Also update localStorage so navbar stays in sync
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
          role: parsed.role,
        });
      } else {
        navigate('/login');
      }
    }
  };

  const fetchShipments = async () => {
    try {
      const res = await api.get('/shipments/');
      const list = (res.data || []).slice(0, 5).map((s) => ({
        id: s.tracking_number || `SHP-${s.id}`,
        date: s.created_at ? new Date(s.created_at).toLocaleDateString() : '—',
        status: s.status || 'Processing',
        amount: s.price ? `Rs. ${Number(s.price).toLocaleString()}` : '—',
      }));
      setShipments(list);
    } catch {
      setShipments([]);
    }
  };

  useEffect(() => {
    Promise.all([fetchProfile(), fetchShipments()]).finally(() => setLoading(false));
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
      // Refresh profile data
      await fetchProfile();
      setTimeout(() => { setEditOpen(false); setEditSuccess(''); }, 1200);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setEditError(typeof detail === 'string' ? detail : 'Failed to update profile.');
    } finally {
      setEditLoading(false);
    }
  };

  const statusStyles = {
    'delivered': 'bg-green-500/10 text-green-400 border-green-500/20',
    'in_transit': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'processing': 'bg-[#FFC000]/10 text-[#FFC000] border-[#FFC000]/20',
    'pending': 'bg-[#FFC000]/10 text-[#FFC000] border-[#FFC000]/20',
    'picked_up': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    'cancelled': 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  const formatStatus = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#FFC000] animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-black p-4 md:p-8 font-sans selection:bg-[#FFC000] selection:text-black">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8 tracking-tight">My Profile</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Left Column: Personal Info */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-[#1A1A1A] p-6 rounded-2xl border border-[#333333] text-center relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFC000] rounded-full blur-[80px] opacity-10"></div>
              
              <div className="w-24 h-24 bg-black rounded-full flex items-center justify-center mx-auto mb-4 text-[#FFC000] border-2 border-[#333333] shadow-lg shadow-[#FFC000]/10">
                <User size={40} strokeWidth={2} />
              </div>
              <h2 className="text-xl font-bold text-white mb-1">{user.name}</h2>
              <p className="text-gray-500 text-sm font-medium uppercase tracking-wider mb-6">Customer Account</p>
              
              <button
                onClick={openEdit}
                className="w-full py-3 px-4 bg-white text-black rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 text-sm font-bold shadow-lg"
              >
                <Edit size={16} /> Edit Profile
              </button>
            </div>

            <div className="bg-[#1A1A1A] p-6 rounded-2xl border border-[#333333]">
              <h3 className="font-bold text-white mb-5 flex items-center gap-2">
                 <div className="w-1 h-5 bg-[#FFC000] rounded-full"></div>
                 Contact Details
              </h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3 text-gray-300 group">
                  <div className="p-2 bg-black rounded-lg border border-[#333333] group-hover:border-[#FFC000]/30 transition-colors">
                    <Mail size={16} className="text-[#FFC000]" />
                  </div>
                  <span className="text-sm mt-1.5">{user.email}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-300 group">
                  <div className="p-2 bg-black rounded-lg border border-[#333333] group-hover:border-[#FFC000]/30 transition-colors">
                    <Phone size={16} className="text-[#FFC000]" />
                  </div>
                  <span className="text-sm">{user.phone}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Order History */}
          <div className="md:col-span-2">
            <div className="bg-[#1A1A1A] p-6 rounded-2xl border border-[#333333] h-full">
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-bold text-white flex items-center gap-3 text-lg">
                  <div className="p-2 bg-[#FFC000] rounded-lg text-black">
                     <Package size={20} />
                  </div>
                   Recent Orders
                </h3>
                <a href="#" className="text-sm font-bold text-[#FFC000] hover:text-white transition-colors flex items-center gap-1">
                    View All <ArrowUpRight size={16} />
                </a>
              </div>

              <div className="space-y-4">
                {shipments.length > 0 ? shipments.map((order) => (
                  <div key={order.id} className="group flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-black/40 border border-[#333333] rounded-xl hover:border-[#FFC000]/50 transition-all cursor-pointer">
                    <div className="flex items-center gap-4 mb-3 sm:mb-0">
                        <div className="w-10 h-10 rounded-full bg-[#1A1A1A] flex items-center justify-center text-gray-400 group-hover:text-white transition-colors">
                            <Box size={20} />
                        </div>
                        <div>
                        <p className="font-bold text-white">{order.id}</p>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">{order.date}</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-6 pl-[56px] sm:pl-0">
                      <p className="font-bold text-white tabular-nums">{order.amount}</p>
                      <span className={`text-xs font-bold px-3 py-1 rounded-lg border ${statusStyles[order.status.toLowerCase()] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                        {formatStatus(order.status)}
                      </span>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-12 text-gray-500">
                    <Package size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No orders yet</p>
                  </div>
                )}
              </div>
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