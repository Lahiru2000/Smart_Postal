import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight, Package } from 'lucide-react';

const Register = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4 font-sans selection:bg-[#FFC000] selection:text-black">
      <div className="max-w-5xl w-full bg-[#1A1A1A] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col md:flex-row border border-[#333333]">
        
        {/* Left Side - Branding */}
        <div className="hidden md:flex md:w-1/2 bg-[#FFC000] flex-col items-center justify-center relative p-12 overflow-hidden">
           <div className="absolute inset-0 opacity-10 pointer-events-none">
             <div className="absolute top-[-20%] left-[-20%] w-[150%] h-[150%] bg-[radial-gradient(circle,black_1px,transparent_1px)] bg-[size:20px_20px]"></div>
          </div>
          
          <div className="relative z-10 w-full h-full flex flex-col items-center justify-center text-center">
             <div className="w-24 h-24 bg-black rounded-3xl flex items-center justify-center mb-8 shadow-2xl -rotate-3 transition-transform hover:-rotate-6">
                <Package className="w-10 h-10 text-[#FFC000]" strokeWidth={2.5} />
             </div>
            
            <h2 className="text-4xl font-black text-black mb-2">Create Account</h2>
            <p className="text-black/70 font-bold text-lg">Join SmartPostal Today</p>
          </div>
        </div>

        {/* Right Side - Register Form */}
        <div className="w-full md:w-1/2 p-8 md:p-16 flex flex-col justify-center bg-[#1A1A1A]">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Get Started</h2>
            <p className="text-gray-400">Join thousands of customers shipping smarter</p>
          </div>

          <form className="space-y-4">
            <div>
               <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Full Name</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-500 group-focus-within:text-[#FFC000] transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  className="w-full pl-12 pr-4 py-3.5 bg-black border border-[#333333] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#FFC000] focus:ring-1 focus:ring-[#FFC000] transition-all font-medium"
                />
              </div>
            </div>

            <div>
               <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-500 group-focus-within:text-[#FFC000] transition-colors" />
                </div>
                <input
                  type="email"
                  placeholder="name@example.com"
                  className="w-full pl-12 pr-4 py-3.5 bg-black border border-[#333333] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#FFC000] focus:ring-1 focus:ring-[#FFC000] transition-all font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Password</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-500 group-focus-within:text-[#FFC000] transition-colors" />
                    </div>
                    <input
                      type="password"
                      placeholder="••••••••"
                      className="w-full pl-12 pr-4 py-3.5 bg-black border border-[#333333] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#FFC000] focus:ring-1 focus:ring-[#FFC000] transition-all font-medium"
                    />
                  </div>
                </div>
                 <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Confirm</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-500 group-focus-within:text-[#FFC000] transition-colors" />
                    </div>
                    <input
                      type="password"
                      placeholder="••••••••"
                      className="w-full pl-12 pr-4 py-3.5 bg-black border border-[#333333] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#FFC000] focus:ring-1 focus:ring-[#FFC000] transition-all font-medium"
                    />
                  </div>
                </div>
            </div>

            <button 
              type="submit"
              className="w-full px-8 py-4 bg-[#FFC000] hover:bg-[#E5AC00] text-black font-bold text-lg rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#FFC000]/20 hover:-translate-y-0.5 mt-2"
            >
              Sign Up
              <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-[#333333] text-center">
            <p className="text-gray-400 font-medium">
              Already have an account?{' '}
              <Link to="/login" className="text-[#FFC000] font-bold hover:underline">
                Log In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;