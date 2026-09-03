import React from 'react';
import { StreamGrid } from '../components/safety/StreamGrid';
import { AlertFeed } from '../components/safety/AlertFeed';

// ============================================================
// SAMPLE / STATIC DATA
// Replace later with real API data
// ============================================================
const violationTrends = [
  { day: 'Mon', hardhat: 12, restricted: 8, zoneB: 5, other: 3 },
  { day: 'Tue', hardhat: 7, restricted: 5, zoneB: 3, other: 2 },
  { day: 'Wed', hardhat: 18, restricted: 10, zoneB: 6, other: 3 },
  { day: 'Thu', hardhat: 10, restricted: 7, zoneB: 4, other: 2 },
  { day: 'Fri', hardhat: 5, restricted: 3, zoneB: 2, other: 1 },
  { day: 'Sat', hardhat: 19, restricted: 11, zoneB: 5, other: 2 },
  { day: 'Sun', hardhat: 9, restricted: 6, zoneB: 4, other: 2 },
];

const severityData = {
  critical: 23,
  warning: 26,
  normal: 10,
};

const hourlyData = [
  1, 1, 0, 1, 2, 4, 7, 10, 13, 12, 9, 8,
  11, 14, 18, 13, 11, 9, 8, 6, 4, 3, 2, 1,
];

const cameraWise = [
  { id: 'CAM-01', name: 'Zone A - Conveyor', critical: 8, warning: 11, normal: 4, status: 'LIVE' },
  { id: 'CAM-02', name: 'Zone B', critical: 6, warning: 9, normal: 3, status: 'LIVE' },
  { id: 'CAM-03', name: 'Entry Gate', critical: 5, warning: 4, normal: 2, status: 'LIVE' },
  { id: 'CAM-04', name: 'Packing Area', critical: 4, warning: 2, normal: 1, status: 'LIVE' },
];

const heatmapGrid = [
  [0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0],
  [0, 1, 2, 3, 2, 1, 0, 0, 1, 2, 1, 0],
  [0, 2, 4, 4, 3, 2, 1, 0, 1, 3, 2, 0],
  [1, 3, 4, 3, 2, 1, 1, 0, 2, 4, 3, 1],
  [1, 2, 3, 2, 1, 1, 0, 1, 3, 4, 3, 1],
  [0, 1, 2, 1, 0, 0, 1, 2, 3, 3, 2, 0],
  [0, 0, 1, 0, 0, 1, 2, 3, 2, 1, 1, 0],
  [0, 1, 1, 0, 0, 1, 1, 2, 1, 1, 0, 0],
];

const heatmapLabels = [
  { name: 'CAM-01', zone: 'Zone A', position: 'left-8 top-5' },
  { name: 'CAM-02', zone: 'Zone B', position: 'right-8 top-5' },
  { name: 'CAM-03', zone: 'Entry', position: 'left-8 bottom-5' },
  { name: 'CAM-04', zone: 'Packing', position: 'right-8 bottom-5' },
];

const heatmapZones = [
  { zone: 'Zone A', intensity: 9, alerts: 18 },
  { zone: 'Zone B', intensity: 7, alerts: 13 },
  { zone: 'Conveyor', intensity: 8, alerts: 16 },
  { zone: 'Entry', intensity: 5, alerts: 9 },
  { zone: 'Packing', intensity: 4, alerts: 7 },
  { zone: 'Storage', intensity: 2, alerts: 3 },
];

const dailyAlertTrend = [
  { day: 'Mon', alerts: 28 },
  { day: 'Tue', alerts: 17 },
  { day: 'Wed', alerts: 37 },
  { day: 'Thu', alerts: 23 },
  { day: 'Fri', alerts: 11 },
  { day: 'Sat', alerts: 37 },
  { day: 'Sun', alerts: 21 },
];

const violationTypeTotals = [
  { name: 'No Hardhat', value: 42 },
  { name: 'Restricted Zone', value: 29 },
  { name: 'No PPE', value: 21 },
  { name: 'Zone B Entry', value: 15 },
  { name: 'Other', value: 9 },
];

