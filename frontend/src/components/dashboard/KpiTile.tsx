import React from 'react';
import { motion } from 'framer-motion';

interface KpiTileProps {
  label: string;
  value: string;
  delta: string;
  trend: 'up' | 'warn' | 'down';
  delay?: number;
}

export const KpiTile: React.FC<KpiTileProps> = ({ label, value, delta, trend, delay = 0 }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="bg-panel border border-border-color rounded-[12px] p-[16px_18px] flex flex-col hover:shadow-md transition-shadow cursor-default"
    >
      <div className="text-[10.5px] font-bold tracking-[0.7px] text-faint uppercase">
        {label}
      </div>
      <div className="font-head text-[26px] font-extrabold mt-[6px]">
        {value}
      </div>
      <div className={`text-[11.5px] font-semibold mt-[5px] ${
        trend === 'up' ? 'text-green' : trend === 'warn' ? 'text-amber' : 'text-red'
      }`}>
        {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '●'} {delta}
      </div>
    </motion.div>
  );
};
