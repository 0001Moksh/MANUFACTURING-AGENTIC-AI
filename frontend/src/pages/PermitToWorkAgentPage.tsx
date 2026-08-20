import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Send,
  FileCheck2,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  ArrowDown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { permitToWorkService } from '../services/permitToWorkService';
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
        <p key={`h-${i}`} className="font-bold text-[14.5px] text-ink mt-3 mb-1.5 flex items-center gap-1.5 text-navy-900">
          <span className="inline-block w-1.5 h-3.5 bg-amber-500 rounded-full"></span>
          {inlineMarkdown(text)}
        </p>
      );
      i++;
      continue;
    }

    if (/^(---|===)\s*$/.test(line.trim())) {
      flushList();
      nodes.push(<hr key={`hr-${i}`} className="my-3 border-border-color" />);
      i++;
      continue;
    }

    if (/^===\s*.+\s*===$/.test(line.trim())) {
      flushList();
      const title = line.replace(/^===\s*/, '').replace(/\s*===$/, '');
      nodes.push(
        <div key={`sec-${i}`} className="my-2.5 px-3 py-1 bg-amber-500/10 border-l-4 border-amber-500 rounded-r text-[12.5px] font-bold text-amber-900 uppercase tracking-wide">
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
      <p key={`p-${i}`} className="text-[13.5px] leading-relaxed my-1">
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
        <code key={i} className="bg-amber-50 text-amber-800 rounded px-1.5 py-0.5 text-[12px] font-mono border border-amber-200">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function MarkdownTable({ lines }: { lines: string[] }) {
  const rows = lines
    .filter((l) => !l.replace(/[|\s-]/g, '').trim() === false || !/^[|\s-]+$/.test(l))
    .filter((l) => !/^[\s|:-]+$/.test(l));

  if (rows.length < 2) return null;

  const parseRow = (row: string) =>
    row
      .split('|')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

  const headers = parseRow(rows[0]);
  const dataRows = rows.slice(1);

  return (
    <div className="overflow-x-auto my-3 rounded-[12px] border border-border-color shadow-sm bg-white">
      <table className="min-w-full text-[12.5px]">
        <thead className="bg-[#FFFBEB] border-b border-amber-200">
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-3.5 py-2.5 text-left font-bold text-amber-900 uppercase tracking-wider text-[11px] whitespace-nowrap"
              >
                {inlineMarkdown(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-color">
          {dataRows.map((rowStr, rIdx) => {
            const cells = parseRow(rowStr);
            return (
              <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white hover:bg-amber-50/40 transition-colors' : 'bg-[#FAFAFA] hover:bg-amber-50/40 transition-colors'}>
                {cells.map((c, cIdx) => (
                  <td key={cIdx} className="px-3.5 py-2 text-ink whitespace-nowrap text-[12px]">
                    {inlineMarkdown(c)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Suggested Prompt Pills ───────────────────────────────────────────────────

const SUGGESTED_QUERIES = [
  { icon: '⚠️', label: 'Active HSE Violations', query: 'Show all active HSE incidents and restricted zone breaches' },
  { icon: '🏭', label: 'High-Risk Work Context', query: 'Get live permit context summary: active incidents + maintenance windows + work orders' },
  { icon: '📋', label: 'Shift Handover Narrative', query: 'Give me a complete shift handover narrative for permit-to-work and site safety' },
  { icon: '🔥', label: 'Hot Work Checklist', query: 'What are the required controls and close-out checklist for Hot Work permits?' },
  { icon: '🚧', label: 'Confined Space Controls', query: 'What are the required minimum controls and entry checklist for Confined Space?' },
  { icon: '🏗️', label: 'Work at Height Rules', query: 'What are the required minimum controls for Work at Height?' },
  { icon: '🚨', label: 'Escalations Required', query: 'Show everything needing immediate escalation: critical incidents, overdue maintenance and delayed work orders' },
  { icon: 'ℹ️', label: 'Agent Data & Ownership', query: 'What data sources do you use, what happens if turned off, and who owns this agent?' },
];

// ─── Message Bubble ────────────────────────────────────────────────────────────

const MessageBubble: React.FC<{
  msg: ChatMessage;
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
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white shrink-0 shadow-xs mt-1">
          <FileCheck2 className="w-3.5 h-3.5" />
        </div>
      )}

      <div
        className={`group relative max-w-[900px] rounded-[16px] p-3 text-[13.5px] leading-relaxed shadow-2xs transition-shadow hover:shadow-sm ${isUser
            ? 'bg-navy-900 text-white rounded-tr-[4px]'
            : 'bg-white text-ink border border-border-color rounded-tl-[4px]'
          }`}
      >
        {/* Copy button */}
        <button
          onClick={() => onCopy(msg.id, msg.text)}
          title="Copy message"
          className={`absolute -top-1.5 ${isUser ? '-left-12.5' : '-right-6.5'} opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity w-12 h-12 rounded-full bg-white border border-border-color shadow-sm flex items-center justify-center cursor-pointer hover:bg-canvas`}
        >
          {copiedId === msg.id ? (
            <Check className="w-6 h-6 text-emerald-600" />
          ) : (
            <Copy className="w-6 h-6 text-muted" />
          )}
        </button>

        <div className="prose prose-sm max-w-none">
          {isUser ? (
            <p className="whitespace-pre-wrap m-0">{msg.text}</p>
          ) : (
            <div>
              {renderMarkdown(msg.text)}
              <AgentTelemetryFooter telemetry={msg.telemetry} rawText={msg.text} />
            </div>
          )}
        </div>
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

export const PermitToWorkAgentPage: React.FC = () => {
  const navigate = useNavigate();
  const [threadId, setThreadId] = useState<string>(() => `ptw-${Date.now()}`);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: "Hi sir, I'm the Permit-to-Work Agent. I track high-risk work, HSE incidents, restricted-zone breaches, and MES work orders to surface violations and support safe operations.",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
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
  }, [messages, scrollToBottom]);

  // Track scroll position to toggle "jump to latest" button
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distanceFromBottom > 250);
  };

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  }, [input]);

  const [activeSteps, setActiveSteps] = useState<ActiveToolStep[]>([]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend ?? input).trim();
    if (!query || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const startTime = performance.now();
    setActiveSteps([
      {
        tool_name: 'get_active_high_risk_permits',
        friendly_label: 'Scanning Hot Work & Confined Space Permits...',
        status: 'executing',
        startTime: Date.now(),
      },
    ]);

    try {
      const res = await permitToWorkService.chat(query, threadId);
      const elapsedSec = (performance.now() - startTime) / 1000;
      setActiveSteps((prev) =>
        prev.map((s) => ({ ...s, status: 'completed', durationSec: elapsedSec }))
      );

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: res.reply || 'No response returned from the Permit-to-Work engine.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        telemetry: createEstimatedTelemetry(
          elapsedSec,
          [
            { name: 'get_active_high_risk_permits', status: 'completed' },
            { name: 'validate_permit_authorization', status: 'completed' },
          ],
          query,
          res.reply || ''
        ),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        text: '⚠️ The Permit-to-Work Agent backend is temporarily unreachable. Please ensure the backend server is running and try again, sir.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
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
    setThreadId(`ptw-${Date.now()}`);
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        text: 'Thread reset. I am ready for your next permit, safety, or work order query, sir.',
      },
    ]);
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
      <div className="bg-gradient-to-r from-[#0B1730] via-[#122347] to-[#0A4D68] text-white rounded-[16px] shadow-sm shrink-0 border border-navy-700/50 overflow-hidden mx-3">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <h1 className="font-head text-[16px] font-extrabold m-0 text-white truncate">
              Permit-to-Work Agent
            </h1>
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
              <motion.span
                animate={{ rotate: heroExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center"
              >
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
                  Correlates live HSE camera alerts with MES work orders to track high-risk work and auto-escalate compliance violations.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                  <div className="bg-white/10 backdrop-blur-xs rounded-[12px] px-3 py-2 border border-white/10 text-center">
                    <div className="text-[18px] font-extrabold text-amber-400">4</div>
                    <div className="text-[10px] text-white/70 font-semibold uppercase">High-Risk Contexts</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs rounded-[12px] px-3 py-2 border border-white/10 text-center">
                    <div className="text-[18px] font-extrabold text-red-400">6</div>
                    <div className="text-[10px] text-white/70 font-semibold uppercase">Zone Breaches</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs rounded-[12px] px-3 py-2 border border-white/10 text-center">
                    <div className="text-[18px] font-extrabold text-cyan-300">2</div>
                    <div className="text-[10px] text-white/70 font-semibold uppercase">Open Windows</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs rounded-[12px] px-3 py-2 border border-white/10 text-center">
                    <div className="text-[18px] font-extrabold text-emerald-400">98.2%</div>
                    <div className="text-[10px] text-white/70 font-semibold uppercase">Compliance</div>
                  </div>
                </div>

                <div className="flex gap-1.5 mt-3 flex-wrap text-[10.5px] text-white/80">
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">🔥 Hot Work</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">🚧 Confined Space</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">🏗️ Work at Height</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">📍 Restricted Zones</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">⚙️ MES Work Orders</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">🚨 Auto-Escalation</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">📋 Shift Handover</span>
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

          {/* Tool Execution Indicator */}
          <div className="pl-10">
            <AgentExecutionIndicator
              activeSteps={activeSteps}
              isStreaming={loading}
              agentName="Permit-to-Work Agent"
            />
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
              className="absolute bottom-30 right-1/2 z-10 flex items-center gap-1.5 bg-gray-900 text-white text-[11.5px] font-semibold px-3 py-1.5 rounded-full shadow-lg hover:bg-navy-800 transition-colors cursor-pointer border-none"
            >
              <ArrowDown className="w-3.5 h-3.5" /> Latest
            </motion.button>
          )}
        </AnimatePresence>

        {/* Suggested Queries & Input Bar */}
        <div className="border-t border-border-color bg-white p-2.5 md:p-3 space-y-2 shrink-0">
          {/* Suggestion Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar text-[12px]">
            {SUGGESTED_QUERIES.map((sq, i) => (
              <button
                key={i}
                onClick={() => handleSend(sq.query)}
                disabled={loading}
                className="shrink-0 bg-canvas hover:bg-amber-50 text-ink hover:text-amber-900 border border-border-color hover:border-amber-300 px-3 py-1.5 rounded-full transition-all text-[11.5px] font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
              >
                <span>{sq.icon}</span>
                <span>{sq.label}</span>
              </button>
            ))}
          </div>

          {/* Text Input & Controls */}
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
              placeholder="Ask about active high-risk permits, zone breaches, work orders, hot-work checklists, or escalations..."
              className="flex-1 resize-none rounded-[12px] border border-border-color bg-canvas px-3.5 py-2 text-[13.5px] outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all placeholder:text-muted max-h-[140px]"
            />
            <button
              onClick={() => void handleSend()}
              disabled={loading || !input.trim()}
              className="inline-flex items-center gap-2 rounded-[12px] bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 px-4 py-2.5 text-white font-semibold text-[13.5px] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer border-none active:scale-95"
            >
              <Send className="w-4 h-4" /> Send
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default PermitToWorkAgentPage;