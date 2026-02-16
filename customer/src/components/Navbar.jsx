import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Package } from 'lucide-react';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Profile', path: '/profile' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 bg-black border-b border-[#333333] shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
               <div className="absolute inset-0 bg-[#FFC000] rounded-xl blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
               <div className="relative p-2 bg-[#FFC000] rounded-xl shadow-lg shadow-[#FFC000]/20">
                  <Package className="w-6 h-6 text-black" strokeWidth={2.5} />
               </div>
            </div>
            <div className="flex flex-col">
                <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-white tracking-tight">Smart<span className="text-[#FFC000]">Postal</span></span>
                    <span className="text-[10px] bg-[#FFC000] text-black px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Customer</span>
                </div>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                  isActive(link.path)
                    ? 'bg-[#1A1A1A] text-[#FFC000] border border-[#333333] shadow-lg'
                    : 'text-gray-400 hover:bg-[#1A1A1A] hover:text-white'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              to="/login"
              className="px-5 py-2.5 text-sm font-bold text-gray-300 hover:text-[#FFC000] transition-colors"
            >
              Log In
            </Link>
            <Link
              to="/register"
              className="px-6 py-2.5 text-sm font-bold text-black bg-[#FFC000] rounded-xl hover:bg-[#E5AC00] transition-all shadow-lg shadow-[#FFC000]/20 hover:shadow-[#FFC000]/40 hover:-translate-y-0.5"
            >
              Sign Up
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-xl text-gray-400 hover:bg-[#1A1A1A] hover:text-[#FFC000] transition-colors"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden border-t border-[#333333] bg-black/95 backdrop-blur-xl absolute w-full left-0">
          <div className="px-4 py-4 space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsOpen(false)}
                className={`block px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  isActive(link.path)
                    ? 'bg-[#FFC000] text-black shadow-lg shadow-[#FFC000]/20'
                    : 'text-gray-300 hover:bg-[#1A1A1A] hover:text-[#FFC000]'
                }`}
              >
                {link.name}
              </Link>
            ))}
            <div className="h-px bg-[#333333] my-2"></div>
            <Link
              to="/login"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-3 rounded-xl text-sm font-bold text-gray-300 hover:bg-[#1A1A1A] hover:text-white transition-colors"
            >
              Log In
            </Link>
            <Link
              to="/register"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-3 rounded-xl text-sm font-bold text-black bg-[#FFC000] text-center shadow-lg shadow-[#FFC000]/20"
            >
              Sign Up
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;