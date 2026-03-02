import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Package, User } from 'lucide-react';
import api from '../services/api';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef(null);
  const location = useLocation();

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Dashboard', path: '/dashboard' },
  ];

  const isActive = (path) => location.pathname === path;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    // Revoke refresh token on the server (best-effort)
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      try { await api.post('/auth/logout', { refresh_token: refreshToken }); } catch { /* ignore */ }
    }
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('role');
    localStorage.removeItem('userId');
    localStorage.removeItem('fullName');
    window.location.href = '/login';
  };

  return (
    <nav className="sticky top-0 z-50 bg-black border-b border-[#333333] shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Left Section: Logo & Links */}
          <div className="flex items-center gap-12">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative">
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
            <div className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`text-sm font-bold transition-all duration-300 ${
                    isActive(link.path)
                      ? 'text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>

          {/* Right Section: Profile Icon & Dropdown */}
          <div className="hidden md:flex items-center gap-4 relative" ref={dropdownRef}>
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="p-2 rounded-full border-2 border-[#FFC000] text-[#FFC000] hover:bg-[#FFC000]/10 transition-colors focus:outline-none"
            >
              <User className="w-6 h-6" />
            </button>

            {/* Profile Dropdown */}
            {isProfileOpen && (
              <div className="absolute right-0 top-14 w-48 bg-[#1A1A1A] border border-[#333333] rounded-xl shadow-xl py-2 overflow-hidden transform opacity-100 scale-100 transition-all duration-200">
                <Link
                  to="/profile"
                  onClick={() => setIsProfileOpen(false)}
                  className="block px-4 py-2.5 text-sm font-medium text-gray-300 hover:text-white hover:bg-[#252525] transition-colors"
                >
                  Profile
                </Link>
                <button
                  onClick={() => {
                    handleLogout();
                    setIsProfileOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-[#252525] transition-colors"
                >
                  Logout
                </button>
              </div>
            )}
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
            
            {/* Mobile Profile Actions */}
            <div className="pt-4 mt-4 border-t border-[#333333] space-y-2">
              <Link
                to="/profile"
                onClick={() => setIsOpen(false)}
                className="block px-4 py-3 rounded-xl text-sm font-bold text-gray-300 hover:bg-[#1A1A1A] hover:text-[#FFC000] transition-all"
              >
                Profile
              </Link>
              <button
                onClick={() => {
                  handleLogout();
                  setIsOpen(false);
                }}
                className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold text-red-400 hover:bg-[#1A1A1A] hover:text-red-300 transition-all"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;