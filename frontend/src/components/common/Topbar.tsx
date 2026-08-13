import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { PersonaToggle } from './PersonaToggle';
import { useStore } from '../../store';

interface TopbarProps {
  persona: 'both' | 'mfg' | 'it';
  setPersona: (p: 'both' | 'mfg' | 'it') => void;
}

const routeTitles: Record<string, [string, string]> = {
  '/': ["Command Centre Overview", "Alpha Refinery · Manufacturing Intelligence Platform"],
  '/use-cases': ["Use-Case Library", "23 agentic AI modules across 5 strategic pillars"],
  '/agents': ["AI Agents", "12 always-on agents, configurable per plant"],
  '/admin': ["Admin Console", "Governance, integrations & usability controls"],
  '/analytics': ["Analytics & ROI", "Adoption, uptime and cumulative value"],
  '/settings': ["Platform Settings", "Branding, SSO and environment configuration"],
};

export const Topbar: React.FC<TopbarProps> = ({ persona, setPersona }) => {
  const [time, setTime] = useState<string>('');
  const location = useLocation();
  const { user, logout } = useStore();

  useEffect(() => {
    const tickClock = () => {
      const d = new Date();
      setTime(d.toLocaleTimeString('en-GB') + " GST");
    };
    tickClock();
    const interval = setInterval(tickClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const [title, subtitle] = routeTitles[location.pathname] || ["Command Centre", "Alpha Refinery"];
  const userInitials = user?.username ? user.username.slice(0, 2).toUpperCase() : 'GU';

  return (
    <header className="h-[64px] shrink-0 bg-panel border-b border-border-color flex items-center gap-[16px] px-[26px] sticky top-0 z-20 shadow-sm">
      <div>
        <h1 className="font-head text-[17px] m-0 font-extrabold">{title}</h1>
        <div className="text-[12px] text-muted mt-[1px]">{subtitle}</div>
      </div>
      <div className="flex-1" />
      <PersonaToggle persona={persona} setPersona={setPersona} />
      <div className="font-mono text-[12px] text-muted pl-[16px] border-l border-border-color min-w-[100px]">
        {time}
      </div>
      <div className="flex items-center gap-3 pl-[16px] border-l border-border-color">
        <div className="flex flex-col text-right hidden sm:flex">
          <span className="text-[12px] font-bold text-ink leading-none mb-0.5">{user?.username || 'Guest'}</span>
          <span className="text-[9.5px] text-muted font-medium leading-none">{user?.role || 'Operator'}</span>
        </div>
        <div className="w-[34px] h-[34px] rounded-full bg-gradient-to-br from-purple to-[#4B3FCB] text-white flex items-center justify-center font-bold text-[12px] font-head shadow-sm select-none">
          {userInitials}
        </div>
        <button 
          onClick={() => {
            logout();
            window.location.reload();
          }}
          title="Logout"
          className="w-[30px] h-[30px] rounded-full bg-transparent hover:bg-red/10 text-muted hover:text-red border border-border-color hover:border-red/20 flex items-center justify-center cursor-pointer transition-colors shrink-0"
        >
          <LogOut className="w-[13px] h-[13px]" />
        </button>
      </div>
    </header>
  );
};
