import React, { useEffect, useState, useRef } from 'react';
import * as marked from 'marked';
import DOMPurify from 'dompurify';

interface ChartMetadataPanelProps {
  metadata?: Record<string, unknown> | null;
  chartId?: string;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const highlightJson = (value: string) =>
  escapeHtml(value).replace(
    /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(?=\s*:)|"(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let className = 'text-slate-700';
      if (/^"/.test(match)) {
        className = /:$/.test(match) ? 'text-blue-600' : 'text-emerald-600';
      } else if (/true|false|null/.test(match)) {
        className = 'text-violet-600';
      } else if (/^-?\d/.test(match)) {
        className = 'text-amber-600';
      }
      return `<span class="${className}">${match}</span>`;
    },
  );

type SummaryRecord = {
  id: string;
  chart_id: string;
  summary_text: string;
  language: string;
  summary_length: string;
  metadata_snapshot: any;
  created_at: string;
};

export const ChartMetadataPanel: React.FC<ChartMetadataPanelProps> = ({ metadata, chartId }) => {
  const formattedJson = metadata
    ? JSON.stringify(metadata, null, 2)
    : '{\n  "status": "metadata unavailable"\n}';

  const [language, setLanguage] = useState<'english' | 'hindi' | 'hinglish'>('english');
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [summary, setSummary] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // JSON collapsed by default
  const [jsonExpanded, setJsonExpanded] = useState(false);

  // Settings dropdown
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Close settings when clicking outside
  useEffect(() => {
    if (!settingsOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [settingsOpen]);

  const thresholds: Record<string, number> = {
    heatmap: 10 * 60 * 1000,
    default_daily: 6 * 60 * 60 * 1000,
  };

  useEffect(() => {
    if (!chartId) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/chart-summaries/${encodeURIComponent(chartId)}`);
        if (res.ok) {
          const data: SummaryRecord | null = await res.json();
          if (data && data.summary_text) {
            setSummary(data.summary_text);
            setGeneratedAt(new Date(data.created_at).getTime());
          }
        }
      } catch {
        // ignore
      }
    };
    load();
  }, [chartId]);

  const isStale = () => {
    if (!generatedAt) return false;
    const chartType = (metadata && (metadata as any).chart_type) || 'default_daily';
    const threshold = chartType === 'heatmap' ? thresholds.heatmap : thresholds.default_daily;
    return Date.now() - generatedAt > threshold;
  };

  const generateSummary = async () => {
    if (!chartId) {
      setError('Missing chart identifier');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const body = {
        chart_id: chartId,
        input_type: 'metadata',
        length,
        language,
        metadata_payload: metadata || {},
      };

      const res = await fetch('/api/chart-summaries/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 403) {
        const payload = await res.json();
        setError(payload.detail || 'Insights Summary Agent is disabled');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload.detail || `Failed to generate summary (status ${res.status})`);
        setLoading(false);
        return;
      }

      const data: SummaryRecord = await res.json();
      setSummary(data.summary_text);
      setGeneratedAt(new Date(data.created_at).getTime());
    } catch (e: any) {
      setError(e?.message || 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (ms: number) => {
    try {
      const d = new Date(ms);
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
    } catch {
      return String(ms);
    }
  };

  // Configure marked for GitHub-flavored markdown and sensible breaks
  (marked as any).setOptions({ gfm: true, breaks: true });

  const renderMarkdownHtml = (md: string) => {
    try {
      const raw = (marked as any).parse(md || '');
      return (DOMPurify as any).sanitize(raw);
    } catch (e) {
      return escapeHtml(md || '');
    }
  };

  return (
    <div className="h-full min-h-[320px] bg-white text-slate-800 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50/80">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-600">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          Metadata
        </div>
        <div className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold text-slate-500">
          Live JSON
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* ───── Collapsible JSON section (collapsed by default) ───── */}
        <div className="flex-shrink-0 border-b border-slate-100">
          <button
            type="button"
            onClick={() => setJsonExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
          >
            <span className="text-[12px] font-semibold text-slate-600 flex items-center gap-2">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`transition-transform duration-200 ${jsonExpanded ? 'rotate-90' : ''}`}
              >
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Raw JSON
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              {jsonExpanded ? 'Collapse' : 'Expand'}
            </span>
          </button>

          {jsonExpanded && (
            <div className="max-h-[220px] overflow-auto border-t border-slate-100 bg-slate-50/40">
              <pre
                className="m-0 p-4 text-[11px] leading-6 font-mono whitespace-pre-wrap select-text text-slate-700"
                dangerouslySetInnerHTML={{ __html: highlightJson(formattedJson) }}
              />
            </div>
          )}
        </div>

        {/* ───── Summary section ───── */}
        <div className="flex-1 min-h-0 p-3 flex flex-col gap-3 bg-white overflow-hidden">
          {/* Action bar */}
          <div className="flex items-center justify-between gap-2 flex-wrap flex-shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={generateSummary}
                disabled={loading}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors cursor-pointer border ${
                  loading
                    ? 'bg-slate-200 text-slate-500 border-slate-200'
                    : 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-400'
                }`}
              >
                {loading ? 'Generating…' : summary ? 'Re-summarize' : 'Summary'}
              </button>

              {/* Settings icon + dropdown */}
              <div className="relative" ref={settingsRef}>
                <button
                  type="button"
                  onClick={() => setSettingsOpen((v) => !v)}
                  className={`p-1.5 rounded-lg border transition-colors ${
                    settingsOpen
                      ? 'bg-slate-100 border-slate-300 text-slate-700'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                  title="Settings"
                >
                  {/* Gear / settings icon */}
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                  </svg>
                </button>

                {settingsOpen && (
                  <div className="absolute left-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-xl p-3 shadow-lg z-30 text-[13px]">
                    <div className="mb-1.5 font-semibold text-slate-700">Language</div>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as any)}
                      className="w-full mb-3 p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-[12px]"
                    >
                      <option value="english">English</option>
                      <option value="hindi">Hindi</option>
                      <option value="hinglish">Hinglish</option>
                    </select>

                    <div className="mb-1.5 font-semibold text-slate-700">Summary Length</div>
                    <select
                      value={length}
                      onChange={(e) => setLength(e.target.value as any)}
                      className="w-full p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-[12px]"
                    >
                      <option value="short">Short / Concise</option>
                      <option value="medium">Medium</option>
                      <option value="long">Detailed / Long</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="text-[11px] text-slate-500">
              {generatedAt ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span>{formatTimestamp(generatedAt)}</span>
                  {isStale() && (
                    <span
                      title="This summary may be outdated. Click Re-summarize for fresh insights."
                      className="text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                    >
                      Stale
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-slate-400 italic">No summary yet</span>
              )}
            </div>
          </div>

          {/* Summary content */}
          <div className="flex-1 min-h-0 overflow-auto p-3 bg-slate-50/60 rounded-xl border border-slate-200">
            {error && (
              <div className="text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded-lg mb-2 text-[12px]">
                {error}
              </div>
            )}
            {loading && (
              <div className="text-slate-400 italic text-[13px]">Generating summary…</div>
            )}
            {!loading && summary && (
              <div className="prose prose-sm max-w-none text-slate-700 text-[13px] leading-relaxed">
                <div dangerouslySetInnerHTML={{ __html: renderMarkdownHtml(summary) }} />
              </div>
            )}
            {!loading && !summary && !error && (
              <div className="text-slate-400 italic text-[13px]">
                Click “Summary” to generate insights for this chart.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChartMetadataPanel;