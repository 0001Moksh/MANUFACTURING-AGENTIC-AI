import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Database,
  Sparkles,
  FileText,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import { AgentChatConsole } from '../components/agents/ReportingAgentConsole';

export const ReportingAgentPage: React.FC = () => {
  const navigate = useNavigate();
  const [heroExpanded, setHeroExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="h-[calc(100vh-22px)] flex flex-col gap-1 w-full px-0 overflow-hidden"
    >
      {/* ── Top Bar / Navigation ── */}
      <div className="flex items-center justify-between pt-2 shrink-0 px-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center pt-2 gap-2 text-[13px] font-semibold text-muted hover:text-teal transition-colors bg-transparent border-none cursor-pointer p-0"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      {/* ── Collapsible Hero Banner ── */}
      <div className="bg-gradient-to-r from-[#0B1730] via-[#0F2545] to-[#00808A] text-white rounded-[16px] shadow-sm shrink-0 border border-navy-700/50 overflow-hidden mx-3">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-teal-500/20 border border-teal-400/40 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-teal-300" />
            </div>
            <h1 className="font-head text-[16px] font-extrabold m-0 text-white truncate">
              LangGraph SQL Reporting Agent
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-300 bg-emerald-400/10 border border-emerald-400/30 px-2 py-0.5 rounded-full ml-1 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live SQL Agent
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setHeroExpanded((v) => !v)}
              className="flex items-center gap-1 text-[11.5px] font-semibold text-white/85 hover:text-white bg-white/10 hover:bg-white/15 border border-white/10 px-2.5 py-1.5 rounded-[10px] transition-colors cursor-pointer"
              title={heroExpanded ? 'Collapse' : 'Expand'}
            >
              <motion.span animate={{ rotate: heroExpanded ? 180 : 0 }} transition={{ duration: 0.2 }} className="flex items-center">
                <ChevronDown className="w-3.5 h-3.5" />
              </motion.span>
              {heroExpanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {heroExpanded && (
            <motion.div
              key="hero-detail"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-1 border-t border-white/10">
                <p className="text-white/80 text-[13px] max-w-[840px] mt-2 mb-0 leading-relaxed">
                  Query production telemetry, shift reports, work orders, and equipment metrics in natural language. The agent executes safe SQL queries, validates database actions with Human-in-the-Loop governance, and generates downloadable PDF reports.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                  <div className="bg-white/10 backdrop-blur-xs rounded-[12px] px-3 py-2 border border-white/10 text-center">
                    <div className="flex justify-center mb-1"><Database className="w-3.5 h-3.5 text-teal-300" /></div>
                    <div className="text-[12px] font-bold text-white">PostgreSQL / MES</div>
                    <div className="text-[9.5px] text-white/70 font-semibold uppercase">Database</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs rounded-[12px] px-3 py-2 border border-white/10 text-center">
                    <div className="flex justify-center mb-1"><ShieldCheck className="w-3.5 h-3.5 text-teal-300" /></div>
                    <div className="text-[12px] font-bold text-white">HITL Approval</div>
                    <div className="text-[9.5px] text-white/70 font-semibold uppercase">Governance</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs rounded-[12px] px-3 py-2 border border-white/10 text-center">
                    <div className="flex justify-center mb-1"><FileText className="w-3.5 h-3.5 text-teal-300" /></div>
                    <div className="text-[12px] font-bold text-white">PDF Reports</div>
                    <div className="text-[9.5px] text-white/70 font-semibold uppercase">Export</div>
                  </div>
                </div>

                <div className="flex gap-1.5 mt-3 flex-wrap text-[10.5px] text-white/80">
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">LangGraph State Machine</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">Natural Language SQL</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">Human-in-the-Loop</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10">PDF Export</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Embedded SQL Reporting Agent Console ── */}
      <div className="flex-1 min-h-0 md:mx-2">
        <AgentChatConsole />
      </div>
    </motion.div>
  );
};

export default ReportingAgentPage;