import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Send,
  Loader2,
  HardHat,
  Microscope,
  Sparkles,
  Layers,
  Flame,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { safetySiteIntelligenceService } from '../services/safetySiteIntelligenceService';

// ─── Types ────────────────────────────────────────────────────────────────────

type ChatRole = 'assistant' | 'user';
interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
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
      <p key={`p-${i}`} className="text-[13.5px] leading-relaxed">
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
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (/^`[^`]+`$/.test(part)) {
      return (
        <code key={i} className="bg-emerald-50 text-emerald-900 rounded px-1 text-[12px] font-mono border border-emerald-200">
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
    <div className="overflow-x-auto my-3 rounded-[12px] border border-border-color shadow-sm">
      <table className="min-w-full text-[12.5px]">
        <thead className="bg-[#F0FDF4]">
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-3 py-2 text-left font-semibold text-emerald-950 uppercase tracking-wide text-[11px] border-b border-emerald-200"
              >
                {inlineMarkdown(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'}>
              {parseRow(row).map((cell, ci) => (
                <td
                  key={ci}
                  className="px-3 py-2 border-b border-border-color/50 text-ink align-top"
                >
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

// ─── Message Bubble ──────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-600 via-teal-600 to-amber-600 flex items-center justify-center shrink-0 mr-2 mt-1 shadow-sm">
          <Layers className="w-4 h-4 text-white" />
        </div>
      )}
      <div
        className={`max-w-[880px] rounded-[18px] px-5 py-4 shadow-sm ${
          isUser
            ? 'bg-gradient-to-br from-[#0B1730] to-[#0F2D3A] text-white rounded-br-[5px]'
            : 'bg-white border border-border-color text-ink rounded-bl-[5px]'
        }`}
      >
        {isUser ? (
          <p className="text-[14px] leading-relaxed">{msg.text}</p>
        ) : (
          <div className="prose-sm max-w-none">{renderMarkdown(msg.text)}</div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className="flex items-center gap-2"
    >
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center shrink-0 shadow-sm">
        <Layers className="w-4 h-4 text-white" />
      </div>
      <div className="bg-white border border-border-color rounded-[18px] rounded-bl-[5px] px-5 py-3 flex items-center gap-2 shadow-sm">
        <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
        <span className="text-[12.5px] text-muted italic font-medium">
          Deva is orchestrating across 135 safety &amp; quality tools...
        </span>
      </div>
    </motion.div>
  );
}

// ─── Suggested Prompts ────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  "Summarize today's active PPE violations and open material quality holds",
  "Which site has the highest number of safety and quality incidents?",
  "List active quality holds and rejected inspection batches",
  "Show CCTV camera operational status logs and night shift violations",
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export const SafetySiteIntelligencePage: React.FC = () => {
  const navigate = useNavigate();
  const threadId = useMemo(() => `multi-site-${Date.now()}`, []);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: "Hello sir! I am **Deva**, your **Safety & Site Intelligence Multi-Agent (HSE & Quality Officer Assistant)**, created by Moksh Bhardwaj.\n\nI unify the complete operational intelligence of **TWO specialized agent domains (135 Live Tools)**:\n\n* **🦺 PPE & Behavior Vision Intelligence (55 Tools)**: Real-time CCTV hard hat & vest compliance, hazard geofences, worker fatigue/collapse, camera status, and shift analytics.\n* **🔬 Safety & Quality Intelligence (80 Tools)**: Material defect logs, quality holds, concrete & welding lab tests, subcontractor compliance, and HSE standard rules.\n\nHow can I assist you with site inspection, PPE safety, or quality analytics today, sir?",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text?: string) => {
    const prompt = (text ?? input).trim();
    if (!prompt || loading) return;
    setInput('');
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text: prompt }]);
    setLoading(true);
    try {
      const res = await safetySiteIntelligenceService.chat(prompt, threadId);
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', text: res.reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          text: 'I am unable to reach the Safety & Site Intelligence Multi-Agent at this time, sir. Please try again shortly.',
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
        onClick={() => navigate('/use-cases')}
        className="flex items-center gap-2 text-[13px] font-semibold text-muted hover:text-emerald-700 transition-colors bg-transparent border-none cursor-pointer p-0 w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Use Cases
      </button>

      {/* ── Hero Banner ── */}
      <div className="bg-gradient-to-r from-[#071E22] via-[#0B3C49] to-[#0A5C36] text-white rounded-[20px] p-6 relative overflow-hidden shrink-0">
        <div className="absolute -top-10 -right-10 w-56 h-56 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-emerald-300 font-bold mb-2">
              <Layers className="w-4 h-4 text-emerald-300" />
              Multi-Agent Intelligence Orchestrator
            </div>
            <h1 className="font-head text-[26px] font-extrabold mb-2 leading-tight">
              Deva — Safety &amp; Site Intelligence
            </h1>
            <p className="text-white/85 max-w-[780px] leading-relaxed text-[13.5px]">
              Unified multi-agent coordinating <strong>Safety &amp; Quality Inspection (80 tools)</strong> and <strong>PPE &amp; Behavior Vision (55 tools)</strong> over 135 live PostgreSQL database analytics tools.
            </p>
            <div className="flex gap-2 mt-4 flex-wrap text-[11px] text-white/85">
              {[
                '135 Combined Tools',
                'Hard-Hat & Vest Vision',
                'Material Defect Analytics',
                'Concrete / Rebar Lab Tests',
                'Geofence Breaches',
                'Vendor & Subcontractor Audit',
              ].map((tag) => (
                <span key={tag} className="px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Sub-agent capability badges */}
          <div className="flex gap-3 shrink-0 flex-wrap">
            {[
              { icon: <Microscope className="w-4 h-4 text-emerald-300" />, label: 'Quality Sub-Agent', value: '80 SQL Tools' },
              { icon: <HardHat className="w-4 h-4 text-amber-300" />, label: 'PPE Vision Sub-Agent', value: '55 Vision Tools' },
              { icon: <Sparkles className="w-4 h-4 text-teal-300" />, label: 'Total Capacity', value: '135 Tools' },
              { icon: <Flame className="w-4 h-4 text-orange-300" />, label: 'Gateway', value: 'Gemini / Groq' },
            ].map((chip) => (
              <div
                key={chip.label}
                className="bg-white/10 border border-white/20 backdrop-blur-sm rounded-xl p-3 text-center min-w-[115px]"
              >
                <div className="flex justify-center mb-1">{chip.icon}</div>
                <div className="text-[10px] text-white/70 uppercase tracking-wider font-medium">
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
          <AnimatePresence>{loading && <TypingIndicator />}</AnimatePresence>
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-border-color bg-white">
          {messages.length === 1 && !loading && (
            <div className="px-5 pt-3 pb-1 flex flex-wrap gap-2">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => void send(p)}
                  className="text-[11.5px] px-3 py-1.5 rounded-full border border-emerald-500 text-emerald-900 hover:bg-emerald-50 transition-colors bg-transparent cursor-pointer font-medium"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-3 items-end p-4">
            <textarea
              id="multi-site-agent-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              placeholder="Ask Deva across both PPE Vision & Quality tools (e.g. 'Show active helmet violations and material quality holds')..."
              className="flex-1 resize-none rounded-[14px] border border-border-color bg-canvas px-4 py-3 text-[14px] outline-none focus:border-emerald-600 transition-colors"
              disabled={loading}
            />
            <button
              id="multi-site-agent-send"
              onClick={() => void send()}
              disabled={loading || !input.trim()}
              className="inline-flex items-center gap-2 rounded-[14px] bg-gradient-to-br from-[#071E22] via-[#0B3C49] to-[#0A5C36] px-5 py-3 text-white font-semibold disabled:opacity-50 transition-opacity hover:opacity-90 shrink-0"
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

export default SafetySiteIntelligencePage;
