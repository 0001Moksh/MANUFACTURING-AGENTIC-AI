import { api } from './api';

export type SpatialCoordinate = {
  x: number;
  y: number;
};

export type HeatmapZone = {
  id: number;
  name: string;
  sector: string;
  camera_id: number;
  camera_name: string;
  coordinates: SpatialCoordinate[];
  incident_count: number;
  risk_score: number;
  risk_level: 'high' | 'moderate' | 'safe';
  color: string;
  pulse: boolean;
  violations_breakdown: Record<string, number>;
  status: string;
};

export type HeatmapSummary = {
  total_zones: number;
  high_risk_zones: number;
  total_incidents: number;
  active_cameras: number;
  safety_index: number;
};

export type SpatialHeatmapResponse = {
  status: 'success';
  time_filter: 'TODAY' | '7_DAYS' | '30_DAYS';
  summary: HeatmapSummary;
  zones: HeatmapZone[];
};

export type SafetySiteIntelligenceResponse = {
  status: 'success';
  thread_id: string;
  reply: string;
};

export const safetySiteIntelligenceService = {
  chat: async (
    message: string,
    threadId?: string,
    uiContext?: Record<string, any>
  ): Promise<SafetySiteIntelligenceResponse> => {
    const res = await api.post<SafetySiteIntelligenceResponse>('/safety-site-intelligence/chat', {
      message,
      thread_id: threadId,
      ui_context: uiContext,
    });
    return res.data;
  },

  fetchHeatmap: async (timeFilter: 'TODAY' | '7_DAYS' | '30_DAYS' = '30_DAYS'): Promise<SpatialHeatmapResponse> => {
    const res = await api.get<SpatialHeatmapResponse>('/safety/heatmap', {
      params: { time_filter: timeFilter },
    });
    return res.data;
  },
};
