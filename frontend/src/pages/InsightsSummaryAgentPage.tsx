import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Send,
  BarChart3,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  Image as ImageIcon,
  ArrowDown,
  Paperclip,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
  attachmentName?: string;
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
  { icon: '📊', label: 'Summarize Chart Trends', query: 'Summarize the key trends and anomalies visible in the attached chart or latest dashboard metrics.' },
  { icon: '📈', label: 'Executive Brief', query: 'Generate a concise executive summary of production KPIs, quality metrics, and any red-flag indicators.' },
  { icon: '🔍', label: 'Anomaly Deep-Dive', query: 'Highlight any statistical outliers or sudden shifts in the metadata and visual analytics provided.' },
  { icon: '📋', label: 'Shift Handover Notes', query: 'Create a clear shift-handover narrative based on current charts, alarms and process metadata.' },
  { icon: '🎯', label: 'Actionable Insights', query: 'Extract the top 3–5 actionable recommendations from the current visual and metadata context.' },
  { icon: '📉', label: 'Root-Cause Hints', query: 'Suggest possible root causes for the most significant deviations shown in the data.' },
  { icon: '🗂', label: 'Metadata Overview', query: 'Give a structured overview of the available metadata fields and their relevance to the current analysis.' },
  { icon: 'ℹ️', label: 'Agent Capabilities', query: 'What data sources do you use, what happens if the agent is offline, and who owns this Insights Summary Agent?' },
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
            <div>
              {msg.attachmentName && (
                <div className="mb-1.5 flex items-center gap-1.5 text-[12px] opacity-90">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[220px]">{msg.attachmentName}</span>
                </div>
              )}
              <p className="whitespace-pre-wrap m-0">{msg.text}</p>
            </div>
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

