import { api } from './api';

export interface ToolInvocation {
  name: string;
  args?: Record<string, any>;
  status?: 'executing' | 'completed' | 'failed';
  timestamp?: string;
}

export interface TurnTelemetry {
  execution_time_sec: number;
  tools_used: ToolInvocation[];
  tokens?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  cost_usd?: number;
}

export interface IncidentInvestigationResponse {
  status: string;
  thread_id: string;
  reply: string;
  tools_used: ToolInvocation[];
  execution_time_sec: number;
  tokens: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  cost_usd: number;
}

export interface IncidentInvestigationSummary {
  status: string;
  trir_ytd: string;
  zero_harm_index: string;
  open_spill_alerts: number;
  active_anomaly_flags: number;
  audited_cameras: number;
  ltifr_rate: string;
  safety_audit_status: string;
}

export interface StreamCallbacks {
  onInit?: (threadId: string) => void;
  onToolStart?: (tool: { tool_name: string; tool_args?: Record<string, any> }) => void;
  onToolEnd?: (tool: { tool_name: string; status: string }) => void;
  onToken?: (text: string) => void;
  onTelemetry?: (telemetry: TurnTelemetry) => void;
  onDone?: () => void;
  onError?: (err: Error) => void;
}

export const incidentInvestigationService = {
  chat: async (message: string, thread_id?: string): Promise<IncidentInvestigationResponse> => {
    const res = await api.post<IncidentInvestigationResponse>('/incident-investigation/chat', {
      message,
      thread_id,
    });
    return res.data;
  },

  getSummary: async (): Promise<IncidentInvestigationSummary> => {
    const res = await api.get<IncidentInvestigationSummary>('/incident-investigation/summary');
    return res.data;
  },

  streamChat: async (
    message: string,
    thread_id: string | undefined,
    callbacks: StreamCallbacks
  ): Promise<void> => {
    const token = localStorage.getItem('token');
    const response = await fetch('http://localhost:8000/api/incident-investigation/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ message, thread_id }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Streaming failed: HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) {
            const jsonStr = trimmed.replace(/^data:\s*/, '');
            if (!jsonStr) continue;

            try {
              const event = JSON.parse(jsonStr);
              if (event.type === 'init') {
                callbacks.onInit?.(event.thread_id);
              } else if (event.type === 'tool_start') {
                callbacks.onToolStart?.({
                  tool_name: event.tool_name,
                  tool_args: event.tool_args,
                });
              } else if (event.type === 'tool_end') {
                callbacks.onToolEnd?.({
                  tool_name: event.tool_name,
                  status: event.status,
                });
              } else if (event.type === 'token') {
                callbacks.onToken?.(event.content);
              } else if (event.type === 'telemetry') {
                callbacks.onTelemetry?.({
                  execution_time_sec: event.execution_time_sec,
                  tools_used: event.tools_used,
                  tokens: event.tokens,
                  cost_usd: event.cost_usd,
                });
              } else if (event.type === 'done') {
                callbacks.onDone?.();
              }
            } catch (err) {
              console.warn('Failed to parse SSE payload:', jsonStr, err);
            }
          }
        }
      }
    } catch (err: any) {
      callbacks.onError?.(err);
    }
  },
};
