import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

interface Alert {
  id: number;
  severity: 'CRITICAL' | 'WARNING' | 'NORMAL';
  message: string;
  timestamp: string;
}

type SeverityFilter = 'ALL' | 'CRITICAL' | 'WARNING' | 'NORMAL';

/* ---------- tiny inline icons (no emoji, no external deps) ---------- */
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
  Check: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
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

export const AlertFeed: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newIds, setNewIds] = useState<Set<number>>(new Set());

  const [panelOpen, setPanelOpen] = useState(false);      // whole feed panel: closed by default
  const [filtersOpen, setFiltersOpen] = useState(false);  // filter section: closed by default

  const [filter, setFilter] = useState<SeverityFilter>('ALL');
  const [query, setQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isLive, setIsLive] = useState(true);
  const [soundOn, setSoundOn] = useState(false);
  const [ackIds, setAckIds] = useState<Set<number>>(new Set());
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [autoStick, setAutoStick] = useState(true);
  const [visibleDayCount, setVisibleDayCount] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const isLiveRef = useRef(isLive);
  const soundOnRef = useRef(soundOn);
  const autoStickRef = useRef(autoStick);
  const bufferRef = useRef<Alert[]>([]);

  useEffect(() => { isLiveRef.current = isLive; }, [isLive]);
  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);
  useEffect(() => { autoStickRef.current = autoStick; }, [autoStick]);

  const flashNew = (id: number) => {
    setNewIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setNewIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 1200);
  };

  useEffect(() => {
    let es: EventSource | null = null;
    let isMounted = true;

    const connectStream = () => {
      es = new EventSource('/api/video-monitoring/stream');

      es.onopen = () => { if (isMounted) { setError(null); setIsConnecting(false); } };

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
            if (prev.some(a => a.id === newAlert.id)) return prev;
            return [newAlert, ...prev].slice(0, 300);
          });
          flashNew(newAlert.id);

          if (soundOnRef.current && newAlert.severity === 'CRITICAL') beep();

          if (autoStickRef.current) {
            requestAnimationFrame(() => containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' }));
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
        else if (es?.readyState === EventSource.CLOSED) setError('Live alert stream disconnected. Retrying connection...');
      };
    };

    connectStream();
    return () => { isMounted = false; es?.close(); };
  }, []);

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
      bufferRef.current.forEach(a => flashNew(a.id));
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

  const toggleAck = (id: number) => {
    setAckIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const counts = useMemo(() => {
    const c = { CRITICAL: 0, WARNING: 0, NORMAL: 0 };
    alerts.forEach(a => { if (a.severity in c) (c as any)[a.severity]++; });
    return c;
  }, [alerts]);

  const dayGroups = useMemo(() => {
    const map = new Map<string, Alert[]>();
    alerts.forEach(a => {
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
    const startIdx = dayGroups.keys.includes(todayKey) ? dayGroups.keys.indexOf(todayKey) : 0;
    return dayGroups.keys.slice(startIdx, startIdx + visibleDayCount);
  }, [selectedDate, dayGroups, visibleDayCount]);

  const visibleAlerts = useMemo(() => {
    const pool = activeDayKeys.flatMap(k => dayGroups.map.get(k) || []);
    return pool.filter(a => {
      if (filter !== 'ALL' && a.severity !== filter) return false;
      if (query && !a.message.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [activeDayKeys, dayGroups, filter, query]);

  const hasMoreDays = !selectedDate && (() => {
    const todayKey = new Date().toDateString();
    const startIdx = dayGroups.keys.includes(todayKey) ? dayGroups.keys.indexOf(todayKey) : 0;
    return startIdx + visibleDayCount < dayGroups.keys.length;
  })();

  const getSeverityStyle = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL': return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'WARNING': return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'NORMAL': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };
  const getBadgeStyle = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL': return 'bg-red-600 text-white';
      case 'WARNING': return 'bg-amber-600 text-white';
      case 'NORMAL': return 'bg-emerald-600 text-white';
      default: return 'bg-slate-600 text-white';
    }
  };

  const chip = (key: SeverityFilter, label: string, count: number, dot: string) => (
    <button
      onClick={() => setFilter(key)}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide border transition-colors ${filter === key
        ? 'bg-slate-100 text-slate-900 border-slate-100'
        : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-800'
        }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`}></span>
      {label}
      <span className="opacity-70">{count}</span>
    </button>
  );

  const currentDateLabel = selectedDate
    ? labelForDateKey(new Date(selectedDate).toDateString())
    : (activeDayKeys[0] ? labelForDateKey(activeDayKeys[0]) : '—');

  return (
    <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 flex flex-col overflow-hidden">
      <style>{`
  /* ================================
     ALERT SYSTEM — MODERN DARK UI
     ================================ */

  @keyframes alertEnter {
    0% {
      opacity: 0;
      transform: translateY(-18px) scale(0.96);
      filter: blur(4px);
    }

    60% {
      opacity: 1;
      transform: translateY(2px) scale(1.01);
      filter: blur(0);
    }

    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes alertPulse {
    0% {
      box-shadow:
        0 0 0 0 rgba(59, 130, 246, 0),
        0 10px 30px rgba(0, 0, 0, 0.18);
    }

    50% {
      box-shadow:
        0 0 0 6px rgba(59, 130, 246, 0.08),
        0 14px 40px rgba(0, 0, 0, 0.25);
    }

    100% {
      box-shadow:
        0 0 0 0 rgba(59, 130, 246, 0),
        0 10px 30px rgba(0, 0, 0, 0.18);
    }
  }

  @keyframes alertExit {
    0% {
      opacity: 1;
      transform: translateX(0);
      max-height: 300px;
    }

    100% {
      opacity: 0;
      transform: translateX(20px);
      max-height: 0;
      margin: 0;
      padding-top: 0;
      padding-bottom: 0;
    }
  }

  @keyframes dropdownEnter {
    0% {
      opacity: 0;
      transform: translateY(-10px) scale(0.97);
    }

    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes panelEnter {
    0% {
      opacity: 0;
      transform: translateY(-8px);
      filter: blur(2px);
    }

    100% {
      opacity: 1;
      transform: translateY(0);
      filter: blur(0);
    }
  }

  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }

    100% {
      background-position: 200% 0;
    }
  }

  @keyframes statusPulse {
    0% {
      transform: scale(1);
      opacity: 1;
    }

    50% {
      transform: scale(1.25);
      opacity: 0.65;
    }

    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  /* ================================
     MAIN ANIMATIONS
     ================================ */

  .alert-enter {
    animation:
      alertEnter 0.45s cubic-bezier(0.16, 1, 0.3, 1) both,
      alertPulse 1.2s ease-out 0.15s both;
  }

  .alert-item {
    position: relative;
    overflow: hidden;

    border: 1px solid rgba(148, 163, 184, 0.12);
    border-radius: 16px;

    background:
      linear-gradient(
        135deg,
        rgba(30, 41, 59, 0.92),
        rgba(15, 23, 42, 0.96)
      );

    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);

    box-shadow:
      0 10px 30px rgba(0, 0, 0, 0.18),
      inset 0 1px 0 rgba(255, 255, 255, 0.04);

    transition:
      opacity 0.25s ease,
      transform 0.25s ease,
      background 0.25s ease,
      border-color 0.25s ease,
      box-shadow 0.25s ease;
  }

  .alert-item:hover {
    transform: translateY(-2px);

    border-color: rgba(148, 163, 184, 0.25);

    background:
      linear-gradient(
        135deg,
        rgba(51, 65, 85, 0.95),
        rgba(15, 23, 42, 0.98)
      );

    box-shadow:
      0 16px 40px rgba(0, 0, 0, 0.28),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }

  .alert-item::before {
    content: "";

    position: absolute;
    inset: 0;

    pointer-events: none;

    background:
      linear-gradient(
        120deg,
        transparent 20%,
        rgba(255, 255, 255, 0.035) 50%,
        transparent 80%
      );

    background-size: 200% 100%;
    opacity: 0;

    transition: opacity 0.3s ease;
  }

  .alert-item:hover::before {
    opacity: 1;
    animation: shimmer 2s linear infinite;
  }

  /* ================================
     POPUP / DROPDOWN
     ================================ */

  .pop-in {
    animation:
      dropdownEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1)
      both;
  }

  .panel-in {
    animation:
      panelEnter 0.25s cubic-bezier(0.16, 1, 0.3, 1)
      both;
  }

  /* ================================
     PANEL
     ================================ */

  .alert-panel {
    border: 1px solid rgba(148, 163, 184, 0.14);

    background:
      linear-gradient(
        145deg,
        rgba(15, 23, 42, 0.97),
        rgba(2, 6, 23, 0.98)
      );

    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);

    border-radius: 20px;

    box-shadow:
      0 25px 70px rgba(0, 0, 0, 0.42),
      0 8px 25px rgba(0, 0, 0, 0.25),
      inset 0 1px 0 rgba(255, 255, 255, 0.045);
  }

  /* ================================
     BOTTOM FADE
     ================================ */

  .bottom-shadow {
    background:
      linear-gradient(
        to bottom,
        rgba(2, 6, 23, 0) 0%,
        rgba(2, 6, 23, 0.35) 35%,
        rgba(2, 6, 23, 0.82) 75%,
        rgba(2, 6, 23, 1) 100%
      );

    pointer-events: none;
  }

  /* ================================
     SCROLLBAR
     ================================ */

  .thin-scroll {
    scroll-behavior: smooth;

    scrollbar-width: thin;
    scrollbar-color:
      rgba(100, 116, 139, 0.65)
      transparent;
  }

  .thin-scroll::-webkit-scrollbar {
    width: 5px;
    height: 5px;
  }

  .thin-scroll::-webkit-scrollbar-track {
    background: transparent;
  }

  .thin-scroll::-webkit-scrollbar-thumb {
    background:
      linear-gradient(
        180deg,
        #64748b,
        #475569
      );

    border-radius: 999px;

    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .thin-scroll::-webkit-scrollbar-thumb:hover {
    background:
      linear-gradient(
        180deg,
        #94a3b8,
        #64748b
      );
  }

  /* ================================
     STATUS INDICATOR
     ================================ */

  .status-dot {
    position: relative;
  }

  .status-dot::after {
    content: "";

    position: absolute;
    inset: -3px;

    border-radius: 999px;

    border: 1px solid currentColor;

    opacity: 0.25;

    animation: statusPulse 2s ease-in-out infinite;
  }

  /* ================================
     CLOSE BUTTON
     ================================ */

  .alert-close {
    display: flex;
    align-items: center;
    justify-content: center;

    width: 30px;
    height: 30px;

    border-radius: 10px;

    color: #94a3b8;

    background: rgba(255, 255, 255, 0.035);

    border: 1px solid rgba(148, 163, 184, 0.08);

    cursor: pointer;

    transition:
      color 0.2s ease,
      background 0.2s ease,
      border-color 0.2s ease,
      transform 0.2s ease;
  }

  .alert-close:hover {
    color: #f8fafc;

    background: rgba(239, 68, 68, 0.12);

    border-color: rgba(248, 113, 113, 0.2);

    transform: rotate(4deg) scale(1.05);
  }

  .alert-close:active {
    transform: scale(0.92);
  }

  /* ================================
     INTERACTIVE ITEMS
     ================================ */

  .alert-action {
    transition:
      transform 0.2s ease,
      background 0.2s ease,
      border-color 0.2s ease;
  }

  .alert-action:hover {
    transform: translateY(-1px);

    background: rgba(255, 255, 255, 0.06);

    border-color: rgba(148, 163, 184, 0.18);
  }

  .alert-action:active {
    transform: translateY(0) scale(0.98);
  }

  /* ================================
     ACCESSIBILITY
     ================================ */

  @media (prefers-reduced-motion: reduce) {
    .alert-enter,
    .pop-in,
    .panel-in,
    .status-dot::after {
      animation: none !important;
    }

    .alert-item,
    .alert-close,
    .alert-action {
      transition: none !important;
    }
  }
`}</style>
      <div>
        {/* Panel Header — always visible, collapse/expand whole feed */}
        <button
          className="w-full p-3 py-4 flex items-center justify-between text-left bg-slate-950/40 transition-colors"
        >
          <div>
            <h3 className="font-bold text-base text-slate-100">
              Real-Time Violation Feed
            </h3>

            <p className="text-[11px] text-slate-500">
              construction_ai.alerts &middot;{" "}
              <span className="font-bold text-cyan-400">
                {alerts.length} total
              </span><br />
              Showing {" "}
              <span className="font-bold text-cyan-400">
                {currentDateLabel}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-md border ${isLive ? 'bg-emerald-950 text-emerald-400 border-emerald-800/60' : 'bg-amber-950 text-amber-400 border-amber-800/60'
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              {isLive ? 'Live' : 'Paused'}
            </span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setPanelOpen((prev) => !prev)}
          className="
    flex items-center justify-center
    w-full h-8
    rounded-lg
    text-slate-400
    hover:text-white
    hover:bg-slate-800
    border border-transparent
    hover:border-slate-700
    transition-all duration-200
    cursor-pointer
  "
          aria-label={panelOpen ? "Collapse panel" : "Expand panel"}
        >
          <Icon.Chevron open={panelOpen} />
        </button>
      </div>


      {panelOpen && (
        <div className="panel-in border-t border-slate-800">
          <div className="px-4 pt-3 flex items-center justify-between gap-2">
            <button
              onClick={() => setFiltersOpen(o => !o)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wide border transition-colors ${filtersOpen ? 'bg-slate-100 text-slate-900 border-slate-100' : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-800'
                }`}
            >
              <Icon.Filter /> Filters <Icon.Chevron open={filtersOpen} />
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSoundOn(s => !s)}
                title={soundOn ? 'Mute critical sound alerts' : 'Enable critical sound alerts'}
                className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors ${soundOn ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
              >
                <Icon.Bell on={soundOn} />
              </button>
              <button
                onClick={() => (isLive ? setIsLive(false) : resumeLive())}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wide border transition-colors ${isLive ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-amber-600 text-white border-amber-500 hover:bg-amber-500'
                  }`}
              >
                {isLive ? <Icon.Pause /> : <Icon.Play />}
                {isLive ? 'Pause' : 'Resume'}
              </button>
            </div>
          </div>

          {filtersOpen && (
            <div className="panel-in px-4 pt-3 space-y-3">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><Icon.Search /></span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search alerts by keyword..."
                  className="w-full bg-slate-800/70 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {chip('ALL', 'All', alerts.length, 'bg-slate-400')}
                {chip('CRITICAL', 'Critical', counts.CRITICAL, 'bg-red-500')}
                {chip('WARNING', 'Warning', counts.WARNING, 'bg-amber-500')}
                {chip('NORMAL', 'Normal', counts.NORMAL, 'bg-emerald-500')}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-500"><Icon.Calendar /></span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => { setSelectedDate(e.target.value); setVisibleDayCount(1); }}
                  className="bg-slate-800/70 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-600"
                />
                {selectedDate && (
                  <button
                    onClick={() => { setSelectedDate(''); setVisibleDayCount(1); }}
                    className="text-[11px] font-semibold text-slate-400 hover:text-slate-200 underline"
                  >
                    Clear date
                  </button>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-amber-950/60 border border-amber-800/60 text-amber-300 text-xs font-medium">
              {error}
            </div>
          )}

          {!isLive && pendingCount > 0 && (
            <button
              onClick={resumeLive}
              className="pop-in mx-4 mt-3 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors w-[calc(100%-2rem)]"
            >
              <Icon.Pause /> Paused &middot; {pendingCount} new alert{pendingCount > 1 ? 's' : ''} waiting &middot; tap to resume
            </button>
          )}

          <div className="relative mt-3">
            <div
              ref={containerRef}
              onScroll={handleScroll}
              className="thin-scroll overflow-y-auto px-4 pb-4 space-y-4 min-h-[280px] max-h-[520px]"
            >
              {visibleAlerts.length === 0 && !error && (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm space-y-2 py-16">
                  {alerts.length === 0 ? (
                    <>
                      <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>Listening for live alerts...</span>
                    </>
                  ) : (
                    <span>No alerts match the current filter.</span>
                  )}
                </div>
              )}

              {visibleAlerts.map((alert) => {
                const acked = ackIds.has(alert.id);
                const expanded = expandedId === alert.id;
                return (
                  <div
                    key={alert.id}
                    className={`alert-item relative pl-6 ${newIds.has(alert.id) ? 'alert-enter' : ''} ${acked ? 'opacity-50' : ''}`}
                  >
                    <div className={`absolute left-0 top-2.5 w-2.5 h-2.5 rounded-full ${getBadgeStyle(alert.severity)}`}></div>
                    <div className="absolute left-[4px] top-5 bottom-[-16px] w-[2px] bg-slate-800"></div>

                    <div
                      className={`p-3 rounded-lg border cursor-pointer ${getSeverityStyle(alert.severity)} shadow-sm`}
                      onClick={() => setExpandedId(expanded ? null : alert.id)}
                    >
                      <div className="flex justify-between items-center mb-1.5">
                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded uppercase tracking-wider ${getBadgeStyle(alert.severity)}`}>
                          {alert.severity}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">{alert.timestamp}</span>
                      </div>
                      <p className="text-xs font-medium text-slate-200">{alert.message}</p>

                      {expanded && (
                        <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between pop-in">
                          <span className="text-[11px] text-slate-400">Alert ID #{alert.id}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleAck(alert.id); }}
                            className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded transition-colors ${acked ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-900 hover:bg-white'
                              }`}
                          >
                            {!acked && <Icon.Check />} {acked ? 'Unacknowledge' : 'Acknowledge'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {hasMoreDays && visibleAlerts.length > 0 && (
                <div className="text-center py-2">
                  <span className="text-[11px] text-slate-500">Scroll for earlier dates...</span>
                </div>
              )}
            </div>

            <div className="bottom-shadow pointer-events-none absolute bottom-0 left-0 right-0 h-24"></div>

            {!autoStick && isLive && (
              <button
                onClick={jumpToLatest}
                className="pop-in absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-100 text-slate-900 text-[11px] font-semibold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 hover:bg-white transition-colors z-10"
              >
                <Icon.Up /> Jump to latest
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};