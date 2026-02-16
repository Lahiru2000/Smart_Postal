import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Truck, CheckCircle, Clock, MapPin, TrendingUp, Star, ArrowUpRight, Zap, Calendar } from 'lucide-react';
import { getShipments, updateShipment } from '../services/api';

const CourierDashboard = () => {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const handleAccept = async (id) => {
    try {
      await updateShipment(id, { status: 'In Transit' });
      fetchShipments();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to accept shipment');
    }
  };

  const handleDeliver = async (id) => {
    try {
      await updateShipment(id, { status: 'Delivered' });
      fetchShipments();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to mark as delivered');
    }
  };

  // Compute stats from real data
  const activeCount = shipments.filter(s => s.status === 'In Transit' && s.courier_id).length;
  const deliveredCount = shipments.filter(s => s.status === 'Delivered').length;
  const pendingCount = shipments.filter(s => s.status === 'Pending').length;

  const stats = [
    { 
      label: 'Active Deliveries', 
      value: String(activeCount), 
      icon: <Truck className="w-6 h-6" strokeWidth={2.5} />, 
      bg: 'bg-[#FFC000]'
    },
    { 
      label: 'Completed', 
      value: String(deliveredCount), 
      icon: <CheckCircle className="w-6 h-6" strokeWidth={2.5} />, 
      bg: 'bg-green-500'
    },
    { 
      label: 'Pending Pickup', 
      value: String(pendingCount), 
      icon: <Clock className="w-6 h-6" strokeWidth={2.5} />, 
      bg: 'bg-orange-500'
    },
  ];

  const statusStyles = {
    'In Transit': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'Delivered': 'bg-green-500/10 text-green-400 border-green-500/20',
    'Pending': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-[#FFC000] rounded-xl flex items-center justify-center shadow-lg shadow-[#FFC000]/20">
                <Zap className="w-6 h-6 text-black" strokeWidth={2.5} />
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
            </div>
            <p className="text-gray-400 font-medium">Overview for {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          </div>
          
          <button className="px-5 py-2.5 bg-[#1A1A1A] hover:bg-[#252525] text-white border border-[#333333] rounded-xl font-bold text-sm transition-all flex items-center gap-2">
             <Calendar className="w-4 h-4 text-[#FFC000]" />
             View Schedule
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          {stats.map((stat, i) => (
            <div key={i} className="group bg-[#1A1A1A] rounded-2xl p-6 border border-[#333333] hover:border-[#FFC000] transition-all duration-300 shadow-xl">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg} text-black shadow-lg group-hover:scale-110 transition-transform`}>
                  {stat.icon}
                </div>
              </div>
              <p className="text-3xl font-bold text-white mb-1 tracking-tight">{stat.value}</p>
              <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Recent Deliveries */}
          <div className="lg:col-span-2 bg-[#1A1A1A] rounded-2xl border border-[#333333] overflow-hidden">
            <div className="p-6 border-b border-[#333333] flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">Shipments</h2>
            </div>
            {loading ? (
              <div className="p-12 text-center text-gray-400">Loading shipments...</div>
            ) : shipments.length === 0 ? (
              <div className="p-12 text-center text-gray-400">No shipments available.</div>
            ) : (
            <div className="divide-y divide-[#333333]">
              {shipments.map((delivery) => (
                <div key={delivery.id} className="p-5 hover:bg-white/5 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[#252525] rounded-lg text-[#FFC000]">
                        <Package className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm">{delivery.tracking_number}</p>
                        <p className="text-xs text-gray-500">{new Date(delivery.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${statusStyles[delivery.status] || 'bg-gray-800 text-gray-400'}`}>
                          {delivery.status}
                      </span>
                      {delivery.status === 'Pending' && (
                        <button onClick={() => handleAccept(delivery.id)} className="px-3 py-1 bg-[#FFC000] text-black text-xs font-bold rounded-lg hover:bg-[#E5AC00] transition-colors">
                          Accept
                        </button>
                      )}
                      {delivery.status === 'In Transit' && delivery.courier_id && (
                        <button onClick={() => handleDeliver(delivery.id)} className="px-3 py-1 bg-green-500 text-black text-xs font-bold rounded-lg hover:bg-green-400 transition-colors">
                          Delivered
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="pl-12 space-y-2">
                     <div className="flex items-center gap-2 text-sm text-gray-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-600"></div>
                        <span className="truncate">{delivery.pickup_address}</span>
                     </div>
                     <div className="flex items-center gap-2 text-sm text-gray-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#FFC000]"></div>
                        <span className="truncate text-gray-200">{delivery.delivery_address}</span>
                     </div>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>

          {/* Quick Actions & Profile */}
          <div className="space-y-6">
            <div className="bg-[#FFC000] rounded-2xl p-6 text-black shadow-lg shadow-[#FFC000]/10">
              <h3 className="font-bold text-xl mb-1">Driver Status</h3>
              <p className="text-black/70 font-medium mb-6 text-sm">You are currently online and visible.</p>
              
              <div className="space-y-3">
                <button className="w-full py-3 bg-black text-white rounded-xl font-bold text-sm hover:bg-gray-900 transition-colors shadow-lg">
                    Go Offline
                </button>
                <button className="w-full py-3 bg-black/10 text-black rounded-xl font-bold text-sm hover:bg-black/20 transition-colors">
                    Vehicle Settings
                </button>
              </div>
            </div>

            <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-[#333333]">
                 <h3 className="font-bold text-white mb-4">Performance Score</h3>
                 <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-400">Rating</span>
                            <span className="text-[#FFC000] font-bold">4.8/5.0</span>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-[#FFC000] w-[96%]"></div>
                        </div>
                    </div>
                 </div>
                 <div className="mt-6 pt-6 border-t border-[#333333] grid grid-cols-2 gap-4 text-center">
                    <div>
                        <p className="text-2xl font-bold text-white">98%</p>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mt-1">Acceptance</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-white">12m</p>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mt-1">Avg Time</p>
                    </div>
                 </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourierDashboard;