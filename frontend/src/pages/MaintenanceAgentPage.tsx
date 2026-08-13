import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings, Cpu, FileText } from 'lucide-react';
import { AgentChatConsole } from '../components/agents/ReportingAgentConsole';

export const MaintenanceAgentPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
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
          <span className="text-teal font-semibold">MAINTENANCE AGENT</span>
        </div>
      </div>

      <div className="bg-panel border border-border-color rounded-[14px] p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-teal/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 mb-2.5">
              <span className="bg-teal-tint text-teal-deep text-[11px] font-bold tracking-[1px] uppercase px-2.5 py-1 rounded-md flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" />
                Predictive Maintenance Engine
              </span>
            </div>

            <h1 className="font-head text-[26px] font-extrabold text-ink m-0">Maintenance Agent Chat</h1>
            <p className="text-muted text-[13.5px] mt-2 max-w-[760px] leading-relaxed m-0">
              Ask Deva about machine health, scheduled maintenance, or raise work orders in natural language. The Maintenance Agent runs read-only diagnostics and can suggest HITL-approved actions.
            </p>
            <p className="text-[12px] text-faint mt-3">
              Chatbot implementation and server-side agent logic are available in the notebook: <a href="/jupyter%20notebooks/Maintenance_Agent.ipynb" className="text-teal font-semibold">jupyter notebooks/Maintenance_Agent.ipynb</a>
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-[#F8FAFC] border border-border-color rounded-xl p-3 text-center min-w-[120px]">
              <Settings className="w-4 h-4 text-teal mx-auto mb-1" />
              <div className="text-[10.5px] text-muted font-medium uppercase tracking-wider">Engine</div>
              <div className="text-[12px] font-bold text-ink">Predictive LSTM + Rules</div>
            </div>

            <div className="bg-[#F8FAFC] border border-border-color rounded-xl p-3 text-center min-w-[120px]">
              <FileText className="w-4 h-4 text-teal mx-auto mb-1" />
              <div className="text-[10.5px] text-muted font-medium uppercase tracking-wider">Export</div>
              <div className="text-[12px] font-bold text-ink">Work Order / PDF</div>
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Chat Console (re-uses the ReportingAgent console wiring to the backend) */}
      <AgentChatConsole agentName="maintenance" />
    </motion.div>
  );
};

export default MaintenanceAgentPage;
