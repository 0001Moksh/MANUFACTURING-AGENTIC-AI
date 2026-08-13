import { api } from './api';

export type ExecutiveVisual = {
  type: 'bar' | 'line' | 'pie' | 'histogram';
  title: string;
  labels: string[];
  series: Array<{
    name: string;
    data: number[];
  }>;
  meta?: {
    legend?: boolean;
    x_label?: string;
    y_label?: string;
  };
};

export type ExecutiveInsightResponse = {
  status: 'success';
  thread_id: string;
  reply: string;
  visuals: ExecutiveVisual[];
};

export const executiveInsightsService = {
  chat: async (message: string, threadId?: string) => {
    const res = await api.post<ExecutiveInsightResponse>('/executive-insights/chat', {
      message,
      thread_id: threadId,
    });
    return res.data;
  },
};
