import { api } from './api';

export type SafetyQualityResponse = {
  status: 'success' | 'blocked';
  thread_id: string;
  reply: string;
  reason?: string;
  guardrail?: { stage: string; reason: string };
};

export const safetyQualityService = {
  chat: async (message: string, threadId?: string): Promise<SafetyQualityResponse> => {
    const res = await api.post<SafetyQualityResponse>('/safety-agent/chat', {
      message,
      thread_id: threadId,
    });
    return res.data;
  },
};
