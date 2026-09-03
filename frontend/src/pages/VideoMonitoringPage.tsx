import React, { useState, useEffect } from 'react';
import { StreamGrid } from '../components/safety/StreamGrid';
import { AlertFeed } from '../components/safety/AlertFeed';
import { ChartCardWrapper } from '../components/safety/ChartCardWrapper';
import { ChartCustomizationDrawer, type ChartDefinition } from '../components/safety/ChartCustomizationDrawer';

// Default chart library definition
const INITIAL_CHARTS: ChartDefinition[] = [
  {
    id: 'violation_trends',
    name: 'Violation Trends',
    category: 'Time-Series',
    description: 'Stacked daily violation breakdown by type over last 7 days',
    colSpan: 'xl:col-span-2',
    isVisible: true,
  },
  {
    id: 'severity_donut',
    name: 'Violation Status',
    category: 'Distribution',
    description: 'Proportional distribution of critical, warning, and normal severity alerts',
    colSpan: 'col-span-1',
    isVisible: true,
  },
  {
    id: 'hourly_activity',
    name: '24-Hour Activity',
    category: 'Histogram',
    description: 'Hourly alert volume breakdown across 24-hour cycle',
    colSpan: 'xl:col-span-2',
    isVisible: true,
  },
  {
    id: 'camera_wise',
    name: 'Camera-wise Violations',
    category: 'Per-Device',
    description: 'Severity breakdown per camera stream',
    colSpan: 'col-span-1',
    isVisible: true,
  },
  {
    id: 'site_heatmap',
    name: 'Site Risk Heatmap',
    category: 'Spatial Grid',
    description: 'AI-detected spatial activity across monitored plant zones',
    colSpan: 'md:col-span-2',
    isVisible: true,
  },
  {
    id: 'daily_trend',
    name: 'Daily Alert Trend',
    category: 'Bar Chart',
    description: 'Total detections per day over recent history',
    colSpan: 'col-span-1',
    isVisible: true,
  },
  {
    id: 'violation_ranking',
    name: 'Violation Type Ranking',
    category: 'Frequency',
    description: 'Frequency ranking of top detected violation classes',
    colSpan: 'col-span-1',
    isVisible: true,
  },
  {
    id: 'camera_risk',
    name: 'Camera Risk Score',
    category: 'Scoring',
    description: 'Weighted criticality risk score per camera unit',
    colSpan: 'col-span-1',
    isVisible: true,
  },
  {
    id: 'zone_ranking',
    name: 'Zone Risk Ranking',
    category: 'Zone Intelligence',
    description: 'Highest risk activity ranking by site zone',
    colSpan: 'col-span-1',
    isVisible: true,
  },
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

export const VideoMonitoringPage: React.FC = () => {
  // Collapsible Analytics Section State (Default Open)
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(true);

  // Drawer state for admin dashboard editing
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Live aggregated analytics state
  const [analyticsData, setAnalyticsData] = useState<any>({
    severityData: { critical: 23, warning: 26, normal: 10, total: 59 },
    violationTrends: [
      { day: 'Mon', hardhat: 12, restricted: 8, zoneB: 5, other: 3 },
      { day: 'Tue', hardhat: 7, restricted: 5, zoneB: 3, other: 2 },
      { day: 'Wed', hardhat: 18, restricted: 10, zoneB: 6, other: 3 },
      { day: 'Thu', hardhat: 10, restricted: 7, zoneB: 4, other: 2 },
      { day: 'Fri', hardhat: 5, restricted: 3, zoneB: 2, other: 1 },
      { day: 'Sat', hardhat: 19, restricted: 11, zoneB: 5, other: 2 },
      { day: 'Sun', hardhat: 9, restricted: 6, zoneB: 4, other: 2 },
    ],
    hourlyData: [1, 1, 0, 1, 2, 4, 7, 10, 13, 12, 9, 8, 11, 14, 18, 13, 11, 9, 8, 6, 4, 3, 2, 1],
    cameraWise: [
      { id: 'CAM-01', name: 'Zone A - Conveyor', critical: 8, warning: 11, normal: 4, status: 'LIVE' },
      { id: 'CAM-02', name: 'Zone B', critical: 6, warning: 9, normal: 3, status: 'LIVE' },
      { id: 'CAM-03', name: 'Entry Gate', critical: 5, warning: 4, normal: 2, status: 'LIVE' },
      { id: 'CAM-04', name: 'Packing Area', critical: 4, warning: 2, normal: 1, status: 'LIVE' },
    ],
    violationTypeTotals: [
      { name: 'No Hardhat', value: 42 },
      { name: 'Restricted Zone', value: 29 },
      { name: 'No PPE', value: 21 },
      { name: 'Zone B Entry', value: 15 },
      { name: 'Other', value: 9 },
    ],
  });

  // Chart configuration state initialized from localStorage
  const [charts, setCharts] = useState<ChartDefinition[]>(() => {
    try {
      const savedHidden = localStorage.getItem('mai_video_monitoring_charts_hidden');
      const savedOrder = localStorage.getItem('mai_video_monitoring_charts_order');

      let hiddenSet = new Set<string>();
      if (savedHidden) {
        hiddenSet = new Set(JSON.parse(savedHidden));
      }

      let chartList = INITIAL_CHARTS.map((c) => ({
        ...c,
        isVisible: !hiddenSet.has(c.id),
      }));

      if (savedOrder) {
        const orderArr: string[] = JSON.parse(savedOrder);
        chartList.sort((a, b) => {
          const idxA = orderArr.indexOf(a.id);
          const idxB = orderArr.indexOf(b.id);
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        });
      }
      return chartList;
    } catch {
      return INITIAL_CHARTS;
    }
  });

  // Drag and drop state
  const [draggedChartId, setDraggedChartId] = useState<string | null>(null);

  // Real-Time Delta Polling for Analytics (Every 4 seconds)
  useEffect(() => {
    let isMounted = true;
    const fetchLiveAnalytics = async () => {
      try {
        const res = await fetch('/api/video-monitoring/analytics');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data && data.severityData) {
            setAnalyticsData(data);
          }
        }
      } catch (e) {
        console.error('Delta polling analytics error:', e);
      }
    };

    fetchLiveAnalytics();
    const interval = setInterval(fetchLiveAnalytics, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Save layout state to localStorage
  const saveLayoutState = (updatedCharts: ChartDefinition[]) => {
    try {
      const hidden = updatedCharts.filter((c) => !c.isVisible).map((c) => c.id);
      const order = updatedCharts.map((c) => c.id);
      localStorage.setItem('mai_video_monitoring_charts_hidden', JSON.stringify(hidden));
      localStorage.setItem('mai_video_monitoring_charts_order', JSON.stringify(order));
    } catch (e) {
      console.error('Failed to save layout to localStorage:', e);
    }
  };

  const handleToggleChart = (id: string) => {
    const updated = charts.map((c) => (c.id === id ? { ...c, isVisible: !c.isVisible } : c));
    setCharts(updated);
    saveLayoutState(updated);
  };

  const handleRemoveChart = (id: string) => {
    handleToggleChart(id);
  };

  const handleResetLayout = () => {
    setCharts(INITIAL_CHARTS);
    try {
      localStorage.removeItem('mai_video_monitoring_charts_hidden');
      localStorage.removeItem('mai_video_monitoring_charts_order');
    } catch {
      /* ignore */
    }
  };

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    setDraggedChartId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    if (!draggedChartId || draggedChartId === targetId) return;

    const fromIdx = charts.findIndex((c) => c.id === draggedChartId);
    const toIdx = charts.findIndex((c) => c.id === targetId);

    if (fromIdx !== -1 && toIdx !== -1) {
      const newCharts = [...charts];
      const [moved] = newCharts.splice(fromIdx, 1);
      newCharts.splice(toIdx, 0, moved);

      setCharts(newCharts);
      saveLayoutState(newCharts);
    }
    setDraggedChartId(null);
  };

  // Calculated derived values
  const { severityData, violationTrends, hourlyData, cameraWise, violationTypeTotals } = analyticsData;
  const totalAlerts = severityData.critical + severityData.warning + severityData.normal || 1;
  const criticalPct = Math.round((severityData.critical / totalAlerts) * 100);
  const warningPct = Math.round((severityData.warning / totalAlerts) * 100);
  const normalPct = Math.max(0, 100 - criticalPct - warningPct);

  const dailyTotals = violationTrends.map((d: any) => ({
    day: d.day,
    total: d.hardhat + d.restricted + d.zoneB + d.other,
  }));

  const cameraRisk = cameraWise
    .map((cam: any) => ({
      ...cam,
      total: cam.critical + cam.warning + cam.normal,
      risk: cam.critical * 3 + cam.warning * 2 + cam.normal,
    }))
    .sort((a: any, b: any) => b.risk - a.risk);

  const zoneRanking = [...heatmapZones].sort((a, b) => b.intensity - a.intensity);
  const maxDaily = Math.max(...dailyTotals.map((d: any) => d.total)) || 1;
  const maxViolation = Math.max(...violationTypeTotals.map((d: any) => d.value)) || 1;
  const maxRisk = Math.max(...cameraRisk.map((d: any) => d.risk)) || 1;
  const maxHourly = Math.max(...hourlyData) || 1;

  // Chart rendering map
  const renderChartById = (chartId: string) => {
    switch (chartId) {
      case 'violation_trends':
        return (
          <div className="h-48 flex items-end gap-2 pt-2">
            {violationTrends.map((d: any, i: number) => {
              const total = d.hardhat + d.restricted + d.zoneB + d.other;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-[9px] text-slate-500 font-mono">{total}</span>
                  <div
                    className="w-full max-w-[52px] rounded-t-lg overflow-hidden flex flex-col-reverse bg-slate-800 hover:scale-[1.03] transition-transform cursor-pointer"
                    style={{ height: `${Math.min(100, (total / 40) * 100)}%` }}
                  >
                    <div className="bg-red-500" style={{ height: total ? `${(d.hardhat / total) * 100}%` : '0%' }} />
                    <div className="bg-amber-500" style={{ height: total ? `${(d.restricted / total) * 100}%` : '0%' }} />
                    <div className="bg-orange-400" style={{ height: total ? `${(d.zoneB / total) * 100}%` : '0%' }} />
                    <div className="bg-slate-500" style={{ height: total ? `${(d.other / total) * 100}%` : '0%' }} />
                  </div>
                  <span className="text-[10px] text-slate-500 font-semibold">{d.day}</span>
                </div>
              );
            })}
          </div>
        );

      case 'severity_donut':
        return (
          <div className="flex flex-col items-center">
            <div className="flex justify-center py-3">
              <div className="relative w-36 h-36">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e293b" strokeWidth="3.5" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#ef4444" strokeWidth="3.5" strokeDasharray={`${criticalPct} 100`} />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f59e0b" strokeWidth="3.5" strokeDasharray={`${warningPct} 100`} strokeDashoffset={-criticalPct} />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#10b981" strokeWidth="3.5" strokeDasharray={`${normalPct} 100`} strokeDashoffset={-(criticalPct + warningPct)} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-white">{totalAlerts}</span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">TOTAL</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 w-full pt-2 border-t border-slate-800/80">
              <div className="text-center">
                <div className="text-sm font-bold text-red-400">{criticalPct}%</div>
                <div className="text-[10px] text-slate-500 font-semibold">Critical</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-amber-400">{warningPct}%</div>
                <div className="text-[10px] text-slate-500 font-semibold">Warning</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-emerald-400">{normalPct}%</div>
                <div className="text-[10px] text-slate-500 font-semibold">Normal</div>
              </div>
            </div>
          </div>
        );

      case 'hourly_activity':
        return (
          <div>
            <div className="h-44 flex items-end gap-1 pt-2">
              {hourlyData.map((value: number, i: number) => (
                <div key={i} className="flex-1 h-full flex items-end group cursor-pointer">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-emerald-700 to-cyan-400 opacity-80 group-hover:opacity-100 transition-all duration-200"
                    style={{ height: `${(value / maxHourly) * 100}%` }}
                    title={`${i}:00 → ${value} alerts`}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-3 px-1">
              <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
            </div>
          </div>
        );

      case 'camera_wise':
        return (
          <div className="space-y-3.5 pt-1">
            {cameraWise.map((cam: any) => {
              const total = cam.critical + cam.warning + cam.normal || 1;
              return (
                <div key={cam.id}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-slate-300 font-medium">{cam.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{total} alerts</span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden bg-slate-800 flex">
                    <div className="bg-red-500" style={{ width: `${(cam.critical / total) * 100}%` }} />
                    <div className="bg-amber-500" style={{ width: `${(cam.warning / total) * 100}%` }} />
                    <div className="bg-emerald-500" style={{ width: `${(cam.normal / total) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        );

      case 'site_heatmap':
        return (
          <div>
            <div className="relative w-full h-60 rounded-xl overflow-hidden border border-slate-800 bg-blue-950">
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

              {heatmapLabels.map((camera) => (
                <div
                  key={camera.name}
                  className={`absolute ${camera.position} px-2 py-1 rounded-md bg-slate-950/80 border border-white/10 backdrop-blur-sm shadow-md`}
                >
                  <div className="text-[9px] text-white font-bold">{camera.name}</div>
                  <div className="text-[8px] text-slate-400">{camera.zone}</div>
                </div>
              ))}

              <div className="absolute left-[22%] top-[35%] w-10 h-10 rounded-full bg-red-500/70 blur-md animate-pulse" />
              <div className="absolute right-[15%] top-[42%] w-12 h-12 rounded-full bg-red-600/80 blur-md animate-pulse" />
            </div>

            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-3">
              {heatmapZones.map((zone) => (
                <div key={zone.zone} className="rounded-lg bg-slate-800/60 border border-slate-700 px-2 py-1.5">
                  <div className="text-[9px] text-slate-400">{zone.zone}</div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-xs font-bold text-slate-200">{zone.alerts}</span>
                    <span className="text-[9px] font-semibold text-amber-400">{zone.intensity}/10</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'daily_trend':
        return (
          <div className="h-44 flex items-end gap-2 pt-2">
            {dailyTotals.map((item: any) => (
              <div key={item.day} className="flex-1 flex flex-col items-center justify-end gap-2">
                <span className="text-[9px] text-slate-500 font-mono">{item.total}</span>
                <div
                  className="w-full max-w-[42px] rounded-t-xl bg-gradient-to-t from-blue-700 to-cyan-400 hover:from-blue-500 hover:to-cyan-300 transition-all cursor-pointer"
                  style={{ height: `${(item.total / maxDaily) * 100}%` }}
                />
                <span className="text-[10px] text-slate-500 font-semibold">{item.day}</span>
              </div>
            ))}
          </div>
        );

      case 'violation_ranking':
        return (
          <div className="space-y-4 pt-1">
            {violationTypeTotals.map((item: any, index: number) => (
              <div key={item.name}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-300">
                    <span className="text-slate-600 mr-1.5 font-bold">#{index + 1}</span>
                    {item.name}
                  </span>
                  <span className="text-xs font-bold text-slate-100 font-mono">{item.value}</span>
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
        );

      case 'camera_risk':
        return (
          <div className="space-y-4 pt-1">
            {cameraRisk.map((cam: any, index: number) => (
              <div key={cam.id}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-300">
                    <span className="text-slate-600 mr-1.5 font-bold">#{index + 1}</span>
                    {cam.name}
                  </span>
                  <span className="text-xs font-bold text-red-400 font-mono">{cam.risk}</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-red-700 via-orange-500 to-yellow-400"
                    style={{ width: `${(cam.risk / maxRisk) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        );

      case 'zone_ranking':
        return (
          <div className="space-y-2.5 pt-1">
            {zoneRanking.map((zone, index) => (
              <div key={zone.zone} className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-800/40 border border-slate-800">
                <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-slate-300 font-medium">{zone.zone}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{zone.intensity}/10</span>
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
        );

      default:
        return null;
    }
  };

  const visibleCharts = charts.filter((c) => c.isVisible);

  return (
    <div className="p-4 md:p-6 h-full flex flex-col gap-6 overflow-y-auto text-slate-950">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-3">
            Video Monitoring Engine
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              LIVE TELEMETRY
            </span>
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Real-time Computer Vision streams, PostgreSQL <code className="text-bold text-cyan-400">Video analytics Application</code> analytics & incident evidence
          </p>
        </div>
      </div>

      {/* Main Content Split: Stream Grid & Alert Feed */}
      <div className="flex flex-col lg:flex-row gap-2 min-h-[50px]">
        {/* Left: Camera Stream Grid */}
        <div className="flex-[3] flex flex-col gap-2 min-h-0">
          <StreamGrid />
        </div>

        {/* Right: Vertical Alert Feed */}
        <div className="flex-[1] min-w-[300px] max-w-[380px] flex flex-col">
          <AlertFeed />
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. COLLAPSIBLE ANALYTICS SECTION & LAYOUT CONTROL            */}
      {/* ============================================================ */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
        {/* Accordion Header */}
        <div className="flex items-center justify-between p-4 px-6 bg-slate-900 border-b border-slate-800/80">
          <div
            className="flex items-center gap-3 cursor-pointer select-none"
            onClick={() => setIsAnalyticsOpen((prev) => !prev)}
          >
            <div className="p-2 rounded-xl bg-slate-800 text-cyan-400">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="3" width="7" height="9" rx="1" />
                <rect x="14" y="3" width="7" height="5" rx="1" />
                <rect x="14" y="12" width="7" height="9" rx="1" />
                <rect x="3" y="16" width="7" height="5" rx="1" />
              </svg>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">Real-Time Safety Analytics</h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800">
                  ZERO REFRESH
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Live aggregations from PostgreSQL <code className="text-slate-300">construction_ai</code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Edit Dashboard / + Add Charts Button */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Edit Dashboard / + Add Charts
            </button>

            {/* Accordion Collapse / Expand Toggle Button */}
            <button
              onClick={() => setIsAnalyticsOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-all cursor-pointer"
            >
              <span>{isAnalyticsOpen ? 'Collapse' : 'Expand'}</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className={`transition-transform duration-200 ${isAnalyticsOpen ? 'rotate-180' : ''}`}
              >
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Accordion Content Block */}
        {isAnalyticsOpen && (
          <div className="p-2 space-y-6 animate-fadeIn">
            {/* AIP Metrics Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Detections</div>
                <div className="text-2xl font-extrabold text-slate-100 mt-1">{severityData.total}</div>
                <div className="text-[10px] text-cyan-400/80 mt-1 font-mono">Live Delta Polled</div>
              </div>
              <div className="rounded-2xl border border-red-900/40 bg-slate-900 p-4 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-red-400/80">Critical</div>
                <div className="text-2xl font-extrabold text-red-400 mt-1">{severityData.critical}</div>
                <div className="text-[10px] text-red-400/60 mt-1 font-mono">{criticalPct}% of total</div>
              </div>
              <div className="rounded-2xl border border-amber-900/40 bg-slate-900 p-4 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400/80">Warning</div>
                <div className="text-2xl font-extrabold text-amber-400 mt-1">{severityData.warning}</div>
                <div className="text-[10px] text-amber-400/60 mt-1 font-mono">{warningPct}% of total</div>
              </div>
              <div className="rounded-2xl border border-emerald-900/40 bg-slate-900 p-4 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/80 font-mono">Normal</div>
                <div className="text-2xl font-extrabold text-emerald-400 mt-1">{severityData.normal}</div>
                <div className="text-[10px] text-emerald-400/60 mt-1 font-mono">{normalPct}% of total</div>
              </div>
              <div className="rounded-2xl border border-blue-900/40 bg-slate-900 p-4 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-400/80">Peak Hour</div>
                <div className="text-2xl font-extrabold text-blue-400 mt-1">{hourlyData.indexOf(maxHourly)}:00</div>
                <div className="text-[10px] text-blue-400/60 mt-1 font-mono">{maxHourly} events</div>
              </div>
              <div className="rounded-2xl border border-violet-900/40 bg-slate-900 p-4 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-violet-400/80">High Risk Zone</div>
                <div className="text-base font-extrabold text-violet-400 mt-2 truncate">{zoneRanking[0]?.zone || 'Zone A'}</div>
                <div className="text-[10px] text-violet-400/60 mt-1 font-mono">Score {zoneRanking[0]?.intensity || 9}/10</div>
              </div>
            </div>

            {/* Reorderable Analytics Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {visibleCharts.map((chart) => (
                <ChartCardWrapper
                  key={chart.id}
                  id={chart.id}
                  title={chart.name}
                  subtitle={chart.description}
                  badgeText={chart.category}
                  colSpan={chart.colSpan}
                  onRemove={() => handleRemoveChart(chart.id)}
                  onDragStart={(e) => handleDragStart(e, chart.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, chart.id)}
                >
                  {renderChartById(chart.id)}
                </ChartCardWrapper>
              ))}
            </div>

            {visibleCharts.length === 0 && (
              <div className="py-12 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800">
                <p className="text-sm font-semibold">All analytics charts are currently hidden.</p>
                <button
                  onClick={() => setIsDrawerOpen(true)}
                  className="mt-3 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold rounded-xl border border-slate-700 cursor-pointer"
                >
                  Open Chart Library to Add Widgets
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Admin Chart Customization Drawer */}
      <ChartCustomizationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        charts={charts}
        onToggleChart={handleToggleChart}
        onResetLayout={handleResetLayout}
      />
    </div>
  );
};