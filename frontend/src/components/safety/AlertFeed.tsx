import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { EvidenceModal, type AlertEvidence } from './EvidenceModal';

interface Alert {
  id: number;
  severity: 'CRITICAL' | 'WARNING' | 'NORMAL' | string;
  message: string;
  timestamp: string;
  camera_name?: string;
  class_name?: string;
  snapshot_path?: string;
  imageUrl?: string;
  confidence?: number;
}

type SeverityFilter = 'ALL' | 'CRITICAL' | 'WARNING' | 'NORMAL';

/* ---------- tiny inline icons ---------- */
const Icon = {
  Chevron: ({ open }: { open: boolean }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Filter: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 5h16M7 12h10M10 19h4" strokeLinecap="round" />
    </svg>
  ),
  Search: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
    </svg>
  ),
  X: () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  ),
  Bell: ({ on }: { on: boolean }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
      {on && <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" />}
      {!on && <path d="M2 2l20 20" strokeLinecap="round" />}
    </svg>
  ),
  Play: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
  ),
  Pause: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
  ),
  Calendar: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  ),
  Up: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Eye: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
};

const beep = (() => {
  let ctx: AudioContext | null = null;
  return () => {
    try {
      ctx = ctx || new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.26);
    } catch { /* audio unavailable */ }
  };
})();

const dateKeyOf = (ts: string): string => {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return 'Undated';
  return d.toDateString();
};

