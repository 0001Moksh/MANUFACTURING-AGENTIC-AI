import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BookOpen, Bot, Settings2, BarChart3, Settings, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../../store';

export const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useStore();
  const userInitials = user?.username ? user.username.slice(0, 2).toUpperCase() : 'GU';

  return (
    <aside className={`${collapsed ? 'w-[72px]' : 'w-[248px]'} shrink-0 overflow-hidden bg-gradient-to-b from-navy-950 via-navy-900 to-navy-800 text-white flex flex-col sticky top-0 h-screen transition-[width] duration-300 ease-in-out`}>
      <div className={`bg-canvas flex items-center gap-[10px] py-[16px] px-[16px] rounded-bl-3xl ${collapsed ? 'justify-center px-0' : ''}`}>
        <div className="w-[38px] h-[38px] flex items-center justify-center shrink-0">
          <img src="/logo-bg.png" alt="Logo" className="w-full h-full object-contain" />
        </div>
        {!collapsed && <div className="flex flex-col min-w-0">
          <div className="font-head font-extrabold text-[20.5px] tracking-[0.2px] truncate text-black">IIIIoT Infotech</div>
          <div className="text-[10px] text-[#8FA0C4] tracking-[0.5px] uppercase truncate">Manufacturing Agentic AI</div>
        </div>}
        <button
          onClick={() => setCollapsed(value => !value)}
          title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
className={`${collapsed ? 'absolute top-[58px] left-11' : 'ml-auto absolute top-[62px] left-55'} w-[28px] h-[28px] rounded-full bg-white border-2 border-black border-r-[6px] hover:border-l-2 hover:border-r-[6px] text-black hover:bg-gray-100 flex items-center justify-center transition-all`}        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronLeft className="w-5 h-5" />
          )}
        </button>
      </div>

      <nav className={`flex-1 py-[16px] px-[12px] overflow-y-auto ${collapsed ? 'px-[8px] pt-[28px]' : ''}`}>
        {!collapsed && <div className="text-[10.5px] tracking-[1.2px] text-[#5E71A0] py-[14px] px-[10px] pb-[6px] font-semibold uppercase">
          Command Centre
        </div>}

        <NavLink to="/" title={collapsed ? 'Overview' : undefined} className={({ isActive }) => `flex items-center gap-[11px] py-[9px] px-[11px] rounded-[8px] mb-[2px] text-[13.5px] font-medium cursor-pointer border border-transparent transition-colors relative ${collapsed ? 'justify-center px-0 gap-0' : ''} ${isActive ? 'bg-teal/15 text-white border-teal/30' : 'text-[#C7D2EA] hover:bg-white/5 hover:text-white'}`}>
          {({ isActive }) => (
            <>
              {isActive && <div className="absolute left-[-12px] top-[8px] bottom-[8px] w-[3px] rounded-[3px] bg-teal" />}
              <LayoutDashboard className="w-[17px] h-[17px] shrink-0 opacity-85" />
              {!collapsed && 'Overview'}
            </>
          )}
        </NavLink>

        <NavLink to="/use-cases" title={collapsed ? 'Use-Case Library' : undefined} className={({ isActive }) => `flex items-center gap-[11px] py-[9px] px-[11px] rounded-[8px] mb-[2px] text-[13.5px] font-medium cursor-pointer border border-transparent transition-colors relative ${collapsed ? 'justify-center px-0 gap-0' : ''} ${isActive ? 'bg-teal/15 text-white border-teal/30' : 'text-[#C7D2EA] hover:bg-white/5 hover:text-white'}`}>
          {({ isActive }) => (
            <>
              {isActive && <div className="absolute left-[-12px] top-[8px] bottom-[8px] w-[3px] rounded-[3px] bg-teal" />}
              <BookOpen className="w-[17px] h-[17px] shrink-0 opacity-85" />
              {!collapsed && <><span>Use-Case Library</span><span className="ml-auto font-mono text-[10.5px] text-[#8FA0C4] bg-white/5 px-[6px] py-[1px] rounded-[20px]">23</span></>}
            </>
          )}
        </NavLink>

        <NavLink to="/agents" title={collapsed ? 'AI Agents' : undefined} className={({ isActive }) => `flex items-center gap-[11px] py-[9px] px-[11px] rounded-[8px] mb-[2px] text-[13.5px] font-medium cursor-pointer border border-transparent transition-colors relative ${collapsed ? 'justify-center px-0 gap-0' : ''} ${isActive ? 'bg-teal/15 text-white border-teal/30' : 'text-[#C7D2EA] hover:bg-white/5 hover:text-white'}`}>
          {({ isActive }) => (
            <>
              {isActive && <div className="absolute left-[-12px] top-[8px] bottom-[8px] w-[3px] rounded-[3px] bg-teal" />}
              <Bot className="w-[17px] h-[17px] shrink-0 opacity-85" />
              {!collapsed && <><span>AI Agents</span><span className="ml-auto font-mono text-[10.5px] text-[#8FA0C4] bg-white/5 px-[6px] py-[1px] rounded-[20px]">6 live</span></>}
            </>
          )}
        </NavLink>

        {!collapsed && <div className="text-[10.5px] tracking-[1.2px] text-[#5E71A0] py-[14px] px-[10px] pb-[6px] font-semibold uppercase mt-2">
          Platform
        </div>}

        <NavLink to="/admin" title={collapsed ? 'Admin Console' : undefined} className={({ isActive }) => `flex items-center gap-[11px] py-[9px] px-[11px] rounded-[8px] mb-[2px] text-[13.5px] font-medium cursor-pointer border border-transparent transition-colors relative ${collapsed ? 'justify-center px-0 gap-0' : ''} ${isActive ? 'bg-teal/15 text-white border-teal/30' : 'text-[#C7D2EA] hover:bg-white/5 hover:text-white'}`}>
          {({ isActive }) => (
            <>
              {isActive && <div className="absolute left-[-12px] top-[8px] bottom-[8px] w-[3px] rounded-[3px] bg-teal" />}
              <Settings2 className="w-[17px] h-[17px] shrink-0 opacity-85" />
              {!collapsed && 'Admin Console'}
            </>
          )}
        </NavLink>

        <NavLink to="/analytics" title={collapsed ? 'Analytics & ROI' : undefined} className={({ isActive }) => `flex items-center gap-[11px] py-[9px] px-[11px] rounded-[8px] mb-[2px] text-[13.5px] font-medium cursor-pointer border border-transparent transition-colors relative ${collapsed ? 'justify-center px-0 gap-0' : ''} ${isActive ? 'bg-teal/15 text-white border-teal/30' : 'text-[#C7D2EA] hover:bg-white/5 hover:text-white'}`}>
          {({ isActive }) => (
            <>
              {isActive && <div className="absolute left-[-12px] top-[8px] bottom-[8px] w-[3px] rounded-[3px] bg-teal" />}
              <BarChart3 className="w-[17px] h-[17px] shrink-0 opacity-85" />
              {!collapsed && 'Analytics & ROI'}
            </>
          )}
        </NavLink>

        <NavLink to="/settings" title={collapsed ? 'Settings' : undefined} className={({ isActive }) => `flex items-center gap-[11px] py-[9px] px-[11px] rounded-[8px] mb-[2px] text-[13.5px] font-medium cursor-pointer border border-transparent transition-colors relative ${collapsed ? 'justify-center px-0 gap-0' : ''} ${isActive ? 'bg-teal/15 text-white border-teal/30' : 'text-[#C7D2EA] hover:bg-white/5 hover:text-white'}`}>
          {({ isActive }) => (
            <>
              {isActive && <div className="absolute left-[-12px] top-[8px] bottom-[8px] w-[3px] rounded-[3px] bg-teal" />}
              <Settings className="w-[17px] h-[17px] shrink-0 opacity-85" />
              {!collapsed && 'Settings'}
            </>
          )}
        </NavLink>
      </nav>

      <div className="border-t border-white/10 p-[14px_12px]">
        <div className={`flex items-center gap-3 px-[8px] ${collapsed ? 'flex-col px-0 gap-2' : ''}`}>
          <div className="w-[34px] h-[34px] rounded-full bg-gradient-to-br from-purple to-[#4B3FCB] text-white flex items-center justify-center font-bold text-[12px] font-head shrink-0">
            {userInitials}
          </div>
          {!collapsed && <div className="min-w-0 flex-1">
            <div className="text-[12px] font-bold text-white truncate">{user?.username || 'Guest'}</div>
            <div className="text-[10px] text-[#8FA0C4] truncate">{user?.role || 'Operator'}</div>
          </div>}
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
