import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Bot, MapPin, Wrench, Shield, FileText, Sparkles, Activity
} from 'lucide-react';
import { MOCK_MACHINES, STATUS_DESCRIPTIONS } from '../data/machineMonitoringData';
import { TelemetryChart } from '../components/machine-monitoring/TelemetryChart';
import { HealthRing, STATUS_COLOR, STATUS_BG } from '../components/machine-monitoring/MachineCard';

export const MachineDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const machine = useMemo(() => {
    return MOCK_MACHINES.find((m) => m.id === id) || MOCK_MACHINES[0];
  }, [id]);

  const [activeTab, setActiveTab] = useState<'telemetry' | 'agent' | 'mes' | 'maintenance'>('telemetry');
  const [selectedMetric, setSelectedMetric] = useState<string>('vibration');

  const statusColor = STATUS_COLOR[machine.status];
  const currentMetricObj = machine.liveMetrics.find(m => m.key === selectedMetric) || machine.liveMetrics[0];

  const TABS = [
    { key: 'telemetry', label: 'Live Telemetry & Signals', icon: Activity },
    { key: 'agent', label: 'AI Agent Root-Cause Analysis', icon: Bot, alert: machine.activeIssues > 0 },
    { key: 'mes', label: 'MES Work Orders & Operator', icon: FileText },
    { key: 'maintenance', label: 'Maintenance & Service History', icon: Wrench },
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="p-6 flex flex-col gap-6 bg-gradient-to-b from-[#F7F8FA] to-[#EEF1F5] min-h-screen"
    >
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted">
          <button
            onClick={() => navigate('/machine-monitoring')}
            className="group hover:text-teal flex items-center gap-1 font-medium transition-colors"
          >
            <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Machine Monitoring</span>
          </button>
          <span className="opacity-40">/</span>
          <span className="text-ink font-semibold">{machine.name}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs px-3 py-1.5 rounded-lg bg-white/80 backdrop-blur border border-slate-200 text-slate-700 font-semibold shadow-sm">
            {machine.code}
          </span>
          <span
            className="px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm"
            style={{ background: STATUS_BG[machine.status], color: statusColor, boxShadow: `0 2px 12px -2px ${statusColor}40` }}
          >
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: statusColor }} />
            {machine.status}
          </span>
        </div>
      </div>

      {/* Hero Machine Details Card */}
      <div className="relative bg-white/90 backdrop-blur-xl border border-white/60 rounded-[20px] p-7 shadow-[0_8px_40px_-12px_rgba(15,23,42,0.15)] flex flex-col lg:flex-row lg:items-center justify-between gap-6 overflow-hidden">
        {/* Decorative gold accent glow */}
        <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gradient-to-br from-amber-200/30 via-teal/10 to-transparent blur-3xl" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-teal via-amber-300 to-teal" />

        <div className="relative flex items-start gap-5">
          <div className="relative">
            <HealthRing score={machine.healthScore} status={machine.status} size={76} />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center border border-slate-100">
              <Sparkles className="w-3 h-3 text-amber-500" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-head text-[26px] font-extrabold text-ink tracking-tight">{machine.name}</h1>
              <span className="text-[11px] px-2.5 py-1 rounded-md bg-gradient-to-r from-teal/15 to-teal/5 text-teal border border-teal/25 font-mono font-bold tracking-wide">
                {machine.type}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted mt-2">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-teal" />
                {machine.plant} • {machine.line}
              </span>
              <span className="opacity-30">•</span>
              <span>Operator: <strong className="text-ink font-semibold">{machine.operator}</strong></span>
              <span className="opacity-30">•</span>
              <span>Installed: <strong className="text-ink font-semibold">{machine.installDate}</strong></span>
            </div>
            <p className="text-xs text-slate-600 mt-2.5 max-w-2xl leading-relaxed">
              {STATUS_DESCRIPTIONS[machine.status]}
            </p>
          </div>
        </div>

        {/* Quick KPI stats */}
        <div className="relative flex items-center gap-5 lg:border-l lg:border-slate-200 lg:pl-7 shrink-0 pt-5 lg:pt-0 border-t lg:border-t-0">
          <KPI label="Active Issues" value={machine.activeIssues} accent={machine.activeIssues > 0 ? '#E24C4C' : '#059669'} />
          <Divider />
          <KPI label="OEE Impact" value="91.4%" accent="#0F172A" />
          <Divider />
          <div className="text-center">
            <div className="text-[10px] text-muted uppercase font-bold tracking-wider">Agent Status</div>
            <div className="font-mono text-xs font-bold text-teal mt-1.5 flex items-center gap-1.5 justify-center bg-teal/10 px-2.5 py-1 rounded-full border border-teal/20">
              <Bot className="w-3.5 h-3.5" />
              {machine.agentStatus}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex items-center gap-1 bg-white/70 backdrop-blur border border-slate-200 rounded-2xl p-1.5 text-sm font-semibold w-fit shadow-sm">
        {TABS.map(({ key, label, icon: Icon }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`relative px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 ${isActive ? 'text-navy-950' : 'text-muted hover:text-ink'
                }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabBg"
                  className="absolute inset-0 bg-gradient-to-r from-teal to-teal-deep rounded-xl shadow-[0_4px_16px_-4px_rgba(31,169,113,0.5)]"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                />
              )}
              <span className={`relative flex items-center gap-1.5 ${isActive ? 'text-white' : ''}`}>
                <Icon className="w-4 h-4" />
                <span>{label}</span>
                {alert && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping ml-1" />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          {activeTab === 'telemetry' && (
            <div className="flex flex-col gap-6">
              {/* Signal Cards Selector */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {machine.liveMetrics.map((m) => {
                  const isSelected = selectedMetric === m.key;
                  const isCrit = m.status === 'critical';
                  const isWarn = m.status === 'warning';
                  const mColor = isCrit ? '#E24C4C' : isWarn ? '#F59E0B' : '#1FA971';

                  return (
                    <motion.div
                      key={m.key}
                      onClick={() => setSelectedMetric(m.key)}
                      whileHover={{ y: -3 }}
                      whileTap={{ scale: 0.98 }}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all bg-white/90 backdrop-blur ${isSelected
                        ? 'border-teal ring-2 ring-teal/25 shadow-[0_8px_24px_-8px_rgba(31,169,113,0.4)]'
                        : 'border-slate-200 shadow-sm hover:border-teal/40 hover:shadow-md'
                        }`}
                    >
                      <div className="flex items-center justify-between text-muted text-[11px] mb-1.5 font-bold uppercase tracking-wide">
                        <span>{m.label}</span>
                        <span className="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]" style={{ background: mColor, color: mColor }} />
                      </div>
                      <div className="font-mono text-2xl font-extrabold" style={{ color: mColor }}>
                        {m.value} <span className="text-xs text-muted font-normal">{m.unit}</span>
                      </div>
                      <div className="mt-2.5 pt-2.5 border-t border-slate-100 text-[10.5px] text-muted flex items-center justify-between">
                        <span>Normal: {m.normalRange[0]}-{m.normalRange[1]}</span>
                        <span className="font-bold" style={{ color: mColor }}>{m.status}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Detailed TimeSeries Chart */}
              <div className="bg-white/90 backdrop-blur-xl border border-slate-200 rounded-[20px] shadow-[0_8px_32px_-12px_rgba(15,23,42,0.12)] overflow-hidden">
                <TelemetryChart
                  machineId={machine.id}
                  metricKey={currentMetricObj.key as any}
                  metricLabel={currentMetricObj.label}
                  unit={currentMetricObj.unit}
                  normalRange={currentMetricObj.normalRange}
                  warningThreshold={currentMetricObj.warningThreshold}
                  criticalThreshold={currentMetricObj.criticalThreshold}
                />
              </div>
            </div>
          )}

          {activeTab === 'agent' && (
            <div className="bg-white/90 backdrop-blur-xl border border-slate-200 rounded-[20px] p-7 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.12)] flex flex-col gap-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal/20 to-teal/5 border border-teal/40 flex items-center justify-center text-teal shadow-inner">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-head font-bold text-lg text-ink">Autonomous Agent Investigation Trace</h3>
                    <p className="text-xs text-muted">Continuous LLM signal monitoring, anomaly classification & proactive resolution recommendation.</p>
                  </div>
                </div>
                <span className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-teal/15 to-teal/5 text-teal border border-teal/30 text-xs font-mono font-bold shadow-sm">
                  Status: {machine.agentStatus}
                </span>
              </div>

              {/* Investigation steps timeline */}
              <div className="flex flex-col gap-4">
                <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 text-white font-mono text-xs border border-slate-700/60 flex flex-col gap-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <div className="text-teal font-bold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-teal animate-ping" />
                    [AGENT TELEMETRY INGESTION ENGINE]
                  </div>
                  <div className="text-slate-300">
                    &gt; Machine ID: <span className="text-amber-400">{machine.code}</span> ({machine.name})
                  </div>
                  <div className="text-slate-300">
                    &gt; Signal Vectors Analyzed: Temperature, Vibration, Current, Voltage, RPM, Hydraulic Line Pressure.
                  </div>
                  {machine.activeIssues > 0 ? (
                    <div className="text-rose-400 font-semibold">
                      &gt; [ANOMALY DETECTED] Vibration waveform exceedance threshold (+38% vs baseline variance).
                    </div>
                  ) : (
                    <div className="text-emerald-400">
                      &gt; Baseline validation complete. All FFT harmonic frequency peaks within ±2% tolerance.
                    </div>
                  )}
                </div>

                {/* Root Cause AI Findings */}
                <div className="border border-slate-200 rounded-2xl p-6 bg-gradient-to-br from-slate-50 to-white shadow-sm">
                  <h4 className="font-head font-bold text-ink text-sm mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-teal" />
                    AI Root Cause Diagnostics Summary
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed mb-5">
                    {machine.activeIssues > 0
                      ? `Agent detected sustained mechanical vibration in drive shaft bearing assembly. FFT spectral analysis indicates potential early-stage inner raceway pitting on Drive Shaft B.`
                      : `Machine telemetry is operating normally within engineered specifications. Preventive maintenance is schedule-locked in MES.`}
                  </p>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => navigate('/agents/maintenance')}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal to-teal-deep text-white font-bold text-xs hover:shadow-[0_8px_20px_-6px_rgba(31,169,113,0.6)] transition-all flex items-center gap-2 shadow-md"
                    >
                      <Wrench className="w-4 h-4" />
                      <span>Launch Predictive Maintenance Agent</span>
                    </button>
                    <button
                      onClick={() => navigate('/agents/incident-investigation')}
                      className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-ink font-bold text-xs hover:border-teal hover:shadow-md transition-all flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4 text-teal" />
                      <span>View Deep Incident Report</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'mes' && (
            <div className="bg-white/90 backdrop-blur-xl border border-slate-200 rounded-[20px] p-7 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.12)]">
              <h3 className="font-head font-bold text-lg text-ink mb-5">MES SQL Server Integration & Work Orders</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-5 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white shadow-sm">
                  <div className="font-bold text-ink mb-2.5">Active Work Order</div>
                  <div className="font-mono text-teal font-bold text-sm">WO-2026-88492</div>
                  <div className="text-muted mt-1.5">Part: High-Precision Cylinder Block B</div>
                  <div className="text-muted">Target Qty: 500 units • Completed: 342 units</div>
                </div>

                <div className="p-5 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white shadow-sm">
                  <div className="font-bold text-ink mb-2.5">Assigned Line Operator</div>
                  <div className="font-bold text-ink text-sm">{machine.operator}</div>
                  <div className="text-muted mt-1.5">Shift: Day Shift (06:00 - 14:00)</div>
                  <div className="text-muted">Certifications: Level 3 CNC Master Specialist</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'maintenance' && (
            <div className="bg-white/90 backdrop-blur-xl border border-slate-200 rounded-[20px] p-7 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.12)]">
              <h3 className="font-head font-bold text-lg text-ink mb-5">Maintenance & Service Log</h3>
              <div className="space-y-3 text-xs">
                <div className="p-4 rounded-xl border border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
                  <div>
                    <div className="font-bold text-ink">Last Scheduled Maintenance</div>
                    <div className="text-muted mt-0.5">{machine.lastMaintenance} • Bearing lubrication & Filter Replacement</div>
                  </div>
                  <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px]">Completed</span>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
                  <div>
                    <div className="font-bold text-ink">Next Inspection Due</div>
                    <div className="text-muted mt-0.5">Scheduled for Oct 12, 2026</div>
                  </div>
                  <span className="px-3 py-1.5 rounded-full bg-teal/10 text-teal border border-teal/25 font-bold text-[11px]">Scheduled</span>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};

/* --- Small helper components --- */

const KPI: React.FC<{ label: string; value: React.ReactNode; accent: string }> = ({ label, value, accent }) => (
  <div className="text-center">
    <div className="text-[10px] text-muted uppercase font-bold tracking-wider">{label}</div>
    <div className="font-mono text-2xl font-extrabold mt-1" style={{ color: accent }}>
      {value}
    </div>
  </div>
);

const Divider = () => <div className="w-[1px] h-9 bg-slate-200" />;