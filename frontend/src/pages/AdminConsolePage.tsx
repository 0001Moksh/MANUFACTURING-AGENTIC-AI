import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UsersTable } from '../components/admin/UsersTable';
import { ConnectorsGrid } from '../components/admin/ConnectorsGrid';
import { RulesBuilder } from '../components/admin/RulesBuilder';
import { usePersona } from '../components/layout/Layout';
import { useStore } from '../store';
import { guardrails, channels } from '../data/mockData';
import { ShieldCheck, Settings } from 'lucide-react';

export const AdminConsolePage: React.FC = () => {
  const { persona } = usePersona();
  const { explainableLogs, setExplainableLogs, humanInLoop, setHumanInLoop } = useStore();
  const [activePane, setActivePane] = useState('users');

  const panes = [
    { id: 'users', label: 'Users & Roles' },
    { id: 'sites', label: 'Sites & Plants' },
    { id: 'integrations', label: 'Integrations' },
    { id: 'guardrails', label: 'Governance & Guardrails' },
    { id: 'rules', label: 'Alert & Escalation Rules' },
    { id: 'notifications', label: 'Notifications' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-[14px] mb-[22px]">
        <div className={`rounded-[12px] p-[16px_18px] border border-border-color bg-panel flex gap-[12px] items-start transition-all duration-300 ${persona === 'mfg' ? 'opacity-40 grayscale-[50%]' : 'hover:border-purple/50 hover:shadow-sm'}`}>
          <div className="w-[34px] h-[34px] rounded-[9px] shrink-0 flex items-center justify-center text-[16px] bg-purple-tint text-[#5b4fd6]">
            <ShieldCheck className="w-[18px] h-[18px]" />
          </div>
          <div>
            <h4 className="m-0 mb-[3px] font-head text-[13.5px] font-bold">Built for the Digital & IT Head</h4>
            <p className="m-0 text-[12.5px] text-muted leading-[1.5]">This is the console your governance, security and integration teams actually live in — RBAC, SSO, audit trails, connector health and model guardrails, all in one place.</p>
          </div>
        </div>

        <div className={`rounded-[12px] p-[16px_18px] border border-border-color bg-panel flex gap-[12px] items-start transition-all duration-300 ${persona === 'it' ? 'opacity-40 grayscale-[50%]' : 'hover:border-teal/50 hover:shadow-sm'}`}>
          <div className="w-[34px] h-[34px] rounded-[9px] shrink-0 flex items-center justify-center text-[16px] bg-teal-tint text-teal-deep">
            <Settings className="w-[18px] h-[18px]" />
          </div>
          <div>
            <h4 className="m-0 mb-[3px] font-head text-[13.5px] font-bold">Still simple for Plant Ops</h4>
            <p className="m-0 text-[12.5px] text-muted leading-[1.5]">Non-technical admins configure alert rules and escalation paths in plain language — no code, no tickets to IT for every threshold change.</p>
          </div>
        </div>
      </div>

      <div className="mb-[20px]">
        <div className="text-[11px] font-bold tracking-[1.2px] text-teal-deep uppercase mb-[6px]">
          Admin Console
        </div>
        <h2 className="font-head text-[24px] m-[0_0_6px] font-extrabold text-ink">
          Platform governance, integrations & usability controls
        </h2>
        <p className="m-0 text-muted text-[13.5px] max-w-[720px] leading-relaxed">
          Everything below is configurable per plant, per role — this is what convinces a Digital Head the platform is enterprise-ready, not a science project.
        </p>
      </div>

      <div className="flex gap-[6px] mb-[18px] flex-wrap border-b border-border-color">
        {panes.map(p => (
          <button
            key={p.id}
            onClick={() => setActivePane(p.id)}
            className={`bg-transparent border-none p-[10px_4px] mr-[18px] text-[13px] font-semibold transition-colors cursor-pointer border-b-2 ${
              activePane === p.id ? 'text-ink border-teal' : 'text-muted border-transparent hover:text-ink'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activePane}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.2 }}
        >
          {activePane === 'users' && (
            <div>
              <UsersTable />
              <div className="flex flex-col gap-[10px] mt-[14px]">
                <div className="flex items-center gap-[14px] bg-panel border border-border-color rounded-[11px] p-[13px_16px]">
                  <div className="flex-1">
                    <div className="font-bold text-[13px] mb-[2px]">SSO / SAML & Active Directory</div>
                    <div className="text-[11.5px] text-muted">Group-based role mapping — no manual user provisioning per plant</div>
                  </div>
                  <span className="text-[10.5px] font-bold py-[3px] px-[9px] rounded-[20px] bg-blue-tint text-[#2258b0]">Configured</span>
                </div>
                <div className="flex items-center gap-[14px] bg-panel border border-border-color rounded-[11px] p-[13px_16px]">
                  <div className="flex-1">
                    <div className="font-bold text-[13px] mb-[2px]">Granular RBAC</div>
                    <div className="text-[11.5px] text-muted">Permissions scoped to module, plant and even individual agent — not all-or-nothing</div>
                  </div>
                  <span className="text-[10.5px] font-bold py-[3px] px-[9px] rounded-[20px] bg-blue-tint text-[#2258b0]">Enabled</span>
                </div>
              </div>
            </div>
          )}

          {activePane === 'sites' && (
            <div className="bg-panel border border-border-color rounded-[14px] overflow-hidden">
              <table className="w-full border-collapse text-[12.5px]">
                <thead>
                  <tr>
                    <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-faint p-[9px_14px] border-b border-border-color font-bold">Plant / Site</th>
                    <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-faint p-[9px_14px] border-b border-border-color font-bold">Location</th>
                    <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-faint p-[9px_14px] border-b border-border-color font-bold">Modules Live</th>
                    <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-faint p-[9px_14px] border-b border-border-color font-bold">Agents</th>
                    <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-faint p-[9px_14px] border-b border-border-color font-bold">Connectivity</th>
                    <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-faint p-[9px_14px] border-b border-border-color font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Alpha Refinery', 'UAE', '12 / 12', '12', 'Edge + Cloud', 'Live'],
                    ['Beta Offshore Platform', 'UAE', '8 / 12', '8', 'Edge-only (offline-capable)', 'Live'],
                    ['Gamma Gas Processing', 'India', '10 / 12', '10', 'Edge + Cloud', 'Live'],
                    ['Delta Plant', 'India', '12 / 12', '12', 'Edge + Cloud', 'Live'],
                    ['Epsilon Onshore', 'Canada', '6 / 12', '6', 'Edge + Cloud', 'Pilot'],
                    ['Zeta Terminal', 'UAE', '4 / 12', '4', 'Edge + Cloud', 'Onboarding'],
                  ].map((row, idx) => (
                    <tr key={idx} className="border-b border-[#F0F2F7] last:border-b-0">
                      <td className="p-[12px_14px] font-bold align-middle">{row[0]}</td>
                      <td className="p-[12px_14px] align-middle">{row[1]}</td>
                      <td className="p-[12px_14px] align-middle">{row[2]}</td>
                      <td className="p-[12px_14px] align-middle">{row[3]}</td>
                      <td className="p-[12px_14px] align-middle">{row[4]}</td>
                      <td className="p-[12px_14px] align-middle">
                        <span className={`text-[10.5px] font-bold py-[3px] px-[9px] rounded-[20px] ${
                          row[5] === 'Live' ? 'bg-green-tint text-green' : row[5] === 'Pilot' ? 'bg-amber-tint text-[#9A6400]' : 'bg-[#EEF0F5] text-muted'
                        }`}>
                          {row[5]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activePane === 'integrations' && <ConnectorsGrid />}
          
          {activePane === 'guardrails' && (
            <div className="flex flex-col gap-[10px]">
              {guardrails.map((g, i) => {
                const isExplainableLogs = g[0] === "Explainability logging";
                const isHITL = g[0] === "Human-in-the-loop approval for high-risk actions";
                const isToggleable = isExplainableLogs || isHITL;
                const isOn = isExplainableLogs ? explainableLogs : (isHITL ? humanInLoop : false);
                
                return (
                  <div key={i} className="flex items-center gap-[14px] bg-panel border border-border-color rounded-[11px] p-[13px_16px]">
                    <div className="flex-1">
                      <div className="font-bold text-[13px] mb-[2px]">{g[0]}</div>
                      <div className="text-[11.5px] text-muted">{g[1]}</div>
                    </div>
                    
                    {isToggleable ? (
                      <button 
                        onClick={() => {
                          if (isExplainableLogs) setExplainableLogs(!explainableLogs);
                          if (isHITL) setHumanInLoop(!humanInLoop);
                        }}
                        className={`w-[34px] h-[19px] rounded-[20px] relative border-none shrink-0 transition-colors cursor-pointer ${
                          isOn ? 'bg-green' : 'bg-[#D7DCE8]'
                        }`}
                      >
                        <div className={`absolute w-[15px] h-[15px] bg-white rounded-full top-[2px] transition-all duration-200 ${
                          isOn ? 'right-[2px]' : 'left-[2px]'
                        }`} />
                      </button>
                    ) : (
                      <span className={`text-[10.5px] font-bold py-[3px] px-[9px] rounded-[20px] ${
                        g[2] === 'On' ? 'bg-green-tint text-green' : g[2] === 'Configurable' ? 'bg-blue-tint text-[#2258b0]' : 'bg-amber-tint text-[#9A6400]'
                      }`}>
                        {g[2]}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          
          {activePane === 'rules' && <RulesBuilder />}
          
          {activePane === 'notifications' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[12px]">
              {channels.map((c, i) => {
                const [isOn, setIsOn] = useState(i !== channels.length - 1);
                return (
                  <div key={i} className="border border-border-color rounded-[11px] p-[13px_15px] flex items-center gap-[12px] bg-panel">
                    <span className="text-[16px]">{c[0]}</span>
                    <span className="flex-1 font-semibold text-[12.5px]">{c[1]}</span>
                    <button 
                      onClick={() => setIsOn(!isOn)}
                      className={`w-[34px] h-[19px] rounded-[20px] relative border-none shrink-0 transition-colors cursor-pointer ${
                        isOn ? 'bg-green' : 'bg-[#D7DCE8]'
                      }`}
                    >
                      <div className={`absolute w-[15px] h-[15px] bg-white rounded-full top-[2px] transition-all duration-200 ${
                        isOn ? 'right-[2px]' : 'left-[2px]'
                      }`} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};
