import React, { useEffect } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import { Sidebar } from '../common/Sidebar';
import { Topbar } from '../common/Topbar';
import { useStore, type PersonaType } from '../../store';
import { telemetryService } from '../../services/api';
import { ChatBot } from '../common/ChatBot';

export const Layout: React.FC = () => {
  const { persona, setTelemetryStats } = useStore();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const stats = await telemetryService.getStats();
        setTelemetryStats(stats);
      } catch (err) {
        console.error('Failed to load telemetry stats', err);
      }
    };
    fetchStats();

    // Refresh stats every 15 seconds
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, [setTelemetryStats]);

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
        <Topbar />
        <main className="flex-1 p-0 w-full mx-auto">
          <Outlet context={{ persona }} />
        </main>      </div>
      <ChatBot />
    </div>
  );
};

export function usePersona() {
  return useOutletContext<{ persona: PersonaType }>();
}

