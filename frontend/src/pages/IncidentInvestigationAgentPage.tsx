import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Send,
  ShieldAlert,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ArrowDown,
  Copy,
  Check,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  incidentInvestigationService,
  type ToolInvocation,
  type TurnTelemetry,
  type IncidentInvestigationSummary,
} from '../services/incidentInvestigationService';
import { AgentExecutionIndicator } from '../components/common/AgentExecutionIndicator';
import { AgentTelemetryFooter } from '../components/common/AgentTelemetryFooter';
import type { ActiveToolStep } from '../types/telemetry';

// ─── Types ────────────────────────────────────────────────────────────────────

type ChatRole = 'assistant' | 'user';

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  timestamp?: string;
  telemetry?: TurnTelemetry;
  activeTools?: ToolInvocation[];
}

// ─── Lightweight Markdown & Table Renderer ────────────────────────────────────

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

    if (/^#{1,3}\s/.test(line)) {
      flushList();
      const text = line.replace(/^#{1,3}\s/, '');
      nodes.push(
        <p key={`h-${i}`} className="font-bold text-[14.5px] mt-3 mb-1.5 flex items-center gap-1.5 text-navy-900">
          <span className="inline-block w-1.5 h-3.5 bg-cyan-500 rounded-full"></span>
          {inlineMarkdown(text)}
        </p>
      );
      i++;
      continue;
    }

    if (/^(---|===)\s*$/.test(line.trim())) {
      flushList();
      nodes.push(<hr key={`hr-${i}`} className="my-3 border-border-color/60" />);
      i++;
      continue;
    }

    if (/^===\s*.+\s*===$/.test(line.trim())) {
      flushList();
      const title = line.replace(/^===\s*/, '').replace(/\s*===$/, '');
      nodes.push(
        <div key={`sec-${i}`} className="my-2.5 px-3 py-1 bg-cyan-500/10 border-l-4 border-cyan-500 rounded-r text-[12.5px] font-bold text-cyan-900 uppercase tracking-wide">
          {title}
        </div>
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
      <p key={`p-${i}`} className="text-[13.5px] leading-relaxed my-1 text-ink">
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
        <code key={i} className="bg-slate-100 text-cyan-800 rounded px-1.5 py-0.5 text-[12px] font-mono border border-slate-200">
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
        <tbody className="divide-y divide-border-color/60 bg-white">
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
      className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-700 to-teal-500 flex items-center justify-center text-white shrink-0 shadow-xs mt-1">
          <ShieldAlert className="w-3.5 h-3.5" />
        </div>
      )}

      <div
        className={`group relative max-w-[900px] rounded-[16px] p-3 text-[13.5px] leading-relaxed shadow-2xs transition-shadow hover:shadow-sm ${isUser
            ? 'bg-gradient-to-br from-[#0B1730] to-[#00808A] text-white rounded-tr-[4px]'
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

        <div className="prose prose-sm max-w-none">
          {isUser ? <p className="m-0 leading-relaxed">{msg.text}</p> : renderMarkdown(msg.text)}
        </div>

        {!isUser && <AgentTelemetryFooter telemetry={msg.telemetry} tools={msg.activeTools} rawText={msg.text} />}

        {msg.timestamp && (
          <div className={`text-[10px] mt-1.5 ${isUser ? 'text-white/60 text-right' : 'text-slate-400'}`}>{msg.timestamp}</div>
        )}
      </div>

      {isUser && (
        <div className="w-7 h-7 rounded-full bg-navy-800 flex items-center justify-center text-white shrink-0 shadow-xs mt-1">
          <span className="text-[11px] font-bold">U</span>
        </div>
      )}
    </motion.div>
  );
}

// ─── Suggested Forensic Prompts ───────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  { icon: '📊', label: 'TRIR (YTD)', query: 'Calculate our Total Recordable Incident Rate (TRIR)' },
  { icon: '🛡️', label: 'Zero Harm Index', query: 'Show current Zero Harm Index & plant safety breakdown' },
  { icon: '🚨', label: 'High-Risk Zones', query: 'List all high-risk plant zones and top anomalies' },
  { icon: '💧', label: 'Spill Check', query: 'Check for active chemical or oil spills on the factory floor' },
  { icon: '🔍', label: 'False Positives', query: 'Analyze low-confidence AI tracking alerts for false positives' },
  { icon: '🔥', label: 'Heat & Fatigue', query: 'Find employees with high-heat exposure and fatigue alerts' },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export const IncidentInvestigationAgentPage: React.FC = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTools, setActiveTools] = useState<ActiveToolStep[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [heroExpanded, setHeroExpanded] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const [threadId, setThreadId] = useState<string>(() => `incident-session-${Date.now()}`);
  const [summaryKpi, setSummaryKpi] = useState<IncidentInvestigationSummary>({
    status: 'success',
    trir_ytd: '0.42',
    zero_harm_index: '98.4',
    open_spill_alerts: 0,
    active_anomaly_flags: 3,
    audited_cameras: 24,
    ltifr_rate: '0.00',
    safety_audit_status: 'OPTIMAL',
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    incidentInvestigationService
      .getSummary()
      .then((data) => {
        if (data) setSummaryKpi(data);
      })
      .catch((err) => console.warn('Could not fetch incident summary:', err));

    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        text: `### 🔍 Incident & Investigation Forensic Intelligence Engine\n\nGreetings sir, I am **Deva**, your dedicated Incident & Investigation Agent created by IIIOT InfoTech.\n\nI am connected to the industrial site database with **43 specialized forensic SQL tools** to analyze:\n\n- **Safety KPI Rates:** Total Recordable Incident Rate (TRIR), LTIFR, Zero Harm Index.\n- **Spill & Defect Detection:** Chemical/oil spills, Basler camera leak detections, and pipeline integrity.\n- **Anomaly & Fatigue Forensics:** Restricted zone breaches, workforce fatigue, and baseline deviations.\n- **Vision Model Audits:** AI tracking low-confidence false positive rates and offline cameras.\n\nHow may I assist your forensic safety audit today, sir?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeTools, loading, scrollToBottom]);

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

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    const newThread = `incident-session-${Date.now()}`;
    setThreadId(newThread);
    setMessages([
      {
        id: 'welcome-reset',
        role: 'assistant',
        text: `Forensic audit history reset, sir. Ready for your next investigation query.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setInput('');
    setActiveTools([]);
  };

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || input;
    if (!textToSend.trim() || loading) return;

    const userMessageId = `user-${Date.now()}`;
    const assistantMessageId = `asst-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      {
        id: userMessageId,
        role: 'user',
        text: textToSend,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    setInput('');
    setLoading(true);
    setActiveTools([]);

    let accumulatedText = '';
    const completedTools: ToolInvocation[] = [];

    setMessages((prev) => [
      ...prev,
      {
        id: assistantMessageId,
        role: 'assistant',
        text: '',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    try {
      await incidentInvestigationService.streamChat(textToSend, threadId, {
        onInit: (newTid) => {
          if (newTid) setThreadId(newTid);
        },
        onToolStart: (tool) => {
          setActiveTools((prev) => [
            ...prev.filter((t) => t.tool_name !== tool.tool_name),
            {
              tool_name: tool.tool_name,
              tool_args: tool.tool_args,
              status: 'executing',
              startTime: Date.now(),
            },
          ]);
        },
        onToolEnd: (tool) => {
          const now = Date.now();
          setActiveTools((prev) =>
            prev.map((t) =>
              t.tool_name === tool.tool_name
                ? {
                  ...t,
                  status: 'completed',
                  durationSec: (now - t.startTime) / 1000,
                }
                : t
            )
          );
          completedTools.push({
            name: tool.tool_name,
            status: 'completed',
          });
        },
        onToken: (chunk) => {
          accumulatedText += chunk;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMessageId ? { ...m, text: accumulatedText } : m))
          );
        },
        onTelemetry: (telemetry) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? {
                  ...m,
                  telemetry: telemetry,
                  activeTools: telemetry.tools_used || completedTools,
                }
                : m
            )
          );
        },
        onDone: () => {
          setLoading(false);
          setActiveTools([]);
        },
        onError: (err) => {
          console.error('Streaming error fallback to standard API:', err);
          incidentInvestigationService
            .chat(textToSend, threadId)
            .then((res) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId
                    ? {
                      ...m,
                      text: res.reply,
                      telemetry: {
                        execution_time_sec: res.execution_time_sec,
                        tools_used: res.tools_used,
                        tokens: res.tokens,
                        cost_usd: res.cost_usd,
                      },
                    }
                    : m
                )
              );
            })
            .catch((fallbackErr) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId
                    ? {
                      ...m,
                      text: `⚠️ Error executing forensic query: ${fallbackErr.message || 'Unknown network error'}.`,
                    }
                    : m
                )
              );
            })
            .finally(() => {
              setLoading(false);
              setActiveTools([]);
            });
        },
      });
    } catch (err: any) {
      console.error('Incident agent execution failed:', err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? {
              ...m,
              text: `⚠️ Request failed: ${err.message || 'Unable to connect to agent backend.'}`,
            }
            : m
        )
      );
      setLoading(false);
      setActiveTools([]);
    }
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
          className="flex items-center pt-2 gap-2 text-[13px] font-semibold text-muted hover:text-cyan-600 transition-colors bg-transparent border-none cursor-pointer p-0"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      {/* ── Collapsible Hero Banner ── */}
      <div className="bg-gradient-to-r from-[#0B1730] via-[#102A43] to-[#0A3641] text-white rounded-[16px] shadow-sm shrink-0 border border-slate-700/50 overflow-hidden mx-3">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-3.5 h-3.5 text-cyan-300" />
            </div>
            <h1 className="font-head text-[16px] font-extrabold m-0 text-white truncate">
              Deva — Incident &amp; Investigation Agent
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-300 bg-emerald-400/10 border border-emerald-400/30 px-2 py-0.5 rounded-full ml-1 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              43 Tools Live
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleClearHistory}
              className="flex items-center gap-1.5 text-[11.5px] font-semibold text-white/85 hover:text-white bg-white/10 hover:bg-white/15 border border-white/10 px-2.5 py-1.5 rounded-[10px] transition-colors cursor-pointer"
              title="Reset conversation thread"
            >
              <RotateCcw className="w-3.5 h-3.5" /> New Conversation
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
                  Automated root-cause forensics, TRIR/LTIFR analysis, spill detection & safety anomaly intelligence across all plant zones.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                  <div className="bg-white/10 backdrop-blur-xs rounded-[12px] px-3 py-2 border border-white/10 text-center">
                    <div className="text-[10px] text-white/70 uppercase font-semibold">TRIR (YTD)</div>
                    <div className="text-[16px] font-extrabold text-cyan-300">{summaryKpi.trir_ytd}</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs rounded-[12px] px-3 py-2 border border-white/10 text-center">
                    <div className="text-[10px] text-white/70 uppercase font-semibold">Zero Harm</div>
                    <div className="text-[16px] font-extrabold text-emerald-400">{summaryKpi.zero_harm_index}%</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs rounded-[12px] px-3 py-2 border border-white/10 text-center">
                    <div className="text-[10px] text-white/70 uppercase font-semibold">Spill Alerts</div>
                    <div className="text-[16px] font-extrabold text-amber-300">{summaryKpi.open_spill_alerts}</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs rounded-[12px] px-3 py-2 border border-white/10 text-center">
                    <div className="text-[10px] text-white/70 uppercase font-semibold">Anomalies</div>
                    <div className="text-[16px] font-extrabold text-rose-300">{summaryKpi.active_anomaly_flags}</div>
                  </div>
                </div>

                <div className="flex gap-1.5 mt-3 flex-wrap text-[10.5px] text-white/80">
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">📊 TRIR / LTIFR</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">💧 Spill Detection</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">🔍 Anomaly Forensics</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">🎥 Vision Model Audits</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">🔥 Fatigue Detection</span>
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
            <AgentExecutionIndicator activeSteps={activeTools} agentName="Deva" isStreaming={loading} />
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
              <Sparkles className="w-3 h-3 text-cyan-600" /> Suggestions:
            </span>
            {SUGGESTED_PROMPTS.map((sq, i) => (
              <button
                key={i}
                onClick={() => handleSend(sq.query)}
                disabled={loading}
                className="shrink-0 bg-canvas hover:bg-cyan-50 text-ink hover:text-cyan-900 border border-border-color hover:border-cyan-300 px-3 py-1.5 rounded-full transition-all text-[11.5px] font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
              >
                <span>{sq.icon}</span>
                <span>{sq.label}</span>
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2 items-end"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              placeholder="Ask Deva: e.g. 'Calculate our current TRIR and Zero Harm Index across plants'..."
              disabled={loading}
              className="flex-1 resize-none rounded-[12px] border border-border-color bg-canvas px-3.5 py-2 text-[13.5px] outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 transition-all placeholder:text-muted max-h-[140px] disabled:bg-slate-100"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="inline-flex items-center gap-2 rounded-[12px] bg-gradient-to-r from-[#0B1730] to-[#00808A] px-4 py-2.5 text-white font-semibold text-[13.5px] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer border-none active:scale-95"
            >
              <Send className="w-4 h-4" /> Investigate
            </button>
          </form>
        </div>
      </div>
    </motion.div>
  );
};

export default IncidentInvestigationAgentPage;