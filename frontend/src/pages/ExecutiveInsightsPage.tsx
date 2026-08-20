import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Send,
  RefreshCw,
  ChevronDown,
  ArrowDown,
  Copy,
  Check,
  BarChart3,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import { AgentTelemetryFooter } from '../components/common/AgentTelemetryFooter';
import type { TurnTelemetry } from '../types/telemetry';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { ExecutiveVisual } from '../services/executiveInsightsService';

// ─── Types ────────────────────────────────────────────────────────────────────

type ChatItem = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  timestamp?: string;
  visuals?: ExecutiveVisual[];
  telemetry?: TurnTelemetry;
};

const greeting = "Hi, I am Executive Insights Agent. Ask me about production, inventory, work orders, machine utilization, or sales.";
const PIE_COLORS = ['#0B1730', '#00A9AE', '#7C6FF0', '#F59E0B', '#1FA971', '#E24C4C'];
const capabilityReply = [
  'Yes. I can generate both analytical visuals and structural diagrams.',
  'Analytical charts: bar, column, line, trend, pie, donut, histogram, stacked bar, gauge / KPI cards.',
  'Process visuals: flowcharts, block diagrams, node-edge graphs, Sankey-style flows, and Gantt-style timelines.',
  'For process questions, ask for the pipeline, dependencies, or workflow and I will return a diagram schema.',
].join(' ');

const chartData = (visual: ExecutiveVisual) =>
  (visual.labels || []).map((label, i) => ({
    name: label,
    ...Object.fromEntries((visual.series || []).map((series) => [series.name, series.data[i]])),
  }));

const fallbackResponse = (message: string): { reply: string; visuals: ExecutiveVisual[] } => {
  const q = message.toLowerCase();
  if (!q.trim()) {
    return { reply: greeting, visuals: [] };
  }

  if (q.includes('what can you do') || q.includes('what can u do') || q.includes('how many charts') || q.includes('can you generate charts')) {
    return { reply: capabilityReply, visuals: [] };
  }

  if (q.includes('pipeline') || q.includes('workflow') || q.includes('flow') || q.includes('process') || q.includes('work order pipeline')) {
    return {
      reply: 'Here is the work-order pipeline as a flow diagram. You can ask for a specific step if you want more detail.',
      visuals: [
        {
          type: 'flow',
          title: 'Work Order Pipeline',
          labels: [],
          nodes: [
            { id: 'req', label: 'Request' },
            { id: 'plan', label: 'Planning' },
            { id: 'approve', label: 'Approval' },
            { id: 'exec', label: 'Execution' },
            { id: 'close', label: 'Closeout' },
          ],
          edges: [
            { from: 'req', to: 'plan' },
            { from: 'plan', to: 'approve' },
            { from: 'approve', to: 'exec' },
            { from: 'exec', to: 'close' },
          ],
          series: [],
          meta: { legend: false },
        },
      ],
    };
  }

  if (q.includes('work order') || q.includes('workorder') || q.includes('wo ')) {
    return {
      reply: 'I found a work-order focused view. Review active and delayed work orders first, then compare plan versus completion.',
      visuals: [
        {
          type: 'bar',
          title: 'Work Order Status',
          labels: ['WO-88213', 'WO-33912', 'WO-10442', 'WO-55610'],
          series: [
            { name: 'Planned Qty', data: [500, 250, 1000, 300] },
            { name: 'Completed Qty', data: [120, 0, 1000, 50] },
          ],
          meta: { legend: true, x_label: 'Work Order Number', y_label: 'Quantity' },
        },
      ],
    };
  }

  if (q.includes('machine') || q.includes('oee') || q.includes('capacity') || q.includes('utilization')) {
    return {
      reply: 'Machine performance is the right lens here. Compare capacity against utilization and flag the lowest-performing assets.',
      visuals: [
        {
          type: 'bar',
          title: 'Capacity vs Utilization',
          labels: ['Machine A', 'Machine B', 'Machine C', 'Machine D'],
          series: [
            { name: 'Capacity', data: [95, 88, 76, 64] },
            { name: 'Utilization', data: [83, 79, 68, 57] },
          ],
          meta: { legend: true, x_label: 'Machine', y_label: 'Score' },
        },
      ],
    };
  }

  if (q.includes('inventory') || q.includes('stock') || q.includes('material')) {
    return {
      reply: 'Inventory pressure looks manageable, but low-stock items and blocked quantity should be reviewed for early warning.',
      visuals: [
        {
          type: 'bar',
          title: 'Inventory Snapshot',
          labels: ['RM', 'WIP', 'FG', 'Blocked'],
          series: [{ name: 'Qty', data: [72, 56, 91, 18] }],
          meta: { legend: true, x_label: 'Bucket', y_label: 'Quantity' },
        },
      ],
    };
  }

  if (q.includes('sales') || q.includes('dispatch') || q.includes('revenue') || q.includes('forecast')) {
    return {
      reply: 'Commercial performance is best reviewed as a forecast-versus-actual lens, with dispatch timing used to explain the gaps.',
      visuals: [
        {
          type: 'line',
          title: 'Forecast vs Actual',
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          series: [
            { name: 'Forecast', data: [120, 135, 128, 142, 150] },
            { name: 'Actual', data: [112, 129, 123, 138, 146] },
          ],
          meta: { legend: true, x_label: 'Day', y_label: 'Value' },
        },
      ],
    };
  }

  return {
    reply: 'I can help with executive summaries, operational trends, and chart-backed answers. Try asking for production, inventory, work orders, machine utilization, or sales.',
    visuals: [
      {
        type: 'bar',
        title: 'Executive Dashboard Snapshot',
        labels: ['Production', 'Quality', 'Maintenance', 'Finance'],
        series: [{ name: 'Health', data: [84, 91, 76, 88] }],
        meta: { legend: true, x_label: 'Domain', y_label: 'Score' },
      },
    ],
  };
};

