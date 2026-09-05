export type StandardChartMetadata = {
  chart_id: string;
  chart_name: string;
  chart_type: string;
  source_table: string;
  timestamp: string;
  metrics: Record<string, unknown>;
  contextual_info: {
    camera_id: string;
    detection_engine: string;
    timezone: string;
  };
};

export type ChartMetadataInput = {
  chartId: string;
  chartName: string;
  chartType: string;
  sourceTable?: string;
  timestamp?: string;
  data?: Record<string, any>;
  cameraId?: string;
  detectionEngine?: string;
  timezone?: string;
};

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toSafeArray = <T = any>(value: unknown): T[] => (Array.isArray(value) ? value : []);

export const formatChartMetadata = ({
  chartId,
  chartName,
  chartType,
  sourceTable = 'realtime_safety_logs',
  timestamp = new Date().toISOString(),
  data = {},
  cameraId = 'CAM_BASAI_03',
  detectionEngine = 'Realtime_Safety_V2',
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
}: ChartMetadataInput): StandardChartMetadata => {
  const normalizedType = (chartType || 'generic').toLowerCase();
  const severityData = data.severityData ?? {};
  const critical = toNumber(severityData.critical, 0);
  const warning = toNumber(severityData.warning, 0);
  const normal = toNumber(severityData.normal, 0);
  const total = critical + warning + normal || 1;

  switch (normalizedType) {
    case 'donut':
      return {
        chart_id: chartId,
        chart_name: chartName,
        chart_type: 'donut',
        source_table: sourceTable,
        timestamp,
        metrics: {
          total_amount: total,
          breakdown: {
            critical: { percentage: Math.round((critical / total) * 100), count: critical },
            warnings: { percentage: Math.round((warning / total) * 100), count: warning },
            normal: { percentage: Math.round((normal / total) * 100), count: normal },
          },
        },
        contextual_info: {
          camera_id: cameraId,
          detection_engine: detectionEngine,
          timezone,
        },
      };

    case 'histogram':
      return {
        chart_id: chartId,
        chart_name: chartName,
        chart_type: 'histogram',
        source_table: sourceTable,
        timestamp,
        metrics: {
          total_amount: toSafeArray<number>(data.hourlyData).reduce((sum, value) => sum + toNumber(value, 0), 0),
          bins: toSafeArray(data.hourlyData).map((value, index) => ({
            bucket: `${String(index).padStart(2, '0')}:00`,
            count: toNumber(value, 0),
          })),
        },
        contextual_info: {
          camera_id: cameraId,
          detection_engine: detectionEngine,
          timezone,
        },
      };

    case 'heatmap':
      return {
        chart_id: chartId,
        chart_name: chartName,
        chart_type: 'heatmap',
        source_table: sourceTable,
        timestamp,
        metrics: {
          total_amount: toSafeArray(data.heatmapZones).reduce((sum, zone: any) => sum + toNumber(zone?.alerts, 0), 0),
          hotspots: toSafeArray(data.heatmapZones).map((zone: any) => ({
            zone: zone?.zone || 'Unknown Zone',
            intensity: toNumber(zone?.intensity, 0),
            alerts: toNumber(zone?.alerts, 0),
          })),
        },
        contextual_info: {
          camera_id: cameraId,
          detection_engine: detectionEngine,
          timezone,
        },
      };

    case 'line':
    case 'bar':
    case 'stacked_bar':
      return {
        chart_id: chartId,
        chart_name: chartName,
        chart_type: normalizedType === 'stacked_bar' ? 'stacked_bar' : normalizedType,
        source_table: sourceTable,
        timestamp,
        metrics: {
          total_amount: toSafeArray(data.violationTrends).reduce((sum, item: any) => sum + toNumber(item?.hardhat, 0) + toNumber(item?.restricted, 0) + toNumber(item?.zoneB, 0) + toNumber(item?.other, 0), 0),
          series: toSafeArray(data.violationTrends).map((item: any) => ({
            period: item?.day || 'Unknown',
            hardhat: toNumber(item?.hardhat, 0),
            restricted: toNumber(item?.restricted, 0),
            zoneB: toNumber(item?.zoneB, 0),
            other: toNumber(item?.other, 0),
          })),
        },
        contextual_info: {
          camera_id: cameraId,
          detection_engine: detectionEngine,
          timezone,
        },
      };

    default:
      return {
        chart_id: chartId,
        chart_name: chartName,
        chart_type: normalizedType,
        source_table: sourceTable,
        timestamp,
        metrics: {
          total_amount: toSafeArray(data.violationTypeTotals).reduce((sum, item: any) => sum + toNumber(item?.value, 0), 0),
          values: toSafeArray(data.violationTypeTotals).map((item: any) => ({
            label: item?.name || 'Unknown',
            value: toNumber(item?.value, 0),
          })),
        },
        contextual_info: {
          camera_id: cameraId,
          detection_engine: detectionEngine,
          timezone,
        },
      };
  }
};
