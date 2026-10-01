import { api } from './api';

export interface EnergyAgentHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface EnergyAgentTrace {
  thread_id: string;
  created_at: string;
  model: string | null;
  tools_used: { name: string; status: string; device_count: number }[];
  tokens: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  cost_usd: number;
  execution_time_sec: number;
  data_source: string;
  telemetry_range: string;
}

export interface EnergyAgentChatResponse {
  status: string;
  thread_id: string;
  reply: string;
  trace: EnergyAgentTrace;
}

export const energyAgentService = {
  chat: async (
    message: string,
    threadId: string,
    history: EnergyAgentHistoryMessage[]
  ): Promise<EnergyAgentChatResponse> => {
    const response = await api.post<EnergyAgentChatResponse>('/energy-agent/chat', {
      message,
      thread_id: threadId,
      history,
    });
    return response.data;
  },
};