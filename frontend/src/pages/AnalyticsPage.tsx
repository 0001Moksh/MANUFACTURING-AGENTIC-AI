import React from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { adoption } from '../data/mockData';
import { KpiTile } from '../components/dashboard/KpiTile';

const adoptionData = adoption.map(a => ({
  name: a[0],
  value: a[1],
}));

export const AnalyticsPage: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-6"

    >
      <div className="mb-[20px]">
        <div className="text-[11px] font-bold tracking-[1.2px] text-teal-deep uppercase mb-[6px]">
          Adoption & ROI
        </div>
        <h2 className="font-head text-[24px] m-[0_0_6px] font-extrabold text-ink">
          Analytics that prove the platform is earning its keep
        </h2>
        <p className="m-0 text-muted text-[13.5px] max-w-[720px] leading-relaxed">
          Usage adoption per site, agent uptime and cumulative ROI — the numbers a Manufacturing Head brings to the board and a Digital Head brings to the CFO.
        </p>
      </div>

      <div className="bg-panel border border-border-color rounded-[14px] p-[22px_24px_14px] mb-[16px]">
        <h3 className="font-head text-[14.5px] m-[0_0_4px] font-bold">Use-Case Adoption by Plant</h3>
        <p className="text-[12px] text-muted m-[0_0_16px]">
          % of catalogued use cases activated and live
        </p>

        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={adoptionData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#98A2BE' }} tickLine={false} axisLine={false} dy={10} />
              <YAxis tick={{ fontSize: 11, fill: '#98A2BE' }} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(0,169,174,0.05)' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                itemStyle={{ fontWeight: 600, color: '#017377' }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {adoptionData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill="url(#colorUv)" />
                ))}
              </Bar>
              <defs>
                <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00A9AE" stopOpacity={1} />
                  <stop offset="100%" stopColor="#017377" stopOpacity={1} />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[14px]">
        <KpiTile label="Agent Uptime" value="99.7%" delta="30-day rolling" trend="up" />
        <KpiTile label="Cumulative ROI (YTD)" value="4.25×" delta="Rs 4.25 Cr / plant / yr" trend="up" />
        <KpiTile label="Avg. Time-to-Value" value="3.4 wks" delta="per new use case" trend="up" />
        <KpiTile label="Alert-to-Action" value="<2s" delta="sensor to notification" trend="up" />
      </div>
    </motion.div>
  );
};
