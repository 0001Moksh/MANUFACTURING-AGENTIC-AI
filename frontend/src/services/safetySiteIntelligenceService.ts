import { api } from './api';

export type SafetySiteIntelligenceResponse = {
  status: 'success';
  thread_id: string;
  reply: string;
};

export const safetySiteIntelligenceService = {
  chat: async (message: string, threadId?: string): Promise<SafetySiteIntelligenceResponse> => {
    const res = await api.post<SafetySiteIntelligenceResponse>('/safety-site-intelligence/chat', {
      message,
      thread_id: threadId,
    });
    return res.data;
  },
};
