import React from 'react';
import { motion } from 'framer-motion';
import { KpiTile } from '../components/dashboard/KpiTile';
import { OeeAreaChart } from '../components/dashboard/OeeAreaChart';
import { LiveFeedStream } from '../components/dashboard/LiveFeedStream';
import { ExecutiveSummaryCard } from '../components/dashboard/ExecutiveSummaryCard';

export const OverviewPage: React.FC = () => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className="flex flex-col h-full"
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

    <div className="mb-[22px]"><OeeAreaChart /></div>
    <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-[16px] items-start">
      <LiveFeedStream />
      <ExecutiveSummaryCard />
    </div>
  </motion.div>
);
