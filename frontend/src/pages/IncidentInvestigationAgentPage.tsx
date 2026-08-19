import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Send,
  ShieldAlert,
  RotateCcw,
  Sparkles,
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

    // Blank line
    if (line.trim() === '') {
      flushList();
      nodes.push(<div key={`br-${i}`} className="h-2" />);
      i++;
      continue;
    }

    // Heading (### or ## or #)
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

    // Horizontal Rule (--- or ===)
    if (/^(---|===)\s*$/.test(line.trim())) {
      flushList();
      nodes.push(<hr key={`hr-${i}`} className="my-3 border-border-color/60" />);
      i++;
      continue;
    }

    // Section Header (e.g. === FORENSIC INVESTIGATION SUMMARY ===)
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

    // Markdown Table
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

    // Bullet list (- or *)
    if (/^[\*\-]\s/.test(line.trim())) {
      listBuffer.push(line.replace(/^[\*\-]\s/, '').trim());
      i++;
      continue;
    }

    // Numbered list (1. 2.)
    if (/^\d+\.\s/.test(line.trim())) {
      listBuffer.push(line.replace(/^\d+\.\s/, '').trim());
      i++;
      continue;
    }

    // Regular paragraph
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



// ─── Suggested Forensic Prompts ───────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  '📊 Calculate our Total Recordable Incident Rate (TRIR)',
  '🛡️ Show current Zero Harm Index & plant safety breakdown',
  '🚨 List all high-risk plant zones and top anomalies',
  '💧 Check for active chemical or oil spills on the factory floor',
  '🔍 Analyze low-confidence AI tracking alerts for false positives',
  '🔥 Find employees with high-heat exposure and fatigue alerts',
];

// ─── Main Component ───────────────────────────────────────────────────────────

