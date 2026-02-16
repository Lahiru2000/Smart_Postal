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
    // Updated border color to match the subtle dark theme
    <nav className="sticky top-0 z-50 bg-black border-b border-[#333333] shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20"> {/* Increased height slightly for premium feel */}
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              {/* Updated glow to specific CityCab Yellow */}
              <div className="absolute inset-0 bg-[#FFC000] rounded-2xl blur opacity-40 group-hover:opacity-60 transition-opacity duration-300"></div>
              <div className="relative bg-[#FFC000] p-2.5 rounded-xl shadow-lg shadow-[#FFC000]/20">
                <Package className="w-6 h-6 text-black" strokeWidth={2.5} />
              </div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-white tracking-tight">Smart</span>
                <span className="text-2xl font-bold text-[#FFC000]">Postal</span>
              </div>
              <span className="text-[11px] text-gray-400 font-medium tracking-wider uppercase">Driver Hub</span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                  isActive(link.path)
                    ? 'bg-[#FFC000] text-black shadow-lg shadow-[#FFC000]/25 translate-y-[-1px]'
                    : 'text-gray-400 hover:text-[#FFC000] hover:bg-[#1A1A1A]'
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
              className="px-5 py-2.5 text-sm font-bold text-gray-300 hover:text-white transition-colors"
            >
              Log In
            </Link>
            <Link
              to="/register"
              className="px-7 py-3 text-sm font-bold text-black bg-[#FFC000] rounded-xl hover:bg-[#E5AC00] transition-all shadow-lg shadow-[#FFC000]/20 hover:shadow-[#FFC000]/40 transform hover:-translate-y-0.5"
            >
              Sign Up
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-xl text-gray-300 hover:bg-[#1A1A1A] hover:text-[#FFC000] transition-colors"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden border-t border-[#333333] bg-black/95 backdrop-blur-xl absolute w-full">
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
            <div className="pt-4 mt-4 border-t border-[#333333] space-y-3">
              <Link
                to="/login"
                onClick={() => setIsOpen(false)}
                className="block w-full px-4 py-3 rounded-xl text-sm font-bold text-center text-gray-300 hover:bg-[#1A1A1A] transition-all"
              >
                Log In
              </Link>
              <Link
                to="/register"
                onClick={() => setIsOpen(false)}
                className="block w-full px-4 py-3 rounded-xl text-sm font-bold text-black bg-[#FFC000] text-center shadow-lg shadow-[#FFC000]/20"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;