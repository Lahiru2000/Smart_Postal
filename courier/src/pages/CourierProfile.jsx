import React from 'react';
import { User, Truck, Star, CheckCircle, Clock, DollarSign } from 'lucide-react';

export default function CourierProfile() {
  // Mock data
  const courier = {
    name: "Kamal Perera",
    id: "DVR-8842",
    vehicle: "TVS King (Three Wheeler)",
    plate: "ABC-1234",
    rating: 4.8,
    totalDeliveries: 1240,
    onlineHours: 45,
    earnings: "Rs. 85,000"
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-800 mb-8">Driver Profile</h1>

        {/* Header Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row items-center md:items-start gap-6">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center text-green-600">
            <User size={40} />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-2xl font-bold text-slate-800">{courier.name}</h2>
            <p className="text-slate-500 font-medium">ID: {courier.id}</p>
            <div className="flex items-center justify-center md:justify-start gap-2 mt-2 text-sm text-slate-600">
              <Truck size={16} />
              <span>{courier.vehicle} • {courier.plate}</span>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center bg-blue-50 p-4 rounded-lg min-w-[120px]">
            <span className="text-slate-500 text-xs uppercase font-bold tracking-wider">Rating</span>
            <div className="flex items-center gap-1 text-yellow-500 font-bold text-xl">
              <Star size={20} fill="currentColor" />
              <span>{courier.rating}</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 text-green-600 rounded-lg">
                <CheckCircle size={24} />
              </div>
              <div>
                <p className="text-slate-500 text-sm">Total Deliveries</p>
                <p className="text-2xl font-bold text-slate-800">{courier.totalDeliveries}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                <Clock size={24} />
              </div>
              <div>
                <p className="text-slate-500 text-sm">Hours Online</p>
                <p className="text-2xl font-bold text-slate-800">{courier.onlineHours}h</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
                <DollarSign size={24} />
              </div>
              <div>
                <p className="text-slate-500 text-sm">Month Earnings</p>
                <p className="text-2xl font-bold text-slate-800">{courier.earnings}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Vehicle Info / Verification */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-semibold text-slate-800 mb-4 border-b pb-2">Vehicle & Documents</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex justify-between p-3 bg-gray-50 rounded">
              <span className="text-slate-600 text-sm">Driving License</span>
              <span className="text-green-600 text-sm font-medium flex items-center gap-1"><CheckCircle size={14}/> Verified</span>
            </div>
            <div className="flex justify-between p-3 bg-gray-50 rounded">
              <span className="text-slate-600 text-sm">Insurance Policy</span>
              <span className="text-green-600 text-sm font-medium flex items-center gap-1"><CheckCircle size={14}/> Verified</span>
            </div>
            <div className="flex justify-between p-3 bg-gray-50 rounded">
              <span className="text-slate-600 text-sm">Vehicle Registration</span>
              <span className="text-green-600 text-sm font-medium flex items-center gap-1"><CheckCircle size={14}/> Verified</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}