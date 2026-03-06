import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Package, User, Mail, Phone, LogOut, Truck } from 'lucide-react';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [user, setUser] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const profileRef = useRef(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { setUser(null); }
    }
  }, [location]);

  // Close profile panel on outside click
  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isLoggedIn = !!localStorage.getItem('token');

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Routes', path: '/route-optimizer' },
  ];

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user');
    setUser(null);
    setProfileOpen(false);
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <nav className="sticky top-0 z-50 bg-[#111111] border-b border-[#222222] shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
               <div className="absolute inset-0 bg-[#FFC000] rounded-xl blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
               <div className="relative p-2 bg-[#FFC000] rounded-xl shadow-lg shadow-[#FFC000]/20">
                  <Package className="w-5 h-5 text-black" strokeWidth={2.5} />
               </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-white tracking-tight">Smart<span className="text-[#FFC000]">Postal</span></span>
              <span className="text-[9px] bg-[#FFC000] text-black px-2 py-0.5 rounded font-extrabold uppercase tracking-wider">Courier</span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  isActive(link.path)
                    ? 'text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              /* Profile Icon */
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="relative w-10 h-10 rounded-full border-2 border-[#FFC000] bg-[#1A1A1A] flex items-center justify-center text-[#FFC000] hover:bg-[#FFC000] hover:text-black transition-all duration-200 shadow-lg shadow-[#FFC000]/10"
                >
                  {user?.full_name ? (
                    <span className="text-xs font-bold">{getInitials(user.full_name)}</span>
                  ) : (
                    <User className="w-5 h-5" strokeWidth={2} />
                  )}
                </button>

                {/* Profile Dropdown Panel */}
                {profileOpen && (
                  <div className="absolute right-0 mt-3 w-80 bg-[#1A1A1A] border border-[#333333] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden z-50">
                    {/* Header */}
                    <div className="relative p-6 pb-5 bg-gradient-to-br from-[#1A1A1A] to-[#111111]">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-[#FFC000] rounded-full blur-[60px] opacity-10"></div>
                      <div className="flex items-center gap-4 relative">
                        <div className="w-14 h-14 rounded-full bg-[#FFC000] flex items-center justify-center text-black font-bold text-lg shadow-lg shadow-[#FFC000]/20 flex-shrink-0">
                          {user?.full_name ? getInitials(user.full_name) : <User size={24} />}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-white font-bold text-base truncate">{user?.full_name || 'User'}</h3>
                          <span className="text-[10px] bg-[#FFC000]/15 text-[#FFC000] px-2 py-0.5 rounded font-bold uppercase tracking-wider inline-block mt-1">Courier</span>
                        </div>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="px-6 py-4 space-y-3 border-t border-[#252525]">
                      <div className="flex items-center gap-3 text-gray-400">
                        <Mail size={15} className="text-[#FFC000] flex-shrink-0" />
                        <span className="text-sm truncate">{user?.email || '—'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-gray-400">
                        <Phone size={15} className="text-[#FFC000] flex-shrink-0" />
                        <span className="text-sm">{user?.phone || '—'}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="px-4 pb-4 pt-2 border-t border-[#252525] space-y-1">
                      <Link
                        to="/profile"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:bg-[#252525] hover:text-white transition-colors"
                      >
                        <User size={16} className="text-gray-500" />
                        View Profile
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <LogOut size={16} />
                        Log Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Auth Buttons */
              <div className="hidden md:flex items-center gap-3">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-semibold text-gray-300 hover:text-white transition-colors"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  className="px-5 py-2 text-sm font-bold text-black bg-[#FFC000] rounded-lg hover:bg-[#E5AC00] transition-all shadow-lg shadow-[#FFC000]/20 hover:shadow-[#FFC000]/40"
                >
                  Sign Up
                </Link>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 rounded-lg text-gray-400 hover:bg-[#1A1A1A] hover:text-[#FFC000] transition-colors"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden border-t border-[#222222] bg-[#111111]/95 backdrop-blur-xl absolute w-full left-0 z-40">
          <div className="px-4 py-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsOpen(false)}
                className={`block px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  isActive(link.path)
                    ? 'bg-[#FFC000] text-black shadow-lg shadow-[#FFC000]/20'
                    : 'text-gray-300 hover:bg-[#1A1A1A] hover:text-[#FFC000]'
                }`}
              >
                {link.name}
              </Link>
            ))}
            <div className="h-px bg-[#222222] my-2"></div>
            {isLoggedIn ? (
              <>
                <Link
                  to="/profile"
                  onClick={() => setIsOpen(false)}
                  className="block px-4 py-3 rounded-xl text-sm font-semibold text-gray-300 hover:bg-[#1A1A1A] hover:text-white transition-colors"
                >
                  Profile
                </Link>
                <button
                  onClick={() => { setIsOpen(false); handleLogout(); }}
                  className="block w-full text-left px-4 py-3 rounded-xl text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  Log Out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className="block px-4 py-3 rounded-xl text-sm font-semibold text-gray-300 hover:bg-[#1A1A1A] hover:text-white transition-colors"
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
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;