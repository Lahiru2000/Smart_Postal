import React from 'react';
import { User, MapPin, Package, Phone, Mail, Edit } from 'lucide-react';

export default function CustomerProfile() {
  // Mock data - replace with actual data from your backend
  const user = {
    name: "John Anderson",
    email: "john.anderson@example.com",
    phone: "+94 77 123 4567",
    address: "123 Galle Road, Colombo 03, Sri Lanka",
    orders: [
      { id: "TRK-001", date: "2023-10-24", status: "Delivered", amount: "Rs. 1,500" },
      { id: "TRK-002", date: "2023-10-28", status: "In Transit", amount: "Rs. 2,300" },
      { id: "TRK-003", date: "2023-11-01", status: "Processing", amount: "Rs. 4,000" },
    ]
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-800 mb-8">My Profile</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Left Column: Personal Info */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
              <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
                <User size={40} />
              </div>
              <h2 className="text-xl font-bold text-slate-800">{user.name}</h2>
              <p className="text-slate-500 text-sm">Customer</p>
              
              <button className="mt-4 w-full py-2 px-4 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 text-sm font-medium">
                <Edit size={16} /> Edit Profile
              </button>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-semibold text-slate-800 mb-4">Contact Details</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3 text-slate-600">
                  <Mail size={18} className="mt-1 text-blue-600" />
                  <span className="text-sm">{user.email}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-600">
                  <Phone size={18} className="text-blue-600" />
                  <span className="text-sm">{user.phone}</span>
                </div>
                <div className="flex items-start gap-3 text-slate-600">
                  <MapPin size={18} className="mt-1 text-blue-600" />
                  <span className="text-sm">{user.address}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Order History */}
          <div className="md:col-span-2">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Package className="text-blue-600" /> Recent Orders
                </h3>
                <a href="#" className="text-sm text-blue-600 hover:underline">View All</a>
              </div>

              <div className="space-y-4">
                {user.orders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:border-blue-100 transition-colors">
                    <div>
                      <p className="font-medium text-slate-800">{order.id}</p>
                      <p className="text-xs text-slate-500">{order.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-slate-800">{order.amount}</p>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        order.status === 'Delivered' ? 'bg-green-100 text-green-700' :
                        order.status === 'In Transit' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}