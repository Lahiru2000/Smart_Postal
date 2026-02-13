import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight } from 'lucide-react';

const Login = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8] p-4">
      <div className="max-w-5xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
        
        {/* Left Side - Illustration */}
        <div className="hidden md:flex md:w-1/2 bg-[#dbeafe] flex-col items-center justify-center relative p-12">
          {/* Background Pattern/Gradient */}
          <div className="absolute inset-0 bg-blue-100/50"></div>
          
          {/* Content */}
          <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
            {/* Placeholder for the illustration - Replace src with your actual image asset */}
            <img 
              src="https://img.freepik.com/free-vector/delivery-staff-ride-motorcycles-sending-parcels-customers_1150-52219.jpg?w=900&t=st=1709400000~exp=1709400600~hmac=example" 
              alt="Delivery Illustration" 
              className="w-full max-w-sm object-contain mix-blend-multiply mb-8"
            />
            
            <div className="flex items-center gap-3 text-[#1e3a8a] font-bold text-2xl mt-auto">
              <div className="p-2 bg-pink-300 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <span>InstaShipin</span>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full md:w-1/2 p-8 md:p-16 flex flex-col justify-center">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-[#1e3a8a] mb-2">Welcome to InstaShipin</h2>
            <p className="text-slate-500 italic text-lg">Ship Smarter Today</p>
          </div>

          <form className="space-y-6">
            {/* Username/Email Input */}
            <div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Username or email"
                  className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-lg text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#1e3a8a] transition-all"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  placeholder="Password"
                  className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-lg text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#1e3a8a] transition-all"
                />
              </div>
            </div>

            {/* Options Row */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600 hover:text-slate-800">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-gray-300 text-[#1e3a8a] focus:ring-[#1e3a8a]" 
                />
                <span>Remember Me</span>
              </label>
              <a href="#" className="text-slate-500 hover:text-[#1e3a8a] transition-colors">
                Forgot Password?
              </a>
            </div>

            {/* Sign In Button */}
            <button 
              type="submit"
              className="w-full sm:w-auto px-10 py-3.5 bg-[#1e3a8a] hover:bg-blue-900 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20 mt-4"
            >
              Sign In
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>

          {/* Link to Register */}
          <div className="mt-8 text-slate-500 text-sm">
            Don't have an account?{' '}
            <Link to="/register" className="text-[#1e3a8a] font-semibold hover:underline">
              Create Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;