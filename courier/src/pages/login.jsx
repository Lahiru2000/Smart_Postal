import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Package, Eye, Zap, Shield, TrendingUp } from 'lucide-react';
import { loginUser } from '../services/api';

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await loginUser({ ...formData, role: 'courier' });
      localStorage.setItem('token', res.data.access_token);
      localStorage.setItem('role', res.data.role);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4 font-sans selection:bg-[#FFC000] selection:text-black">
      <div className="max-w-6xl w-full bg-[#1A1A1A] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col md:flex-row border border-[#333333]">
        
        {/* Left Side - Branding (Bright Yellow) */}
        <div className="hidden md:flex md:w-1/2 bg-[#FFC000] flex-col items-center justify-center relative p-12 overflow-hidden">
          {/* Abstract Pattern */}
          <div className="absolute inset-0 opacity-10 pointer-events-none">
             <div className="absolute top-[-20%] left-[-20%] w-[150%] h-[150%] bg-[radial-gradient(circle,black_1px,transparent_1px)] bg-[size:20px_20px]"></div>
          </div>
          
          <div className="relative z-10 w-full h-full flex flex-col items-center justify-center text-black">
            <div className="mb-10 text-center">
              <div className="inline-flex p-4 bg-black rounded-3xl mb-6 shadow-2xl">
                <Package className="w-12 h-12 text-[#FFC000]" strokeWidth={2.5} />
              </div>
              <h1 className="text-5xl font-black mb-2 tracking-tight">Smart<span className="opacity-70">Postal</span></h1>
              <p className="text-black/80 text-lg font-bold">Intelligent Delivery Solutions</p>
            </div>

            <div className="grid gap-4 w-full max-w-sm">
              {[
                { title: "Instant Payments", desc: "Get paid within 24 hours", icon: <Zap /> },
                { title: "Full Insurance", desc: "Complete driver coverage", icon: <Shield /> },
                { title: "Track Earnings", desc: "Real-time analytics", icon: <TrendingUp /> }
              ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 bg-black/5 rounded-2xl border border-black/10 backdrop-blur-sm">
                    <div className="p-2 bg-black rounded-xl text-[#FFC000]">
                        {React.cloneElement(item.icon, { size: 20, strokeWidth: 3 })}
                    </div>
                    <div>
                        <p className="font-bold text-black leading-tight">{item.title}</p>
                        <p className="text-xs font-semibold text-black/60">{item.desc}</p>
                    </div>
                  </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side - Login Form (Dark Mode) */}
        <div className="w-full md:w-1/2 p-8 md:p-16 flex flex-col justify-center bg-[#1A1A1A]">
          <div className="mb-10">
            {/* Mobile Logo */}
            <div className="md:hidden flex items-center gap-3 mb-8">
              <div className="p-2 bg-[#FFC000] rounded-xl">
                <Package className="w-6 h-6 text-black" strokeWidth={3} />
              </div>
              <span className="text-xl font-bold text-white">Smart<span className="text-[#FFC000]">Postal</span></span>
            </div>

            <h2 className="text-4xl font-bold text-white mb-3 tracking-tight">Welcome Back</h2>
            <p className="text-gray-400 font-medium">Sign in to access your courier dashboard.</p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm font-medium">
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-500 group-focus-within:text-[#FFC000] transition-colors" />
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="name@example.com"
                  className="w-full pl-12 pr-4 py-4 bg-black border border-[#333333] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#FFC000] focus:ring-1 focus:ring-[#FFC000] transition-all font-medium"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-500 group-focus-within:text-[#FFC000] transition-colors" />
                </div>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 py-4 bg-black border border-[#333333] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#FFC000] focus:ring-1 focus:ring-[#FFC000] transition-all font-medium"
                  required
                />
                <button type="button" className="absolute inset-y-0 right-0 pr-4 flex items-center">
                  <Eye className="h-5 w-5 text-gray-600 hover:text-gray-300 transition-colors" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center">
                    <input type="checkbox" className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-gray-600 bg-black checked:border-[#FFC000] checked:bg-[#FFC000] transition-all" />
                    <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none opacity-0 peer-checked:opacity-100 text-black" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <span className="text-sm text-gray-400 group-hover:text-white font-medium transition-colors">Remember me</span>
              </label>
              <a href="#" className="text-sm font-bold text-[#FFC000] hover:text-[#FFD700] hover:underline">
                Forgot password?
              </a>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full px-8 py-4 bg-[#FFC000] hover:bg-[#E5AC00] text-black font-bold text-lg rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#FFC000]/20 hover:shadow-[#FFC000]/40 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing In...' : 'Sign In'}
              {!loading && <ArrowRight className="w-5 h-5" strokeWidth={2.5} />}
            </button>
          </form>

          <div className="mt-10 pt-6 border-t border-[#333333] text-center">
            <p className="text-gray-400 font-medium">
              New to SmartPostal?{' '}
              <Link to="/register" className="text-[#FFC000] font-bold hover:underline">
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;