import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FilterBar } from '../components/usecases/FilterBar';
import { UseCaseCard } from '../components/usecases/UseCaseCard';
import { useNavigate } from 'react-router-dom';
import { useCases } from '../data/mockData';
import { pluginService } from '../services/api';

const ACTIVE_USE_CASE_IDS = new Set([1, 2, 6, 9, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37]);

const CPU_USE_CASE = {
  id: 27,
  pillar: 'sustain',
  title: 'CPU Utilization Monitoring',
  tags: ['IOT', 'ML'],
  status: 'live' as const,
  desc: 'Live host and per-core CPU utilization collected by the connected IIIOT-Veda plugin and stored in PostgreSQL.',
  impact: 'One live view of overall and per-core CPU load, user time, system time and idle capacity.',
};

const MEMORY_USE_CASE = {
  id: 28, pillar: 'sustain', title: 'Memory Utilization Monitoring', tags: ['IOT'], status: 'live' as const,
  desc: 'Live RAM usage and available memory collected by IIIOT-Veda for each host.',
  impact: 'Track memory capacity, usage trends and hosts with high memory utilization.',
};

const CONNECTOR_USE_CASES = [
  { id: 29, pluginId: 'telegraf-disk-monitoring', pillar: 'sustain', title: 'Disk Monitoring', tags: ['IOT'], status: 'live' as const, desc: 'Filesystem capacity, inode utilization, and disk I/O collected by IIIOT-Veda.', impact: 'Detect low storage capacity and storage performance bottlenecks.' },
  { id: 30, pluginId: 'telegraf-network-monitoring', pillar: 'sustain', title: 'Network Monitoring', tags: ['IOT'], status: 'live' as const, desc: 'Interface traffic, errors, and dropped packets collected by IIIOT-Veda.', impact: 'Track network throughput and identify unhealthy interfaces.' },
  { id: 31, pluginId: 'telegraf-mqtt-consumer', pillar: 'connect', title: 'MQTT Device Telemetry', tags: ['IOT'], status: 'live' as const, desc: 'IoT and gateway messages consumed from configured MQTT topics.', impact: 'Bring device and gateway telemetry into the MAI data pipeline.' },
  { id: 32, pluginId: 'telegraf-modbus', pillar: 'connect', title: 'Modbus Monitoring', tags: ['IOT'], status: 'live' as const, desc: 'Industrial registers polled from configured Modbus equipment.', impact: 'Monitor PLCs, meters, drives, and sensors over Modbus.' },
  { id: 33, pluginId: 'telegraf-opcua', pillar: 'connect', title: 'OPC UA Monitoring', tags: ['IOT'], status: 'live' as const, desc: 'Process tags read from configured OPC UA servers.', impact: 'Connect PLC, SCADA, historian, and Kepware data to MAI.' },
  { id: 34, pluginId: 'iiiot-veda-network-diagnostics', pillar: 'connect', title: 'Network Diagnostics', tags: ['IOT'], status: 'live' as const, desc: 'Reachability, latency, ports, HTTP, DNS, and certificate checks.', impact: 'Detect endpoint, network, and certificate problems before services fail.' },
  { id: 35, pluginId: 'iiiot-veda-email-monitoring', pillar: 'connect', title: 'Email Monitoring', tags: ['IOT'], status: 'live' as const, desc: 'SMTP and IMAP availability, response, and certificate checks.', impact: 'Identify mail service outages and expiring certificates.' },
  { id: 36, pluginId: 'iiiot-veda-server-monitoring', pillar: 'sustain', title: 'Server Monitoring', tags: ['IOT'], status: 'live' as const, desc: 'Uptime, load, swap, process, and service health telemetry.', impact: 'Track server health and critical workloads from one live view.' },
  { id: 37, pluginId: 'iiiot-veda-desktop-monitoring', pillar: 'sustain', title: 'Desktop Monitoring', tags: ['IOT'], status: 'live' as const, desc: 'Desktop operating-system, process, and service health telemetry.', impact: 'Monitor Linux, macOS, and Windows workstation health.' },
];

export const UseCasesPage: React.FC = () => {
  const [activePillar, setActivePillar] = useState('all');
  const [activeType, setActiveType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cpuPluginConnected, setCpuPluginConnected] = useState(false);
  const [memoryPluginConnected, setMemoryPluginConnected] = useState(false);
  const [connectedPluginIds, setConnectedPluginIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    void pluginService.list().then((plugins: Array<{ id?: string; slug?: string; connection_status?: string }>) => {
      if (!active) return;
      const telegraf = plugins.find(plugin => plugin.id === 'telegraf-cpu-monitoring' || plugin.slug === 'telegraf-cpu-monitoring');
      setCpuPluginConnected(telegraf?.connection_status === 'connected');
      setMemoryPluginConnected(plugins.some(plugin => plugin.id === 'telegraf-memory-monitoring' && plugin.connection_status === 'connected'));
      setConnectedPluginIds(new Set(plugins.filter(plugin => plugin.connection_status === 'connected').map(plugin => plugin.id || '')));
    });
    return () => { active = false; };
  }, []);

  const availableUseCases = useMemo(
    () => [...useCases, ...(cpuPluginConnected ? [CPU_USE_CASE] : []), ...(memoryPluginConnected ? [MEMORY_USE_CASE] : []), ...CONNECTOR_USE_CASES.filter(item => connectedPluginIds.has(item.pluginId))],
    [cpuPluginConnected, memoryPluginConnected, connectedPluginIds],
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
              const connector = CONNECTOR_USE_CASES.find(item => item.id === u.id);
              if (connector) { navigate(`/use-cases/connectors/${connector.pluginId}`); return; }
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
