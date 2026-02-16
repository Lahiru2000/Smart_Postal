import React from 'react';
import { Link } from 'react-router-dom';
import { Package, TrendingUp, Shield, Clock, Zap, ArrowRight, DollarSign, MapPin } from 'lucide-react';

const Home = () => {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-[#FFC000] selection:text-black">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Abstract Background Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[500px] h-[500px] bg-[#FFC000] rounded-full blur-[120px] opacity-10"></div>
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[#FFC000] rounded-full blur-[120px] opacity-5"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left Content */}
            <div className="space-y-10">
              <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-[#1A1A1A] rounded-full border border-[#333333] hover:border-[#FFC000]/50 transition-colors">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFC000] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[#FFC000]"></span>
                </div>
                <span className="text-xs font-bold text-gray-300 tracking-wide uppercase">Live Tracking • Real-time Updates</span>
              </div>

              <h1 className="text-5xl md:text-7xl font-extrabold leading-[1.1] tracking-tight">
                <span className="text-white">Drive Your Future</span>
                <br />
                <span className="text-[#FFC000]">Earn Your Way.</span>
              </h1>

              <p className="text-xl text-gray-400 max-w-xl leading-relaxed font-medium">
                Join Sri Lanka's premium delivery network. Professional tools for professional drivers.
              </p>

              <div className="flex flex-col sm:flex-row gap-5">
                <Link
                  to="/register"
                  className="group inline-flex items-center justify-center gap-3 px-8 py-4 bg-[#FFC000] text-black text-lg font-bold rounded-2xl shadow-[0_0_20px_rgba(255,192,0,0.3)] hover:shadow-[0_0_30px_rgba(255,192,0,0.5)] transition-all transform hover:-translate-y-1"
                >
                  Start Earning
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-transparent text-white text-lg font-bold rounded-2xl border-2 border-[#333333] hover:border-[#FFC000] hover:text-[#FFC000] hover:bg-[#1A1A1A] transition-all"
                >
                  Sign In
                </Link>
              </div>

              {/* Stats - Styled like the CityCab Cards */}
              <div className="grid grid-cols-3 gap-6 pt-8 border-t border-[#333333]">
                <div>
                  <p className="text-3xl font-bold text-[#FFC000]">5K+</p>
                  <p className="text-sm text-gray-500 font-semibold mt-1">Drivers</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-[#FFC000]">50K+</p>
                  <p className="text-sm text-gray-500 font-semibold mt-1">Deliveries</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-[#FFC000]">4.9</p>
                  <p className="text-sm text-gray-500 font-semibold mt-1">Rating</p>
                </div>
              </div>
            </div>

            {/* Right Content - Feature Grid */}
            <div className="relative">
              <div className="grid gap-5">
                {[
                    { title: "Instant Payments", desc: "Get paid immediately after every ride.", icon: <DollarSign className="w-6 h-6"/> },
                    { title: "Safe & Secure", desc: "24/7 support and real-time trip tracking.", icon: <Shield className="w-6 h-6"/> },
                    { title: "Flexible Schedule", desc: "Be your own boss. Work when you want.", icon: <Clock className="w-6 h-6"/> }
                ].map((item, i) => (
                    <div key={i} className="group p-6 bg-[#1A1A1A] rounded-2xl border border-[#333333] hover:border-[#FFC000] hover:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] transition-all duration-300">
                        <div className="w-12 h-12 bg-[#FFC000] rounded-xl flex items-center justify-center mb-4 text-black shadow-lg shadow-[#FFC000]/20 group-hover:scale-110 transition-transform duration-300">
                            {React.cloneElement(item.icon, { strokeWidth: 2.5 })}
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                        <p className="text-gray-400">{item.desc}</p>
                    </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dual Color Section - Matching Image 2 Bottom Layout */}
      <section className="flex flex-col md:flex-row">
        {/* Left: Black Side */}
        <div className="flex-1 bg-black py-20 px-8 md:px-16 border-t border-[#333333]">
            <div className="max-w-lg mx-auto md:mx-0">
                <h2 className="text-4xl font-bold text-white mb-8">Ride with <span className="text-[#FFC000]">SmartPostal</span></h2>
                <ul className="space-y-6">
                    {[
                        "Get picked up in minutes",
                        "Track your ride in real-time",
                        "Secure cashless payments"
                    ].map((item, i) => (
                        <li key={i} className="flex items-center gap-4 text-gray-300 font-medium text-lg">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#1A1A1A] border border-[#FFC000] flex items-center justify-center">
                                <div className="w-2.5 h-2.5 rounded-full bg-[#FFC000]"></div>
                            </div>
                            {item}
                        </li>
                    ))}
                </ul>
                <button className="mt-10 px-8 py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors flex items-center gap-2">
                    Download App <ArrowRight className="w-5 h-5"/>
                </button>
            </div>
        </div>

        {/* Right: Yellow Side */}
        <div className="flex-1 bg-[#FFC000] py-20 px-8 md:px-16 text-black">
             <div className="max-w-lg mx-auto md:mx-0">
                <h2 className="text-4xl font-bold mb-8">Drive & Earn</h2>
                <ul className="space-y-6">
                    {[
                        "Be your own boss",
                        "Flexible working hours",
                        "Instant daily payouts"
                    ].map((item, i) => (
                        <li key={i} className="flex items-center gap-4 font-bold text-lg text-gray-900">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-black flex items-center justify-center">
                                <div className="w-2.5 h-2.5 rounded-full bg-[#FFC000]"></div>
                            </div>
                            {item}
                        </li>
                    ))}
                </ul>
                <button className="mt-10 px-8 py-4 bg-black text-[#FFC000] font-bold rounded-xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all flex items-center gap-2">
                    Become a Driver <ArrowRight className="w-5 h-5"/>
                </button>
            </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black border-t border-[#333333] pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
                <div className="bg-[#FFC000] p-2 rounded-lg">
                    <Package className="w-6 h-6 text-black" />
                </div>
                <span className="text-2xl font-bold text-white">Smart<span className="text-[#FFC000]">Postal</span></span>
            </div>
          <p className="text-gray-500 text-sm">&copy; 2026 SmartPostal. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;