export const IncidentInvestigationAgentPage: React.FC = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTools, setActiveTools] = useState<ActiveToolStep[]>([]);

  const [threadId, setThreadId] = useState<string>(
    () => `incident-session-${Date.now()}`
  );
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

  // Fetch summary KPI metrics on load
  useEffect(() => {
    incidentInvestigationService
      .getSummary()
      .then((data) => {
        if (data) setSummaryKpi(data);
      })
      .catch((err) => console.warn('Could not fetch incident summary:', err));

    // Welcome Message
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        text: `### 🔍 Incident & Investigation Forensic Intelligence Engine\n\nGreetings sir, I am **Deva**, your dedicated Incident & Investigation Agent created by Moksh Bhardwaj.\n\nI am connected to the industrial site database with **43 specialized forensic SQL tools** to analyze:\n\n- **Safety KPI Rates:** Total Recordable Incident Rate (TRIR), LTIFR, Zero Harm Index.\n- **Spill & Defect Detection:** Chemical/oil spills, Basler camera leak detections, and pipeline integrity.\n- **Anomaly & Fatigue Forensics:** Restricted zone breaches, workforce fatigue, and baseline deviations.\n- **Vision Model Audits:** AI tracking low-confidence false positive rates and offline cameras.\n\nHow may I assist your forensic safety audit today, sir?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTools, loading]);


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
  };

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || input;
    if (!textToSend.trim() || loading) return;

    const userMessageId = `user-${Date.now()}`;
    const assistantMessageId = `asst-${Date.now()}`;

    // Add user message
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

    // Temporary placeholder for assistant response
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
            prev.map((m) =>
              m.id === assistantMessageId ? { ...m, text: accumulatedText } : m
            )
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
          // Fallback to standard chat request if SSE encounters an issue
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col h-[calc(100vh-80px)] max-w-[1400px] mx-auto p-2 md:p-4 gap-4 font-sans text-ink"
    >
      {/* ── Top Header & KPI Banner ── */}
      <div className="bg-gradient-to-r from-[#0B1730] via-[#102A43] to-[#0A3641] text-white p-5 rounded-[18px] shadow-lg border border-slate-700/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-colors cursor-pointer border border-white/10"
              title="Back to Agents Dashboard"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 rounded-md text-[11px] font-bold tracking-wider uppercase">
                  Forensic Agent
                </span>
                <span className="text-[12px] text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  43 Tools Live
                </span>
              </div>
              <h1 className="text-[20px] md:text-[22px] font-extrabold text-white mt-1 flex items-center gap-2">
                Deva — Incident & Investigation Agent
              </h1>
              <p className="text-[12.5px] text-slate-300">
                Automated Root-Cause Forensics, TRIR/LTIFR Analysis, Spill Detection & Safety Anomaly Intelligence.
              </p>
            </div>
          </div>

          {/* Quick Metrics Chips */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="bg-white/10 border border-white/15 px-3 py-2 rounded-xl text-center min-w-[90px]">
              <div className="text-[10px] text-slate-300 uppercase font-semibold">TRIR (YTD)</div>
              <div className="text-[14px] font-extrabold text-cyan-300">{summaryKpi.trir_ytd}</div>
            </div>
            <div className="bg-white/10 border border-white/15 px-3 py-2 rounded-xl text-center min-w-[90px]">
              <div className="text-[10px] text-slate-300 uppercase font-semibold">Zero Harm</div>
              <div className="text-[14px] font-extrabold text-emerald-400">{summaryKpi.zero_harm_index}%</div>
            </div>
            <div className="bg-white/10 border border-white/15 px-3 py-2 rounded-xl text-center min-w-[90px]">
              <div className="text-[10px] text-slate-300 uppercase font-semibold">Spill Alerts</div>
              <div className="text-[14px] font-extrabold text-amber-300">{summaryKpi.open_spill_alerts}</div>
            </div>
            <div className="bg-white/10 border border-white/15 px-3 py-2 rounded-xl text-center min-w-[90px]">
              <div className="text-[10px] text-slate-300 uppercase font-semibold">Anomalies</div>
              <div className="text-[14px] font-extrabold text-rose-300">{summaryKpi.active_anomaly_flags}</div>
            </div>
            <button
              onClick={handleClearHistory}
              className="p-2.5 bg-white/10 hover:bg-rose-500/20 text-slate-300 hover:text-white rounded-xl border border-white/15 transition-all cursor-pointer flex items-center gap-1.5 text-[12px] font-medium"
              title="Reset Chat Session"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">New Conversation</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Chat Messages Container ── */}
      <div className="flex-1 bg-panel border border-border-color rounded-[18px] overflow-hidden flex flex-col shadow-sm min-h-0">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-700 to-teal-500 flex items-center justify-center text-white shrink-0 shadow-sm mt-1">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`relative max-w-[85%] md:max-w-[80%] rounded-[16px] p-4 shadow-sm text-[13.5px] ${
                    isUser
                      ? 'bg-gradient-to-br from-[#0B1730] to-[#00808A] text-white rounded-tr-none'
                      : 'bg-white border border-border-color text-ink rounded-tl-none'
                  }`}
                >
                  {/* Message Content */}
                  <div className="prose prose-sm max-w-none">
                    {isUser ? (
                      <p className="m-0 leading-relaxed">{msg.text}</p>
                    ) : (
                      renderMarkdown(msg.text)
                    )}
                  </div>

                  {/* ── Response Telemetry & Metadata Footer ── */}
                  {!isUser && (
                    <AgentTelemetryFooter
                      telemetry={msg.telemetry}
                      tools={msg.activeTools}
                      rawText={msg.text}
                    />
                  )}

                  {/* Timestamp */}
                  {msg.timestamp && (
                    <div
                      className={`text-[10px] mt-1 text-right ${
                        isUser ? 'text-white/60' : 'text-slate-400'
                      }`}
                    >
                      {msg.timestamp}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* ── Interactive Tool Execution Animation Indicator ── */}
          <div className="pl-11">
            <AgentExecutionIndicator
              activeSteps={activeTools}
              agentName="Deva"
              isStreaming={loading}
            />
          </div>

          <div ref={bottomRef} />
        </div>

        {/* ── Suggested Prompts & Input Box ── */}
        <div className="p-4 bg-[#F8FAFC] border-t border-border-color space-y-3">
          {/* Quick Prompts */}
          {messages.length <= 2 && !loading && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-600" /> Suggestions:
              </span>
              {SUGGESTED_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(prompt)}
                  className="text-[12px] bg-white hover:bg-cyan-50 border border-slate-200 hover:border-cyan-400 text-slate-700 hover:text-cyan-900 px-3 py-1.5 rounded-full transition-all whitespace-nowrap shadow-xs cursor-pointer font-medium"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Deva: e.g. 'Calculate our current TRIR and Zero Harm Index across plants'..."
              disabled={loading}
              className="flex-1 bg-white border border-slate-300 focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 rounded-[14px] px-4 py-3 text-[13.5px] outline-none transition-all shadow-xs disabled:bg-slate-100"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-gradient-to-r from-[#0B1730] to-[#00808A] hover:opacity-95 text-white font-semibold px-5 py-3 rounded-[14px] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm cursor-pointer shrink-0"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Investigate</span>
            </button>
          </form>
        </div>
      </div>
    </motion.div>
  );
};

export default IncidentInvestigationAgentPage;
