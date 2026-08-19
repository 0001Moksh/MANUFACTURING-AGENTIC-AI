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
  Mic,
  MicOff,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { safetySiteIntelligenceService } from '../services/safetySiteIntelligenceService';
import type {
  HeatmapZone,
  HeatmapSummary,
} from '../services/safetySiteIntelligenceService';
import { SpatialFloorHeatmap } from '../components/safety/SpatialFloorHeatmap';

// ─── Types ────────────────────────────────────────────────────────────────────

type ChatRole = 'assistant' | 'user';
interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  zoneContext?: string;
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
      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
    >
      {msg.zoneContext && isUser && (
        <span className="text-[10.5px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full mb-1">
          📍 Context: {msg.zoneContext}
        </span>
      )}
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
        {!isUser && (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-600 via-teal-600 to-amber-600 flex items-center justify-center shrink-0 mr-2 mt-1 shadow-sm">
            <Layers className="w-4 h-4 text-white" />
          </div>
        )}
        <div
          className={`max-w-[760px] rounded-[18px] px-5 py-4 shadow-sm ${
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
          Deva is analyzing spatial site intelligence across 135 tools...
        </span>
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export const SafetySiteIntelligencePage: React.FC = () => {
  const navigate = useNavigate();
  const threadId = useMemo(() => `multi-site-${Date.now()}`, []);
  const bottomRef = useRef<HTMLDivElement>(null);

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
      text: "Hello sir! I am **Deva**, your **Safety & Site Intelligence Multi-Agent (HSE & Quality Officer Assistant)**, created by Moksh Bhardwaj.\n\nI am connected to the **Spatial Risk Heatmap Engine** and **135 specialized tools** covering:\n\n* **🦺 PPE & CCTV Vision Intelligence**: Real-time hard hat & safety vest compliance, geofence breaches, worker fatigue, and camera status.\n* **🔬 Safety & Quality Intelligence**: Material defect logs, quality holds, concrete & welding lab tests, and subcontractor compliance.\n\nYou can click any zone on the floor plan above or ask me directly about safety violations and quality holds, sir!",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Fetch heatmap data
  const loadHeatmap = async (tf: 'TODAY' | '7_DAYS' | '30_DAYS') => {
    setLoadingHeatmap(true);
    try {
      const data = await safetySiteIntelligenceService.fetchHeatmap(tf);
      if (data && data.zones) {
        setZones(data.zones);
        setSummary(data.summary);
        // Refresh selectedZone reference if still active
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
  }, [timeFilter]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Handle send query with UI context injection
  const send = async (text?: string) => {
    const prompt = (text ?? input).trim();
    if (!prompt || loading) return;
    setInput('');

    // Prepare active UI context
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

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', text: prompt, zoneContext: zoneLabel },
    ]);
    setLoading(true);

    try {
      const res = await safetySiteIntelligenceService.chat(prompt, threadId, uiContext);
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

  // Quick prompt handler for selected zone
  const handleAskDevaAboutZone = (zone: HeatmapZone) => {
    const prompt = `Why is ${zone.name} flagged as ${zone.risk_level.toUpperCase()} risk (${zone.risk_score}/100) with ${zone.incident_count} violations under the ${timeFilter} filter? Please provide root causes and recommendations.`;
    void send(prompt);
  };

  // Dynamic suggested prompts
  const suggestedPrompts = useMemo(() => {
    if (selectedZone) {
      return [
        `Why is this zone flagged ${selectedZone.risk_level.toUpperCase()} risk, sir?`,
        `Show detailed breakdown of violations in ${selectedZone.name.split('(')[0].trim()}`,
        `Recommend corrective HSE actions for this area`,
      ];
    }
    return [
      "Summarize today's active PPE violations and open material quality holds",
      "Which plant sector has the highest risk score and violation density?",
      "List active quality holds and rejected inspection batches",
      "Check camera status logs and night shift violations",
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
      className="min-h-[calc(100vh-100px)] flex flex-col gap-3.5"
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
      <div className="bg-gradient-to-r from-[#071E22] via-[#0B3C49] to-[#0A5C36] text-white rounded-[18px] p-4 sm:p-5 relative overflow-hidden shrink-0 shadow-sm">
        <div className="absolute -top-10 -right-10 w-56 h-56 bg-white/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.18em] text-emerald-300 font-bold mb-1">
              <Layers className="w-3.5 h-3.5 text-emerald-300" />
              UC09 · Multi-Agent Spatial Site Intelligence
            </div>
            <h1 className="font-head text-[22px] sm:text-[24px] font-extrabold mb-1 leading-tight">
              Deva — Computer Vision Safety &amp; Site Intelligence
            </h1>
            <p className="text-white/80 max-w-[760px] leading-relaxed text-[12.5px]">
              Combines <strong>Spatial Risk Heat Maps</strong>, <strong>PPE &amp; Behavior Vision (55 tools)</strong>, and <strong>Safety &amp; Quality Inspection (80 tools)</strong> across 135 live database analytics tools.
            </p>
          </div>

          <div className="flex gap-2.5 shrink-0 flex-wrap">
            {[
              { icon: <Microscope className="w-3.5 h-3.5 text-emerald-300" />, label: 'Quality Sub-Agent', value: '80 Tools' },
              { icon: <HardHat className="w-3.5 h-3.5 text-amber-300" />, label: 'PPE Vision', value: '55 Tools' },
              { icon: <Sparkles className="w-3.5 h-3.5 text-teal-300" />, label: 'Capacity', value: '135 Tools' },
              { icon: <Flame className="w-3.5 h-3.5 text-orange-300" />, label: 'Gateway', value: 'Gemini / Groq' },
            ].map((chip) => (
              <div
                key={chip.label}
                className="bg-white/10 border border-white/20 backdrop-blur-sm rounded-xl p-2.5 text-center min-w-[95px]"
              >
                <div className="flex justify-center mb-0.5">{chip.icon}</div>
                <div className="text-[9.5px] text-white/70 uppercase tracking-wider font-medium">
                  {chip.label}
                </div>
                <div className="text-[11.5px] font-bold text-white">{chip.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Two-Column Layout: Spatial Heatmap + Context-Aware Chatbot ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 min-h-0">
        {/* Left Column (6/12): Spatial Floor Heatmap */}
        <div className="lg:col-span-6 flex flex-col min-w-0">
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

        {/* Right Column (6/12): Integrated Context-Aware Chatbot */}
        <div className="lg:col-span-6 flex flex-col bg-panel border border-border-color rounded-[20px] overflow-hidden shadow-sm min-h-[620px]">
          {/* Chat Header */}
          <div className="px-4 py-3 border-b border-border-color bg-canvas flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[13px] font-bold text-ink">Deva Intelligence Assistant</span>
              {selectedZone ? (
                <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-semibold">
                  Zone: {selectedZone.name.split('(')[0].trim()}
                </span>
              ) : (
                <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium">
                  Plant-Wide Context
                </span>
              )}
            </div>
            <span className="text-[11px] text-muted font-medium">
              Time Filter: <strong>{timeFilter}</strong>
            </span>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 min-h-0">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            <AnimatePresence>{loading && <TypingIndicator />}</AnimatePresence>
            <div ref={bottomRef} />
          </div>

          {/* Suggested Prompts & Input Area */}
          <div className="border-t border-border-color bg-white shrink-0">
            <div className="px-4 pt-2.5 pb-1 flex flex-wrap gap-1.5 overflow-x-auto max-h-[68px]">
              {suggestedPrompts.map((p) => (
                <button
                  key={p}
                  onClick={() => void send(p)}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-emerald-500/80 text-emerald-950 hover:bg-emerald-50 transition-colors bg-transparent cursor-pointer font-medium whitespace-nowrap"
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <div className="flex gap-2 items-center p-3">
              <button
                type="button"
                onClick={toggleSpeechRecognition}
                title={isRecording ? 'Listening... click to stop' : 'Voice Query (Whisper STT)'}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isRecording
                    ? 'bg-red-500 text-white border-red-600 animate-pulse'
                    : 'bg-canvas text-muted hover:text-emerald-700 border-border-color hover:bg-emerald-50'
                }`}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

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
                rows={1}
                placeholder={
                  selectedZone
                    ? `Ask Deva about ${selectedZone.name} (e.g. 'Why is this zone red?')...`
                    : "Ask Deva across spatial risk, PPE, or quality inspection tools..."
                }
                className="flex-1 resize-none rounded-[12px] border border-border-color bg-canvas px-3 py-2.5 text-[13.5px] outline-none focus:border-emerald-600 transition-colors"
                disabled={loading}
              />

              <button
                id="multi-site-agent-send"
                onClick={() => void send()}
                disabled={loading || !input.trim()}
                className="inline-flex items-center gap-1.5 rounded-[12px] bg-gradient-to-br from-[#071E22] via-[#0B3C49] to-[#0A5C36] px-4 py-2.5 text-white font-semibold text-[13px] disabled:opacity-50 transition-opacity hover:opacity-90 shrink-0 cursor-pointer border-none"
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
