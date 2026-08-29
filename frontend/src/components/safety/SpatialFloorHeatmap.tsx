import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Camera,
  Layers,
  Sparkles,
  ShieldCheck,
  Activity,
  MapPin,
  ChevronRight,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import type { HeatmapZone, HeatmapSummary } from '../../services/safetySiteIntelligenceService';

interface SpatialFloorHeatmapProps {
  zones: HeatmapZone[];
  summary: HeatmapSummary | null;
  selectedZone: HeatmapZone | null;
  onSelectZone: (zone: HeatmapZone | null) => void;
  timeFilter: 'TODAY' | '7_DAYS' | '30_DAYS';
  onChangeTimeFilter: (filter: 'TODAY' | '7_DAYS' | '30_DAYS') => void;
  onAskDevaAboutZone?: (zone: HeatmapZone) => void;
  loading?: boolean;
}

const RISK_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  safe: 4,
};

export const SpatialFloorHeatmap: React.FC<SpatialFloorHeatmapProps> = ({
  zones,
  summary,
  selectedZone,
  onSelectZone,
  timeFilter,
  onChangeTimeFilter,
  onAskDevaAboutZone,
  loading = false,
}) => {
  const svgWidth = 800;
  const svgHeight = 500;

  const sectors = useMemo(() => {
    const uniq = Array.from(new Set(zones.map((z) => z.sector))).filter(Boolean);
    return uniq;
  }, [zones]);

  const [activeSector, setActiveSector] = useState<string>('ALL');
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (activeSector !== 'ALL' && !sectors.includes(activeSector)) {
      setActiveSector('ALL');
    }
  }, [sectors, activeSector]);

  useEffect(() => {
    if (
      selectedZone &&
      selectedZone.sector &&
      activeSector !== 'ALL' &&
      activeSector !== selectedZone.sector
    ) {
      setActiveSector(selectedZone.sector);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedZone?.id]);

  const visibleZones = useMemo(() => {
    const filtered =
      activeSector === 'ALL' ? zones : zones.filter((z) => z.sector === activeSector);
    return [...filtered].sort(
      (a, b) =>
        (RISK_ORDER[a.risk_level] ?? 9) - (RISK_ORDER[b.risk_level] ?? 9) ||
        b.risk_score - a.risk_score
    );
  }, [zones, activeSector]);

  const sectorRiskCount = (sector: string) =>
    zones.filter(
      (z) => z.sector === sector && (z.risk_level === 'high' || z.risk_level === 'critical')
    ).length;

  const toSvgPoints = (coords: { x: number; y: number }[]) =>
    coords.map((c) => `${c.x * svgWidth},${c.y * svgHeight}`).join(' ');

  const getPolygonCenter = (coords: { x: number; y: number }[]) => {
    if (!coords.length) return { x: 0, y: 0 };
    const avgX = coords.reduce((acc, c) => acc + c.x, 0) / coords.length;
    const avgY = coords.reduce((acc, c) => acc + c.y, 0) / coords.length;
    return { x: avgX * svgWidth, y: avgY * svgHeight };
  };

  const kpiItems = summary
    ? [
        {
          icon: <AlertTriangle className="w-4 h-4" />,
          label: 'HIGH RISK',
          value: summary.high_risk_zones,
          color: 'text-red-400',
          bg: 'bg-red-500/15',
          border: 'border-red-500/20',
        },
        {
          icon: <Layers className="w-4 h-4" />,
          label: 'VIOLATIONS',
          value: summary.total_incidents,
          color: 'text-amber-300',
          bg: 'bg-amber-500/15',
          border: 'border-amber-500/20',
        },
        {
          icon: <ShieldCheck className="w-4 h-4" />,
          label: 'SAFETY IDX',
          value: `${summary.safety_index}%`,
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/15',
          border: 'border-emerald-500/20',
        },
        {
          icon: <Camera className="w-4 h-4" />,
          label: 'CCTV LIVE',
          value: summary.active_cameras,
          color: 'text-sky-300',
          bg: 'bg-sky-500/15',
          border: 'border-sky-500/20',
        },
      ]
    : [];

  return (
    <motion.div
      layout
      initial={false}
      animate={{
        width: expanded ? '100%' : 72,
      }}
      transition={{ type: 'spring', stiffness: 340, damping: 34 }}
      className={`bg-[#0B1528] text-white rounded-[20px] border border-white/10 shadow-xl overflow-hidden relative flex flex-col ${
        expanded ? 'p-4 sm:p-5 gap-3.5' : 'py-4 px-2 gap-3 items-center'
      }`}
      style={{ minWidth: expanded ? undefined : 72 }}
    >
      {/* ═══════════════ COLLAPSED SIDEBAR STRIP ═══════════════ */}
      {!expanded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex flex-col items-center gap-3 w-full h-full"
        >
          {/* Expand button */}
          <button
            onClick={() => setExpanded(true)}
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer"
            title="Expand floor plan"
          >
            <PanelLeftOpen className="w-4.5 h-4.5" />
          </button>

          {/* Vertical label */}
          <div
            className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.14em] text-emerald-400 font-bold"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            <Activity className="w-3 h-3 animate-pulse" />
            Spatial Risk
          </div>

          {/* KPI icons stacked */}
          <div className="flex flex-col gap-2.5 mt-1 w-full items-center">
            {kpiItems.map((k) => (
              <div
                key={k.label}
                className={`w-12 rounded-xl ${k.bg} border ${k.border} flex flex-col items-center py-2 gap-0.5`}
                title={`${k.label}: ${k.value}`}
              >
                <div className={k.color}>{k.icon}</div>
                <div className={`text-[10px] font-bold ${k.color} leading-none`}>
                  {k.value}
                </div>
                <div className="text-[7.5px] text-white/45 uppercase tracking-wider leading-none text-center px-0.5">
                  {k.label.split(' ')[0]}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ═══════════════ EXPANDED FULL LAYOUT ═══════════════ */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-3.5 w-full"
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div>
                  <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-wider text-emerald-400 font-bold">
                    <Activity className="w-3.5 h-3.5 animate-pulse" />
                    Spatial Risk Heat Map
                  </div>
                  <h2 className="text-[16px] font-bold text-white mt-0.5">
                    Plant Floor Safety &amp; Risk Layout
                  </h2>
                </div>

                {/* Collapse button */}
                <button
                  onClick={() => setExpanded(false)}
                  className="mt-0.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all cursor-pointer border border-white/15 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white"
                  title="Collapse to sidebar"
                >
                  <PanelLeftClose className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Collapse</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5 bg-white/10 p-1 rounded-xl border border-white/10 self-start sm:self-auto">
                {[
                  { id: 'TODAY', label: 'Today' },
                  { id: '7_DAYS', label: '7 Days' },
                  { id: '30_DAYS', label: '30 Days' },
                ].map((tf) => (
                  <button
                    key={tf.id}
                    onClick={() => onChangeTimeFilter(tf.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border-none ${
                      timeFilter === tf.id
                        ? 'bg-emerald-500 text-slate-950 shadow-md'
                        : 'bg-transparent text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>

            {/* KPI Tiles */}
            {summary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {kpiItems.map((k) => (
                  <div
                    key={k.label}
                    className="bg-white/5 border border-white/10 rounded-xl p-2 flex items-center gap-2"
                  >
                    <div
                      className={`w-7 h-7 rounded-lg ${k.bg} ${k.color} flex items-center justify-center shrink-0`}
                    >
                      {k.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[9px] text-white/55 uppercase tracking-wider truncate">
                        {k.label}
                      </div>
                      <div className={`text-[13px] font-bold ${k.color}`}>{k.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Sector Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar-dark">
              <button
                onClick={() => setActiveSector('ALL')}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-semibold transition-all cursor-pointer border ${
                  activeSector === 'ALL'
                    ? 'bg-white text-slate-950 border-white shadow-md'
                    : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Layers className="w-3 h-3" />
                All Zones
                <span
                  className={`text-[9.5px] px-1.5 py-0.5 rounded-full ${
                    activeSector === 'ALL' ? 'bg-slate-950/10' : 'bg-white/10'
                  }`}
                >
                  {zones.length}
                </span>
              </button>
              {sectors.map((s) => {
                const riskCount = sectorRiskCount(s);
                const isActive = activeSector === s;
                return (
                  <button
                    key={s}
                    onClick={() => setActiveSector(s)}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-semibold transition-all cursor-pointer border whitespace-nowrap ${
                      isActive
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md'
                        : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <MapPin className="w-3 h-3" />
                    {s}
                    {riskCount > 0 && (
                      <span
                        className={`text-[9.5px] px-1.5 py-0.5 rounded-full font-bold ${
                          isActive ? 'bg-slate-950/15' : 'bg-red-500/25 text-red-300'
                        }`}
                      >
                        {riskCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Floor Map */}
            <div className="relative bg-[#060D1A] rounded-2xl border border-white/15 overflow-hidden flex items-center justify-center aspect-[8/5] min-h-[220px]">
              <div
                className="absolute inset-0 opacity-15 pointer-events-none"
                style={{
                  backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)`,
                  backgroundSize: '24px 24px',
                }}
              />

              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full select-none">
                <rect
                  x="20"
                  y="20"
                  width={svgWidth - 40}
                  height={svgHeight - 40}
                  fill="none"
                  stroke="#1E293B"
                  strokeWidth="2"
                  strokeDasharray="6 6"
                  rx="12"
                />
                <line
                  x1="20"
                  y1={svgHeight * 0.55}
                  x2={svgWidth - 20}
                  y2={svgHeight * 0.55}
                  stroke="#334155"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                <text
                  x={svgWidth / 2}
                  y={svgHeight * 0.55 - 6}
                  fill="#64748B"
                  fontSize="10"
                  textAnchor="middle"
                  fontFamily="monospace"
                  letterSpacing="1"
                >
                  MAIN LOGISTICS &amp; EVACUATION CORRIDOR
                </text>

                {zones.map((z) => {
                  const isSelected = selectedZone?.id === z.id;
                  const inActiveSector =
                    activeSector === 'ALL' || z.sector === activeSector;
                  const points = toSvgPoints(z.coordinates);
                  const center = getPolygonCenter(z.coordinates);

                  return (
                    <g
                      key={z.id}
                      onClick={() => onSelectZone(isSelected ? null : z)}
                      className="cursor-pointer transition-all"
                      opacity={inActiveSector ? 1 : 0.18}
                    >
                      {z.pulse && inActiveSector && (
                        <circle
                          cx={center.x}
                          cy={center.y}
                          r={isSelected ? 42 : 32}
                          fill="none"
                          stroke="#EF4444"
                          strokeWidth="2"
                          opacity="0.75"
                          className="animate-ping origin-center"
                        />
                      )}
                      <polygon
                        points={points}
                        fill={z.color}
                        fillOpacity={isSelected ? 0.45 : 0.22}
                        stroke={isSelected ? '#FFFFFF' : z.color}
                        strokeWidth={isSelected ? 3 : 1.8}
                        className="transition-all duration-200 hover:fill-opacity-40"
                      />
                      {inActiveSector && (
                        <>
                          <circle
                            cx={center.x - 45}
                            cy={center.y - 18}
                            r="8"
                            fill="#0F172A"
                            stroke="#38BDF8"
                            strokeWidth="1.5"
                          />
                          <circle cx={center.x - 45} cy={center.y - 15} r={6} fill="#38BDF8" />
                          <text
                            x={center.x}
                            y={center.y - 6}
                            fill="#FFFFFF"
                            fontSize="11"
                            fontWeight="bold"
                            textAnchor="middle"
                            className="pointer-events-none drop-shadow-md"
                          >
                            {z.name.split('(')[0].trim()}
                          </text>
                          <rect
                            x={center.x - 44}
                            y={center.y + 6}
                            width="88"
                            height="18"
                            rx="9"
                            fill={z.color}
                            fillOpacity="0.9"
                            className="pointer-events-none"
                          />
                          <text
                            x={center.x}
                            y={center.y + 19}
                            fill={z.risk_level === 'safe' ? '#064E3B' : '#FFFFFF'}
                            fontSize="9.5"
                            fontWeight="bold"
                            textAnchor="middle"
                            className="pointer-events-none"
                          >
                            {z.risk_level.toUpperCase()} · {z.risk_score} PTS
                          </text>
                        </>
                      )}
                    </g>
                  );
                })}
              </svg>

              {loading && (
                <div className="absolute inset-0 bg-[#0B1528]/70 backdrop-blur-sm flex items-center justify-center">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                    <Activity className="w-4 h-4 animate-spin" />
                    Updating spatial violation density...
                  </div>
                </div>
              )}
            </div>

            {/* Zone List */}
            <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto custom-scrollbar-dark pr-0.5">
              {visibleZones.length === 0 && (
                <div className="text-center text-white/50 text-[12px] py-6">
                  No zones in this sector.
                </div>
              )}
              {visibleZones.map((z) => {
                const isSelected = selectedZone?.id === z.id;
                return (
                  <button
                    key={z.id}
                    onClick={() => onSelectZone(isSelected ? null : z)}
                    className={`text-left flex items-center gap-3 px-3 py-2 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white/15 border-white/30 shadow-md'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: z.color,
                        boxShadow: z.pulse ? `0 0 8px ${z.color}` : undefined,
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12.5px] font-semibold text-white truncate">
                          {z.name.split('(')[0].trim()}
                        </span>
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide"
                          style={{ backgroundColor: `${z.color}30`, color: z.color }}
                        >
                          {z.risk_level}
                        </span>
                      </div>
                      <div className="text-[10.5px] text-white/55 truncate">
                        {z.sector} · {z.camera_name}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[13px] font-bold" style={{ color: z.color }}>
                        {z.risk_score}
                      </div>
                      <div className="text-[9px] text-white/50 uppercase">
                        {z.incident_count} events
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-white/30 shrink-0" />
                  </button>
                );
              })}
            </div>

            {/* Selected Zone Inspector */}
            <AnimatePresence>
              {selectedZone && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="bg-white/10 border border-white/20 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-md relative"
                >
                  <button
                    onClick={() => onSelectZone(null)}
                    className="absolute top-3 right-3 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all cursor-pointer border-none flex items-center justify-center z-10"
                    title="Close inspection panel"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div className="space-y-1 min-w-0 pr-8 md:pr-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: selectedZone.color }}
                      />
                      <span className="text-[11px] uppercase tracking-wider text-white/70 font-semibold">
                        {selectedZone.sector}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-white/10 text-white">
                        Camera: {selectedZone.camera_name}
                      </span>
                    </div>
                    <h3 className="text-[16px] font-bold text-white">{selectedZone.name}</h3>
                    <p className="text-[12.5px] text-white/80">
                      Total Violations: <strong>{selectedZone.incident_count} events</strong> ·
                      Risk Score:{' '}
                      <strong style={{ color: selectedZone.color }}>
                        {selectedZone.risk_score}/100 ({selectedZone.risk_level.toUpperCase()})
                      </strong>
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {Object.entries(selectedZone.violations_breakdown).map(([k, v]) => (
                        <span
                          key={k}
                          className="text-[10.5px] px-2 py-0.5 rounded-md bg-black/30 border border-white/10 text-white/90"
                        >
                          {k}: <strong>{v}</strong>
                        </span>
                      ))}
                    </div>
                  </div>

                  {onAskDevaAboutZone && (
                    <button
                      onClick={() => onAskDevaAboutZone(selectedZone)}
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[12.5px] px-4 py-2.5 rounded-xl transition-colors cursor-pointer border-none flex items-center gap-2 shrink-0 shadow-md"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Ask Deva why this zone is {selectedZone.risk_level}
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default SpatialFloorHeatmap;