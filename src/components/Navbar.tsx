import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Menu, X, ChevronDown, LogOut, User as UserIcon, LayoutDashboard, History, ArrowLeftRight, Shield } from 'lucide-react';

export function Navbar() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0e1a]/90 backdrop-blur-md border-b border-[#1e293b]">
      <div className="section-padding h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-lg gold-gradient flex items-center justify-center">
            <ArrowLeftRight className="w-5 h-5 text-[#0a0e1a]" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-bold tracking-tight">
            Bet<span className="gold-text">Code</span> Bridge
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          <Link to="/" className="btn-ghost">Home</Link>
          <Link to="/convert" className="btn-ghost">Convert</Link>
          {user && <Link to="/dashboard" className="btn-ghost">Dashboard</Link>}
          {user && <Link to="/history" className="btn-ghost">History</Link>}
          {profile?.role === 'admin' && <Link to="/admin" className="btn-ghost">Admin</Link>}
        </div>

        {/* Auth area */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#1e293b] transition-colors"
              >
                {profile?.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#1e293b] flex items-center justify-center text-xs font-bold gold-text">
                    {profile?.username?.[0]?.toUpperCase() ?? 'U'}
                  </div>
                )}
                <span className="text-sm font-medium">{profile?.username ?? 'User'}</span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
              {userMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 bg-[#0f1623] border border-[#1e293b] rounded-xl shadow-2xl py-2"
                  onMouseLeave={() => setUserMenuOpen(false)}
                >
                  <Link to="/profile" className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#1e293b] transition-colors" onClick={() => setUserMenuOpen(false)}>
                    <UserIcon className="w-4 h-4 text-gray-400" /> Profile
                  </Link>
                  <Link to="/dashboard" className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#1e293b] transition-colors" onClick={() => setUserMenuOpen(false)}>
                    <LayoutDashboard className="w-4 h-4 text-gray-400" /> Dashboard
                  </Link>
                  <Link to="/history" className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#1e293b] transition-colors" onClick={() => setUserMenuOpen(false)}>
                    <History className="w-4 h-4 text-gray-400" /> History
                  </Link>
                  {profile?.role === 'admin' && (
                    <Link to="/admin" className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#1e293b] transition-colors" onClick={() => setUserMenuOpen(false)}>
                      <Shield className="w-4 h-4 text-gray-400" /> Admin Panel
                    </Link>
                  )}
                  <div className="border-t border-[#1e293b] my-1" />
                  <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="btn-ghost">Login</Link>
              <Link to="/register" className="btn-primary text-sm">Get Started</Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 text-gray-300">
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-[#0a0e1a] border-b border-[#1e293b] px-4 py-4 space-y-2">
          <Link to="/" className="block btn-ghost" onClick={() => setMobileOpen(false)}>Home</Link>
          <Link to="/convert" className="block btn-ghost" onClick={() => setMobileOpen(false)}>Convert</Link>
          {user && <Link to="/dashboard" className="block btn-ghost" onClick={() => setMobileOpen(false)}>Dashboard</Link>}
          {user && <Link to="/history" className="block btn-ghost" onClick={() => setMobileOpen(false)}>History</Link>}
          {user && <Link to="/profile" className="block btn-ghost" onClick={() => setMobileOpen(false)}>Profile</Link>}
          {profile?.role === 'admin' && <Link to="/admin" className="block btn-ghost" onClick={() => setMobileOpen(false)}>Admin</Link>}
          <div className="border-t border-[#1e293b] pt-2">
            {user ? (
              <button onClick={handleSignOut} className="w-full text-left px-4 py-2 text-red-400">Sign Out</button>
            ) : (
              <div className="flex gap-2">
                <Link to="/login" className="btn-secondary flex-1 text-center text-sm" onClick={() => setMobileOpen(false)}>Login</Link>
                <Link to="/register" className="btn-primary flex-1 text-center text-sm" onClick={() => setMobileOpen(false)}>Get Started</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
