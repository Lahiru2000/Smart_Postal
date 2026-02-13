import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Package } from 'lucide-react';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Profile', path: '/profile' }, // <--- Added Profile Link Here
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="p-1.5 bg-pink-300 rounded-lg">
              <Package className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-[#1e3a8a]">InstaShipin</span>
            <span className="text-xs bg-blue-100 text-[#1e3a8a] px-2 py-0.5 rounded-full font-medium ml-1">Courier</span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(link.path)
                    ? 'bg-[#1e3a8a] text-white'
                    : 'text-slate-600 hover:bg-blue-50 hover:text-[#1e3a8a]'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/login"
              className="px-5 py-2 text-sm font-medium text-[#1e3a8a] border border-[#1e3a8a] rounded-lg hover:bg-blue-50 transition-colors"
            >
              Log In
            </Link>
            <Link
              to="/register"
              className="px-5 py-2 text-sm font-medium text-white bg-[#1e3a8a] rounded-lg hover:bg-blue-900 transition-colors shadow-md shadow-blue-900/20"
            >
              Sign Up
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-gray-100"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsOpen(false)}
                className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive(link.path)
                    ? 'bg-[#1e3a8a] text-white'
                    : 'text-slate-600 hover:bg-blue-50 hover:text-[#1e3a8a]'
                }`}
              >
                {link.name}
              </Link>
            ))}
            <hr className="my-2 border-gray-100" />
            <Link
              to="/login"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2.5 rounded-lg text-sm font-medium text-[#1e3a8a] hover:bg-blue-50 transition-colors"
            >
              Log In
            </Link>
            <Link
              to="/register"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-[#1e3a8a] text-center hover:bg-blue-900 transition-colors"
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