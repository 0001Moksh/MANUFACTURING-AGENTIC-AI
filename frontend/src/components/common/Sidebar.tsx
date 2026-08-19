import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BookOpen, Bot, Settings2, BarChart3, Settings, LogOut } from 'lucide-react';
import { useStore } from '../../store';

export const Sidebar: React.FC = () => {
  const { user, logout } = useStore();
  const userInitials = user?.username ? user.username.slice(0, 2).toUpperCase() : 'GU';

  return (
    <aside className="w-[248px] shrink-0 bg-gradient-to-b from-navy-950 via-navy-900 to-navy-800 text-white flex flex-col sticky top-0 h-screen">
      <div className="flex items-center gap-[10px] py-[22px] px-[20px] pb-[18px] border-b border-white/10">
        <div className="w-[36px] h-[36px] rounded-[9px] bg-gradient-to-br from-teal to-[#00787c] flex items-center justify-center font-head font-extrabold text-[14px] text-white shrink-0">
          III
        </div>
        <div className="flex flex-col">
          <div className="font-head font-extrabold text-[15px] tracking-[0.2px]">IIIIoT Infotech</div>
          <div className="text-[10.5px] text-[#8FA0C4] tracking-[0.5px] mt-[1px] uppercase">Manufacturing Agentic AI</div>
        </div>
      </div>
      
      <nav className="flex-1 py-[16px] px-[12px] overflow-y-auto">
        <div className="text-[10.5px] tracking-[1.2px] text-[#5E71A0] py-[14px] px-[10px] pb-[6px] font-semibold uppercase">
          Command Centre
        </div>
        
        <NavLink to="/" className={({ isActive }) => `flex items-center gap-[11px] py-[9px] px-[11px] rounded-[8px] mb-[2px] text-[13.5px] font-medium cursor-pointer border border-transparent transition-colors relative ${isActive ? 'bg-teal/15 text-white border-teal/30' : 'text-[#C7D2EA] hover:bg-white/5 hover:text-white'}`}>
          {({ isActive }) => (
            <>
              {isActive && <div className="absolute left-[-12px] top-[8px] bottom-[8px] w-[3px] rounded-[3px] bg-teal" />}
              <LayoutDashboard className="w-[17px] h-[17px] shrink-0 opacity-85" />
              Overview
            </>
          )}
        </NavLink>
        
        <NavLink to="/use-cases" className={({ isActive }) => `flex items-center gap-[11px] py-[9px] px-[11px] rounded-[8px] mb-[2px] text-[13.5px] font-medium cursor-pointer border border-transparent transition-colors relative ${isActive ? 'bg-teal/15 text-white border-teal/30' : 'text-[#C7D2EA] hover:bg-white/5 hover:text-white'}`}>
          {({ isActive }) => (
            <>
              {isActive && <div className="absolute left-[-12px] top-[8px] bottom-[8px] w-[3px] rounded-[3px] bg-teal" />}
              <BookOpen className="w-[17px] h-[17px] shrink-0 opacity-85" />
              Use-Case Library
              <span className="ml-auto font-mono text-[10.5px] text-[#8FA0C4] bg-white/5 px-[6px] py-[1px] rounded-[20px]">23</span>
            </>
          )}
        </NavLink>

        <NavLink to="/agents" className={({ isActive }) => `flex items-center gap-[11px] py-[9px] px-[11px] rounded-[8px] mb-[2px] text-[13.5px] font-medium cursor-pointer border border-transparent transition-colors relative ${isActive ? 'bg-teal/15 text-white border-teal/30' : 'text-[#C7D2EA] hover:bg-white/5 hover:text-white'}`}>
          {({ isActive }) => (
            <>
              {isActive && <div className="absolute left-[-12px] top-[8px] bottom-[8px] w-[3px] rounded-[3px] bg-teal" />}
              <Bot className="w-[17px] h-[17px] shrink-0 opacity-85" />
              AI Agents
              <span className="ml-auto font-mono text-[10.5px] text-[#8FA0C4] bg-white/5 px-[6px] py-[1px] rounded-[20px]">12</span>
            </>
          )}
        </NavLink>

        <div className="text-[10.5px] tracking-[1.2px] text-[#5E71A0] py-[14px] px-[10px] pb-[6px] font-semibold uppercase mt-2">
          Platform
        </div>

        <NavLink to="/admin" className={({ isActive }) => `flex items-center gap-[11px] py-[9px] px-[11px] rounded-[8px] mb-[2px] text-[13.5px] font-medium cursor-pointer border border-transparent transition-colors relative ${isActive ? 'bg-teal/15 text-white border-teal/30' : 'text-[#C7D2EA] hover:bg-white/5 hover:text-white'}`}>
          {({ isActive }) => (
            <>
              {isActive && <div className="absolute left-[-12px] top-[8px] bottom-[8px] w-[3px] rounded-[3px] bg-teal" />}
              <Settings2 className="w-[17px] h-[17px] shrink-0 opacity-85" />
              Admin Console
            </>
          )}
        </NavLink>

        <NavLink to="/analytics" className={({ isActive }) => `flex items-center gap-[11px] py-[9px] px-[11px] rounded-[8px] mb-[2px] text-[13.5px] font-medium cursor-pointer border border-transparent transition-colors relative ${isActive ? 'bg-teal/15 text-white border-teal/30' : 'text-[#C7D2EA] hover:bg-white/5 hover:text-white'}`}>
          {({ isActive }) => (
            <>
              {isActive && <div className="absolute left-[-12px] top-[8px] bottom-[8px] w-[3px] rounded-[3px] bg-teal" />}
              <BarChart3 className="w-[17px] h-[17px] shrink-0 opacity-85" />
              Analytics & ROI
            </>
          )}
        </NavLink>

        <NavLink to="/settings" className={({ isActive }) => `flex items-center gap-[11px] py-[9px] px-[11px] rounded-[8px] mb-[2px] text-[13.5px] font-medium cursor-pointer border border-transparent transition-colors relative ${isActive ? 'bg-teal/15 text-white border-teal/30' : 'text-[#C7D2EA] hover:bg-white/5 hover:text-white'}`}>
          {({ isActive }) => (
            <>
              {isActive && <div className="absolute left-[-12px] top-[8px] bottom-[8px] w-[3px] rounded-[3px] bg-teal" />}
              <Settings className="w-[17px] h-[17px] shrink-0 opacity-85" />
              Settings
            </>
          )}
        </NavLink>
      </nav>

      <div className="border-t border-white/10 p-[14px_12px]">
        <div className="flex items-center gap-3 px-[8px]">
          <div className="w-[34px] h-[34px] rounded-full bg-gradient-to-br from-purple to-[#4B3FCB] text-white flex items-center justify-center font-bold text-[12px] font-head shrink-0">
            {userInitials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-bold text-white truncate">{user?.username || 'Guest'}</div>
            <div className="text-[10px] text-[#8FA0C4] truncate">{user?.role || 'Operator'}</div>
          </div>
          <button
            onClick={() => { logout(); window.location.reload(); }}
            title="Logout"
            className="w-[30px] h-[30px] rounded-[7px] text-[#C7D2EA] hover:bg-white/10 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <LogOut className="w-[15px] h-[15px]" />
          </button>
        </div>
      </div>
    </aside>
  );
};
