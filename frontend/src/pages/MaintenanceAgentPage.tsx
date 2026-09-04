import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Send,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ArrowDown,
  Wrench,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import type { MaintenanceVisual } from '../services/maintenanceInsightsService';
import { maintenanceInsightsService } from '../services/maintenanceInsightsService';
import { AgentExecutionIndicator } from '../components/common/AgentExecutionIndicator';
import { AgentTelemetryFooter } from '../components/common/AgentTelemetryFooter';
import { parseMarkdown } from '../utils/markdownParser';
import type { TurnTelemetry, ActiveToolStep } from '../types/telemetry';
import { createEstimatedTelemetry } from '../utils/telemetryHelper';

// ─── Types ────────────────────────────────────────────────────────────────────

type ChatItem = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  timestamp?: string;
  visuals?: MaintenanceVisual[];
  telemetry?: TurnTelemetry;
};

const COLORS = ['#0B1730', '#00A9AE', '#7C6FF0', '#F59E0B'];

const renderData = (visual: MaintenanceVisual) =>
  (visual.labels || []).map((label, i) => ({
    name: label,
    ...Object.fromEntries((visual.series || []).map((series) => [series.name, series.data[i]])),
  }));

// ─── Suggested Prompt Pills ───────────────────────────────────────────────────

const SUGGESTED_QUERIES = [
  { icon: '', label: 'Machine Health', query: 'Give me the current health status of all critical machines' },
  { icon: '', label: 'Predictive Schedule', query: 'Show the predictive maintenance schedule for this week' },
  { icon: '', label: 'Open Work Orders', query: 'List all open maintenance work orders with priority' },
  { icon: '', label: 'Active Alerts', query: 'Show all active machine alerts that need attention' },
  { icon: '', label: 'Downtime Trend', query: 'Show downtime trend for the last 7 days by machine' },
  { icon: '', label: 'Agent Data & Ownership', query: 'What data sources do you use, what happens if turned off, and who owns this agent?' },
];

// ─── Chart Renderer ───────────────────────────────────────────────────────────

