import React from 'react';
import { User, Truck, Star, CheckCircle, Clock, DollarSign, Award, TrendingUp, Shield, MapPin, Calendar } from 'lucide-react';

export default function CourierProfile() {
  const courier = {
    name: "Kamal Perera",
    id: "DVR-8842",
    vehicle: "TVS King (Three Wheeler)",
    plate: "ABC-1234",
    rating: 4.8,
    totalDeliveries: 1240,
    onlineHours: 45,
    earnings: "Rs. 85,000",
    joinDate: "Jan 2024"
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 font-sans selection:bg-[#FFC000] selection:text-black">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-white tracking-tight">Driver Profile</h1>
            <button className="px-5 py-2.5 bg-[#1A1A1A] hover:bg-[#252525] border border-[#333333] hover:border-[#FFC000] rounded-xl text-sm font-bold transition-all">
                Edit Profile
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
                <h2 className="text-4xl font-bold text-white mb-2 tracking-tight">{courier.name}</h2>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                    <span className="px-3 py-1 rounded-lg bg-black border border-[#333333] text-gray-400 font-mono text-sm">
                        ID: <span className="text-[#FFC000] font-bold">{courier.id}</span>
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
                  <span className="text-white font-medium">{courier.vehicle}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#333333]"></div>
                  <span className="font-mono">{courier.plate}</span>
                </div>
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-[#333333]"></div>
                   <Calendar size={16} />
                   <span>Joined {courier.joinDate}</span>
                </div>
              </div>
            </div>

            {/* Rating Box */}
            <div className="bg-black/50 backdrop-blur-sm p-5 rounded-2xl border border-[#333333] flex flex-col items-center min-w-[120px]">
                <span className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Rating</span>
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-3xl font-bold text-white">{courier.rating}</span>
                    <Star size={24} className="text-[#FFC000] fill-[#FFC000]" />
                </div>
                <div className="flex gap-1">
                    {[1,2,3,4,5].map((s) => (
                        <div key={s} className={`h-1.5 w-4 rounded-full ${s <= Math.round(courier.rating) ? 'bg-[#FFC000]' : 'bg-gray-800'}`}></div>
                    ))}
                </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          {[
            { label: 'Total Deliveries', value: courier.totalDeliveries, icon: <CheckCircle size={24} />, color: 'text-green-400', bg: 'bg-green-400/10' },
            { label: 'Online Hours', value: `${courier.onlineHours}h`, icon: <Clock size={24} />, color: 'text-blue-400', bg: 'bg-blue-400/10' },
            { label: 'Month Earnings', value: courier.earnings, icon: <DollarSign size={24} />, color: 'text-[#FFC000]', bg: 'bg-[#FFC000]/10' },
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
    </div>
  );
}