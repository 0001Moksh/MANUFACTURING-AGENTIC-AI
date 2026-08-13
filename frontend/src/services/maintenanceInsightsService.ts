import { api } from './api';

export type MaintenanceVisual = {
  type: 'bar' | 'line' | 'pie' | 'flow';
  title: string;
  labels: string[];
  series: Array<{ name: string; data: number[] }>;
  nodes?: Array<{ id: string; label: string }>;
  edges?: Array<{ from: string; to: string }>;
  meta?: {
    legend?: boolean;
    x_label?: string;
    y_label?: string;
  };
};

export type MaintenanceResponse = {
  status: 'success';
  thread_id: string;
  reply: string;
  visuals: MaintenanceVisual[];
};

export const maintenanceInsightsService = {
  chat: async (message: string, threadId?: string) => {
    const res = await api.post<MaintenanceResponse>('/maintenance/chat', {
      message,
      thread_id: threadId,
    });
    return res.data;
  },
};
