import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Sparkles } from 'lucide-react';
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

type ChatItem = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  visuals?: ExecutiveVisual[];
};

const greeting = "Hi, I am Executive Insights Agent. Ask me about production, inventory, work orders, machine utilization, or sales.";
const PIE_COLORS = ['#0B1730', '#00A9AE', '#7C6FF0', '#F59E0B', '#1FA971', '#E24C4C'];

const chartData = (visual: ExecutiveVisual) =>
  visual.labels.map((label, i) => ({
    name: label,
    ...Object.fromEntries(visual.series.map(series => [series.name, series.data[i]])),
  }));

const fallbackResponse = (message: string): { reply: string; visuals: ExecutiveVisual[] } => {
  const q = message.toLowerCase();
  if (!q.trim()) {
    return {
      reply: greeting,
      visuals: [],
    };
  }

  if (q.includes('work order') || q.includes('workorder') || q.includes('order')) {
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

export const ExecutiveInsightsPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatItem[]>([
    { id: 'welcome', role: 'assistant', text: greeting },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const threadId = useMemo(() => `exec-${Date.now()}`, []);

  const sendMessage = async () => {
    const prompt = input.trim();
    if (!prompt || isLoading) return;

    const userMsg: ChatItem = { id: `u-${Date.now()}`, role: 'user', text: prompt };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/executive-insights/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, thread_id: threadId }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }

      const res = await response.json();
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: res.reply,
        visuals: res.visuals,
      }]);
    } catch (err) {
      const fallback = fallbackResponse(prompt);
      setMessages(prev => [...prev, {
        id: `e-${Date.now()}`,
        role: 'assistant',
        text: fallback.reply,
        visuals: fallback.visuals,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderChart = (visual: ExecutiveVisual) => {
    const data = chartData(visual);
    const showLegend = visual.meta?.legend !== false;
    const xLabel = visual.meta?.x_label;
    const yLabel = visual.meta?.y_label;

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
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="h-[calc(100vh-110px)] flex flex-col gap-4">
      <div className="bg-gradient-to-r from-navy-900 via-navy-800 to-teal-deep text-white rounded-[20px] p-6 shadow-[0_20px_50px_-24px_rgba(6,11,22,0.55)]">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/70 font-bold mb-2">
          <Sparkles className="w-4 h-4" />
          Executive Insights
        </div>
        <h1 className="font-head text-[28px] font-extrabold mb-2">Chat with data, backed by visuals</h1>
        <p className="text-white/80 max-w-[820px] leading-relaxed">
          Ask for operational insight in natural language, and the agent will return a short executive summary plus chart-ready visuals.
        </p>
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
                    <div className="h-[280px]">
                      {renderChart(visual)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {isLoading && <div className="text-[13px] text-muted">Executive Insights Agent is thinking...</div>}
        </div>

        <div className="border-t border-border-color p-4 bg-white">
          <div className="flex gap-3 items-end">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              rows={2}
              placeholder="Ask for a summary, trend, or chart..."
              className="flex-1 resize-none rounded-[14px] border border-border-color bg-canvas px-4 py-3 text-[14px] outline-none focus:border-teal-deep"
            />
            <button
              onClick={() => void sendMessage()}
              disabled={isLoading || !input.trim()}
              className="inline-flex items-center gap-2 rounded-[14px] bg-navy-900 px-4 py-3 text-white font-semibold disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
