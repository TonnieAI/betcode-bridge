// src/components/Footer.tsx
import { Link } from 'react-router-dom';
import { ArrowLeftRight, Twitter, Facebook, Instagram } from 'lucide-react';
import { BOOKMAKER_LIST } from '@/lib/bookmakers';

export function Footer() {
  return (
    <footer className="bg-[#0a0e1a] border-t border-[#1e293b] mt-20">
      <div className="section-padding py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-lg gold-gradient flex items-center justify-center">
                <ArrowLeftRight className="w-5 h-5 text-[#0a0e1a]" strokeWidth={2.5} />
              </div>
              <span className="text-lg font-bold">Bet<span className="gold-text">Code</span> Bridge</span>
            </Link>
            <p className="text-sm text-gray-400 leading-relaxed">
              The premier bet slip conversion platform for sportsbooks. Translate codes between bookmakers instantly.
            </p>
            <div className="flex gap-3 mt-4">
              <a href="#" className="w-9 h-9 rounded-lg bg-[#1e293b] flex items-center justify-center text-gray-400 hover:text-[#d4af37] transition-colors">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 rounded-lg bg-[#1e293b] flex items-center justify-center text-gray-400 hover:text-[#d4af37] transition-colors">
                <Facebook className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 rounded-lg bg-[#1e293b] flex items-center justify-center text-gray-400 hover:text-[#d4af37] transition-colors">
                <Instagram className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-semibold text-gray-200 mb-4">Platform</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link to="/convert" className="hover:text-[#d4af37] transition-colors">Convert Bet Slip</Link></li>
              <li><Link to="/dashboard" className="hover:text-[#d4af37] transition-colors">Dashboard</Link></li>
              <li><Link to="/history" className="hover:text-[#d4af37] transition-colors">History</Link></li>
              <li><Link to="/profile" className="hover:text-[#d4af37] transition-colors">Profile</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-200 mb-4">Bookmakers</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              {BOOKMAKER_LIST.slice(0, 6).map((b) => (
                <li key={b.id} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: b.color }} />
                  {b.name}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-200 mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="#" className="hover:text-[#d4af37] transition-colors">About</a></li>
              <li><Link to="/register" className="hover:text-[#d4af37] transition-colors">Create Account</Link></li>
              <li><a href="#" className="hover:text-[#d4af37] transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-[#d4af37] transition-colors">Privacy Policy</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-[#1e293b] mt-8 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} BetCode Bridge. Not affiliated with any bookmaker. For educational and convenience purposes only.
          </p>
          <p className="text-xs text-gray-500">
            18+ · Please gamble responsibly.
          </p>
        </div>
      </div>
    </footer>
  );
}