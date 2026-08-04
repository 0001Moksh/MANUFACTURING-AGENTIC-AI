import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { PersonaToggle } from './PersonaToggle';

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
      <div className="w-[34px] h-[34px] rounded-full bg-gradient-to-br from-purple to-[#4B3FCB] text-white flex items-center justify-center font-bold text-[12.5px] font-head shadow-sm cursor-pointer hover:brightness-110 transition-all">
        SD
      </div>
    </header>
  );
};
