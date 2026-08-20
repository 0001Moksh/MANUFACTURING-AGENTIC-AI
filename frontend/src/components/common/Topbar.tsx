import React from 'react';
import { useLocation } from 'react-router-dom';

const routeTitles: Record<string, [string, string]> = {
  '/': ["Command Centre Overview", "Alpha Refinery · Manufacturing Intelligence Platform"],
  '/use-cases': ["Manufacturing Agentic AI Use-Case Library", "23 agentic AI modules across 5 strategic pillars"],
  '/agents': ["AI Agents", "12 always-on agents, configurable per plant"],
  '/admin': ["Admin Console", "Governance, integrations & usability controls"],
  '/analytics': ["Analytics & ROI", "Adoption, uptime and cumulative value"],
  '/settings': ["Platform Settings", "Branding, SSO and environment configuration"],
};

export const Topbar: React.FC = () => {
  const location = useLocation();
  const [title, subtitle] = routeTitles[location.pathname] || ["Command Centre", "Alpha Refinery · Manufacturing Intelligence Platform"];

  return (
    // <header className="h-[48px] px-6 shrink-0 border-b border-border-color sticky top-0 z-20 bg-canvas/95 backdrop-blur-sm flex items-center justify-between">
    //   <div className="flex items-center gap-3">
    //     <h1 className="text-[14px] font-extrabold font-head text-ink m-0">{title}</h1>
    //     {subtitle && <span className="text-[11.5px] text-muted border-l border-border-color pl-3 hidden sm:inline">{subtitle}</span>}
    //   </div>
    //   <div className="flex items-center gap-2">
    //   </div>
    //   <img src="/logo.png" alt="Logo" className="h-[22px] object-contain" />
    // </header>
    <></>
  );
};
