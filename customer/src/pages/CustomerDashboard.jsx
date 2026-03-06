import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Package, Send, CheckCircle, Clock, MapPin, Search, Plus, ArrowUpRight, Truck, Box, Trash2, Filter, ChevronDown, X } from 'lucide-react';
import { getShipments, deleteShipment, trackShipment } from '../services/api';


const CustomerDashboard = () => {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trackingInput, setTrackingInput] = useState('');
  const [trackError, setTrackError] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    fetchShipments();
  }, []);

  const fetchShipments = async () => {
    try {
      const res = await getShipments();
      setShipments(res.data);
    } catch (err) {
      console.error('Failed to fetch shipments', err);
      if (err.response?.status === 401) navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this shipment?')) return;
    try {
      await deleteShipment(id);
      setShipments(shipments.filter(s => s.id !== id));
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete shipment');
    }
  };

  const handleTrack = async () => {
    setTrackError('');
    if (!trackingInput.trim()) return;
    try {
      const res = await trackShipment(trackingInput.trim());
      // Navigate to edit page with the shipment id
      navigate(`/edit-shipment/${res.data.id}`);
    } catch (err) {
      setTrackError(err.response?.data?.detail || 'Shipment not found');
    }
  };

  // Compute counts from real data
  const activeCount = shipments.filter(s => s.status === 'Pending' || s.status === 'In Transit').length;
  const deliveredCount = shipments.filter(s => s.status === 'Delivered').length;
  const inTransitCount = shipments.filter(s => s.status === 'In Transit').length;
  const pendingCount = shipments.filter(s => s.status === 'Pending').length;
  const totalCount = shipments.length;

  const filterOptions = [
    { key: 'all', label: 'All Shipments', count: totalCount, icon: <Box className="w-4 h-4" />, color: 'text-gray-400', activeBg: 'bg-white/10', activeBorder: 'border-white/20' },
    { key: 'active', label: 'Active', count: activeCount, icon: <Send className="w-4 h-4" />, color: 'text-[#FFC000]', activeBg: 'bg-[#FFC000]/10', activeBorder: 'border-[#FFC000]/30' },
    { key: 'Pending', label: 'Pending', count: pendingCount, icon: <Clock className="w-4 h-4" />, color: 'text-[#FFC000]', activeBg: 'bg-[#FFC000]/10', activeBorder: 'border-[#FFC000]/30' },
    { key: 'In Transit', label: 'In Transit', count: inTransitCount, icon: <Truck className="w-4 h-4" />, color: 'text-blue-400', activeBg: 'bg-blue-500/10', activeBorder: 'border-blue-500/30' },
    { key: 'Delivered', label: 'Delivered', count: deliveredCount, icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-400', activeBg: 'bg-green-500/10', activeBorder: 'border-green-500/30' },
  ];

  const filteredShipments = shipments.filter((s) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'active') return s.status === 'Pending' || s.status === 'In Transit';
    return s.status === activeFilter;
  });

  const currentFilter = filterOptions.find(f => f.key === activeFilter) || filterOptions[0];

  const statusColor = (status) => {
    switch (status) {
      case 'In Transit': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Delivered': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'Pending': return 'bg-[#FFC000]/10 text-[#FFC000] border-[#FFC000]/20';
      case 'Reversed': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'Return Requested': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default: return 'bg-gray-800 text-gray-400 border-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-black font-sans selection:bg-[#FFC000] selection:text-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white tracking-tight">My Dashboard</h1>
            <p className="text-gray-400 mt-2 text-lg">Track and manage your global shipments.</p>
          </div>
          <Link to="/new-shipment" className="inline-flex items-center gap-2 px-6 py-3.5 bg-[#FFC000] text-black font-bold rounded-xl hover:bg-[#E5AC00] transition-all shadow-[0_0_20px_rgba(255,192,0,0.2)] hover:shadow-[0_0_30px_rgba(255,192,0,0.4)] hover:-translate-y-0.5">
            <Plus className="w-5 h-5" strokeWidth={3} />
            New Shipment
          </Link>
        </div>

        {/* Filter Bar */}
        <div className="mb-8">
          {/* Desktop: Pill filters */}
          <div className="hidden sm:flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 mr-2 text-gray-500">
              <Filter className="w-4 h-4" />
              <span className="text-sm font-semibold">Filter:</span>
            </div>
            {filterOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setActiveFilter(opt.key)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-200 ${
                  activeFilter === opt.key
                    ? `${opt.activeBg} ${opt.color} ${opt.activeBorder} shadow-lg`
                    : 'bg-[#1A1A1A] text-gray-400 border-[#333333] hover:border-[#555] hover:text-white'
                }`}
              >
                {opt.icon}
                {opt.label}
                <span className={`ml-1 text-xs font-bold px-1.5 py-0.5 rounded-md ${
                  activeFilter === opt.key ? 'bg-white/10' : 'bg-black/40'
                }`}>
                  {opt.count}
                </span>
              </button>
            ))}
            {activeFilter !== 'all' && (
              <button
                onClick={() => setActiveFilter('all')}
                className="ml-1 p-2 rounded-lg text-gray-500 hover:text-white hover:bg-[#1A1A1A] transition-colors"
                title="Clear filter"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Mobile: Dropdown */}
          <div className="sm:hidden relative">
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className="w-full flex items-center justify-between px-4 py-3 bg-[#1A1A1A] border border-[#333333] rounded-xl text-sm font-semibold text-white"
            >
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#FFC000]" />
                <span>{currentFilter.label}</span>
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-white/10 text-gray-300">{currentFilter.count}</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
            </button>
            {filterOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#1A1A1A] border border-[#333333] rounded-xl shadow-2xl z-30 overflow-hidden">
                {filterOptions.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => { setActiveFilter(opt.key); setFilterOpen(false); }}
                    className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold transition-colors ${
                      activeFilter === opt.key
                        ? `${opt.activeBg} ${opt.color}`
                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {opt.icon}
                      {opt.label}
                    </div>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${
                      activeFilter === opt.key ? 'bg-white/10' : 'bg-black/40'
                    }`}>
                      {opt.count}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Track Shipment */}
        <div className="bg-[#1A1A1A] rounded-2xl border border-[#333333] p-1 shadow-2xl mb-10">
            <div className="bg-black/40 rounded-xl p-6 sm:p-8 backdrop-blur-sm">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <Search className="w-5 h-5 text-[#FFC000]" />
                    Track a Shipment
                </h2>
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-[#FFC000] transition-colors" />
                    <input
                        type="text"
                        value={trackingInput}
                        onChange={(e) => setTrackingInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleTrack()}
                        placeholder="Enter tracking number (e.g. TRK-A1B2C3D4)"
                        className="w-full pl-12 pr-4 py-4 bg-black border border-[#333333] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#FFC000] focus:ring-1 focus:ring-[#FFC000] transition-all font-medium"
                    />
                    </div>
                    <button onClick={handleTrack} className="px-8 py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors shadow-lg">
                    Track Now
                    </button>
                </div>
                {trackError && <p className="text-red-400 text-sm mt-3">{trackError}</p>}
            </div>
        </div>

        {/* Recent Shipments */}
        <div className="bg-[#1A1A1A] rounded-2xl border border-[#333333] overflow-hidden">
          <div className="p-6 border-b border-[#333333] flex justify-between items-center">
            <h2 className="text-lg font-bold text-white">Recent Shipments</h2>
          </div>
          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading shipments...</div>
          ) : filteredShipments.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">{activeFilter === 'all' ? 'No shipments yet. Create your first shipment!' : `No ${currentFilter.label.toLowerCase()} shipments.`}</p>
              {activeFilter !== 'all' && (
                <button onClick={() => setActiveFilter('all')} className="mt-3 text-sm text-[#FFC000] hover:text-white font-semibold transition-colors">
                  Clear filter
                </button>
              )}
            </div>
          ) : (
          <div className="divide-y divide-[#333333]">
            {filteredShipments.map((shipment) => (
              <div key={shipment.id} onClick={() => navigate(`/shipment/${shipment.id}`)} className="p-6 hover:bg-white/5 transition-colors group cursor-pointer">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center border border-[#333333] group-hover:border-[#FFC000]/50 transition-colors">
                      <Package className="w-6 h-6 text-[#FFC000]" strokeWidth={2} />
                    </div>
                    <div>
                      <p className="font-bold text-white text-lg">{shipment.tracking_number}</p>
                      <p className="text-xs text-gray-500 font-mono">Booked: {new Date(shipment.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`self-start sm:self-center px-3 py-1.5 rounded-lg text-xs font-bold border ${statusColor(shipment.status)} uppercase tracking-wider`}>
                      {shipment.status}
                    </span>
                    {shipment.status === 'Delivered' && (
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(shipment.id); }} className="p-2 text-gray-500 hover:text-red-400 transition-colors" title="Delete shipment">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="pl-[64px] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <span className="group-hover:text-white transition-colors">{shipment.delivery_address}</span>
                  </div>
                  {shipment.receiver_name && (
                    <div className="flex items-center gap-2 text-sm text-gray-400 bg-black/50 px-3 py-1 rounded-lg border border-[#333333] w-fit">
                      <Clock className="w-3.5 h-3.5 text-[#FFC000]" />
                      <span>To: <span className="text-white font-medium">{shipment.receiver_name}</span></span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard;