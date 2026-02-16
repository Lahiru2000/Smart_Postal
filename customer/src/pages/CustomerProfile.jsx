import React from 'react';
import { User, MapPin, Package, Phone, Mail, Edit, ArrowUpRight, Box } from 'lucide-react';

export default function CustomerProfile() {
  // Mock data
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

  const statusStyles = {
    'Delivered': 'bg-green-500/10 text-green-400 border-green-500/20',
    'In Transit': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'Processing': 'bg-[#FFC000]/10 text-[#FFC000] border-[#FFC000]/20',
  };

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
              
              <button className="w-full py-3 px-4 bg-white text-black rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 text-sm font-bold shadow-lg">
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
                <div className="flex items-start gap-3 text-gray-300 group">
                   <div className="p-2 bg-black rounded-lg border border-[#333333] group-hover:border-[#FFC000]/30 transition-colors">
                    <MapPin size={16} className="text-[#FFC000]" />
                   </div>
                  <span className="text-sm mt-1.5 leading-relaxed">{user.address}</span>
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
                {user.orders.map((order) => (
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
                      <span className={`text-xs font-bold px-3 py-1 rounded-lg border ${statusStyles[order.status]}`}>
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