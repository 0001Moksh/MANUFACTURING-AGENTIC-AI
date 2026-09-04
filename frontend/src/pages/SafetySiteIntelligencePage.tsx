import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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
  Mic,
  MicOff,
  RefreshCw,
  ChevronDown,
  Copy,
  Check,
  ArrowDown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { safetySiteIntelligenceService } from '../services/safetySiteIntelligenceService';
import type {
  HeatmapZone,
  HeatmapSummary,
} from '../services/safetySiteIntelligenceService';
import { SpatialFloorHeatmap } from '../components/safety/SpatialFloorHeatmap';
import { AgentTelemetryFooter } from '../components/common/AgentTelemetryFooter';
import type { TurnTelemetry } from '../types/telemetry';

// ─── Types ────────────────────────────────────────────────────────────────────

type ChatRole = 'assistant' | 'user';
interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  zoneContext?: string;
  timestamp?: string;
  telemetry?: TurnTelemetry;
}

// ─── Lightweight Markdown & Table Renderer ───────────────────────────────────

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
        <p key={`h-${i}`} className="font-bold text-[14px] text-ink mt-3 mb-1 flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-3.5 bg-emerald-500 rounded-full" />
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
        <code key={i} className="bg-emerald-50 text-emerald-900 rounded px-1.5 py-0.5 text-[12px] font-mono border border-emerald-200">
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
        <thead className="bg-[#F0FDF4] border-b border-emerald-200">
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-3.5 py-2.5 text-left font-bold text-emerald-950 uppercase tracking-wider text-[11px] whitespace-nowrap"
              >
                {inlineMarkdown(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-color">
          {dataRows.map((row, ri) => (
            <tr
              key={ri}
              className={
                ri % 2 === 0
                  ? 'bg-white hover:bg-emerald-50/40 transition-colors'
                  : 'bg-[#FAFAFA] hover:bg-emerald-50/40 transition-colors'
              }
            >
              {parseRow(row).map((cell, ci) => (
                <td key={ci} className="px-3.5 py-2 text-ink whitespace-nowrap text-[12px] align-top">
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
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
    >
      {msg.zoneContext && isUser && (
        <span className="text-[10.5px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full mb-1">
          Context: {msg.zoneContext}
        </span>
      )}
      <div className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
        {!isUser && (
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-600 via-teal-600 to-amber-600 flex items-center justify-center shrink-0 shadow-xs mt-1">
            <Layers className="w-3.5 h-3.5 text-white" />
          </div>
        )}
        <div
          className={`group relative max-w-[760px] rounded-[16px] p-3.5 text-[13.5px] leading-relaxed shadow-2xs transition-shadow hover:shadow-sm ${isUser
              ? 'bg-navy-900 text-white rounded-tr-[4px]'
              : 'bg-white border border-border-color text-ink rounded-tl-[4px]'
            }`}
        >
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

          {isUser ? (
            <p className="whitespace-pre-wrap m-0">{msg.text}</p>
          ) : (
            <>
              <div className="prose-sm max-w-none">{renderMarkdown(msg.text)}</div>
              <AgentTelemetryFooter telemetry={msg.telemetry} rawText={msg.text} />
            </>
          )}
        </div>
        {isUser && (
          <div className="w-7 h-7 rounded-full bg-navy-800 flex items-center justify-center text-white shrink-0 shadow-xs mt-1">
            <span className="text-[11px] font-bold">U</span>
          </div>
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
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center shrink-0 shadow-xs">
        <Layers className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="bg-white border border-border-color rounded-[16px] rounded-tl-[4px] px-4 py-2.5 flex items-center gap-2 shadow-2xs">
        <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
        <span className="text-[12.5px] text-muted italic font-medium">
          Deva is analyzing spatial site intelligence across 135 tools...
        </span>
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export const SafetySiteIntelligencePage: React.FC = () => {
  const navigate = useNavigate();
  const [threadId, setThreadId] = useState<string>(() => `multi-site-${Date.now()}`);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Hero collapse state
  const [heroExpanded, setHeroExpanded] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Spatial Heatmap state
  const [timeFilter, setTimeFilter] = useState<'TODAY' | '7_DAYS' | '30_DAYS'>('30_DAYS');
  const [zones, setZones] = useState<HeatmapZone[]>([]);
  const [summary, setSummary] = useState<HeatmapSummary | null>(null);
  const [selectedZone, setSelectedZone] = useState<HeatmapZone | null>(null);
  const [loadingHeatmap, setLoadingHeatmap] = useState<boolean>(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: "Hello sir! I am **Deva**, your **Safety & Site Intelligence Multi-Agent (HSE & Quality Officer Assistant)**.\n\nI am connected to the **Spatial Risk Heatmap Engine** and **135 specialized tools** covering:\n\n* **PPE & CCTV Vision Intelligence**: Real-time hard hat & safety vest compliance, geofence breaches, worker fatigue, and camera status.\n* **Safety & Quality Intelligence**: Material defect logs, quality holds, concrete & welding lab tests, and subcontractor compliance.\n\nClick any zone on the floor plan or ask me directly about safety violations and quality holds, sir!",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // Fetch heatmap data
  const loadHeatmap = async (tf: 'TODAY' | '7_DAYS' | '30_DAYS') => {
    setLoadingHeatmap(true);
    try {
      const data = await safetySiteIntelligenceService.fetchHeatmap(tf);
      if (data && data.zones) {
        setZones(data.zones);
        setSummary(data.summary);
        if (selectedZone) {
          const updated = data.zones.find((z) => z.id === selectedZone.id);
          if (updated) setSelectedZone(updated);
        }
      }
    } catch (err) {
      console.error('Failed to load spatial heatmap data', err);
    } finally {
      setLoadingHeatmap(false);
    }
  };

  useEffect(() => {
    void loadHeatmap(timeFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeFilter]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

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

  // Handle send query with UI context injection
  const send = async (text?: string) => {
    const prompt = (text ?? input).trim();
    if (!prompt || loading) return;
    setInput('');

    const uiContext = selectedZone
      ? {
        time_filter: timeFilter,
        zone_id: selectedZone.id,
        zone_name: selectedZone.name,
        risk_level: selectedZone.risk_level.toUpperCase(),
        risk_score: selectedZone.risk_score,
        incident_count: selectedZone.incident_count,
        top_violations: Object.entries(selectedZone.violations_breakdown)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', '),
      }
      : {
        time_filter: timeFilter,
        high_risk_zones: summary?.high_risk_zones ?? 0,
        total_incidents: summary?.total_incidents ?? 0,
      };

    const zoneLabel = selectedZone ? `${selectedZone.name} (${selectedZone.risk_level.toUpperCase()})` : undefined;
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', text: prompt, zoneContext: zoneLabel, timestamp: ts },
    ]);
    setLoading(true);

    try {
      const res = await safetySiteIntelligenceService.chat(prompt, threadId, uiContext);
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', text: res.reply, timestamp: ts },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          text: 'I am unable to reach the Safety & Site Intelligence Multi-Agent at this time, sir. Please try again shortly.',
          timestamp: ts,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleResetThread = () => {
    setThreadId(`multi-site-${Date.now()}`);
    setSelectedZone(null);
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        text: 'Thread reset. I am ready to analyze spatial risk, PPE, or quality data for you, sir.',
      },
    ]);
  };

  // Quick prompt handler for selected zone
  const handleAskDevaAboutZone = (zone: HeatmapZone) => {
    const prompt = `Why is ${zone.name} flagged as ${zone.risk_level.toUpperCase()} risk (${zone.risk_score}/100) with ${zone.incident_count} violations under the ${timeFilter} filter? Please provide root causes and recommendations.`;
    void send(prompt);
  };

  // Dynamic suggested prompts
  const suggestedPrompts = useMemo(() => {
    if (selectedZone) {
      return [
        { icon: '', label: 'Why flagged?', query: `Why is this zone flagged ${selectedZone.risk_level.toUpperCase()} risk, sir?` },
        { icon: '', label: 'Violation breakdown', query: `Show detailed breakdown of violations in ${selectedZone.name.split('(')[0].trim()}` },
        { icon: '', label: 'Corrective actions', query: 'Recommend corrective HSE actions for this area' },
      ];
    }
    return [
      { icon: '', label: 'PPE & Quality Holds', query: "Summarize today's active PPE violations and open material quality holds" },
      { icon: '', label: 'Highest Risk Sector', query: 'Which plant sector has the highest risk score and violation density?' },
      { icon: '', label: 'Quality Holds', query: 'List active quality holds and rejected inspection batches' },
      { icon: '', label: 'Camera & Night Shift', query: 'Check camera status logs and night shift violations' },
    ];
  }, [selectedZone]);

  // Voice speech simulation / Web Speech API integration
  const toggleSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }
    if (isRecording) {
      setIsRecording(false);
      return;
    }
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.onstart = () => setIsRecording(true);
      recognition.onend = () => setIsRecording(false);
      recognition.onerror = () => setIsRecording(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput(transcript);
          void send(transcript);
        }
      };
      recognition.start();
    } catch {
      setIsRecording(false);
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
          onClick={() => navigate('/use-cases')}
          className="flex items-center gap-2 text-[13px] font-semibold text-muted hover:text-emerald-700 transition-colors bg-transparent border-none cursor-pointer p-0"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Use Cases
        </button>
      </div>

      {/* ── Collapsible Hero Banner ── */}
      <div className="bg-gradient-to-r from-[#071E22] via-[#0B3C49] to-[#0A5C36] text-white rounded-[16px] shadow-sm shrink-0 border border-emerald-900/40 overflow-hidden mx-3">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
              <Layers className="w-3.5 h-3.5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h1 className="font-head text-[16px] font-extrabold m-0 text-white truncate">
                Deva — Safety &amp; Site Intelligence
              </h1>
            </div>
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
                  Combines <strong>Spatial Risk Heat Maps</strong>, <strong>PPE &amp; Behavior Vision (55 tools)</strong>, and{' '}
                  <strong>Safety &amp; Quality Inspection (80 tools)</strong> across 135 live database analytics tools.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                  <div className="bg-white/10 backdrop-blur-xs rounded-[12px] px-3 py-2 border border-white/10 text-center">
                    <div className="flex justify-center mb-0.5"><Microscope className="w-3.5 h-3.5 text-emerald-300" /></div>
                    <div className="text-[10px] text-white/70 font-semibold uppercase">Quality Sub-Agent</div>
                    <div className="text-[13px] font-extrabold text-white">80 Tools</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs rounded-[12px] px-3 py-2 border border-white/10 text-center">
                    <div className="flex justify-center mb-0.5"><HardHat className="w-3.5 h-3.5 text-amber-300" /></div>
                    <div className="text-[10px] text-white/70 font-semibold uppercase">PPE Vision</div>
                    <div className="text-[13px] font-extrabold text-white">55 Tools</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs rounded-[12px] px-3 py-2 border border-white/10 text-center">
                    <div className="flex justify-center mb-0.5"><Sparkles className="w-3.5 h-3.5 text-teal-300" /></div>
                    <div className="text-[10px] text-white/70 font-semibold uppercase">Capacity</div>
                    <div className="text-[13px] font-extrabold text-white">135 Tools</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs rounded-[12px] px-3 py-2 border border-white/10 text-center">
                    <div className="flex justify-center mb-0.5"><Flame className="w-3.5 h-3.5 text-orange-300" /></div>
                    <div className="text-[10px] text-white/70 font-semibold uppercase">Gateway</div>
                    <div className="text-[13px] font-extrabold text-white">Gemini / Groq</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Main Two-Column Layout: Spatial Heatmap + Context-Aware Chatbot ── */}
      <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0 px-3 pb-2 overflow-hidden">
        {/* Left Column: Spatial Floor Heatmap */}
        <div className="flex-shrink-0 w-full lg:w-[420px] flex flex-col min-w-0 min-h-0 overflow-y-auto custom-scrollbar">
          <SpatialFloorHeatmap
            zones={zones}
            summary={summary}
            selectedZone={selectedZone}
            onSelectZone={setSelectedZone}
            timeFilter={timeFilter}
            onChangeTimeFilter={setTimeFilter}
            onAskDevaAboutZone={handleAskDevaAboutZone}
            loading={loadingHeatmap}
          />
        </div>

        {/* Right Column: Integrated Context-Aware Chatbot */}
        <div className="flex-1 grid grid-rows-[auto_1fr_auto] bg-panel border border-border-color rounded-[16px] overflow-hidden shadow-sm min-h-0 relative">
          {/* Chat Header */}
          <div className="px-4 py-2.5 border-b border-border-color bg-canvas flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-[13px] font-bold text-ink truncate">Deva Intelligence Assistant</span>
              {selectedZone ? (
                <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-semibold shrink-0">
                  Zone: {selectedZone.name.split('(')[0].trim()}
                </span>
              ) : (
                <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium shrink-0">
                  Plant-Wide
                </span>
              )}
            </div>
            <span className="text-[11px] text-muted font-medium shrink-0">
              <strong>{timeFilter}</strong>
            </span>
          </div>

          {/* Messages Feed */}
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
            <AnimatePresence>{loading && <TypingIndicator />}</AnimatePresence>
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
                className="absolute bottom-30 right-1/2 z-10 flex items-center gap-1.5 bg-gray-900 text-white text-[11.5px] font-semibold px-3 py-1.5 rounded-full shadow-lg hover:bg-navy-800 transition-colors cursor-pointer border-none"
              >
                <ArrowDown className="w-3.5 h-3.5" /> Latest
              </motion.button>
            )}
          </AnimatePresence>

          {/* Suggested Prompts & Input Area */}
          <div className="border-t border-border-color bg-white p-2.5 md:p-3 space-y-2 shrink-0">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar text-[12px]">
              {suggestedPrompts.map((p, i) => (
                <button
                  key={i}
                  onClick={() => void send(p.query)}
                  disabled={loading}
                  className="shrink-0 bg-canvas hover:bg-emerald-50 text-ink hover:text-emerald-900 border border-border-color hover:border-emerald-300 px-3 py-1.5 rounded-full transition-all text-[11.5px] font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  <span>{p.icon}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <div className="flex gap-2 items-end">
              <button
                type="button"
                onClick={toggleSpeechRecognition}
                title={isRecording ? 'Listening... click to stop' : 'Voice Query (Whisper STT)'}
                className={`p-2.5 rounded-[12px] border transition-all cursor-pointer shrink-0 ${isRecording
                    ? 'bg-red-500 text-white border-red-600 animate-pulse'
                    : 'bg-canvas text-muted hover:text-emerald-700 border-border-color hover:bg-emerald-50'
                  }`}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <textarea
                ref={textareaRef}
                id="multi-site-agent-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                placeholder={
                  selectedZone
                    ? `Ask Deva about ${selectedZone.name} (e.g. 'Why is this zone red?')...`
                    : 'Ask Deva across spatial risk, PPE, or quality inspection tools...'
                }
                className="flex-1 resize-none rounded-[12px] border border-border-color bg-canvas px-3.5 py-2 text-[13.5px] outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-muted max-h-[140px]"
                disabled={loading}
              />

              <button
                id="multi-site-agent-send"
                onClick={() => void send()}
                disabled={loading || !input.trim()}
                className="inline-flex items-center gap-2 rounded-[12px] bg-gradient-to-r from-[#071E22] via-[#0B3C49] to-[#0A5C36] hover:opacity-90 px-4 py-2.5 text-white font-semibold text-[13.5px] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer border-none active:scale-95 shrink-0"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default SafetySiteIntelligencePage;