import React from 'react';
import { Package, Send, CheckCircle, Clock, MapPin, Search, Plus, ArrowUpRight } from 'lucide-react';

const CustomerDashboard = () => {
  // Placeholder data
  const stats = [
    { label: 'Active Shipments', value: '3', icon: <Send className="w-6 h-6" />, color: 'bg-blue-50 text-blue-600' },
    { label: 'Delivered', value: '28', icon: <CheckCircle className="w-6 h-6" />, color: 'bg-green-50 text-green-600' },
    { label: 'In Transit', value: '2', icon: <Clock className="w-6 h-6" />, color: 'bg-amber-50 text-amber-600' },
    { label: 'Total Shipments', value: '33', icon: <Package className="w-6 h-6" />, color: 'bg-purple-50 text-purple-600' },
  ];

  const recentShipments = [
    { id: 'SHP-1024', to: '456 Oak Ave, New York', status: 'In Transit', date: 'Feb 13, 2026', eta: 'Feb 15, 2026' },
    { id: 'SHP-1023', to: '321 Elm Blvd, Boston', status: 'Delivered', date: 'Feb 11, 2026', eta: 'Feb 12, 2026' },
    { id: 'SHP-1022', to: '888 Maple Dr, Chicago', status: 'Delivered', date: 'Feb 9, 2026', eta: 'Feb 10, 2026' },
    { id: 'SHP-1021', to: '777 Walnut Ave, Miami', status: 'Pending', date: 'Feb 13, 2026', eta: 'Feb 16, 2026' },
  ];

  const statusColor = (status) => {
    switch (status) {
      case 'In Transit': return 'bg-blue-100 text-blue-700';
      case 'Delivered': return 'bg-green-100 text-green-700';
      case 'Pending': return 'bg-amber-100 text-amber-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f4f8]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#1e3a8a]">My Dashboard</h1>
            <p className="text-slate-500 mt-1">Track and manage all your shipments.</p>
          </div>
          <button className="inline-flex items-center gap-2 px-6 py-3 bg-[#1e3a8a] text-white font-medium rounded-xl hover:bg-blue-900 transition-colors shadow-lg shadow-blue-900/20">
            <Plus className="w-5 h-5" />
            New Shipment
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.color}`}>
                  {stat.icon}
                </div>
                <ArrowUpRight className="w-5 h-5 text-slate-300" />
              </div>
              <p className="text-3xl font-bold text-slate-800">{stat.value}</p>
              <p className="text-sm text-slate-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Track Shipment */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Track a Shipment</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Enter tracking number (e.g. SHP-1024)"
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#1e3a8a] transition-all"
              />
            </div>
            <button className="px-8 py-3 bg-[#1e3a8a] text-white font-medium rounded-xl hover:bg-blue-900 transition-colors shadow-md shadow-blue-900/20">
              Track
            </button>
          </div>
        </div>

        {/* Recent Shipments */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-slate-800">Recent Shipments</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {recentShipments.map((shipment) => (
              <div key={shipment.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Package className="w-5 h-5 text-[#1e3a8a]" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{shipment.id}</p>
                      <p className="text-xs text-slate-400">Booked: {shipment.date}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(shipment.status)}`}>
                    {shipment.status}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{shipment.to}</span>
                  </div>
                  <p className="text-xs text-slate-400">ETA: {shipment.eta}</p>
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
