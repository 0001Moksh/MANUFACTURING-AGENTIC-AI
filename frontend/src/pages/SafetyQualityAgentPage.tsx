import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Send,
  ShieldCheck,
  Loader2,
  Microscope,
  ClipboardList,
  PackageCheck,
  Users,
  RefreshCw,
  ChevronDown,
  ArrowDown,
  Copy,
  Check,
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
  timestamp?: string;
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

    if (line.trim() === '') {
      flushList();
      nodes.push(<div key={`br-${i}`} className="h-2" />);
      i++;
      continue;
    }

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

    if (/^[\*\-]\s/.test(line.trim())) {
      listBuffer.push(line.replace(/^[\*\-]\s/, '').trim());
      i++;
      continue;
    }

    if (/^\d+\.\s/.test(line.trim())) {
      listBuffer.push(line.replace(/^\d+\.\s/, '').trim());
      i++;
      continue;
    }

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
              <th key={i} className="px-3 py-2 text-left font-bold text-ink uppercase tracking-wider text-[11px]">
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

function MessageBubble({
  msg,
  copiedId,
  onCopy,
}: {
  msg: ChatMessage;
  copiedId: string | null;
  onCopy: (id: string, text: string) => void;
}) {
  const isUser = msg.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shrink-0 mr-2 mt-1 shadow-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      <div
        className={`group relative max-w-[900px] rounded-[16px] p-3 text-[13.5px] leading-relaxed shadow-2xs transition-shadow hover:shadow-sm ${isUser
            ? 'bg-gradient-to-br from-[#0B1730] to-[#0F2545] text-white rounded-tr-[4px]'
            : 'bg-white border border-border-color text-ink rounded-tl-[4px]'
          }`}
      >
        <button
          onClick={() => onCopy(msg.id, msg.text)}
          title="Copy message"
          className={`absolute -top-2.5 ${isUser ? '-left-2.5' : '-right-2.5'} opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity w-6 h-6 rounded-full bg-white border border-border-color shadow-sm flex items-center justify-center cursor-pointer hover:bg-canvas`}
        >
          {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-muted" />}
        </button>

        {isUser ? (
          <p className="text-[13.5px] leading-relaxed m-0 whitespace-pre-wrap">{msg.text}</p>
        ) : (
          <div>
            <div className="prose-sm max-w-none">{renderMarkdown(msg.text)}</div>
            <AgentTelemetryFooter telemetry={msg.telemetry} rawText={msg.text} />
          </div>
        )}

        {msg.timestamp && (
          <div className={`text-[10px] mt-1.5 ${isUser ? 'text-white/50 text-right' : 'text-muted'}`}>{msg.timestamp}</div>
        )}
      </div>
      {isUser && (
        <div className="w-7 h-7 rounded-full bg-navy-800 flex items-center justify-center text-white shrink-0 ml-2 mt-1 shadow-xs">
          <span className="text-[11px] font-bold">U</span>
        </div>
      )}
    </motion.div>
  );
}

