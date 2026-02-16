import React from 'react';
import { Link } from 'react-router-dom';
import { Package, Send, Search, Clock, Shield, ArrowRight, CheckCircle, Zap } from 'lucide-react';

const Home = () => {
  return (
    <div className="min-h-screen bg-black font-sans selection:bg-[#FFC000] selection:text-black">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-black text-white border-b border-[#333333]">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-[#FFC000] rounded-full blur-[150px]"></div>
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[#1A1A1A] rounded-full blur-[100px]"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-36">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full bg-[#1A1A1A] border border-[#333333]">
              <div className="w-2 h-2 rounded-full bg-[#FFC000] animate-pulse"></div>
              <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">Global Logistics Network</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-black leading-[1.1] mb-8 tracking-tight">
              Ship Smarter.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFC000] to-yellow-200">Arrive Faster.</span>
            </h1>
            
            <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl leading-relaxed font-medium">
              Premium logistics solutions for the modern world. Real-time tracking, AI-optimized routing, and transparent pricing.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-5">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-[#FFC000] text-black font-bold text-lg rounded-xl hover:bg-[#E5AC00] transition-all shadow-[0_0_20px_rgba(255,192,0,0.3)] hover:shadow-[0_0_30px_rgba(255,192,0,0.5)] transform hover:-translate-y-1"
              >
                Get Started
                <ArrowRight className="w-5 h-5" strokeWidth={3} />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-[#1A1A1A] text-white font-bold text-lg rounded-xl border border-[#333333] hover:border-[#FFC000] hover:text-[#FFC000] transition-all"
              >
                Track Parcel
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 bg-black">
        <div className="text-center mb-20">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Why <span className="text-[#FFC000]">SmartPostal?</span></h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Engineered for reliability. Designed for speed.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: <Zap className="w-6 h-6" />,
              title: 'Instant Booking',
              desc: 'Book a delivery in seconds with our AI-powered interface.',
            },
            {
              icon: <Search className="w-6 h-6" />,
              title: 'Live Tracking',
              desc: 'Precision GPS tracking updates every 30 seconds.',
            },
            {
              icon: <Clock className="w-6 h-6" />,
              title: 'Express Delivery',
              desc: 'Same-day delivery options for urgent urban shipments.',
            },
            {
              icon: <Shield className="w-6 h-6" />,
              title: 'Full Insurance',
              desc: 'Comprehensive coverage for high-value items included.',
            },
            {
              icon: <Package className="w-6 h-6" />,
              title: 'Bulk Management',
              desc: 'Enterprise-grade tools for managing high-volume shipping.',
            },
            {
              icon: <CheckCircle className="w-6 h-6" />,
              title: 'Transparent Pricing',
              desc: 'Upfront quotes. No hidden surcharges. Ever.',
            },
          ].map((feature, i) => (
            <div
              key={i}
              className="group bg-[#1A1A1A] rounded-2xl p-8 border border-[#333333] hover:border-[#FFC000] transition-all duration-300 hover:shadow-2xl"
            >
              <div className="w-14 h-14 bg-black rounded-xl flex items-center justify-center mb-6 text-[#FFC000] border border-[#333333] group-hover:scale-110 transition-transform shadow-lg shadow-[#FFC000]/10">
                {React.cloneElement(feature.icon, { strokeWidth: 2.5 })}
              </div>
              <h3 className="text-xl font-bold text-white mb-3 group-hover:text-[#FFC000] transition-colors">{feature.title}</h3>
              <p className="text-gray-400 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 bg-[#FFC000] overflow-hidden">
         <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-black rounded-full blur-[80px]"></div>
             <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-black rounded-full blur-[80px]"></div>
         </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-black text-black mb-6 tracking-tight">Ready to Ship?</h2>
          <p className="text-black/80 text-xl mb-10 max-w-2xl mx-auto font-bold">
            Create your free account today and experience the future of logistics.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-3 px-10 py-5 bg-black text-[#FFC000] font-bold text-lg rounded-xl hover:bg-gray-900 transition-all shadow-2xl hover:-translate-y-1"
          >
            Create Account
            <ArrowRight className="w-6 h-6" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black border-t border-[#333333]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#FFC000] rounded-lg">
              <Package className="w-5 h-5 text-black" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-2xl text-white tracking-tight">Smart<span className="text-[#FFC000]">Postal</span></span>
          </div>
          <p className="text-sm text-gray-500 font-medium">&copy; 2026 SmartPostal Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;