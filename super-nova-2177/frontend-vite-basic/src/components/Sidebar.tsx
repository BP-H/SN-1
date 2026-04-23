
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Radio, MessageSquare, Network, Globe, LogOut, User as UserIcon, Bot, Building2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { user, logout, updateSpecies } = useAuth();

  const navItems = [
    { path: '/', label: 'DASHBOARD', icon: LayoutDashboard },
    { path: '/vibes', label: 'VIBE FEED', icon: Radio },
    { path: '/nexus', label: 'NEXUS AI', icon: MessageSquare },
    { path: '/graph', label: 'NETWORK', icon: Network },
    { path: '/gov', label: 'GOVERNANCE', icon: Globe },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        ></div>
      )}

      <div className={`fixed left-0 top-0 bottom-0 w-64 md:w-20 md:hover:w-64 transition-all duration-500 ease-out z-50 flex flex-col bg-black/95 md:bg-black/80 backdrop-blur-xl border-r border-white/10 group overflow-hidden ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        {/* Logo Area */}
        <div className="h-20 flex items-center justify-between px-4 md:justify-center relative shrink-0">
          <div className="flex items-center gap-4 md:gap-0">
            <div className="w-10 h-10 bg-gradient-to-br from-nova-purple to-nova-pink rounded-xl animate-spin-slow shadow-[0_0_20px_rgba(242,0,137,0.5)]"></div>
            <div className="md:absolute md:left-20 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
              <h1 className="font-orbitron font-bold text-white text-lg tracking-widest">SUPERNOVA</h1>
            </div>
          </div>
          <button onClick={onClose} className="md:hidden text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 flex flex-col gap-2 py-8 px-3">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`flex items-center h-12 px-3 rounded-xl transition-all duration-300 relative overflow-hidden ${isActive
                  ? 'bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                  : 'text-gray-500 hover:text-white hover:bg-white/5'
                  }`}
              >
                <Icon size={24} className={`shrink-0 ${isActive ? 'text-nova-cyan' : ''}`} />
                <span className={`ml-4 font-mono text-xs tracking-widest md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 whitespace-nowrap ${isActive ? 'text-nova-cyan' : ''}`}>
                  {item.label}
                </span>
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-nova-cyan shadow-[0_0_10px_var(--nova-cyan)]"></div>
                )}
              </Link>
            );
          })}
        </div>

        {/* User Section */}
        <div className="p-4 border-t border-white/10 bg-black/40">
          {user && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 overflow-hidden">
                <button className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center border transition-all ${user.species === 'ai' ? 'border-nova-acid text-nova-acid bg-nova-acid/10' :
                  user.species === 'company' ? 'border-nova-purple text-nova-purple bg-nova-purple/10' :
                    'border-nova-pink text-nova-pink bg-nova-pink/10'
                  }`}>
                  {user.species === 'ai' ? <Bot size={20} /> : user.species === 'company' ? <Building2 size={20} /> : <UserIcon size={20} />}
                </button>
                <div className="md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
                  <div className="text-white font-bold text-sm truncate max-w-[120px]">{user.username}</div>
                  <div className="text-xs text-gray-500 uppercase font-mono">{user.species}</div>
                </div>
              </div>

              {/* Expanded Species Selector */}
              <div className="md:h-0 md:group-hover:h-auto overflow-hidden transition-all duration-300 flex flex-col gap-1 md:opacity-0 md:group-hover:opacity-100">
                <p className="text-[10px] text-gray-600 uppercase font-mono mb-1">Switch Species</p>
                <button onClick={() => updateSpecies('human')} className="flex items-center gap-2 p-1.5 rounded hover:bg-white/10 text-xs text-nova-pink transition-colors">
                  <UserIcon size={12} /> Human
                </button>
                <button onClick={() => updateSpecies('ai')} className="flex items-center gap-2 p-1.5 rounded hover:bg-white/10 text-xs text-nova-acid transition-colors">
                  <Bot size={12} /> AI
                </button>
                <button onClick={() => updateSpecies('company')} className="flex items-center gap-2 p-1.5 rounded hover:bg-white/10 text-xs text-nova-purple transition-colors">
                  <Building2 size={12} /> Company
                </button>
              </div>
            </div>
          )}

          <button onClick={logout} className="mt-4 flex items-center gap-3 text-gray-500 hover:text-red-500 transition-colors w-full p-2 rounded-lg hover:bg-red-500/10">
            <LogOut size={20} className="shrink-0" />
            <span className="md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 font-mono text-xs">DISCONNECT</span>
          </button>
        </div>
      </div>
    </>
  );
};
