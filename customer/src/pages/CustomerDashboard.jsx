import React from 'react';
import { Link } from 'react-router-dom';
import { Package, Send, CheckCircle, Clock, MapPin, Search, Plus, ArrowUpRight, Truck, Box } from 'lucide-react';


const CustomerDashboard = () => {
  // Placeholder data
  const stats = [
    { label: 'Active Shipments', value: '3', icon: <Send className="w-6 h-6" />, bg: 'bg-[#FFC000]', text: 'text-black' },
    { label: 'Delivered', value: '28', icon: <CheckCircle className="w-6 h-6" />, bg: 'bg-green-500', text: 'text-black' },
    { label: 'In Transit', value: '2', icon: <Truck className="w-6 h-6" />, bg: 'bg-blue-500', text: 'text-white' },
    { label: 'Total Shipments', value: '33', icon: <Box className="w-6 h-6" />, bg: 'bg-gray-700', text: 'text-white' },
  ];

  const recentShipments = [
    { id: 'SHP-1024', to: '456 Oak Ave, New York', status: 'In Transit', date: 'Feb 13, 2026', eta: 'Feb 15, 2026' },
    { id: 'SHP-1023', to: '321 Elm Blvd, Boston', status: 'Delivered', date: 'Feb 11, 2026', eta: 'Feb 12, 2026' },
    { id: 'SHP-1022', to: '888 Maple Dr, Chicago', status: 'Delivered', date: 'Feb 9, 2026', eta: 'Feb 10, 2026' },
    { id: 'SHP-1021', to: '777 Walnut Ave, Miami', status: 'Pending', date: 'Feb 13, 2026', eta: 'Feb 16, 2026' },
  ];

  const statusColor = (status) => {
    switch (status) {
      case 'In Transit': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Delivered': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'Pending': return 'bg-[#FFC000]/10 text-[#FFC000] border-[#FFC000]/20';
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

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {stats.map((stat, i) => (
            <div key={i} className="group bg-[#1A1A1A] rounded-2xl p-6 border border-[#333333] hover:border-[#FFC000]/50 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg} ${stat.text} shadow-lg group-hover:scale-110 transition-transform`}>
                  {React.cloneElement(stat.icon, { strokeWidth: 2.5 })}
                </div>
                <div className="p-1.5 bg-black rounded-lg border border-[#333333] group-hover:border-[#FFC000]/30 transition-colors">
                    <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-[#FFC000]" />
                </div>
              </div>
              <p className="text-4xl font-bold text-white tracking-tight mb-1">{stat.value}</p>
              <p className="text-sm text-gray-400 font-medium">{stat.label}</p>
            </div>
          ))}
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
                        placeholder="Enter tracking number (e.g. SHP-1024)"
                        className="w-full pl-12 pr-4 py-4 bg-black border border-[#333333] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#FFC000] focus:ring-1 focus:ring-[#FFC000] transition-all font-medium"
                    />
                    </div>
                    <button className="px-8 py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors shadow-lg">
                    Track Now
                    </button>
                </div>
            </div>
        </div>

        {/* Recent Shipments */}
        <div className="bg-[#1A1A1A] rounded-2xl border border-[#333333] overflow-hidden">
          <div className="p-6 border-b border-[#333333] flex justify-between items-center">
            <h2 className="text-lg font-bold text-white">Recent Shipments</h2>
            <button className="text-sm font-bold text-[#FFC000] hover:text-white transition-colors">View All History</button>
          </div>
          <div className="divide-y divide-[#333333]">
            {recentShipments.map((shipment) => (
              <div key={shipment.id} className="p-6 hover:bg-white/5 transition-colors group cursor-pointer">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center border border-[#333333] group-hover:border-[#FFC000]/50 transition-colors">
                      <Package className="w-6 h-6 text-[#FFC000]" strokeWidth={2} />
                    </div>
                    <div>
                      <p className="font-bold text-white text-lg">{shipment.id}</p>
                      <p className="text-xs text-gray-500 font-mono">Booked: {shipment.date}</p>
                    </div>
                  </div>
                  <span className={`self-start sm:self-center px-3 py-1.5 rounded-lg text-xs font-bold border ${statusColor(shipment.status)} uppercase tracking-wider`}>
                    {shipment.status}
                  </span>
                </div>
                
                <div className="pl-[64px] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <span className="group-hover:text-white transition-colors">{shipment.to}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400 bg-black/50 px-3 py-1 rounded-lg border border-[#333333] w-fit">
                    <Clock className="w-3.5 h-3.5 text-[#FFC000]" />
                    <span>ETA: <span className="text-white font-medium">{shipment.eta}</span></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard;