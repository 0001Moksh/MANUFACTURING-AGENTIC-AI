import React, { useState } from 'react';
import {
  Terminal,
  Clock,
  Coins,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Cpu,
  Layers,
} from 'lucide-react';

export interface ToolCallTelemetry {
  name: string;
  args?: Record<string, any>;
  latency_ms?: number;
  status?: 'success' | 'error' | 'pending' | 'pending_hitl' | string;
  summary?: string;
}

export interface ExecutionTracePayload {
  active_agent?: string;
  routing_path?: string;
  tools_called?: ToolCallTelemetry[];
  total_latency_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  cost_usd?: number;
}

interface ExecutionTraceWidgetProps {
  trace: ExecutionTracePayload;
}

export const ExecutionTraceWidget: React.FC<ExecutionTraceWidgetProps> = ({ trace }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toolsCount = trace.tools_called?.length || 0;
  const latency = trace.total_latency_ms ? `${trace.total_latency_ms.toFixed(1)}ms` : '35.0ms';
  const cost = trace.cost_usd !== undefined ? `$${trace.cost_usd.toFixed(5)}` : '$0.00004';
  const routing = trace.routing_path || `Supervisor -> ${trace.active_agent || 'System Agent'}`;

  return (
    <div className="mt-2 text-left w-full">
      {/* Compact Telemetry Summary Bar */}

      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="
    w-full flex items-center justify-between
    px-3 py-2
    bg-slate-900/80
    hover:bg-slate-800
    border border-slate-700/70
    hover:border-slate-600
    rounded-xl
    text-[11px]
    text-slate-300
    transition-all duration-200
    cursor-pointer select-none
    group
    shadow-sm
    hover:shadow-md
  "
      >
        {/* Left section */}
        <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">

          {/* Trace label */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="
        flex items-center justify-center
        w-6 h-6
        rounded-md
        bg-teal-500/10
        border border-teal-500/20
      ">
              <Terminal className="w-3.5 h-3.5 text-teal-400" />
            </div>

            <span className="font-semibold text-slate-200">
              Trace
            </span>
          </div>

          {/* Separator */}
          <div className="h-4 w-px bg-slate-700/80" />

          {/* Tools */}
          <span className="
      inline-flex items-center gap-1.5
      font-medium
      text-slate-300
      bg-slate-800/80
      px-2 py-1
      rounded-md
      border border-slate-700/70
      shrink-0
    ">
            <Layers className="w-3 h-3 text-slate-400" />

            {toolsCount > 0
              ? `${toolsCount} Tool${toolsCount > 1 ? "s" : ""}`
              : "Direct Route"}
          </span>

          {/* Latency */}
          <span className="
      inline-flex items-center gap-1.5
      text-slate-400
      font-mono text-[10px]
      shrink-0
    ">
            <Clock className="w-3 h-3 text-slate-500" />
            {latency}
          </span>

          {/* Cost */}
          <span className="
      inline-flex items-center gap-1.5
      text-slate-400
      font-mono text-[10px]
      hidden sm:inline-flex
      shrink-0
    ">
            <Coins className="w-3 h-3 text-slate-500" />
            {cost}
          </span>
        </div>

        {/* Right section */}
        <div className="
    flex items-center gap-1.5
    text-slate-500
    group-hover:text-slate-200
    shrink-0
    ml-3
    transition-colors
  ">
          <span className="
      text-[10px]
      font-medium
      uppercase
      tracking-wide
    ">
            {isExpanded ? "Hide" : "Details"}
          </span>

          <div className="
      flex items-center justify-center
      w-5 h-5
      rounded-md
      bg-slate-800
      group-hover:bg-slate-700
      border border-slate-700/60
      transition-colors
    ">
            {isExpanded ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded Telemetry Drawer */}
      {isExpanded && (
        <div className="mt-1.5 p-3 bg-slate-900 text-slate-200 rounded-lg border border-slate-800 shadow-md text-[11px] space-y-2.5 animate-in fade-in duration-150">
          {/* Routing Decision */}
          <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-800">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
                <Cpu className="w-3 h-3 text-teal-400" /> Routing Pathway
              </span>
              <div className="font-mono text-xs text-teal-300 font-semibold">{routing}</div>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Latency</span>
              <span className="font-mono text-xs text-slate-200">{latency}</span>
            </div>
          </div>

          {/* Tools Called List */}
          {toolsCount > 0 ? (
            <div className="space-y-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
                Executed Tools ({toolsCount})
              </span>
              {trace.tools_called?.map((tool, idx) => {
                const isSuccess = tool.status === 'success';
                const isHitl = tool.status === 'pending_hitl';
                return (
                  <div key={idx} className="p-2 bg-slate-950/70 border border-slate-800/90 rounded-md space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Terminal className="w-3 h-3 text-cyan-400" />
                        <span className="font-mono font-semibold text-cyan-300 text-[11px]">
                          {tool.name}()
                        </span>
                      </div>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${isSuccess
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : isHitl
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : 'bg-red-950 text-red-400 border border-red-800'
                          }`}
                      >
                        {tool.status || 'SUCCESS'}
                      </span>
                    </div>

                    {tool.summary && (
                      <div className="text-slate-300 text-[11px] flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>{tool.summary}</span>
                      </div>
                    )}

                    {tool.args && Object.keys(tool.args).length > 0 && (
                      <div className="pt-1">
                        <div className="text-[10px] text-slate-400 font-medium">Arguments:</div>
                        <pre className="text-[10px] font-mono text-slate-300 bg-slate-900 p-1.5 rounded overflow-x-auto border border-slate-800/80">
                          {JSON.stringify(tool.args, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-slate-400 italic text-[11px]">
              Direct synthetic reasoning dispatch (no external tool mutations needed).
            </div>
          )}

          {/* Tokens & Cost Summary Footer */}
          <div className="pt-2 border-t border-slate-800/90 grid grid-cols-3 gap-2 text-center text-[10px]">
            <div className="bg-slate-950/50 p-1.5 rounded border border-slate-800/60">
              <span className="text-slate-400 block">Prompt Tokens</span>
              <span className="font-mono font-semibold text-slate-200">{trace.input_tokens || 110}</span>
            </div>
            <div className="bg-slate-950/50 p-1.5 rounded border border-slate-800/60">
              <span className="text-slate-400 block">Output Tokens</span>
              <span className="font-mono font-semibold text-slate-200">{trace.output_tokens || 70}</span>
            </div>
            <div className="bg-slate-950/50 p-1.5 rounded border border-slate-800/60">
              <span className="text-slate-400 block">Estimated Cost</span>
              <span className="font-mono font-semibold text-emerald-400">{cost}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
