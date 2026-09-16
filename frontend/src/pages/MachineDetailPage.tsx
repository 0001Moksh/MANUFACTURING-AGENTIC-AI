import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Bot, MapPin, Wrench, Shield, FileText
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

  // Select metric detail for chart
  const currentMetricObj = machine.liveMetrics.find(m => m.key === selectedMetric) || machine.liveMetrics[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-6 flex flex-col gap-6"
    >
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted">
          <button onClick={() => navigate('/machine-monitoring')} className="hover:text-teal flex items-center gap-1 font-medium">
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Machine Monitoring</span>
          </button>
          <span>/</span>
          <span className="text-ink font-semibold">{machine.name}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-slate-100 border border-border text-slate-700 font-semibold">
            {machine.code}
          </span>
          <span
            className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5"
            style={{ background: STATUS_BG[machine.status], color: statusColor }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: statusColor }} />
            {machine.status}
          </span>
        </div>
      </div>

      {/* Hero Machine Details Card */}
      <div className="bg-panel border border-border rounded-[16px] p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative overflow-hidden">
        <div className="flex items-start gap-5">
          <HealthRing score={machine.healthScore} status={machine.status} size={72} />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-head text-2xl font-extrabold text-ink">{machine.name}</h1>
              <span className="text-xs px-2.5 py-0.5 rounded bg-teal/10 text-teal border border-teal/20 font-mono font-semibold">
                {machine.type}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted mt-1.5">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-teal" />
                {machine.plant} • {machine.line}
              </span>
              <span>•</span>
              <span>Operator: <strong className="text-ink">{machine.operator}</strong></span>
              <span>•</span>
              <span>Installed: <strong className="text-ink">{machine.installDate}</strong></span>
            </div>
            <p className="text-xs text-slate-600 mt-2 max-w-2xl leading-relaxed">
              {STATUS_DESCRIPTIONS[machine.status]}
            </p>
          </div>
        </div>

        {/* Quick KPI stats */}
        <div className="flex items-center gap-4 lg:border-l lg:border-border lg:pl-6 shrink-0 pt-4 lg:pt-0 border-t lg:border-t-0">
          <div className="text-center">
            <div className="text-xs text-muted uppercase font-bold text-[10px]">Active Issues</div>
            <div className={`font-mono text-xl font-extrabold mt-1 ${machine.activeIssues > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {machine.activeIssues}
            </div>
          </div>
          <div className="w-[1px] h-8 bg-border" />
          <div className="text-center">
            <div className="text-xs text-muted uppercase font-bold text-[10px]">OEE Impact</div>
            <div className="font-mono text-xl font-extrabold text-ink mt-1">
              91.4%
            </div>
          </div>
          <div className="w-[1px] h-8 bg-border" />
          <div className="text-center">
            <div className="text-xs text-muted uppercase font-bold text-[10px]">Agent Status</div>
            <div className="font-mono text-xs font-bold text-teal mt-1 flex items-center gap-1">
              <Bot className="w-3.5 h-3.5" />
              {machine.agentStatus}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex items-center gap-2 border-b border-border text-sm font-semibold">
        <button
          onClick={() => setActiveTab('telemetry')}
          className={`pb-3 px-4 transition-all relative ${activeTab === 'telemetry' ? 'text-teal font-bold' : 'text-muted hover:text-ink'}`}
        >
          <span>Live Telemetry & Signals</span>
          {activeTab === 'telemetry' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal rounded-full" />}
        </button>
        <button
          onClick={() => setActiveTab('agent')}
          className={`pb-3 px-4 transition-all relative ${activeTab === 'agent' ? 'text-teal font-bold' : 'text-muted hover:text-ink'}`}
        >
          <span className="flex items-center gap-1.5">
            <Bot className="w-4 h-4 text-teal" />
            <span>AI Agent Root-Cause Analysis</span>
            {machine.activeIssues > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </span>
          {activeTab === 'agent' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal rounded-full" />}
        </button>
        <button
          onClick={() => setActiveTab('mes')}
          className={`pb-3 px-4 transition-all relative ${activeTab === 'mes' ? 'text-teal font-bold' : 'text-muted hover:text-ink'}`}
        >
          <span>MES Work Orders & Operator</span>
          {activeTab === 'mes' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal rounded-full" />}
        </button>
        <button
          onClick={() => setActiveTab('maintenance')}
          className={`pb-3 px-4 transition-all relative ${activeTab === 'maintenance' ? 'text-teal font-bold' : 'text-muted hover:text-ink'}`}
        >
          <span>Maintenance & Service History</span>
          {activeTab === 'maintenance' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal rounded-full" />}
        </button>
      </div>

      {/* Tab Content */}
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
                <div
                  key={m.key}
                  onClick={() => setSelectedMetric(m.key)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-panel border-teal ring-2 ring-teal/20 shadow-md'
                      : 'bg-panel border-border hover:border-teal/40'
                  }`}
                >
                  <div className="flex items-center justify-between text-muted text-xs mb-1 font-semibold uppercase">
                    <span>{m.label}</span>
                    <span className="w-2 h-2 rounded-full" style={{ background: mColor }} />
                  </div>
                  <div className="font-mono text-xl font-extrabold" style={{ color: mColor }}>
                    {m.value} <span className="text-xs text-muted font-normal">{m.unit}</span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-border/50 text-[10.5px] text-muted flex items-center justify-between">
                    <span>Normal: {m.normalRange[0]}-{m.normalRange[1]}</span>
                    <span className="font-semibold" style={{ color: mColor }}>{m.status}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detailed TimeSeries Chart */}
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
      )}

      {activeTab === 'agent' && (
        <div className="bg-panel border border-border rounded-[16px] p-6 shadow-sm flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal/15 border border-teal/40 flex items-center justify-center text-teal">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-head font-bold text-lg text-ink">Autonomous Agent Investigation Trace</h3>
                <p className="text-xs text-muted">Continuous LLM signal monitoring, anomaly classification & proactive resolution recommendation.</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-teal/15 text-teal border border-teal/30 text-xs font-mono font-bold">
              Status: {machine.agentStatus}
            </span>
          </div>

          {/* Investigation steps timeline */}
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-xl bg-slate-900 text-white font-mono text-xs border border-slate-700 flex flex-col gap-2">
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
            <div className="border border-border rounded-xl p-5 bg-[#F8FAFC]">
              <h4 className="font-head font-bold text-ink text-sm mb-2 flex items-center gap-2">
                <Shield className="w-4 h-4 text-teal" />
                AI Root Cause Diagnostics Summary
              </h4>
              <p className="text-xs text-slate-700 leading-relaxed mb-4">
                {machine.activeIssues > 0
                  ? `Agent detected sustained mechanical vibration in drive shaft bearing assembly. FFT spectral analysis indicates potential early-stage inner raceway pitting on Drive Shaft B.`
                  : `Machine telemetry is operating normally within engineered specifications. Preventive maintenance is schedule-locked in MES.`}
              </p>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/agents/maintenance')}
                  className="px-4 py-2 rounded-lg bg-teal text-navy-950 font-bold text-xs hover:bg-teal-deep hover:text-white transition-colors flex items-center gap-2"
                >
                  <Wrench className="w-4 h-4" />
                  <span>Launch Predictive Maintenance Agent</span>
                </button>
                <button
                  onClick={() => navigate('/agents/incident-investigation')}
                  className="px-4 py-2 rounded-lg bg-panel border border-border text-ink font-bold text-xs hover:border-teal transition-colors flex items-center gap-2"
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
        <div className="bg-panel border border-border rounded-[16px] p-6 shadow-sm">
          <h3 className="font-head font-bold text-lg text-ink mb-4">MES SQL Server Integration & Work Orders</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl border border-border bg-[#F8FAFC]">
              <div className="font-bold text-ink mb-2">Active Work Order</div>
              <div className="font-mono text-teal font-bold text-sm">WO-2026-88492</div>
              <div className="text-muted mt-1">Part: High-Precision Cylinder Block B</div>
              <div className="text-muted">Target Qty: 500 units • Completed: 342 units</div>
            </div>

            <div className="p-4 rounded-xl border border-border bg-[#F8FAFC]">
              <div className="font-bold text-ink mb-2">Assigned Line Operator</div>
              <div className="font-bold text-ink text-sm">{machine.operator}</div>
              <div className="text-muted mt-1">Shift: Day Shift (06:00 - 14:00)</div>
              <div className="text-muted">Certifications: Level 3 CNC Master Specialist</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'maintenance' && (
        <div className="bg-panel border border-border rounded-[16px] p-6 shadow-sm">
          <h3 className="font-head font-bold text-lg text-ink mb-4">Maintenance & Service Log</h3>
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg border border-border flex items-center justify-between">
              <div>
                <div className="font-bold text-ink">Last Scheduled Maintenance</div>
                <div className="text-muted">{machine.lastMaintenance} • Bearing lubrication & Filter Replacement</div>
              </div>
              <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 font-bold text-[11px]">Completed</span>
            </div>

            <div className="p-3 rounded-lg border border-border flex items-center justify-between">
              <div>
                <div className="font-bold text-ink">Next Inspection Due</div>
                <div className="text-muted">Scheduled for Oct 12, 2026</div>
              </div>
              <span className="px-2.5 py-1 rounded bg-teal/10 text-teal font-bold text-[11px]">Scheduled</span>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};
