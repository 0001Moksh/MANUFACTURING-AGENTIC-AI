import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FilterBar } from '../components/usecases/FilterBar';
import { UseCaseCard } from '../components/usecases/UseCaseCard';
import { useNavigate } from 'react-router-dom';
import { useCases } from '../data/mockData';
import { pluginService } from '../services/api';

const ACTIVE_USE_CASE_IDS = new Set([1, 2, 6, 9, 24, 25, 26, 27, 28]);

const CPU_USE_CASE = {
  id: 27,
  pillar: 'sustain',
  title: 'CPU Utilization Monitoring',
  tags: ['IOT', 'ML'],
  status: 'live' as const,
  desc: 'Live host and per-core CPU utilization collected by the connected Telegraf plugin and stored in PostgreSQL.',
  impact: 'One live view of overall and per-core CPU load, user time, system time and idle capacity.',
};

const MEMORY_USE_CASE = {
  id: 28, pillar: 'sustain', title: 'Memory Utilization Monitoring', tags: ['IOT'], status: 'live' as const,
  desc: 'Live RAM usage and available memory collected by Telegraf for each host.',
  impact: 'Track memory capacity, usage trends and hosts with high memory utilization.',
};

export const UseCasesPage: React.FC = () => {
  const [activePillar, setActivePillar] = useState('all');
  const [activeType, setActiveType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cpuPluginConnected, setCpuPluginConnected] = useState(false);
  const [memoryPluginConnected, setMemoryPluginConnected] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    void pluginService.list().then((plugins: Array<{ id?: string; slug?: string; connection_status?: string }>) => {
      if (!active) return;
      const telegraf = plugins.find(plugin => plugin.id === 'telegraf-cpu-monitoring' || plugin.slug === 'telegraf-cpu-monitoring');
      setCpuPluginConnected(telegraf?.connection_status === 'connected');
      setMemoryPluginConnected(plugins.some(plugin => plugin.id === 'telegraf-memory-monitoring' && plugin.connection_status === 'connected'));
    });
    return () => { active = false; };
  }, []);

  const availableUseCases = useMemo(
    () => [...useCases, ...(cpuPluginConnected ? [CPU_USE_CASE] : []), ...(memoryPluginConnected ? [MEMORY_USE_CASE] : [])],
    [cpuPluginConnected, memoryPluginConnected],
  );

  const filtered = availableUseCases.filter(u => {
    if (u.id === 2) return false;
    if (activePillar !== 'all' && u.pillar !== activePillar) return false;
    if (activeType !== 'all' && !u.tags.includes(activeType)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!u.title.toLowerCase().includes(q) && !u.desc.toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const activeUseCases = filtered.filter(useCase => ACTIVE_USE_CASE_IDS.has(useCase.id));
  const upcomingUseCases = filtered.filter(useCase => !ACTIVE_USE_CASE_IDS.has(useCase.id));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }} 
      className="p-6"

    >
      <div className="mb-[20px]">
        <h2 className="font-head text-[24px] m-[0_0_6px] font-extrabold text-ink">
          Manufacturing Agentic AI Use-Case Library
        </h2>
        <p className="m-0 text-muted text-[13.5px] max-w-[720px] leading-relaxed">
          Each card is a deployable module. Click one to view its impact and site-level admin controls.
        </p>
      </div>

      <FilterBar
        activePillar={activePillar}
        setActivePillar={setActivePillar}
        activeType={activeType}
        setActiveType={setActiveType}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        resultCount={filtered.length}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[14px]">
        {activeUseCases.map(u => (
          <UseCaseCard
            key={u.id}
            useCase={u}
            onClick={() => {
              if (u.id === 6) {
                navigate('/use-cases/executive-insights');
                return;
              }
              if (u.id === 9) {
                navigate('/use-cases/safety-site-intelligence');
                return;
              }
              if (u.id === 24) {
                navigate('/use-cases/video-monitoring');
                return;
              }
              if (u.id === 25) {
                navigate('/machine-monitoring');
                return;
              }
              if (u.id === 26) {
                navigate('/use-cases/voice-agent');
                return;
              }
              if (u.id === 28) { navigate('/use-cases/memory-utilization'); return; }
              if (u.id === 27) {
                navigate('/use-cases/cpu-utilization');
                return;
              }
              navigate(`/use-cases/${u.id}`);
            }}
          />
        ))}
      </div>

      {upcomingUseCases.length > 0 && (
        <section aria-labelledby="future-use-cases-heading">
          <hr className="my-9 border-0 border-t border-border-color" />
          <h3 id="future-use-cases-heading" className="font-head text-[18px] font-extrabold text-ink m-[0_0_16px]">
            Future Capabilities &amp; Coming Soon
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[14px]">
            {upcomingUseCases.map(u => (
              <UseCaseCard key={u.id} useCase={u} isComingSoon onClick={() => navigate(`/use-cases/${u.id}`)} />
            ))}
          </div>
        </section>
      )}

    </motion.div>
  );
};
