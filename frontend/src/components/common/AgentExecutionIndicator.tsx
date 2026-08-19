import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, CheckCircle2, Loader2, Sparkles, Terminal } from 'lucide-react';
import type { ActiveToolStep } from '../../types/telemetry';
import { getFriendlyToolDescription } from '../../utils/telemetryHelper';

interface AgentExecutionIndicatorProps {
  activeSteps?: ActiveToolStep[];
  agentName?: string;
  isStreaming?: boolean;
}

export const AgentExecutionIndicator: React.FC<AgentExecutionIndicatorProps> = ({
  activeSteps = [],
  agentName = 'Deva',
  isStreaming = false,
}) => {
  if (activeSteps.length === 0 && !isStreaming) {
    return null;
  }

  // Fallback generic "Thinking" state if no granular tool events yet
  if (activeSteps.length === 0 && isStreaming) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        className="flex items-center gap-3 py-2 px-3.5 my-2 max-w-[85%] bg-gradient-to-r from-slate-900/5 via-teal-900/5 to-cyan-900/5 border border-teal-500/20 rounded-2xl shadow-xs text-[12.5px]"
      >
        <div className="relative flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          <Sparkles className="w-2.5 h-2.5 text-teal-600 absolute" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-teal-900">{agentName} is thinking...</span>
          <span className="text-[11.5px] text-slate-500 font-mono">analyzing context & safety parameters</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="space-y-1.5 my-2.5 max-w-[90%]"
    >
      <AnimatePresence>
        {activeSteps.map((step, idx) => {
          const isExecuting = step.status === 'executing';
          const description =
            step.friendly_label || getFriendlyToolDescription(step.tool_name);

          return (
            <motion.div
              key={`${step.tool_name}-${idx}`}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border text-[12.5px] transition-all shadow-xs ${
                isExecuting
                  ? 'bg-gradient-to-r from-amber-500/10 via-cyan-500/10 to-teal-500/10 border-cyan-400/60 text-slate-800 animate-pulse'
                  : 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {isExecuting ? (
                  <div className="relative flex items-center justify-center shrink-0">
                    <Loader2 className="w-4 h-4 text-cyan-700 animate-spin" />
                    <Zap className="w-2 h-2 text-amber-500 absolute" />
                  </div>
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                )}

                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0">
                  <span className="font-semibold text-slate-900 truncate">
                    {description}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] text-cyan-800 bg-white/80 border border-slate-200 px-1.5 py-0.5 rounded w-fit">
                    <Terminal className="w-3 h-3 text-slate-500" />
                    {step.tool_name}
                  </span>
                </div>
              </div>

              <div className="text-[11px] font-mono text-slate-500 shrink-0 text-right">
                {isExecuting ? (
                  <span className="text-cyan-700 font-semibold animate-pulse">Running...</span>
                ) : (
                  <span className="text-emerald-700 font-medium">
                    {step.durationSec ? `${step.durationSec.toFixed(2)}s` : '✓ Done'}
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
};