// ─── Diagrams / Charts ─────────────────────────────────────────────────────────

const FlowDiagram: React.FC<{ visual: ExecutiveVisual }> = ({ visual }) => {
  const nodes = visual.nodes || [];
  const edges = visual.edges || [];
  const width = 860;
  const height = 180;
  const nodePositions = nodes.map((node, index) => {
    const x = 80 + (index * (width - 160)) / Math.max(nodes.length - 1, 1);
    return { ...node, x, y: 90 };
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      {edges.map((edge, idx) => {
        const from = nodePositions.find((n) => n.id === edge.from);
        const to = nodePositions.find((n) => n.id === edge.to);
        if (!from || !to) return null;
        return (
          <line
            key={idx}
            x1={from.x + 48}
            y1={from.y}
            x2={to.x - 48}
            y2={to.y}
            stroke="#00A9AE"
            strokeWidth="2.5"
            markerEnd="url(#arrowhead)"
          />
        );
      })}
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <polygon points="0 0, 8 4, 0 8" fill="#00A9AE" />
        </marker>
      </defs>
      {nodePositions.map((node) => (
        <g key={node.id}>
          <rect x={node.x - 48} y={node.y - 26} width="96" height="52" rx="16" fill="#0B1730" />
          <text x={node.x} y={node.y + 5} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700">
            {node.label}
          </text>
        </g>
      ))}
    </svg>
  );
};

const HistogramBars: React.FC<{ visual: ExecutiveVisual }> = ({ visual }) => {
  const data = chartData(visual);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey={visual.series[0]?.name || 'Frequency'} fill="#0B1730" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

function VisualBlock({ visual }: { visual: ExecutiveVisual }) {
  const showLegend = visual.meta?.legend !== false;
  const xLabel = visual.meta?.x_label;
  const yLabel = visual.meta?.y_label;

  const renderChart = () => {
    if (visual.type === 'flow') return <FlowDiagram visual={visual} />;
    if (visual.type === 'histogram') return <HistogramBars visual={visual} />;

    const data = chartData(visual);

    if (visual.type === 'pie') {
      const pieData = visual.labels.map((name, i) => ({
        name,
        value: visual.series[0]?.data[i] ?? 0,
      }));
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip />
            {showLegend && <Legend />}
            <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label>
              {pieData.map((_, idx) => (
                <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (visual.type === 'line') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -5 } : undefined} />
            <YAxis label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft' } : undefined} />
            <Tooltip />
            {showLegend && <Legend />}
            {visual.series.map((series, i) => (
              <Line key={series.name} type="monotone" dataKey={series.name} stroke={PIE_COLORS[i % PIE_COLORS.length]} strokeWidth={2} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -5 } : undefined} />
          <YAxis label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft' } : undefined} />
          <Tooltip />
          {showLegend && <Legend />}
          {visual.series.map((series, i) => (
            <Bar key={series.name} dataKey={series.name} fill={PIE_COLORS[i % PIE_COLORS.length]} radius={[6, 6, 0, 0]} />
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
      <div className="h-[260px]">{renderChart()}</div>
    </div>
  );
}

// ─── Suggested Prompt Pills ───────────────────────────────────────────────────

const SUGGESTED_QUERIES = [
  { icon: '📈', label: 'Production Summary', query: 'Give me a summary of production performance this week' },
  { icon: '📦', label: 'Inventory Snapshot', query: 'Show current inventory snapshot across RM, WIP, and FG' },
  { icon: '🛠️', label: 'Work Order Status', query: 'Show me all open work orders and their status' },
  { icon: '⚙️', label: 'Machine Utilization', query: 'Show capacity vs utilization for our machines' },
  { icon: '💰', label: 'Sales Forecast', query: 'Show forecast vs actual sales trend' },
  { icon: '🔀', label: 'Work Order Pipeline', query: 'Show me the work order pipeline as a flow diagram' },
];

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
          <BarChart3 className="w-3.5 h-3.5" />
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

        <div className="whitespace-pre-wrap m-0">{msg.text}</div>

        {msg.visuals?.map((visual, idx) => (
          <VisualBlock key={`${msg.id}-${idx}`} visual={visual} />
        ))}

        {!isUser && msg.telemetry && <AgentTelemetryFooter telemetry={msg.telemetry} rawText={msg.text} />}

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

// ─── Main Page ────────────────────────────────────────────────────────────────

export const ExecutiveInsightsPage: React.FC = () => {
  const navigate = useNavigate();
  const [threadId, setThreadId] = useState<string>(() => `exec-${Date.now()}`);
  const [messages, setMessages] = useState<ChatItem[]>([
    { id: 'welcome', role: 'assistant', text: greeting, timestamp: 'Just now' },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [heroExpanded, setHeroExpanded] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

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

  const startNewConversation = () => {
    setThreadId(`exec-${Date.now()}`);
    setMessages([{ id: `welcome-${Date.now()}`, role: 'assistant', text: greeting, timestamp: 'Just now' }]);
    setInput('');
  };

  const sendMessage = async (textToSend?: string) => {
    const prompt = (textToSend ?? input).trim();
    if (!prompt || isLoading) return;

    const userMsg: ChatItem = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/executive-insights/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, thread_id: threadId }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }

      const res = await response.json();
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: res.reply,
          visuals: res.visuals,
          telemetry: res.telemetry,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      const fallback = fallbackResponse(prompt);
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          text: fallback.reply,
          visuals: fallback.visuals,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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
          <ArrowLeft className="w-4 h-4" /> Back to Use-Case Library
        </button>
      </div>

      {/* ── Collapsible Hero Banner ── */}
      <div className="bg-gradient-to-r from-[#0B1730] via-[#0F2545] to-[#00808A] text-white rounded-[16px] shadow-sm shrink-0 border border-navy-700/50 overflow-hidden mx-3">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-teal-500/20 border border-teal-400/40 flex items-center justify-center shrink-0">
              <BarChart3 className="w-3.5 h-3.5 text-teal-300" />
            </div>
            <h1 className="font-head text-[16px] font-extrabold m-0 text-white truncate">
              Chat with Data: Executive Insights
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-300 bg-emerald-400/10 border border-emerald-400/30 px-2 py-0.5 rounded-full ml-1 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={startNewConversation}
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
                  Ask for operational insight in natural language and receive a concise executive summary with chart-ready visuals — production, inventory, work orders, machine utilization, and sales.
                </p>

                <div className="flex gap-1.5 mt-3 flex-wrap text-[10.5px] text-white/80">
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">📊 Operational Analytics</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">📈 Charts</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">📝 Executive Summaries</span>
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

          {isLoading && (
            <div className="pl-10 text-[12.5px] text-muted flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
              Executive Insights Agent is thinking...
            </div>
          )}

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
                onClick={() => void sendMessage(sq.query)}
                disabled={isLoading}
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
                  void sendMessage();
                }
              }}
              rows={1}
              placeholder="Ask for a summary, trend, or chart..."
              className="flex-1 resize-none rounded-[12px] border border-border-color bg-canvas px-3.5 py-2 text-[13.5px] outline-none focus:border-teal-deep focus:ring-2 focus:ring-teal-500/20 transition-all placeholder:text-muted max-h-[140px]"
            />
            <button
              onClick={() => void sendMessage()}
              disabled={isLoading || !input.trim()}
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

export default ExecutiveInsightsPage;