function VisualBlock({ visual }: { visual: MaintenanceVisual }) {
  const renderVisual = () => {
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
            const fromIdx = nodes.findIndex((n) => n.id === edge.from);
            const toIdx = nodes.findIndex((n) => n.id === edge.to);
            const fx = 90 + (fromIdx * 680) / Math.max(nodes.length - 1, 1);
            const tx = 90 + (toIdx * 680) / Math.max(nodes.length - 1, 1);
            return <line key={idx} x1={fx} y1="90" x2={tx} y2="90" stroke="#00A9AE" strokeWidth="2.5" markerEnd="url(#maintArrow)" />;
          })}
          {nodes.map((node, idx) => {
            const x = 90 + (idx * 680) / Math.max(nodes.length - 1, 1);
            return (
              <g key={node.id}>
                <rect x={x - 46} y="64" width="92" height="52" rx="16" fill="#0B1730" />
                <text x={x} y="96" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700">
                  {node.label}
                </text>
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
              {data.map((_, idx) => (
                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
              ))}
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
            {visual.series.map((s, i) => (
              <Line key={s.name} type="monotone" dataKey={s.name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} />
            ))}
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
          {visual.series.map((s, i) => (
            <Bar key={s.name} dataKey={s.name} fill={COLORS[i % COLORS.length]} radius={[6, 6, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="mt-3 bg-white border border-border-color rounded-[14px] p-3.5 shadow-2xs">
      <div className="font-semibold text-[12.5px] mb-2.5 text-navy-900 flex items-center gap-1.5">
        <span className="inline-block w-1.5 h-3.5 bg-teal-500 rounded-full" />
        {visual.title}
      </div>
      <div className="h-[260px]">{renderVisual()}</div>
    </div>
  );
}

// ─── Assistant Content Renderer (JSON / Structured Text → Tables) ──────────
function AssistantContent({ text }: { text: string }) {
  // Try parse JSON first
  try {
    const obj = JSON.parse(text);
    // machines array
    if (obj && Array.isArray(obj.machines)) {
      return (
        <div className="my-3 overflow-x-auto">
          <table className="min-w-full text-[13px] bg-white border border-border-color rounded-md">
            <thead className="bg-[#F8FAFC]">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Machine Code</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-left font-semibold">Capacity / hr</th>
                <th className="px-3 py-2 text-left font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {obj.machines.map((m: any, i: number) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFF]'}>
                  <td className="px-3 py-2 align-top">{m.machine_code}</td>
                  <td className="px-3 py-2 align-top">{m.status}</td>
                  <td className="px-3 py-2 align-top">{m.capacity_per_hour}</td>
                  <td className="px-3 py-2 align-top">{m.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    // generic array -> render table
    if (obj && Array.isArray(obj)) {
      const keys = Array.from(new Set(obj.flatMap((r: any) => Object.keys(r))));
      return (
        <div className="my-3 overflow-x-auto">
          <table className="min-w-full text-[13px] bg-white border border-border-color rounded-md">
            <thead className="bg-[#F8FAFC]">
              <tr>{keys.map((k) => <th key={k} className="px-3 py-2 text-left font-semibold">{k}</th>)}</tr>
            </thead>
            <tbody>
              {obj.map((row: any, i: number) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFF]'}>
                  {keys.map((k) => <td key={k} className="px-3 py-2 align-top">{String(row[k] ?? '')}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
  } catch (e) {
    // not JSON — fall through
  }

  // Try to parse simple key: value blocks (work orders)
  if (text.includes('Work Order Number:') || text.match(/Machine ID:\s*\d+/)) {
    const blocks = text.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
    const rows = blocks.map((blk) => {
      const obj: any = {};
      blk.split('\n').forEach((line) => {
        const parts = line.split(':');
        if (parts.length >= 2) {
          const key = parts.shift()!.trim();
          const val = parts.join(':').trim();
          obj[key] = val;
        }
      });
      return obj;
    });
    const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
    return (
      <div className="my-3 overflow-x-auto">
        <table className="min-w-full text-[13px] bg-white border border-border-color rounded-md">
          <thead className="bg-[#F8FAFC]">
            <tr>{keys.map((k) => <th key={k} className="px-3 py-2 text-left font-semibold">{k}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFF]'}>
                {keys.map((k) => <td key={k} className="px-3 py-2 align-top">{row[k] ?? ''}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // fallback to markdown/html
  return <div dangerouslySetInnerHTML={{ __html: parseMarkdown(text) }} />;
}

// ─── Message Bubble ────────────────────────────────────────────────────────────

const MessageBubble: React.FC<{
  msg: ChatItem;
  copiedId: string | null;
  onCopy: (id: string, text: string) => void;
}> = ({ msg, copiedId, onCopy }) => {
  const isUser = msg.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white shrink-0 shadow-xs mt-1">
          <Wrench className="w-3.5 h-3.5" />
        </div>
      )}

      <div
        className={`group relative max-w-[900px] rounded-[16px] p-3 text-[13.5px] leading-relaxed shadow-2xs transition-shadow hover:shadow-sm ${
          isUser
            ? 'bg-navy-900 text-white rounded-tr-[4px]'
            : 'bg-white text-ink border border-border-color rounded-tl-[4px]'
        }`}
      >
        <button
          onClick={() => onCopy(msg.id, msg.text)}
          title="Copy message"
          className={`absolute -top-2.5 ${isUser ? '-left-2.5' : '-right-2.5'} opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity w-6 h-6 rounded-full bg-white border border-border-color shadow-sm flex items-center justify-center cursor-pointer hover:bg-canvas`}
        >
          {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-muted" />}
        </button>

        <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2">
          {msg.role === 'assistant' ? <AssistantContent text={msg.text} /> : <div dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.text) }} />}
        </div>

        {msg.visuals?.map((visual, idx) => (
          <VisualBlock key={`${msg.id}-${idx}`} visual={visual} />
        ))}

        {!isUser && <AgentTelemetryFooter telemetry={msg.telemetry} rawText={msg.text} />}

        {msg.timestamp && (
          <div className={`text-[10px] mt-1.5 ${isUser ? 'text-white/50 text-right' : 'text-muted'}`}>{msg.timestamp}</div>
        )}
      </div>

      {isUser && (
        <div className="w-7 h-7 rounded-full bg-navy-800 flex items-center justify-center text-white shrink-0 shadow-xs mt-1">
          <span className="text-[11px] font-bold">U</span>
        </div>
      )}
    </motion.div>
  );
};

// ─── Main Page Component ──────────────────────────────────────────────────────

export const MaintenanceAgentPage: React.FC = () => {
  const navigate = useNavigate();
  const [threadId, setThreadId] = useState<string>(() => `maint-${Date.now()}`);
  const [messages, setMessages] = useState<ChatItem[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hi sir, I am the Maintenance Agent. Ask me about machine health, predictive maintenance schedules, work orders, or alerts.',
      timestamp: 'Just now',
      telemetry: createEstimatedTelemetry(0.38, [{ name: 'query_machine_health', status: 'completed' }]),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [heroExpanded, setHeroExpanded] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [activeSteps, setActiveSteps] = useState<ActiveToolStep[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distanceFromBottom > 250);
  };

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  }, [input]);

  const handleSend = async (textToSend?: string) => {
    const prompt = (textToSend ?? input).trim();
    if (!prompt || loading) return;

    setMessages((prev) => [
      ...prev,
      {
        id: `u-${Date.now()}`,
        role: 'user',
        text: prompt,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
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
      setActiveSteps((prev) => prev.map((s) => ({ ...s, status: 'completed', durationSec: elapsedSec })));

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: res.reply,
          visuals: res.visuals,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          text: 'Maintenance service is temporarily unreachable. Please ensure the backend server is running and try again, sir.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
      setActiveSteps([]);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleResetThread = () => {
    setThreadId(`maint-${Date.now()}`);
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        text: 'New conversation started. Ask me about machine health, predictive maintenance schedules, work orders, or alerts.',
        timestamp: 'Just now',
      },
    ]);
    setInput('');
    setActiveSteps([]);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="h-[calc(100vh-22px)] flex flex-col gap-1 w-full px-0 overflow-hidden"
    >
      {/* ── Top Bar / Navigation ── */}
      <div className="flex items-center justify-between pt-2 shrink-0 px-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center pt-2 gap-2 text-[13px] font-semibold text-muted hover:text-teal transition-colors bg-transparent border-none cursor-pointer p-0"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      {/* ── Collapsible Hero Banner ── */}
      <div className="bg-gradient-to-r from-[#0B1730] via-[#0F2A42] to-[#0A4D68] text-white rounded-[16px] shadow-sm shrink-0 border border-navy-700/50 overflow-hidden mx-3">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-teal-500/20 border border-teal-400/40 flex items-center justify-center shrink-0">
              <Wrench className="w-3.5 h-3.5 text-teal-300" />
            </div>
            <h1 className="font-head text-[16px] font-extrabold m-0 text-white truncate">Maintenance Agent</h1>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-300 bg-emerald-400/10 border border-emerald-400/30 px-2 py-0.5 rounded-full ml-1 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleResetThread}
              className="flex items-center gap-1.5 text-[11.5px] font-semibold text-white/85 hover:text-white bg-white/10 hover:bg-white/15 border border-white/10 px-2.5 py-1.5 rounded-[10px] transition-colors cursor-pointer"
              title="Reset conversation thread"
            >
              <RefreshCw className="w-3.5 h-3.5" /> New Conversation
            </button>
            <button
              onClick={() => setHeroExpanded((v) => !v)}
              className="flex items-center gap-1 text-[11.5px] font-semibold text-white/85 hover:text-white bg-white/10 hover:bg-white/15 border border-white/10 px-2.5 py-1.5 rounded-[10px] transition-colors cursor-pointer"
              title={heroExpanded ? 'Collapse' : 'Expand'}
            >
              <motion.span animate={{ rotate: heroExpanded ? 180 : 0 }} transition={{ duration: 0.2 }} className="flex items-center">
                <ChevronDown className="w-3.5 h-3.5" />
              </motion.span>
              {heroExpanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {heroExpanded && (
            <motion.div
              key="hero-detail"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-1 border-t border-white/10">
                <p className="text-white/80 text-[13px] max-w-[840px] mt-2 mb-0 leading-relaxed">
                  Correlates live SCADA telemetry with maintenance history to track machine health, predict failures, and surface work orders before downtime hits.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                  <div className="bg-white/10 backdrop-blur-xs rounded-[12px] px-3 py-2 border border-white/10 text-center">
                    <div className="text-[18px] font-extrabold text-teal-300">12</div>
                    <div className="text-[10px] text-white/70 font-semibold uppercase">Machines Tracked</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs rounded-[12px] px-3 py-2 border border-white/10 text-center">
                    <div className="text-[18px] font-extrabold text-red-400">3</div>
                    <div className="text-[10px] text-white/70 font-semibold uppercase">Active Alerts</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs rounded-[12px] px-3 py-2 border border-white/10 text-center">
                    <div className="text-[18px] font-extrabold text-amber-400">7</div>
                    <div className="text-[10px] text-white/70 font-semibold uppercase">Open Work Orders</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs rounded-[12px] px-3 py-2 border border-white/10 text-center">
                    <div className="text-[18px] font-extrabold text-emerald-400">94.6%</div>
                    <div className="text-[10px] text-white/70 font-semibold uppercase">Uptime</div>
                  </div>
                </div>

                <div className="flex gap-1.5 mt-3 flex-wrap text-[10.5px] text-white/80">
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">Machine Health</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">Predictive Schedules</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">Work Orders</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">Alerts</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">Downtime Trends</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Main Chat Interface ── */}
      <div className="flex-1 grid grid-rows-[1fr_auto] overflow-hidden min-h-0 md:mx-2 relative">
        {/* Messages Stream */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="overflow-y-auto overflow-x-hidden p-3 md:p-4 space-y-3 custom-scrollbar min-h-0"
        >
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} copiedId={copiedId} onCopy={handleCopy} />
            ))}
          </AnimatePresence>

          <div className="pl-10">
            <AgentExecutionIndicator activeSteps={activeSteps} isStreaming={loading} agentName="Maintenance Agent" />
          </div>

          <div ref={messagesEndRef} />
        </div>

        {/* Jump to latest button */}
        <AnimatePresence>
          {showScrollBtn && (
            <motion.button
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              onClick={() => scrollToBottom()}
              className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 bg-navy-900 text-white text-[11.5px] font-semibold px-3 py-1.5 rounded-full shadow-lg hover:bg-navy-800 transition-colors cursor-pointer border-none"
            >
              <ArrowDown className="w-3.5 h-3.5" /> Latest
            </motion.button>
          )}
        </AnimatePresence>

        {/* Suggested Queries & Input Bar */}
        <div className="border-t border-border-color bg-white p-2.5 md:p-3 space-y-2 shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar text-[12px]">
            <span className="text-[10.5px] font-bold text-muted uppercase tracking-wider shrink-0 flex items-center gap-1">
              Quick Ask:
            </span>
            {SUGGESTED_QUERIES.map((sq, i) => (
              <button
                key={i}
                onClick={() => handleSend(sq.query)}
                disabled={loading}
                className="shrink-0 bg-canvas hover:bg-teal-50 text-ink hover:text-teal-900 border border-border-color hover:border-teal-300 px-3 py-1.5 rounded-full transition-all text-[11.5px] font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
              >
                <span>{sq.icon}</span>
                <span>{sq.label}</span>
              </button>
            ))}
          </div>

          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              rows={1}
              placeholder="Ask about machine health, predictive schedules, work orders, or alerts..."
              className="flex-1 resize-none rounded-[12px] border border-border-color bg-canvas px-3.5 py-2 text-[13.5px] outline-none focus:border-teal-deep focus:ring-2 focus:ring-teal-500/20 transition-all placeholder:text-muted max-h-[140px]"
            />
            <button
              onClick={() => void handleSend()}
              disabled={loading || !input.trim()}
              className="inline-flex items-center gap-2 rounded-[12px] bg-gradient-to-r from-navy-900 to-navy-800 hover:from-navy-800 hover:to-navy-700 px-4 py-2.5 text-white font-semibold text-[13.5px] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer border-none active:scale-95"
            >
              <Send className="w-4 h-4" /> Send
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default MaintenanceAgentPage;