const labelForDateKey = (key: string): string => {
  if (key === 'Undated') return 'Undated';
  const today = new Date().toDateString();
  const yestDate = new Date();
  yestDate.setDate(yestDate.getDate() - 1);
  const yesterday = yestDate.toDateString();
  if (key === today) return 'Today';
  if (key === yesterday) return 'Yesterday';
  const d = new Date(key);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

/** Human-readable timestamp: "03 Sep · 12:54 PM" */
const formatAlertTime = (ts: string): string => {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;

  const day = d.toLocaleDateString(undefined, { day: '2-digit' });
  const month = d.toLocaleDateString(undefined, { month: 'short' });
  const time = d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return `${day} ${month} · ${time}`;
};

const toInputDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const AlertFeed: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ids currently in "just arrived" glow state — cleared after 1s so the
  // card returns to a completely normal look.
  const [newIds, setNewIds] = useState<Set<number>>(new Set());

  const [panelOpen, setPanelOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [filter, setFilter] = useState<SeverityFilter>('ALL');
  const [query, setQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isLive, setIsLive] = useState(true);
  const [soundOn, setSoundOn] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [autoStick, setAutoStick] = useState(true);
  const [visibleDayCount, setVisibleDayCount] = useState(1);

  const [activeDateTotal, setActiveDateTotal] = useState<number | null>(null);
  const [activeDateKey, setActiveDateKey] = useState<string>('');

  const containerRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const isLiveRef = useRef(isLive);
  const soundOnRef = useRef(soundOn);
  const autoStickRef = useRef(autoStick);
  const bufferRef = useRef<Alert[]>([]);
  const initialLoadDone = useRef(false);

  useEffect(() => { isLiveRef.current = isLive; }, [isLive]);
  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);
  useEffect(() => { autoStickRef.current = autoStick; }, [autoStick]);

  // New alert gets a blue glow for exactly 1s, then eases straight back to normal.
  const flashNew = useCallback((id: number) => {
    setNewIds((prev) => new Set(prev).add(id));

    setTimeout(() => {
      setNewIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 1000);
  }, []);

  const [selectedEvidenceAlert, setSelectedEvidenceAlert] = useState<AlertEvidence | null>(null);

  // ---------- Initial load (NO "NEW" tags) ----------
  useEffect(() => {
    let isMounted = true;
    const fetchInitialAlerts = async () => {
      try {
        const res = await fetch('/api/video-monitoring/alerts');
        if (!res.ok) return;
        const data = await res.json();

        if (!isMounted) return;

        const list: Alert[] = Array.isArray(data) ? data : (data.alerts ?? []);
        const total = Array.isArray(data) ? list.length : (data.totalForDate ?? list.length);
        const dateKey = Array.isArray(data)
          ? (list[0] ? dateKeyOf(list[0].timestamp) : new Date().toDateString())
          : (data.activeDate ? new Date(data.activeDate).toDateString() : (list[0] ? dateKeyOf(list[0].timestamp) : ''));

        setAlerts(list);
        setActiveDateTotal(total);
        setActiveDateKey(dateKey);
        initialLoadDone.current = true;
      } catch (err) {
        console.error('Failed to fetch initial alerts:', err);
      }
    };
    fetchInitialAlerts();
    return () => { isMounted = false; };
  }, []);

  // ---------- SSE stream ----------
  useEffect(() => {
    let es: EventSource | null = null;
    let isMounted = true;

    const connectStream = () => {
      es = new EventSource('/api/video-monitoring/stream');

      es.onopen = () => {
        if (isMounted) {
          setError(null);
          setIsConnecting(false);
        }
      };

      es.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const newAlert: Alert = JSON.parse(event.data);

          if (!isLiveRef.current) {
            bufferRef.current = [newAlert, ...bufferRef.current];
            setPendingCount(bufferRef.current.length);
            return;
          }

          setAlerts((prev) => {
            if (prev.some((a) => a.id === newAlert.id)) return prev;
            return [newAlert, ...prev].slice(0, 300);
          });

          flashNew(newAlert.id);

          const todayKey = new Date().toDateString();
          if (dateKeyOf(newAlert.timestamp) === todayKey) {
            setActiveDateTotal((t) => (t == null ? 1 : t + 1));
            setActiveDateKey(todayKey);
          }

          if (soundOnRef.current && newAlert.severity === 'CRITICAL') beep();

          if (autoStickRef.current) {
            requestAnimationFrame(() =>
              containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
            );
          }

          setError(null);
          setIsConnecting(false);
        } catch (e) {
          console.error('Failed to parse alert data', e);
        }
      };

      es.onerror = () => {
        if (!isMounted) return;
        if (es?.readyState === EventSource.CONNECTING) setIsConnecting(true);
        else if (es?.readyState === EventSource.CLOSED)
          setError('Live alert stream disconnected. Retrying connection...');
      };
    };

    connectStream();
    return () => {
      isMounted = false;
      es?.close();
    };
  }, [flashNew]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setAutoStick(el.scrollTop < 24);

    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (nearBottom) {
      setVisibleDayCount((c) => c + 1);
    }
  }, []);

  const resumeLive = () => {
    setIsLive(true);
    if (bufferRef.current.length > 0) {
      setAlerts((prev) => [...bufferRef.current, ...prev].slice(0, 300));
      bufferRef.current.forEach((a) => flashNew(a.id));
      bufferRef.current = [];
    }
    setPendingCount(0);
    setAutoStick(true);
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const jumpToLatest = () => {
    setAutoStick(true);
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const counts = useMemo(() => {
    const c = { CRITICAL: 0, WARNING: 0, NORMAL: 0 };
    alerts.forEach((a) => {
      if (a.severity in c) (c as any)[a.severity]++;
    });
    return c;
  }, [alerts]);

  const dayGroups = useMemo(() => {
    const map = new Map<string, Alert[]>();
    alerts.forEach((a) => {
      const key = dateKeyOf(a.timestamp);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    const keys = Array.from(map.keys()).sort((a, b) => {
      if (a === 'Undated') return 1;
      if (b === 'Undated') return -1;
      return new Date(b).getTime() - new Date(a).getTime();
    });
    return { map, keys };
  }, [alerts]);

  const activeDayKeys = useMemo(() => {
    if (selectedDate) {
      const target = new Date(selectedDate).toDateString();
      return dayGroups.keys.includes(target) ? [target] : [];
    }
    if (dayGroups.keys.length === 0) return [];
    const todayKey = new Date().toDateString();
    const startIdx = dayGroups.keys.includes(todayKey)
      ? dayGroups.keys.indexOf(todayKey)
      : 0;
    return dayGroups.keys.slice(startIdx, startIdx + visibleDayCount);
  }, [selectedDate, dayGroups, visibleDayCount]);

  const displayDateKey = selectedDate
    ? new Date(selectedDate).toDateString()
    : activeDateKey || activeDayKeys[0] || '';

  const displayTotal =
    selectedDate
      ? (dayGroups.map.get(new Date(selectedDate).toDateString())?.length ?? 0)
      : activeDateTotal ?? alerts.length;

  const visibleAlerts = useMemo(() => {
    const pool = activeDayKeys.flatMap((k) => dayGroups.map.get(k) || []);
    return pool.filter((a) => {
      if (filter !== 'ALL' && a.severity !== filter) return false;
      if (query && !a.message.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [activeDayKeys, dayGroups, filter, query]);

  const hasMoreDays =
    !selectedDate &&
    (() => {
      const todayKey = new Date().toDateString();
      const startIdx = dayGroups.keys.includes(todayKey)
        ? dayGroups.keys.indexOf(todayKey)
        : 0;
      return startIdx + visibleDayCount < dayGroups.keys.length;
    })();

  const todayStr = toInputDate(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = toInputDate(yesterdayDate);
  const quickDateMode: 'today' | 'yesterday' | 'custom' | 'all' =
    !selectedDate ? 'all' : selectedDate === todayStr ? 'today' : selectedDate === yesterdayStr ? 'yesterday' : 'custom';

  const applyQuickDate = (mode: 'today' | 'yesterday' | 'all') => {
    setVisibleDayCount(1);
    if (mode === 'all') setSelectedDate('');
    else if (mode === 'today') setSelectedDate(todayStr);
    else setSelectedDate(yesterdayStr);
  };

  /* ---------- Professional severity styles (light theme) ---------- */
  const getSeverityAccent = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return {
          bar: 'bg-red-500',
          badge: 'bg-red-50 text-red-600 border-red-200',
          card: 'border-red-200/70 hover:border-red-300',
        };
      case 'WARNING':
        return {
          bar: 'bg-amber-500',
          badge: 'bg-amber-50 text-amber-700 border-amber-200',
          card: 'border-amber-200/70 hover:border-amber-300',
        };
      case 'NORMAL':
        return {
          bar: 'bg-emerald-500',
          badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          card: 'border-emerald-200/70 hover:border-emerald-300',
        };
      default:
        return {
          bar: 'bg-slate-400',
          badge: 'bg-slate-100 text-slate-600 border-slate-200',
          card: 'border-slate-200 hover:border-slate-300',
        };
    }
  };

  const chip = (key: SeverityFilter, label: string, count: number, dot: string) => (
    <button
      onClick={() => setFilter(key)}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide border transition-colors whitespace-nowrap ${filter === key
        ? 'bg-slate-900 text-white border-slate-900'
        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
        }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
      <span className="opacity-70">{count}</span>
    </button>
  );

  const dateQuickBtn = (mode: 'today' | 'yesterday' | 'all', label: string) => (
    <button
      onClick={() => applyQuickDate(mode)}
      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wide border transition-colors whitespace-nowrap ${quickDateMode === mode
        ? 'bg-cyan-50 text-cyan-700 border-cyan-300'
        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
        }`}
    >
      {label}
    </button>
  );

  const currentDateLabel = displayDateKey
    ? labelForDateKey(displayDateKey)
    : '—';

  return (
    <div
      className="bg-white rounded-xl shadow-md border border-slate-200 flex flex-col overflow-hidden transition-all duration-300 w-full"
      style={
        panelOpen
          ? {
            height: 'calc(100vh - 94px)',
            maxHeight: 'calc(100vh - 230px)',
          }
          : {
            height: 'auto',
            maxHeight: 'none',
          }
      }
    >
      <style>{`
  @keyframes pulseGlow {
    0% {
      box-shadow:
        0 0 0 3px rgba(37, 99, 235, 0.18),
        0 0 24px rgba(37, 99, 235, 0.35),
        0 6px 18px rgba(0, 0, 0, 0.08);
      border-color: rgba(37, 99, 235, 0.55);
      background: linear-gradient(145deg, rgba(219, 234, 254, 0.9), rgba(255, 255, 255, 1));
    }
    100% {
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
      border-color: rgba(226, 232, 240, 1);
      background: #ffffff;
    }
  }

  @keyframes alertEnter {
    0% {
      opacity: 0;
      transform: translateY(-16px) scale(0.97);
    }
    60% {
      opacity: 1;
      transform: translateY(1px) scale(1.005);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes badgeFadeInOut {
    0% { opacity: 0; transform: scale(0.8) translateY(-2px); }
    15% { opacity: 1; transform: scale(1) translateY(0); }
    80% { opacity: 1; transform: scale(1) translateY(0); }
    100% { opacity: 0; transform: scale(0.85) translateY(-2px); }
  }

  @keyframes dropdownEnter {
    0% { opacity: 0; transform: translateY(-8px) scale(0.98); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes panelEnter {
    0% { opacity: 0; transform: translateY(-6px); }
    100% { opacity: 1; transform: translateY(0); }
  }

  .alert-enter {
    animation:
      alertEnter 0.35s cubic-bezier(0.16, 1, 0.3, 1) both,
      pulseGlow 1s ease-out 0.02s forwards;
  }

  .alert-card {
    position: relative;
    border-radius: 14px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
  }

  .alert-card:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(15, 23, 42, 0.1);
  }

  .new-badge {
    position: absolute;
    top: 10px;
    right: 12px;
    z-index: 5;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 2px 7px;
    border-radius: 999px;
    background: linear-gradient(135deg, #3b82f6, #6366f1);
    color: white;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.35);
    animation: badgeFadeInOut 1s ease both;
  }

  .pop-in { animation: dropdownEnter 0.2s cubic-bezier(0.16, 1, 0.3, 1) both; }
  .panel-in { animation: panelEnter 0.22s cubic-bezier(0.16, 1, 0.3, 1) both; }

  .bottom-shadow {
    background: linear-gradient(to bottom,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0.7) 40%,
      rgba(255, 255, 255, 0.98) 100%);
    pointer-events: none;
  }

  .thin-scroll {
    scroll-behavior: smooth;
    scrollbar-width: thin;
    scrollbar-color: rgba(148, 163, 184, 0.6) transparent;
  }
  .thin-scroll::-webkit-scrollbar { width: 5px; }
  .thin-scroll::-webkit-scrollbar-track { background: transparent; }
  .thin-scroll::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #94a3b8, #64748b);
    border-radius: 999px;
  }

  .date-input-native {
    position: absolute;
    inset: 0;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
  }
  .date-input-native::-webkit-calendar-picker-indicator {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    cursor: pointer;
  }

  @media (prefers-reduced-motion: reduce) {
    .alert-enter, .pop-in, .panel-in, .new-badge { animation: none !important; }
    .alert-card { transition: none !important; }
  }
`}</style>

      {/* ========== HEADER ========== */}
      <div className="flex-shrink-0">
        <button
          type="button"
          onClick={() => setPanelOpen((prev) => !prev)}
          className="w-full p-3 py-4 flex items-center justify-between gap-3 text-left bg-slate-50 transition-colors hover:bg-slate-100"
        >
          <div className="min-w-0">
            <h3 className="font-bold text-base text-slate-900 truncate">
              Real-Time Violation Feed
            </h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              <span className="hidden sm:inline">construction_ai.alerts &middot; </span>
              <span className="font-bold text-cyan-700">{displayTotal} total</span>
              <span className="hidden sm:inline"> &middot; Showing </span>
              <span className="sm:hidden"> &middot; </span>
              <span className="font-bold text-cyan-700">{currentDateLabel}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-md border ${isLive
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
              />
              <span className="hidden xs:inline">{isLive ? 'Live' : 'Paused'}</span>
            </span>
            <span className="text-slate-500">
              <Icon.Chevron open={panelOpen} />
            </span>
          </div>
        </button>
      </div>

      {/* ========== COLLAPSIBLE BODY ========== */}
      {panelOpen && (
        <div className="panel-in border-t border-slate-200 flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Toolbar */}
          <div className="flex-shrink-0 px-3 sm:px-4 pt-3 flex flex-wrap items-center justify-between gap-2">
            <button
              onClick={() => setFiltersOpen((o) => !o)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wide border transition-colors ${filtersOpen
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                }`}
            >
              <Icon.Filter /> Filters <Icon.Chevron open={filtersOpen} />
              {(filter !== 'ALL' || query || selectedDate) && (
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
              )}
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSoundOn((s) => !s)}
                title={soundOn ? 'Mute critical sound alerts' : 'Enable critical sound alerts'}
                className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors ${soundOn
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-100'
                  }`}
              >
                <Icon.Bell on={soundOn} />
              </button>
              <button
                onClick={() => (isLive ? setIsLive(false) : resumeLive())}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wide border transition-colors ${isLive
                  ? 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                  : 'bg-amber-600 text-white border-amber-600 hover:bg-amber-500'
                  }`}
              >
                {isLive ? <Icon.Pause /> : <Icon.Play />}
                <span className="hidden xs:inline">{isLive ? 'Pause' : 'Resume'}</span>
              </button>
            </div>
          </div>

          {/* Filters */}
          {filtersOpen && (
            <div className="panel-in flex-shrink-0 px-3 sm:px-4 pt-3 space-y-3">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Icon.Search />
                </span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search alerts by keyword..."
                  className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-8 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-cyan-500 transition-colors"
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <Icon.X />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {chip('ALL', 'All', alerts.length, 'bg-slate-400')}
                {chip('CRITICAL', 'Critical', counts.CRITICAL, 'bg-red-500')}
                {chip('WARNING', 'Warning', counts.WARNING, 'bg-amber-500')}
                {chip('NORMAL', 'Normal', counts.NORMAL, 'bg-emerald-500')}
              </div>

              {/* ---- Improved date filter ---- */}
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                {dateQuickBtn('all', 'All dates')}
                {dateQuickBtn('today', 'Today')}
                {dateQuickBtn('yesterday', 'Yesterday')}

                <div
                  className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wide border transition-colors cursor-pointer whitespace-nowrap ${quickDateMode === 'custom'
                    ? 'bg-cyan-50 text-cyan-700 border-cyan-300'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                    }`}
                  onClick={() => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.focus()}
                >
                  <Icon.Calendar />
                  {quickDateMode === 'custom' ? labelForDateKey(new Date(selectedDate).toDateString()) : 'Pick date'}
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={selectedDate}
                    max={todayStr}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setVisibleDayCount(1);
                    }}
                    className="date-input-native"
                  />
                </div>

                {selectedDate && (
                  <button
                    onClick={() => {
                      setSelectedDate('');
                      setVisibleDayCount(1);
                    }}
                    className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    title="Clear date filter"
                  >
                    <Icon.X />
                  </button>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="flex-shrink-0 mx-3 sm:mx-4 mt-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
              {error}
            </div>
          )}

          {!isLive && pendingCount > 0 && (
            <button
              onClick={resumeLive}
              className="pop-in flex-shrink-0 mx-3 sm:mx-4 mt-3 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors w-[calc(100%-1.5rem)] sm:w-[calc(100%-2rem)]"
            >
              <Icon.Pause /> Paused · {pendingCount} new alert
              {pendingCount > 1 ? 's' : ''} waiting · tap to resume
            </button>
          )}

          {/* ========== SCROLLABLE LIST ========== */}
          <div className="relative flex-1 min-h-0 mt-3">
            <div
              ref={containerRef}
              onScroll={handleScroll}
              className="thin-scroll h-full overflow-y-auto px-3 sm:px-4 pb-5 space-y-3 bg-slate-50/40"
            >
              {visibleAlerts.length === 0 && !error && (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm space-y-2 py-16">
                  {alerts.length === 0 ? (
                    <>
                      <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      <span>Listening for live alerts...</span>
                    </>
                  ) : (
                    <span>No alerts match the current filter.</span>
                  )}
                </div>
              )}

              {visibleAlerts.map((alert) => {
                const isNew = newIds.has(alert.id);
                const sev = getSeverityAccent(alert.severity);

                return (
                  <div
                    key={alert.id}
                    className={`alert-card relative ${sev.card} ${isNew ? 'alert-enter' : ''}`}
                  >
                    {/* Left accent bar */}
                    <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${sev.bar}`} />

                    {/* Transient NEW badge — fades in and out inside the 1s glow window */}
                    {isNew && <span className="new-badge">New</span>}

                    <div className="pl-4 pr-3.5 py-3">
                      {/* Top row: severity + time */}
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase rounded-md border ${sev.badge}`}
                        >
                          {alert.severity}
                        </span>

                        <span className="text-[11px] text-slate-500 font-medium tabular-nums">
                          {formatAlertTime(alert.timestamp)}
                        </span>
                      </div>

                      {/* Message */}
                      <p className="text-[13px] font-medium text-slate-800 leading-snug pr-1 break-words">
                        {alert.message}
                      </p>

                      {/* Footer */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-400 font-mono tracking-wide">
                          ID #{alert.id}
                        </span>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvidenceAlert(alert);
                          }}
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg
                                     bg-blue-600 hover:bg-blue-700 text-white
                                     border border-blue-600 shadow-sm
                                     transition-all active:scale-[0.97]"
                        >
                          <Icon.Eye />
                          View Evidence
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {hasMoreDays && visibleAlerts.length > 0 && (
                <div className="text-center py-2">
                  <span className="text-[11px] text-slate-400">
                    Scroll for earlier dates...
                  </span>
                </div>
              )}
            </div>

            <div className="bottom-shadow pointer-events-none absolute bottom-0 left-0 right-0 h-16" />

            {!autoStick && isLive && (
              <button
                onClick={jumpToLatest}
                className="pop-in absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[11px] font-semibold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 hover:bg-slate-800 transition-colors z-10"
              >
                <Icon.Up /> Jump to latest
              </button>
            )}
          </div>
        </div>
      )}

      <EvidenceModal
        alert={selectedEvidenceAlert}
        onClose={() => setSelectedEvidenceAlert(null)}
      />
    </div>
  );
};