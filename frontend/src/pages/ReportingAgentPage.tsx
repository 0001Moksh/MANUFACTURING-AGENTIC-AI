import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Database, Sparkles, FileText, ShieldCheck } from 'lucide-react';
import { AgentChatConsole } from '../components/agents/ReportingAgentConsole';

export const ReportingAgentPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/agents')}
          className="flex items-center gap-2 text-[13px] font-semibold text-muted hover:text-teal transition-colors bg-transparent border-none cursor-pointer p-0"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to AI Agents
        </button>

        <div className="flex items-center gap-2 text-[12px] text-faint font-mono">
          <span>AI AGENTS</span>
          <span>/</span>
          <span className="text-teal font-semibold">REPORTING AGENT</span>
        </div>
      </div>

      {/* Hero Header Banner */}
      <div className="bg-panel border border-border-color rounded-[14px] p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-teal/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 mb-2.5">
              <span className="bg-teal-tint text-teal-deep text-[11px] font-bold tracking-[1px] uppercase px-2.5 py-1 rounded-md flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                LangGraph State Machine Engine
              </span>
              <span className="bg-green-tint text-green text-[11px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
                Live SQL Agent
              </span>
            </div>
            
            <h1 className="font-head text-[26px] font-extrabold text-ink m-0">
              LangGraph SQL Reporting Agent
            </h1>
            <p className="text-muted text-[13.5px] mt-2 max-w-[760px] leading-relaxed m-0">
              Query production telemetry, shift reports, work orders, and equipment metrics in natural language. The agent executes safe SQL queries, validates database actions with Human-in-the-Loop governance, and generates downloadable PDF reports.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-[#F8FAFC] border border-border-color rounded-xl p-3 text-center min-w-[120px]">
              <Database className="w-4 h-4 text-teal mx-auto mb-1" />
              <div className="text-[10.5px] text-muted font-medium uppercase tracking-wider">Database</div>
              <div className="text-[12px] font-bold text-ink">PostgreSQL / MES</div>
            </div>

            <div className="bg-[#F8FAFC] border border-border-color rounded-xl p-3 text-center min-w-[120px]">
              <ShieldCheck className="w-4 h-4 text-teal mx-auto mb-1" />
              <div className="text-[10.5px] text-muted font-medium uppercase tracking-wider">Governance</div>
              <div className="text-[12px] font-bold text-ink">HITL Approval</div>
            </div>

            <div className="bg-[#F8FAFC] border border-border-color rounded-xl p-3 text-center min-w-[120px]">
              <FileText className="w-4 h-4 text-teal mx-auto mb-1" />
              <div className="text-[10.5px] text-muted font-medium uppercase tracking-wider">Export</div>
              <div className="text-[12px] font-bold text-ink">PDF Reports</div>
            </div>
          </div>
        </div>
      </div>

      {/* Embedded SQL Reporting Agent Console */}
      <AgentChatConsole />
    </motion.div>
  );
};
