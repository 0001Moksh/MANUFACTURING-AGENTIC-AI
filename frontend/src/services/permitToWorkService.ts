import { api } from './api';

export type PermitToWorkResponse = {
  status: 'success';
  thread_id: string;
  reply: string;
};

export type PermitToWorkSummary = {
  status: string;
  active_high_risk_contexts: number;
  unresolved_breaches: number;
  maintenance_windows_open: number;
  expired_permits_flagged: number;
  safety_compliance_rate: string;
};

export const permitToWorkService = {
  chat: async (message: string, threadId?: string): Promise<PermitToWorkResponse> => {
    const res = await api.post<PermitToWorkResponse>('/permit-to-work/chat', {
      message,
      thread_id: threadId,
    });
    return res.data;
  },

  getSummary: async (): Promise<PermitToWorkSummary> => {
    const res = await api.get<PermitToWorkSummary>('/permit-to-work/summary');
    return res.data;
  },
};
