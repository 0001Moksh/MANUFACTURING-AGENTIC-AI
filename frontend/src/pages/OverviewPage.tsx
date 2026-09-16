import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Bot, ArrowRight, Cpu } from 'lucide-react';
import { KpiTile } from '../components/dashboard/KpiTile';
import { OeeAreaChart } from '../components/dashboard/OeeAreaChart';
import { LiveFeedStream } from '../components/dashboard/LiveFeedStream';
import { ExecutiveSummaryCard } from '../components/dashboard/ExecutiveSummaryCard';

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex p-6 flex-col h-full"
    >
      <div className="mb-[20px]">
        <h2 className="font-head text-[24px] m-[0_0_6px] font-extrabold text-ink">Every decision-critical signal, one screen</h2>
        <p className="m-0 text-muted text-[13.5px] max-w-[720px] leading-relaxed">A unified, agent-monitored view of production, finance, safety and environment.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[14px] mb-[22px]">
        <KpiTile label="Production Output" value="8,240 T/day" delta="+3.2% vs plan" trend="up" delay={0.05} />
        <KpiTile label="Plant OEE (avg)" value="83.6%" delta="+4.1pp vs Q1" trend="up" delay={0.1} />
        <KpiTile label="Zero Harm Index" value="94.6" delta="+1.2% vs last mo." trend="up" delay={0.15} />
        <KpiTile label="Revenue YTD" value="₹487 Cr" delta="+6.8% vs target" trend="up" delay={0.2} />
      </div>

      {/* Continuous Machine Monitoring Hero Banner Card */}
      <motion.div
        whileHover={{ scale: 1.005 }}
        transition={{ duration: 0.2 }}
        onClick={() => navigate('/machine-monitoring')}
        className="mb-[22px] p-5 rounded-[16px] bg-gradient-to-r from-navy-900 via-[#0F172A] to-navy-900 border border-teal/30 hover:border-teal shadow-lg hover:shadow-teal/10 cursor-pointer relative overflow-hidden group transition-all"
      >
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-teal/10 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-xl bg-teal/15 border border-teal/40 flex items-center justify-center text-teal shadow-inner">
                <Cpu className="w-6 h-6 text-teal" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-navy-950 border border-teal/50 flex items-center justify-center text-amber-400">
                <Bot className="w-3 h-3 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-head text-[18px] font-bold text-white group-hover:text-teal transition-colors">
                  Continuous Machine Monitoring
                </h3>
                <span className="px-2 py-0.5 text-[11px] font-mono bg-teal/20 text-[#2DD4BF] border border-teal/40 rounded-full font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal animate-ping" />
                  InfluxDB + MES Signal Engine
                </span>
              </div>
              <p className="text-muted text-[13px] leading-relaxed max-w-[640px]">
                Real-time health monitoring, anomaly detection & automated root-cause analysis driven by AI agent telemetry pipeline.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/10">
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="text-center">
                <div className="text-emerald-400 font-bold text-sm">10</div>
                <div className="text-[10px] text-slate-400 uppercase">Running</div>
              </div>
              <div className="w-[1px] h-6 bg-white/10" />
              <div className="text-center">
                <div className="text-amber-400 font-bold text-sm">1</div>
                <div className="text-[10px] text-slate-400 uppercase">Warning</div>
              </div>
              <div className="w-[1px] h-6 bg-white/10" />
              <div className="text-center">
                <div className="text-rose-400 font-bold text-sm">1</div>
                <div className="text-[10px] text-slate-400 uppercase">Critical</div>
              </div>
              <div className="w-[1px] h-6 bg-white/10" />
              <div className="text-center">
                <div className="text-slate-400 font-bold text-sm">1</div>
                <div className="text-[10px] text-slate-400 uppercase">Offline</div>
              </div>
            </div>

            <div className="flex items-center gap-1 px-4 py-2 rounded-lg bg-teal/20 text-teal border border-teal/40 font-semibold text-xs group-hover:bg-teal group-hover:text-navy-950 transition-all">
              <span>View Monitoring</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </motion.div>

      <div className="mb-[22px]"><OeeAreaChart /></div>
      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-[16px] items-start">
        <LiveFeedStream />
        <ExecutiveSummaryCard />
      </div>
    </motion.div>
  );
};

