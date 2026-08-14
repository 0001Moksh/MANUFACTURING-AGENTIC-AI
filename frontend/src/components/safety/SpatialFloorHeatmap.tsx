import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Camera,
  Layers,
  Sparkles,
  ShieldCheck,
  Activity,
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

  // Convert normalized [{x, y}] to SVG points string "x1,y1 x2,y2 ..."
  const toSvgPoints = (coords: { x: number; y: number }[]) => {
    return coords.map((c) => `${c.x * svgWidth},${c.y * svgHeight}`).join(' ');
  };

  // Compute center of polygon for label placement
  const getPolygonCenter = (coords: { x: number; y: number }[]) => {
    if (!coords.length) return { x: 0, y: 0 };
    const avgX = coords.reduce((acc, c) => acc + c.x, 0) / coords.length;
    const avgY = coords.reduce((acc, c) => acc + c.y, 0) / coords.length;
    return { x: avgX * svgWidth, y: avgY * svgHeight };
  };

  return (
    <div className="bg-[#0B1528] text-white rounded-[20px] p-5 flex flex-col gap-4 border border-white/10 shadow-xl overflow-hidden relative">
      {/* ── Top Bar: Header & Time Filter ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-emerald-400 font-bold">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            Spatial Risk Heat Map &amp; CCTV Vision
          </div>
          <h2 className="text-[17px] font-bold text-white mt-0.5">Plant Floor Safety &amp; Risk Layout</h2>
        </div>

        {/* Time Filters */}
        <div className="flex items-center gap-1.5 bg-white/10 p-1 rounded-xl border border-white/10 self-start sm:self-auto">
          {[
            { id: 'TODAY', label: 'Today (Live)' },
            { id: '7_DAYS', label: 'Last 7 Days' },
            { id: '30_DAYS', label: 'Last 30 Days' },
          ].map((tf) => (
            <button
              key={tf.id}
              onClick={() => onChangeTimeFilter(tf.id as any)}
              className={`px-3 py-1.5 rounded-lg text-[11.5px] font-semibold transition-all cursor-pointer border-none ${
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

      {/* ── Summary KPI Tiles ── */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-white/60 uppercase tracking-wider">High Risk Zones</div>
              <div className="text-[15px] font-bold text-red-400">{summary.high_risk_zones} Zones</div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-white/60 uppercase tracking-wider">Total Violations</div>
              <div className="text-[15px] font-bold text-amber-300">{summary.total_incidents} Events</div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-white/60 uppercase tracking-wider">Safety Index</div>
              <div className="text-[15px] font-bold text-emerald-400">{summary.safety_index}%</div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-white/60 uppercase tracking-wider">Active CCTV</div>
              <div className="text-[15px] font-bold text-blue-300">{summary.active_cameras} Streams</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Floor Map Canvas ── */}
      <div className="relative bg-[#060D1A] rounded-2xl border border-white/15 overflow-hidden flex items-center justify-center min-h-[340px]">
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)`,
            backgroundSize: '24px 24px',
          }}
        />

        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto max-h-[460px] select-none"
        >
          {/* Architectural perimeter and corridor guides */}
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

          {/* Plant Central Corridor */}
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

          {/* Zone Polygons */}
          {zones.map((z) => {
            const isSelected = selectedZone?.id === z.id;
            const points = toSvgPoints(z.coordinates);
            const center = getPolygonCenter(z.coordinates);

            return (
              <g
                key={z.id}
                onClick={() => onSelectZone(isSelected ? null : z)}
                className="cursor-pointer transition-all"
              >
                {/* Pulsing alert ring for high risk zones */}
                {z.pulse && (
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

                {/* Zone Polygon */}
                <polygon
                  points={points}
                  fill={z.color}
                  fillOpacity={isSelected ? 0.45 : 0.22}
                  stroke={isSelected ? '#FFFFFF' : z.color}
                  strokeWidth={isSelected ? 3 : 1.8}
                  className="transition-all duration-200 hover:fill-opacity-40"
                />

                {/* Camera Pin */}
                <circle cx={center.x - 45} cy={center.y - 18} r="8" fill="#0F172A" stroke="#38BDF8" strokeWidth="1.5" />
                <text
                  x={center.x - 45}
                  y={center.y - 15}
                  fill="#38BDF8"
                  fontSize="8"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  📷
                </text>

                {/* Zone Name Label */}
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

                {/* Risk Badge Pill */}
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

      {/* ── Selected Zone Inspector Card ── */}
      <AnimatePresence>
        {selectedZone && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="bg-white/10 border border-white/20 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-md"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
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
                Total Violations: <strong>{selectedZone.incident_count} events</strong> · Risk Score:{' '}
                <strong style={{ color: selectedZone.color }}>
                  {selectedZone.risk_score}/100 ({selectedZone.risk_level.toUpperCase()})
                </strong>
              </p>

              {/* Violation breakdowns */}
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
    </div>
  );
};

export default SpatialFloorHeatmap;