// ─── Suggested Prompts ────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  { icon: '📋', label: 'Inspection Rules', query: 'List all quality inspection rules in the database' },
  { icon: '🏭', label: 'Top Defect Site', query: 'Which site has the most material defects this month?' },
  { icon: '🚧', label: 'Open Holds', query: 'Show me all open quality holds' },
  { icon: '📈', label: 'Pass/Fail Trend', query: 'What is the weekly pass/fail trend for inspections?' },
  { icon: '🧑‍🔧', label: 'Vendor Performance', query: 'Show vendor performance ranking for this quarter' },
  { icon: 'ℹ️', label: 'Agent Info', query: 'What data sources do you use, what happens if turned off, and who owns this agent?' },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export const SafetyQualityAgentPage: React.FC = () => {
  const navigate = useNavigate();
  const [threadId, setThreadId] = useState<string>(() => `sq-${Date.now()}`);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: "Hello sir! I am **Deva**, your Safety & Quality Agent (HSE Officer Assistant), created by IIIOT InfoTech.\n\nI have access to **80 specialized tools** covering quality inspections, defect analytics, material holds, vendor performance, inspector records, and compliance standards.\n\nHow can I assist you with site intelligence today, sir?",
      timestamp: 'Just now',
      telemetry: createEstimatedTelemetry(0.42, [{ name: 'get_today_quality_inspection_reports', status: 'completed' }]),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [heroExpanded, setHeroExpanded] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [activeSteps, setActiveSteps] = useState<ActiveToolStep[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, activeSteps, scrollToBottom]);

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
    setThreadId(`sq-${Date.now()}`);
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        text: 'New conversation started. Ask about quality inspections, defects, material holds, or compliance.',
        timestamp: 'Just now',
      },
    ]);
    setInput('');
    setActiveSteps([]);
  };

  const send = async (text?: string) => {
    const prompt = (text ?? input).trim();
    if (!prompt || loading) return;
    setInput('');
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', text: prompt, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    ]);
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
      setActiveSteps((prev) => prev.map((s) => ({ ...s, status: 'completed', durationSec: elapsedSec })));

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: res.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
          text: '⚠️ I am unable to reach the Safety & Quality Agent at this time, sir. Please try again shortly.',
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
      <div className="bg-gradient-to-r from-[#0B1730] via-[#0D2040] to-[#00808A] text-white rounded-[16px] shadow-sm shrink-0 border border-navy-700/50 overflow-hidden mx-3">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-teal-500/20 border border-teal-400/40 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-300" />
            </div>
            <h1 className="font-head text-[16px] font-extrabold m-0 text-white truncate">
              Deva — Safety &amp; Quality Agent
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
                  80 specialized tools covering PPE compliance, quality inspections, defect analytics, material holds, vendor performance, and compliance standards — all backed by live PostgreSQL data.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                  <div className="bg-white/10 backdrop-blur-xs rounded-[12px] px-3 py-2 border border-white/10 text-center">
                    <div className="flex justify-center mb-1"><ClipboardList className="w-3.5 h-3.5 text-teal-300" /></div>
                    <div className="text-[13px] font-extrabold text-white">80 Tools</div>
                    <div className="text-[9.5px] text-white/70 font-semibold uppercase">Specialized</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs rounded-[12px] px-3 py-2 border border-white/10 text-center">
                    <div className="flex justify-center mb-1"><Microscope className="w-3.5 h-3.5 text-teal-300" /></div>
                    <div className="text-[13px] font-extrabold text-white">PostgreSQL</div>
                    <div className="text-[9.5px] text-white/70 font-semibold uppercase">Database (RO)</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs rounded-[12px] px-3 py-2 border border-white/10 text-center">
                    <div className="flex justify-center mb-1"><PackageCheck className="w-3.5 h-3.5 text-teal-300" /></div>
                    <div className="text-[13px] font-extrabold text-white">Gemini/Groq</div>
                    <div className="text-[9.5px] text-white/70 font-semibold uppercase">LLM Gateway</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs rounded-[12px] px-3 py-2 border border-white/10 text-center">
                    <div className="flex justify-center mb-1"><Users className="w-3.5 h-3.5 text-teal-300" /></div>
                    <div className="text-[13px] font-extrabold text-white">Deva</div>
                    <div className="text-[9.5px] text-white/70 font-semibold uppercase">by Moksh</div>
                  </div>
                </div>

                <div className="flex gap-1.5 mt-3 flex-wrap text-[10.5px] text-white/80">
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">🦺 PPE Compliance</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">🔬 Defect Analytics</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">🚧 Quality Holds</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">🧑‍🔧 Vendor Performance</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">📋 Inspector Records</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">✅ Compliance Standards</span>
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
            <AgentExecutionIndicator activeSteps={activeSteps} isStreaming={loading} agentName="Deva" />
          </div>

          <div ref={bottomRef} />
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
            {SUGGESTED_PROMPTS.map((sq, i) => (
              <button
                key={i}
                onClick={() => void send(sq.query)}
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
              id="safety-agent-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={1}
              placeholder="Ask Deva about quality inspections, defects, holds, vendor performance..."
              className="flex-1 resize-none rounded-[12px] border border-border-color bg-canvas px-3.5 py-2 text-[13.5px] outline-none focus:border-teal-deep focus:ring-2 focus:ring-teal-500/20 transition-all placeholder:text-muted max-h-[140px]"
              disabled={loading}
            />
            <button
              id="safety-agent-send"
              onClick={() => void send()}
              disabled={loading || !input.trim()}
              className="inline-flex items-center gap-2 rounded-[12px] bg-gradient-to-br from-[#0B1730] to-[#00808A] px-4 py-2.5 text-white font-semibold text-[13.5px] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer border-none active:scale-95"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default SafetyQualityAgentPage;