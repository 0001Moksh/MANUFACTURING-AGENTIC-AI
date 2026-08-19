import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Send,
  ShieldCheck,
  Loader2,
  Microscope,
  ClipboardList,
  PackageCheck,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { safetyQualityService } from '../services/safetyQualityService';
import { AgentExecutionIndicator } from '../components/common/AgentExecutionIndicator';
import { AgentTelemetryFooter } from '../components/common/AgentTelemetryFooter';
import type { TurnTelemetry, ActiveToolStep } from '../types/telemetry';
import { createEstimatedTelemetry } from '../utils/telemetryHelper';

// ─── Types ────────────────────────────────────────────────────────────────────

type ChatRole = 'assistant' | 'user';
interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  telemetry?: TurnTelemetry;
}

// ─── Lightweight Markdown Renderer ───────────────────────────────────────────

function renderMarkdown(raw: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const lines = raw.split('\n');
  let i = 0;
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length === 0) return;
    nodes.push(
      <ul key={`ul-${nodes.length}`} className="my-2 space-y-1 pl-4 list-disc list-outside text-[13.5px]">
        {listBuffer.map((item, j) => (
          <li key={j}>{inlineMarkdown(item)}</li>
        ))}
      </ul>
    );
    listBuffer = [];
  };

  while (i < lines.length) {
    const line = lines[i];

    // Blank line
    if (line.trim() === '') {
      flushList();
      nodes.push(<div key={`br-${i}`} className="h-2" />);
      i++;
      continue;
    }

    // Heading (### or ##)
    if (/^#{2,3}\s/.test(line)) {
      flushList();
      const text = line.replace(/^#{2,3}\s/, '');
      nodes.push(
        <p key={`h-${i}`} className="font-bold text-[14px] text-ink mt-3 mb-1">
          {inlineMarkdown(text)}
        </p>
      );
      i++;
      continue;
    }

    // Table
    if (line.trim().startsWith('|')) {
      flushList();
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      nodes.push(<MarkdownTable key={`tbl-${nodes.length}`} lines={tableLines} />);
      continue;
    }

    // Bullet list
    if (/^[\*\-]\s/.test(line.trim())) {
      listBuffer.push(line.replace(/^[\*\-]\s/, '').trim());
      i++;
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line.trim())) {
      listBuffer.push(line.replace(/^\d+\.\s/, '').trim());
      i++;
      continue;
    }

    // Regular paragraph
    flushList();
    nodes.push(
      <p key={`p-${i}`} className="text-[13.5px] leading-relaxed text-ink">
        {inlineMarkdown(line)}
      </p>
    );
    i++;
  }

  flushList();
  return nodes;
}

