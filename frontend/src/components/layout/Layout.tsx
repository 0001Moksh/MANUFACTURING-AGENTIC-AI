import React, { useState, useEffect } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import { Sidebar } from '../common/Sidebar';
import { Topbar } from '../common/Topbar';

export type PersonaType = 'both' | 'mfg' | 'it';

export const Layout: React.FC = () => {
  const [persona, setPersona] = useState<PersonaType>('both');

  // Add persona classes to body for global styling effects if needed
  useEffect(() => {
    document.body.classList.remove('persona-mfg', 'persona-it');
    if (persona === 'mfg') document.body.classList.add('persona-mfg');
    if (persona === 'it') document.body.classList.add('persona-it');
  }, [persona]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar persona={persona} setPersona={setPersona} />
        <main className="flex-1 p-[26px_30px_60px] max-w-[1400px] w-full mx-auto">
          <Outlet context={{ persona }} />
        </main>
        <footer className="text-center py-[30px] pb-[10px] text-faint text-[11.5px]">
          IIIoT Infotech · Manufacturing Agentic AI Platform — Simulated walkthrough for internal sales enablement, not a live environment.
        </footer>
      </div>
    </div>
  );
};

export function usePersona() {
  return useOutletContext<{ persona: PersonaType }>();
}