export const InsightsSummaryAgentPage: React.FC = () => {
  const navigate = useNavigate();
  const [threadId, setThreadId] = useState<string>(() => `insights-${Date.now()}`);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: "Hi Sir, I am the Insights Summary Agent. I specialize in synthesizing chart data, visual analytics, and metadata into concise or detailed summaries. How may I assist you today?",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [heroExpanded, setHeroExpanded] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

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
    if ((!query && !attachedFile) || loading) return;

    const displayText = query || (attachedFile ? `Analyze attached image: ${attachedFile.name}` : '');
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: displayText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachmentName: attachedFile?.name,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setAttachedFile(null);
    if (fileRef.current) fileRef.current.value = '';
    setLoading(true);

    const startTime = performance.now();
    setActiveSteps([
      {
        tool_name: 'analyze_visual_metadata',
        friendly_label: 'Extracting chart patterns & metadata...',
        status: 'executing',
        startTime: Date.now(),
      },
    ]);

    try {
      // If an image is attached, validate it with the backend guardrail first
      if (attachedFile) {
        const fd = new FormData();
        fd.append('file', attachedFile);
        const vres = await fetch('/api/agents/insights/validate-image', {
          method: 'POST',
          body: fd,
        });
        if (!vres.ok) {
          const vp = await vres.json().catch(() => ({}));
          const reason = vp.reason || 'invalid_image';
          const guardMsg: ChatMessage = {
            id: `guard-${Date.now()}`,
            role: 'assistant',
            text: `Sir, I can only analyze chart visualizations. The uploaded file was rejected (${reason}). Please attach a valid chart image or ask a question about the metadata.`,
          };
          setMessages((prev) => [...prev, guardMsg]);
          setLoading(false);
          setActiveSteps([]);
          return;
        }
        // otherwise allow and continue; backend may provide a reason
      }
      // Placeholder – replace with real insightsSummaryService.chat(...) when available
      await new Promise((r) => setTimeout(r, 900 + Math.random() * 600));
      const elapsedSec = (performance.now() - startTime) / 1000;

      setActiveSteps((prev) =>
        prev.map((s) => ({ ...s, status: 'completed', durationSec: elapsedSec }))
      );

      const mockReply = `### Insights Summary

I have reviewed the request${attachedFile ? ` and the attached visual (${attachedFile.name})` : ''}.

**Key observations**
- Primary trend direction and magnitude have been extracted from the visual / metadata context.
- Several secondary signals (outliers, rate-of-change, correlation hints) are highlighted below.

**Actionable takeaways**
1. Focus monitoring on the most significant deviation window.
2. Cross-check the metadata fields that show the strongest correlation with the observed pattern.
3. Consider a short-cycle review at the next shift handover.

---
*This is a simulated response. Wire the real Insights Summary backend service to replace this placeholder.*`;

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: mockReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        telemetry: createEstimatedTelemetry(
          elapsedSec,
          [
            { name: 'analyze_visual_metadata', status: 'completed' },
            { name: 'synthesize_summary', status: 'completed' },
          ],
          displayText,
          mockReply
        ),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        text: 'The Insights Summary Agent backend is temporarily unreachable. Please ensure the backend server is running and try again, sir.',
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
    setThreadId(`insights-${Date.now()}`);
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        text: 'Thread reset. I am ready to synthesize new chart data, visual analytics or metadata into clear summaries, sir.',
      },
    ]);
    setAttachedFile(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setAttachedFile(file);
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
              <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <h1 className="font-head text-[16px] font-extrabold m-0 text-white truncate">
              Insights Summary Agent
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
                  AI-powered engine that converts metadata, charts and video analytics into concise, actionable summaries for operators and leadership.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                  <div className="bg-white/10 backdrop-blur-xs rounded-[12px] px-3 py-2 border border-white/10 text-center">
                    <div className="text-[18px] font-extrabold text-amber-400">12</div>
                    <div className="text-[10px] text-white/70 font-semibold uppercase">Active Charts</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs rounded-[12px] px-3 py-2 border border-white/10 text-center">
                    <div className="text-[18px] font-extrabold text-cyan-300">4</div>
                    <div className="text-[10px] text-white/70 font-semibold uppercase">Anomalies</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs rounded-[12px] px-3 py-2 border border-white/10 text-center">
                    <div className="text-[18px] font-extrabold text-emerald-400">98%</div>
                    <div className="text-[10px] text-white/70 font-semibold uppercase">Coverage</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs rounded-[12px] px-3 py-2 border border-white/10 text-center">
                    <div className="text-[18px] font-extrabold text-violet-300">~2s</div>
                    <div className="text-[10px] text-white/70 font-semibold uppercase">Avg Latency</div>
                  </div>
                </div>

                <div className="flex gap-1.5 mt-3 flex-wrap text-[10.5px] text-white/80">
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">Chart Trends</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">Visual Analytics</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">Metadata</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">Anomaly Detection</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">Executive Briefs</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">Shift Handover</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">Image Upload</span>
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
              agentName="Insights Summary Agent"
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

          {/* Attachment chip (when file selected) */}
          {attachedFile && (
            <div className="flex items-center gap-2 text-[12px] text-ink bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 w-fit">
              <ImageIcon className="w-3.5 h-3.5 text-amber-700" />
              <span className="truncate max-w-[240px] font-medium">{attachedFile.name}</span>
              <button
                onClick={() => {
                  setAttachedFile(null);
                  if (fileRef.current) fileRef.current.value = '';
                }}
                className="text-amber-800 hover:text-amber-950 font-bold leading-none ml-1"
                title="Remove attachment"
              >
                ×
              </button>
            </div>
          )}

          {/* Text Input & Controls */}
          <div className="flex gap-2 items-end">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={loading}
              title="Attach chart / image"
              className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-[12px] border border-border-color bg-canvas hover:bg-amber-50 text-ink hover:text-amber-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Paperclip className="w-4 h-4" />
            </button>

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
              placeholder="Ask for a chart summary, executive brief, anomaly analysis, or attach an image..."
              className="flex-1 resize-none rounded-[12px] border border-border-color bg-canvas px-3.5 py-2 text-[13.5px] outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all placeholder:text-muted max-h-[140px]"
            />
            <button
              onClick={() => void handleSend()}
              disabled={loading || (!input.trim() && !attachedFile)}
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

export default InsightsSummaryAgentPage;