// ============================================================
// SAMPLE CHARTS COMPONENT
// ============================================================
const SampleCharts = () => {
  const totalAlerts = severityData.critical + severityData.warning + severityData.normal;
  const criticalPct = Math.round((severityData.critical / totalAlerts) * 100);
  const warningPct = Math.round((severityData.warning / totalAlerts) * 100);
  const normalPct = 100 - criticalPct - warningPct;

  const dailyTotals = violationTrends.map((d) => ({
    day: d.day,
    total: d.hardhat + d.restricted + d.zoneB + d.other,
  }));

  const cameraRisk = cameraWise
    .map((cam) => ({
      ...cam,
      total: cam.critical + cam.warning + cam.normal,
      risk: cam.critical * 3 + cam.warning * 2 + cam.normal,
    }))
    .sort((a, b) => b.risk - a.risk);

  const zoneRanking = [...heatmapZones].sort((a, b) => b.intensity - a.intensity);
  const maxDaily = Math.max(...dailyTotals.map((d) => d.total)) || 1;
  const maxViolation = Math.max(...violationTypeTotals.map((d) => d.value)) || 1;
  const maxRisk = Math.max(...cameraRisk.map((d) => d.risk)) || 1;
  const maxHourly = Math.max(...hourlyData) || 1;

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Total Alerts</div>
          <div className="text-2xl font-bold text-slate-100 mt-1">{totalAlerts}</div>
          <div className="text-[10px] text-slate-500 mt-1">Last 7 days</div>
        </div>
        <div className="rounded-2xl border border-red-900/40 bg-slate-900 p-4">
          <div className="text-[10px] uppercase tracking-wider text-red-400/70">Critical</div>
          <div className="text-2xl font-bold text-red-400 mt-1">{severityData.critical}</div>
          <div className="text-[10px] text-red-400/60 mt-1">{criticalPct}% of alerts</div>
        </div>
        <div className="rounded-2xl border border-amber-900/40 bg-slate-900 p-4">
          <div className="text-[10px] uppercase tracking-wider text-amber-400/70">Warning</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">{severityData.warning}</div>
          <div className="text-[10px] text-amber-400/60 mt-1">{warningPct}% of alerts</div>
        </div>
        <div className="rounded-2xl border border-emerald-900/40 bg-slate-900 p-4">
          <div className="text-[10px] uppercase tracking-wider text-emerald-400/70">Normal</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{severityData.normal}</div>
          <div className="text-[10px] text-emerald-400/60 mt-1">{normalPct}% of alerts</div>
        </div>
        <div className="rounded-2xl border border-blue-900/40 bg-slate-900 p-4">
          <div className="text-[10px] uppercase tracking-wider text-blue-400/70">Peak Hour</div>
          <div className="text-2xl font-bold text-blue-400 mt-1">{hourlyData.indexOf(maxHourly)}:00</div>
          <div className="text-[10px] text-blue-400/60 mt-1">{maxHourly} alerts</div>
        </div>
        <div className="rounded-2xl border border-violet-900/40 bg-slate-900 p-4">
          <div className="text-[10px] uppercase tracking-wider text-violet-400/70">High Risk Zone</div>
          <div className="text-lg font-bold text-violet-400 mt-2">{zoneRanking[0].zone}</div>
          <div className="text-[10px] text-violet-400/60 mt-1">Risk score {zoneRanking[0].intensity}/10</div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

        {/* 1. Violation Trends */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 xl:col-span-2">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Violation Trends</h3>
              <p className="text-[11px] text-slate-500 mt-1">Daily breakdown by violation type</p>
            </div>
            <span className="text-[10px] px-2 py-1 rounded-lg bg-slate-800 text-slate-400">7 DAYS</span>
          </div>
          <div className="h-48 flex items-end gap-2">
            {violationTrends.map((d, i) => {
              const total = d.hardhat + d.restricted + d.zoneB + d.other;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-[9px] text-slate-500">{total}</span>
                  <div
                    className="w-full max-w-[52px] rounded-t-lg overflow-hidden flex flex-col-reverse bg-slate-800 hover:scale-[1.03] transition-transform"
                    style={{ height: `${(total / 40) * 100}%` }}
                  >
                    <div className="bg-red-500" style={{ height: total ? `${(d.hardhat / total) * 100}%` : '0%' }} />
                    <div className="bg-amber-500" style={{ height: total ? `${(d.restricted / total) * 100}%` : '0%' }} />
                    <div className="bg-orange-400" style={{ height: total ? `${(d.zoneB / total) * 100}%` : '0%' }} />
                    <div className="bg-slate-500" style={{ height: total ? `${(d.other / total) * 100}%` : '0%' }} />
                  </div>
                  <span className="text-[10px] text-slate-500">{d.day}</span>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-4 mt-5 text-[10px] text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> Hardhat</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Restricted</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-orange-400" /> Zone B</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-500" /> Other</span>
          </div>
        </div>

        {/* 2. Severity Donut */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-slate-200">Violation Status</h3>
          <p className="text-[11px] text-slate-500 mt-1">Severity distribution</p>
          <div className="flex justify-center py-5">
            <div className="relative w-36 h-36">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e293b" strokeWidth="3.5" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#ef4444" strokeWidth="3.5" strokeDasharray={`${criticalPct} 100`} />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f59e0b" strokeWidth="3.5" strokeDasharray={`${warningPct} 100`} strokeDashoffset={-criticalPct} />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#10b981" strokeWidth="3.5" strokeDasharray={`${normalPct} 100`} strokeDashoffset={-(criticalPct + warningPct)} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-white">{totalAlerts}</span>
                <span className="text-[10px] text-slate-500">TOTAL</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className="text-sm font-bold text-red-400">{criticalPct}%</div>
              <div className="text-[10px] text-slate-500">Critical</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-amber-400">{warningPct}%</div>
              <div className="text-[10px] text-slate-500">Warning</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-emerald-400">{normalPct}%</div>
              <div className="text-[10px] text-slate-500">Normal</div>
            </div>
          </div>
        </div>

        {/* 3. 24-Hour Activity */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 xl:col-span-2">
          <h3 className="text-sm font-semibold text-slate-200">24-Hour Activity</h3>
          <p className="text-[11px] text-slate-500 mt-1 mb-4">Alert activity throughout the day</p>
          <div className="h-44 flex items-end gap-1">
            {hourlyData.map((value, i) => (
              <div key={i} className="flex-1 h-full flex items-end group">
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-emerald-700 to-cyan-400 opacity-80 group-hover:opacity-100 transition-all duration-200"
                  style={{ height: `${(value / maxHourly) * 100}%` }}
                  title={`${i}:00 → ${value} alerts`}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[9px] text-slate-600 mt-2">
            <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
          </div>
        </div>

        {/* 4. Camera-wise */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-slate-200">Camera-wise Violations</h3>
          <p className="text-[11px] text-slate-500 mt-1 mb-4">Severity by camera</p>
          <div className="space-y-4">
            {cameraWise.map((cam) => {
              const total = cam.critical + cam.warning + cam.normal;
              return (
                <div key={cam.id}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-xs text-slate-300">{cam.name}</span>
                    <span className="text-[10px] text-slate-500">{total} alerts</span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden bg-slate-800 flex">
                    <div className="bg-red-500" style={{ width: `${(cam.critical / total) * 100}%` }} />
                    <div className="bg-amber-500" style={{ width: `${(cam.warning / total) * 100}%` }} />
                    <div className="bg-emerald-500" style={{ width: `${(cam.normal / total) * 100}%` }} />
                  </div>
                  <div className="flex justify-between mt-1 text-[9px]">
                    <span className="text-red-400">C {cam.critical}</span>
                    <span className="text-amber-400">W {cam.warning}</span>
                    <span className="text-emerald-400">N {cam.normal}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 5. SITE RISK HEATMAP (Screenshot style) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:col-span-2">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Site Risk Heatmap</h3>
              <p className="text-[11px] text-slate-500 mt-1">AI detected activity across monitored zones</p>
            </div>
            <div className="text-[10px] text-slate-500">LIVE</div>
          </div>

          <div className="relative w-full h-64 rounded-xl overflow-hidden border border-slate-700 bg-blue-950">
            {/* Grid */}
            <div className="absolute inset-0 grid grid-cols-12 grid-rows-8">
              {heatmapGrid.flatMap((row, rowIndex) =>
                row.map((value, colIndex) => {
                  let bg = 'bg-blue-900';
                  if (value === 1) bg = 'bg-cyan-700/50';
                  if (value === 2) bg = 'bg-yellow-500/50';
                  if (value === 3) bg = 'bg-orange-500/70';
                  if (value === 4) bg = 'bg-red-600/90';
                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={`${bg} border border-blue-900/30 transition-all duration-300 hover:brightness-125`}
                    />
                  );
                })
              )}
            </div>

            {/* Soft overlay */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-blue-950/20 via-transparent to-black/20" />

            {/* Camera labels */}
            {heatmapLabels.map((camera) => (
              <div
                key={camera.name}
                className={`absolute ${camera.position} px-2 py-1 rounded-md bg-slate-950/70 border border-white/10 backdrop-blur-sm`}
              >
                <div className="text-[9px] text-white font-semibold">{camera.name}</div>
                <div className="text-[8px] text-slate-400">{camera.zone}</div>
              </div>
            ))}

            {/* Hotspot indicators */}
            <div className="absolute left-[22%] top-[35%] w-12 h-12 rounded-full bg-red-500/70 blur-md animate-pulse" />
            <div className="absolute left-[29%] top-[40%] w-5 h-5 rounded-full bg-yellow-300 blur-sm" />
            <div className="absolute right-[15%] top-[42%] w-14 h-14 rounded-full bg-red-600/80 blur-md animate-pulse" />
            <div className="absolute right-[20%] top-[48%] w-6 h-6 rounded-full bg-yellow-300 blur-sm" />

            {/* Legend */}
            <div className="absolute right-3 bottom-3 flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-950/80 border border-white/10">
              <span className="text-[8px] text-slate-400">Risk</span>
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span className="w-2 h-2 rounded-full bg-yellow-400" />
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="w-2 h-2 rounded-full bg-red-500" />
            </div>
          </div>

          {/* Zone summary */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-3">
            {heatmapZones.map((zone) => (
              <div key={zone.zone} className="rounded-lg bg-slate-800/60 border border-slate-700 px-2 py-2">
                <div className="text-[9px] text-slate-500">{zone.zone}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm font-bold text-slate-200">{zone.alerts}</span>
                  <span
                    className={`text-[9px] font-semibold ${
                      zone.intensity >= 8
                        ? 'text-red-400'
                        : zone.intensity >= 6
                        ? 'text-orange-400'
                        : zone.intensity >= 4
                        ? 'text-yellow-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {zone.intensity}/10
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 6. Daily Alert Trend */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-slate-200">Daily Alert Trend</h3>
          <p className="text-[11px] text-slate-500 mt-1 mb-4">Total detections per day</p>
          <div className="h-44 flex items-end gap-2">
            {dailyTotals.map((item) => (
              <div key={item.day} className="flex-1 flex flex-col items-center justify-end gap-2">
                <span className="text-[9px] text-slate-500">{item.total}</span>
                <div
                  className="w-full max-w-[42px] rounded-t-xl bg-gradient-to-t from-blue-700 to-cyan-400 hover:from-blue-500 hover:to-cyan-300 transition-all"
                  style={{ height: `${(item.total / maxDaily) * 100}%` }}
                />
                <span className="text-[10px] text-slate-500">{item.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 7. Violation Type Ranking */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-slate-200">Violation Type Ranking</h3>
          <p className="text-[11px] text-slate-500 mt-1 mb-5">Most frequently detected violations</p>
          <div className="space-y-5">
            {violationTypeTotals.map((item, index) => (
              <div key={item.name}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-slate-300">
                    <span className="text-slate-600 mr-2">#{index + 1}</span>
                    {item.name}
                  </span>
                  <span className="text-xs font-semibold text-slate-100">{item.value}</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-400"
                    style={{ width: `${(item.value / maxViolation) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 8. Camera Risk Score */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-slate-200">Camera Risk Score</h3>
          <p className="text-[11px] text-slate-500 mt-1 mb-5">Weighted criticality score</p>
          <div className="space-y-5">
            {cameraRisk.map((cam, index) => (
              <div key={cam.id}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-slate-300">
                    <span className="text-slate-600 mr-2">#{index + 1}</span>
                    {cam.name}
                  </span>
                  <span className="text-xs font-bold text-red-400">{cam.risk}</span>
                </div>
                <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-red-700 via-orange-500 to-yellow-400"
                    style={{ width: `${(cam.risk / maxRisk) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 9. Zone Risk Ranking */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-slate-200">Zone Risk Ranking</h3>
          <p className="text-[11px] text-slate-500 mt-1 mb-5">Highest activity areas</p>
          <div className="space-y-3">
            {zoneRanking.map((zone, index) => (
              <div
                key={zone.zone}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/40 border border-slate-800"
              >
                <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-slate-300">{zone.zone}</span>
                    <span className="text-[10px] text-slate-400">{zone.intensity}/10</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500"
                      style={{ width: `${zone.intensity * 10}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// MAIN PAGE
// ============================================================
export const VideoMonitoringPage: React.FC = () => {
  return (
    <div className="p-4 md:p-6 h-full flex flex-col gap-5 overflow-hidden">
      {/* Top header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold ">Video Monitoring</h1>
          
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-5">
        {/* Left side - Cameras */}
        <div className="flex-[3] flex flex-col gap-5 min-h-0 overflow-y-auto">
          <StreamGrid />
        </div>

        {/* Right side - Vertical Alert Feed */}
        <div className="flex-[1] min-w-[280px] max-w-[360px] flex flex-col">
          <AlertFeed />
        </div>
      </div>

      {/* Charts Section */}
      <div className="shrink-0">
        <SampleCharts />
      </div>

      {/* Evidence Log */}
      <div className="shrink-0">
        <h2 className="text-lg font-bold text-slate-100 mb-3">Snapshot & Visual Evidence Log</h2>
      </div>
    </div>
  );
};