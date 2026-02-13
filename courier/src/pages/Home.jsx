import React from 'react';
import { Link } from 'react-router-dom';
import { Package, Truck, MapPin, Clock, Shield, ArrowRight, CheckCircle } from 'lucide-react';

const Home = () => {
  return (
    <div className="min-h-screen bg-[#f0f4f8]">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1e3a8a] via-blue-800 to-blue-900 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-pink-300 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-20 w-96 h-96 bg-blue-400 rounded-full blur-3xl"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-pink-300 rounded-lg">
                <Package className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold">InstaShipin</span>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium">Courier Portal</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
              Deliver Faster,<br />
              <span className="text-pink-300">Earn More.</span>
            </h1>
            <p className="text-lg md:text-xl text-blue-100 mb-8 max-w-xl">
              Join our network of trusted couriers. Manage your deliveries, track routes, and maximize your earnings — all in one place.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-[#1e3a8a] font-semibold rounded-xl hover:bg-blue-50 transition-all shadow-lg"
              >
                Get Started
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-white/30 text-white font-semibold rounded-xl hover:bg-white/10 transition-all"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-[#1e3a8a] mb-4">Why Deliver With Us?</h2>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto">
            Everything you need to manage your deliveries efficiently and grow your earnings.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: <Truck className="w-8 h-8" />,
              title: 'Smart Route Planning',
              desc: 'Get optimized delivery routes to save time and fuel on every trip.',
            },
            {
              icon: <MapPin className="w-8 h-8" />,
              title: 'Real-Time Tracking',
              desc: 'Track all your active deliveries with live location updates.',
            },
            {
              icon: <Clock className="w-8 h-8" />,
              title: 'Flexible Schedule',
              desc: 'Work on your own terms. Pick up deliveries when it suits you.',
            },
            {
              icon: <Shield className="w-8 h-8" />,
              title: 'Secure Payments',
              desc: 'Get paid reliably with transparent earnings and instant payouts.',
            },
            {
              icon: <Package className="w-8 h-8" />,
              title: 'Easy Parcel Management',
              desc: 'Scan, sort, and manage packages with our intuitive dashboard.',
            },
            {
              icon: <CheckCircle className="w-8 h-8" />,
              title: 'Performance Insights',
              desc: 'Track your delivery stats, ratings, and improvement areas.',
            },
          ].map((feature, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg transition-shadow border border-gray-100"
            >
              <div className="w-14 h-14 bg-blue-50 text-[#1e3a8a] rounded-xl flex items-center justify-center mb-5">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">{feature.title}</h3>
              <p className="text-slate-500">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-[#1e3a8a] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Start Delivering?</h2>
          <p className="text-blue-200 text-lg mb-8 max-w-xl mx-auto">
            Create your courier account today and start earning with every delivery.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-10 py-4 bg-white text-[#1e3a8a] font-semibold rounded-xl hover:bg-blue-50 transition-all shadow-lg"
          >
            Create Account
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-pink-300 rounded-lg">
              <Package className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-[#1e3a8a]">InstaShipin</span>
          </div>
          <p className="text-sm text-slate-400">&copy; 2026 InstaShipin. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
