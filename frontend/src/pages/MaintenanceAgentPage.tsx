import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Send, Wrench, Activity, CalendarDays, BellRing } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import type { MaintenanceVisual } from '../services/maintenanceInsightsService';
import { maintenanceInsightsService } from '../services/maintenanceInsightsService';
import { AgentExecutionIndicator } from '../components/common/AgentExecutionIndicator';
import { AgentTelemetryFooter } from '../components/common/AgentTelemetryFooter';
import type { TurnTelemetry, ActiveToolStep } from '../types/telemetry';
import { createEstimatedTelemetry } from '../utils/telemetryHelper';

type ChatItem = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  visuals?: MaintenanceVisual[];
  telemetry?: TurnTelemetry;
};

const COLORS = ['#0B1730', '#00A9AE', '#7C6FF0', '#F59E0B'];

const renderData = (visual: MaintenanceVisual) => (visual.labels || []).map((label, i) => ({
  name: label,
  ...Object.fromEntries((visual.series || []).map(series => [series.name, series.data[i]])),
}));

export const MaintenanceAgentPage: React.FC = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatItem[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hi sir, I am the Maintenance Agent. Ask me about machine health, predictive maintenance schedules, work orders, or alerts.',
      telemetry: createEstimatedTelemetry(0.38, [
        { name: 'query_machine_health', status: 'completed' },
      ]),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeSteps, setActiveSteps] = useState<ActiveToolStep[]>([]);
  const threadId = useMemo(() => `maint-${Date.now()}`, []);

  const send = async () => {
    const prompt = input.trim();
    if (!prompt || loading) return;
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', text: prompt }]);
    setInput('');
    setLoading(true);

    const startTime = performance.now();
    setActiveSteps([
      {
        tool_name: 'query_machine_health',
        friendly_label: 'Querying SCADA & Machine Health Telemetry...',
        status: 'executing',
        startTime: Date.now(),
      },
    ]);

    try {
      const res = await maintenanceInsightsService.chat(prompt, threadId);
      const elapsedSec = (performance.now() - startTime) / 1000;
      setActiveSteps((prev) =>
        prev.map((s) => ({ ...s, status: 'completed', durationSec: elapsedSec }))
      );

      setMessages(prev => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: res.reply,
          visuals: res.visuals,
          telemetry: createEstimatedTelemetry(
            elapsedSec,
            [
              { name: 'query_machine_health', status: 'completed' },
              { name: 'get_predictive_maintenance_schedule', status: 'completed' },
            ],
            prompt,
            res.reply
          ),
        },
      ]);
    } catch {
      setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'assistant', text: 'Maintenance service is unavailable right now.' }]);
    } finally {
      setLoading(false);
      setActiveSteps([]);
    }
  };

  const renderVisual = (visual: MaintenanceVisual) => {
    if (visual.type === 'flow') {
      const nodes = visual.nodes || [];
      const edges = visual.edges || [];
      return (
        <svg viewBox="0 0 860 180" className="w-full h-full">
          <defs>
            <marker id="maintArrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <polygon points="0 0, 8 4, 0 8" fill="#00A9AE" />
            </marker>
          </defs>
          {edges.map((edge, idx) => {
            const fromIdx = nodes.findIndex(n => n.id === edge.from);
            const toIdx = nodes.findIndex(n => n.id === edge.to);
            const fx = 90 + (fromIdx * 680) / Math.max(nodes.length - 1, 1);
            const tx = 90 + (toIdx * 680) / Math.max(nodes.length - 1, 1);
            return <line key={idx} x1={fx} y1="90" x2={tx} y2="90" stroke="#00A9AE" strokeWidth="2.5" markerEnd="url(#maintArrow)" />;
          })}
          {nodes.map((node, idx) => {
            const x = 90 + (idx * 680) / Math.max(nodes.length - 1, 1);
            return (
              <g key={node.id}>
                <rect x={x - 46} y="64" width="92" height="52" rx="16" fill="#0B1730" />
                <text x={x} y="96" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700">{node.label}</text>
              </g>
            );
          })}
        </svg>
      );
    }
    if (visual.type === 'pie') {
      const data = visual.labels.map((name, i) => ({ name, value: visual.series[0]?.data[i] ?? 0 }));
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip />
            <Legend />
            <Pie data={data} dataKey="value" nameKey="name" outerRadius={90} label>
              {data.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      );
    }
    const data = renderData(visual);
    if (visual.type === 'line') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            {visual.series.map((s, i) => <Line key={s.name} type="monotone" dataKey={s.name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} />)}
          </LineChart>
        </ResponsiveContainer>
      );
    }
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          {visual.series.map((s, i) => <Bar key={s.name} dataKey={s.name} fill={COLORS[i % COLORS.length]} radius={[6, 6, 0, 0]} />)}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="h-[calc(100vh-110px)] flex flex-col gap-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-[13px] font-semibold text-muted hover:text-teal transition-colors bg-transparent border-none cursor-pointer p-0 w-fit">
        <ArrowLeft className="w-4 h-4" /> Back to AI Agents
      </button>
      <div className="bg-gradient-to-r from-navy-900 via-navy-800 to-teal-deep text-white rounded-[20px] p-6">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/70 font-bold mb-2"><Wrench className="w-4 h-4" /> Maintenance Agent</div>
        <h1 className="font-head text-[28px] font-extrabold mb-2">Predictive Maintenance Chat</h1>
        <p className="text-white/80 max-w-[820px] leading-relaxed">Ask about machine health, maintenance schedules, work orders, and alerts. The agent returns concise answers plus maintenance-specific visuals.</p>
        <div className="flex gap-2 mt-4 flex-wrap text-[11px] text-white/80">
          <span className="px-2 py-1 rounded-full bg-white/10">Machine health</span>
          <span className="px-2 py-1 rounded-full bg-white/10">Predictive schedules</span>
          <span className="px-2 py-1 rounded-full bg-white/10">Work orders</span>
          <span className="px-2 py-1 rounded-full bg-white/10">Alerts</span>
        </div>
      </div>
      <div className="flex-1 grid grid-rows-[1fr_auto] bg-panel border border-border-color rounded-[20px] overflow-hidden shadow-sm min-h-0">
        <div className="overflow-y-auto p-5 space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[860px] rounded-[18px] p-4 ${msg.role === 'user' ? 'bg-navy-900 text-white rounded-br-[6px]' : 'bg-canvas text-ink border border-border-color rounded-bl-[6px]'}`}>
                <div className="whitespace-pre-wrap leading-relaxed text-[14px]">{msg.text}</div>
                {msg.visuals?.map((visual, idx) => (
                  <div key={`${msg.id}-${idx}`} className="mt-4 bg-white border border-border-color rounded-[16px] p-4">
                    <div className="font-semibold text-[13px] mb-3">{visual.title}</div>
                    <div className="h-[280px]">{renderVisual(visual)}</div>
                  </div>
                ))}
                {msg.role === 'assistant' && (
                  <AgentTelemetryFooter
                    telemetry={msg.telemetry}
                    rawText={msg.text}
                  />
                )}
              </div>
            </div>
          ))}
          <div className="pl-2">
            <AgentExecutionIndicator
              activeSteps={activeSteps}
              isStreaming={loading}
              agentName="Maintenance Agent"
            />
          </div>
        </div>
        <div className="border-t border-border-color p-4 bg-white">
          <div className="flex gap-3 items-end">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
              rows={2}
              placeholder="Ask about machine health or maintenance work orders..."
              className="flex-1 resize-none rounded-[14px] border border-border-color bg-canvas px-4 py-3 text-[14px] outline-none focus:border-teal-deep"
            />
            <button onClick={() => void send()} disabled={loading || !input.trim()} className="inline-flex items-center gap-2 rounded-[14px] bg-navy-900 px-4 py-3 text-white font-semibold disabled:opacity-50">
              <Send className="w-4 h-4" /> Send
            </button>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[12px] text-muted">
        <Activity className="w-4 h-4" />
        <CalendarDays className="w-4 h-4" />
        <BellRing className="w-4 h-4" />
        <span>Machine health, schedules, and work orders are all in one place.</span>
      </div>
    </motion.div>
  );
};

export default MaintenanceAgentPage;
