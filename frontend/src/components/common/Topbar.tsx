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

  const [title] = routeTitles[location.pathname] || ["Command Centre", ""];

  return (
    <header className="h-[0px] shrink-0 border-b border-border-color sticky top-0 z-20 bg-canvas/95 backdrop-blur-sm" />
  );
};