function inlineMarkdown(text: string): React.ReactNode {
  // Bold (**text**)
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong>;
    }
    if (/^`[^`]+`$/.test(part)) {
      return (
        <code key={i} className="bg-gray-100 text-teal-700 rounded px-1 text-[12px] font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function MarkdownTable({ lines }: { lines: string[] }) {
  if (lines.length < 2) return null;
  const parseRow = (line: string) =>
    line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());

  const headers = parseRow(lines[0]);
  const rows = lines.slice(2).map(parseRow);

  return (
    <div className="my-3 overflow-x-auto rounded-lg border border-border-color shadow-sm">
      <table className="min-w-full divide-y divide-border-color text-[12.5px]">
        <thead className="bg-[#F8FAFC]">
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-3 py-2 text-left font-bold text-ink uppercase tracking-wider text-[11px]"
              >
                {inlineMarkdown(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-color bg-white">
          {rows.map((row, rIdx) => (
            <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-[#FAFCFF]'}>
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="px-3 py-2 text-muted font-medium whitespace-pre-wrap">
                  {inlineMarkdown(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Chat Message Bubble ──────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shrink-0 mr-2 mt-1 shadow-sm">
          <ShieldCheck className="w-4 h-4 text-white" />
        </div>
      )}
      <div
        className={`max-w-[860px] rounded-[18px] px-5 py-4 shadow-sm ${
          isUser
            ? 'bg-gradient-to-br from-[#0B1730] to-[#0F2545] text-white rounded-br-[5px]'
            : 'bg-white border border-border-color text-ink rounded-bl-[5px]'
        }`}
      >
        {isUser ? (
          <p className="text-[14px] leading-relaxed">{msg.text}</p>
        ) : (
          <div>
            <div className="prose-sm max-w-none">{renderMarkdown(msg.text)}</div>
            <AgentTelemetryFooter telemetry={msg.telemetry} rawText={msg.text} />
          </div>
        )}
      </div>
    </motion.div>
  );
}



// ─── Suggested Prompts ────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  'List all quality inspection rules in the database',
  'Which site has the most material defects this month?',
  'Show me all open quality holds',
  'What is the weekly pass/fail trend for inspections?',
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export const SafetyQualityAgentPage: React.FC = () => {
  const navigate = useNavigate();
  const threadId = useMemo(() => `sq-${Date.now()}`, []);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: "Hello sir! I am **Deva**, your Safety & Quality Agent (HSE Officer Assistant), created by Moksh Bhardwaj.\n\nI have access to **80 specialized tools** covering quality inspections, defect analytics, material holds, vendor performance, inspector records, and compliance standards.\n\nHow can I assist you with site intelligence today, sir?",
      telemetry: createEstimatedTelemetry(0.42, [
        { name: 'get_today_quality_inspection_reports', status: 'completed' },
      ]),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeSteps, setActiveSteps] = useState<ActiveToolStep[]>([]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, activeSteps]);

  const send = async (text?: string) => {
    const prompt = (text ?? input).trim();
    if (!prompt || loading) return;
    setInput('');
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text: prompt }]);
    setLoading(true);

    const startTime = performance.now();
    setActiveSteps([
      {
        tool_name: 'get_today_quality_inspection_reports',
        friendly_label: 'Retrieving Quality Inspection Logs...',
        status: 'executing',
        startTime: Date.now(),
      },
    ]);

    try {
      const res = await safetyQualityService.chat(prompt, threadId);
      const elapsedSec = (performance.now() - startTime) / 1000;
      setActiveSteps((prev) =>
        prev.map((s) => ({ ...s, status: 'completed', durationSec: elapsedSec }))
      );

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: res.reply,
          telemetry: createEstimatedTelemetry(
            elapsedSec,
            [
              { name: 'get_today_quality_inspection_reports', status: 'completed' },
              { name: 'get_material_defect_analytics', status: 'completed' },
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
          text: 'I am unable to reach the Safety & Quality Agent at this time, sir. Please try again shortly.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="h-[calc(100vh-110px)] flex flex-col gap-4"
    >
      {/* ── Back button ── */}
      <button
        onClick={() => navigate('/agents')}
        className="flex items-center gap-2 text-[13px] font-semibold text-muted hover:text-teal transition-colors bg-transparent border-none cursor-pointer p-0 w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to AI Agents
      </button>

      {/* ── Hero Banner ── */}
      <div className="bg-gradient-to-r from-[#0B1730] via-[#0D2040] to-[#00808A] text-white rounded-[20px] p-6 relative overflow-hidden shrink-0">
        {/* Decorative blobs */}
        <div className="absolute -top-10 -right-10 w-56 h-56 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-40 h-40 bg-teal-400/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/70 font-bold mb-2">
              <ShieldCheck className="w-4 h-4" />
              Safety &amp; Quality Agent
            </div>
            <h1 className="font-head text-[26px] font-extrabold mb-2 leading-tight">
              Deva — HSE Officer Assistant
            </h1>
            <p className="text-white/80 max-w-[780px] leading-relaxed text-[13.5px]">
              80 specialized tools covering PPE compliance, quality inspections, defect analytics, material holds, vendor performance, and compliance standards — all backed by live PostgreSQL data.
            </p>
            <div className="flex gap-2 mt-4 flex-wrap text-[11px] text-white/80">
              {[
                'PPE Compliance',
                'Defect Analytics',
                'Quality Holds',
                'Vendor Performance',
                'Inspector Records',
                'Compliance Standards',
              ].map((tag) => (
                <span key={tag} className="px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-sm">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Stat chips */}
          <div className="flex gap-3 shrink-0 flex-wrap">
            {[
              { icon: <ClipboardList className="w-4 h-4 text-teal-300" />, label: 'Tools', value: '80 Specialized' },
              { icon: <Microscope className="w-4 h-4 text-teal-300" />, label: 'Database', value: 'PostgreSQL (RO)' },
              { icon: <PackageCheck className="w-4 h-4 text-teal-300" />, label: 'LLM Gateway', value: 'Gemini / Groq' },
              { icon: <Users className="w-4 h-4 text-teal-300" />, label: 'Persona', value: 'Deva by Moksh' },
            ].map((chip) => (
              <div
                key={chip.label}
                className="bg-white/10 border border-white/20 backdrop-blur-sm rounded-xl p-3 text-center min-w-[110px]"
              >
                <div className="flex justify-center mb-1">{chip.icon}</div>
                <div className="text-[10px] text-white/60 uppercase tracking-wider font-medium">
                  {chip.label}
                </div>
                <div className="text-[12px] font-bold text-white">{chip.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Chat Window ── */}
      <div className="flex-1 grid grid-rows-[1fr_auto] bg-panel border border-border-color rounded-[20px] overflow-hidden shadow-sm min-h-0">
        {/* Messages */}
        <div className="overflow-y-auto p-5 space-y-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          <div className="pl-10">
            <AgentExecutionIndicator
              activeSteps={activeSteps}
              isStreaming={loading}
              agentName="Deva"
            />
          </div>
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-border-color bg-white">
          {/* Suggested prompts (shown only when only welcome message exists) */}
          {messages.length === 1 && !loading && (
            <div className="px-5 pt-3 pb-1 flex flex-wrap gap-2">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => void send(p)}
                  className="text-[11.5px] px-3 py-1.5 rounded-full border border-teal/40 text-teal-700 hover:bg-teal/5 transition-colors bg-transparent cursor-pointer font-medium"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-3 items-end p-4">
            <textarea
              id="safety-agent-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              placeholder="Ask Deva about quality inspections, defects, holds, vendor performance..."
              className="flex-1 resize-none rounded-[14px] border border-border-color bg-canvas px-4 py-3 text-[14px] outline-none focus:border-teal-deep transition-colors"
              disabled={loading}
            />
            <button
              id="safety-agent-send"
              onClick={() => void send()}
              disabled={loading || !input.trim()}
              className="inline-flex items-center gap-2 rounded-[14px] bg-gradient-to-br from-[#0B1730] to-[#00808A] px-4 py-3 text-white font-semibold disabled:opacity-50 transition-opacity hover:opacity-90 shrink-0"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default SafetyQualityAgentPage;
