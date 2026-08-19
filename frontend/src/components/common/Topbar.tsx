import React from 'react';
import { useLocation } from 'react-router-dom';

const routeTitles: Record<string, [string, string]> = {
  '/': ["Command Centre Overview", "Alpha Refinery · Manufacturing Intelligence Platform"],
  '/use-cases': ["Use-Case Library", "23 agentic AI modules across 5 strategic pillars"],
  '/agents': ["AI Agents", "12 always-on agents, configurable per plant"],
  '/admin': ["Admin Console", "Governance, integrations & usability controls"],
  '/analytics': ["Analytics & ROI", "Adoption, uptime and cumulative value"],
  '/settings': ["Platform Settings", "Branding, SSO and environment configuration"],
};

export const Topbar: React.FC = () => {
  const location = useLocation();

  const [title] = routeTitles[location.pathname] || ["Command Centre", ""];

  return (
    <header className="h-[64px] shrink-0 border-b border-border-color flex items-center px-[26px] sticky top-0 z-20 bg-canvas/95 backdrop-blur-sm">
      <h1 className="font-head text-[17px] m-0 font-extrabold">{title}</h1>
    </header>
  );
};
