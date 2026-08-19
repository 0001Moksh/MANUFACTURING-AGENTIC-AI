export interface ToolInvocation {
  name: string;
  args?: Record<string, any>;
  status?: 'executing' | 'completed' | 'failed';
  timestamp?: string;
  durationSec?: number;
  resultSummary?: string;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface TurnTelemetry {
  execution_time_sec: number;
  tools_used: ToolInvocation[];
  tokens?: TokenUsage;
  cost_usd?: number;
  model_name?: string;
}

export interface ActiveToolStep {
  tool_name: string;
  friendly_label?: string;
  tool_args?: Record<string, any>;
  status: 'executing' | 'completed' | 'failed';
  startTime: number;
  durationSec?: number;
}
