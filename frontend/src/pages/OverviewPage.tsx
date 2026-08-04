import React from 'react';
import { motion } from 'framer-motion';
import { KpiTile } from '../components/dashboard/KpiTile';
import { OeeAreaChart } from '../components/dashboard/OeeAreaChart';
import { LiveFeedStream } from '../components/dashboard/LiveFeedStream';
import { ExecutiveSummaryCard } from '../components/dashboard/ExecutiveSummaryCard';
import { usePersona } from '../components/layout/Layout';
import { Factory, ShieldCheck } from 'lucide-react';

export const OverviewPage: React.FC = () => {
  const { persona } = usePersona();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col h-full"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-[14px] mb-[22px]">
        <div className={`rounded-[12px] p-[16px_18px] border border-border-color bg-panel flex gap-[12px] items-start transition-all duration-300 ${persona === 'it' ? 'opacity-40 grayscale-[50%]' : 'hover:border-teal/50 hover:shadow-sm'}`}>
          <div className="w-[34px] h-[34px] rounded-[9px] shrink-0 flex items-center justify-center text-[16px] bg-teal-tint text-teal-deep">
            <Factory className="w-[18px] h-[18px]" />
          </div>
          <div>
            <h4 className="m-0 mb-[3px] font-head text-[13.5px] font-bold">Why this matters to Manufacturing Heads</h4>
            <p className="m-0 text-[12.5px] text-muted leading-[1.5]">One live view of production, safety and cost — instead of 12 PDFs and yesterday's SAP batch. Decisions move from days to minutes.</p>
          </div>
        </div>

        <div className={`rounded-[12px] p-[16px_18px] border border-border-color bg-panel flex gap-[12px] items-start transition-all duration-300 ${persona === 'mfg' ? 'opacity-40 grayscale-[50%]' : 'hover:border-purple/50 hover:shadow-sm'}`}>
          <div className="w-[34px] h-[34px] rounded-[9px] shrink-0 flex items-center justify-center text-[16px] bg-purple-tint text-[#5b4fd6]">
            <ShieldCheck className="w-[18px] h-[18px]" />
          </div>
          <div>
            <h4 className="m-0 mb-[3px] font-head text-[13.5px] font-bold">Why this matters to Digital & IT Heads</h4>
            <p className="m-0 text-[12.5px] text-muted leading-[1.5]">API-first on your existing SAP/MES/CCTV stack, edge-deployable with no forced cloud dependency, and governed by RBAC, audit trails and human-in-the-loop approval.</p>
          </div>
        </div>
      </div>

      <div className="mb-[20px]">
        <div className="text-[11px] font-bold tracking-[1.2px] text-teal-deep uppercase mb-[6px]">
          Live Simulation
        </div>
        <h2 className="font-head text-[24px] m-[0_0_6px] font-extrabold text-ink">
          Every decision-critical signal, one screen
        </h2>
        <p className="m-0 text-muted text-[13.5px] max-w-[720px] leading-relaxed">
          This is a working simulation of the platform your team would see on day one — production, finance, safety and environment, unified and agent-monitored 24/7.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[14px] mb-[22px]">
        <KpiTile label="Production Output" value="8,240 T/day" delta="+3.2% vs plan" trend="up" delay={0.05} />
        <KpiTile label="Plant OEE (avg)" value="83.6%" delta="+4.1pp vs Q1" trend="up" delay={0.1} />
        <KpiTile label="Zero Harm Index" value="94.6" delta="+1.2% vs last mo." trend="up" delay={0.15} />
        <KpiTile label="Revenue YTD" value="₹487 Cr" delta="+6.8% vs target" trend="up" delay={0.2} />
      </div>

      <div className="mb-[22px]">
        <OeeAreaChart />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-[16px] items-start">
        <LiveFeedStream />
        <ExecutiveSummaryCard />
      </div>
    </motion.div>
  );
};
