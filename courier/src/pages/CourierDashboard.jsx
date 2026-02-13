import React from 'react';
import { Package, Truck, CheckCircle, Clock, MapPin, TrendingUp, Star, ArrowUpRight } from 'lucide-react';

const CourierDashboard = () => {
  // Placeholder data
  const stats = [
    { label: 'Active Deliveries', value: '5', icon: <Truck className="w-6 h-6" />, color: 'bg-blue-50 text-blue-600' },
    { label: 'Completed Today', value: '12', icon: <CheckCircle className="w-6 h-6" />, color: 'bg-green-50 text-green-600' },
    { label: 'Pending Pickup', value: '3', icon: <Clock className="w-6 h-6" />, color: 'bg-amber-50 text-amber-600' },
    { label: 'Total Earnings', value: '$248', icon: <TrendingUp className="w-6 h-6" />, color: 'bg-purple-50 text-purple-600' },
  ];

  const recentDeliveries = [
    { id: 'PKG-2341', from: '123 Main St', to: '456 Oak Ave', status: 'In Transit', time: '10 min ago' },
    { id: 'PKG-2340', from: '789 Pine Rd', to: '321 Elm Blvd', status: 'Delivered', time: '45 min ago' },
    { id: 'PKG-2339', from: '555 Cedar Ln', to: '888 Maple Dr', status: 'Delivered', time: '1 hr ago' },
    { id: 'PKG-2338', from: '222 Birch St', to: '777 Walnut Ave', status: 'Pending', time: '2 hrs ago' },
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#1e3a8a]">Courier Dashboard</h1>
          <p className="text-slate-500 mt-1">Welcome back! Here's your delivery overview.</p>
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

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Recent Deliveries */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-slate-800">Recent Deliveries</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {recentDeliveries.map((delivery) => (
                <div key={delivery.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                        <Package className="w-5 h-5 text-[#1e3a8a]" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{delivery.id}</p>
                        <p className="text-xs text-slate-400">{delivery.time}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(delivery.status)}`}>
                      {delivery.status}
                    </span>
                  </div>
                  <div className="ml-13 flex items-center gap-2 text-sm text-slate-500 mt-2">
                    <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{delivery.from}</span>
                    <span className="text-slate-300">→</span>
                    <span className="truncate">{delivery.to}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 h-fit">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-slate-800">Your Performance</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-50 rounded-full mb-3">
                  <Star className="w-10 h-10 text-green-500" />
                </div>
                <p className="text-4xl font-bold text-slate-800">4.8</p>
                <p className="text-sm text-slate-500">Average Rating</p>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">On-time Delivery</span>
                    <span className="font-semibold text-slate-800">96%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: '96%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">Acceptance Rate</span>
                    <span className="font-semibold text-slate-800">89%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: '89%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">Completion Rate</span>
                    <span className="font-semibold text-slate-800">98%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-purple-500 h-2 rounded-full" style={{ width: '98%' }}></div>
                  </div>
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
