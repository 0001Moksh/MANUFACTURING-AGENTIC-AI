import { api } from './api';

export type PPEVisionResponse = {
  status: 'success' | 'blocked';
  thread_id: string;
  reply: string;
  reason?: string;
  guardrail?: { stage: string; reason: string };
};

export const ppeVisionService = {
  chat: async (message: string, threadId?: string): Promise<PPEVisionResponse> => {
    const res = await api.post<PPEVisionResponse>('/ppe-agent/chat', {
      message,
      thread_id: threadId,
    });
    return res.data;
  },
};
