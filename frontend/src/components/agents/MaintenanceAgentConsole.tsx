import React, { useState } from 'react';
import { AlertTriangle, Settings, FileText, CheckCircle2, ChevronRight, Activity, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MOCK_MACHINES = [
  {
    id: 'm1',
    name: 'Train-3 Regenerator',
    zone: 'Zone 4',
    risk: 'Critical',
    issue: 'High vibration detected in bearing assembly. Predictive failure within 72h.',
    guideRef: 'SOP-TR3-08: Bearing Maintenance',
    steps: [
      'Isolate Train-3 from the main power grid and apply LOTO (Lockout/Tagout).',
      'Remove the outer housing of the regenerator unit.',
      'Inspect the primary bearing assembly for visible wear or thermal damage.',
      'Replace the bearing cartridge using specialized alignment tool (Tool #442).',
      'Re-grease the assembly, restore power, and run the 15-minute diagnostic test.'
    ]
  },
  {
    id: 'm2',
    name: 'Compressor B',
    zone: 'Zone 1',
    risk: 'High',
    issue: 'Coolant pressure dropping steadily. Possible seal leak.',
    guideRef: 'SOP-CMP-12: Seal Inspection',
    steps: [
      'Bypass Compressor B to redundant Compressor C.',
      'Drain residual coolant from the primary loop.',
      'Inspect the mechanical seals on the intake valve for degradation.',
      'Replace faulty O-rings and re-pressurize the system to 120 PSI.',
      'Monitor for 30 minutes to ensure pressure holds steady.'
    ]
  },
  {
    id: 'm3',
    name: 'Conveyor Drive Motor',
    zone: 'Packaging',
    risk: 'Medium',
    issue: 'Temperature running 15% above normal baseline.',
    guideRef: 'SOP-MOT-02: Motor Thermal Management',
    steps: [
      'Check external cooling fans for blockages.',
      'Verify motor load is within specified parameters.',
      'Clean cooling fins and ensure adequate ambient airflow.',
      'If temperature remains high, schedule planned downtime for internal coil inspection.'
    ]
  }
];

export const MaintenanceAgentConsole: React.FC = () => {
  const [selectedMachine, setSelectedMachine] = useState(MOCK_MACHINES[0]);

  return (
    <div className="bg-panel border border-border-color rounded-[14px] p-0 mt-6 shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[500px]">
      
      {/* Left Pane: Machine List */}
      <div className="w-full md:w-[320px] border-r border-border-color flex flex-col bg-[#F8F9FB]">
        <div className="p-4 border-b border-border-color flex items-center gap-2 bg-white">
          <Settings className="text-teal-deep w-[20px] h-[20px]" />
          <div>
            <h3 className="font-head text-[15px] font-bold m-0 text-ink">Maintenance Agent</h3>
            <div className="text-[11px] text-muted font-mono tracking-wide uppercase mt-0.5">LSTM Predictive Models</div>
          </div>
        </div>
        
        <div className="p-3 text-[12px] text-muted font-semibold uppercase tracking-wider">
          Machines at Risk
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {MOCK_MACHINES.map(machine => (
            <button
              key={machine.id}
              onClick={() => setSelectedMachine(machine)}
              className={`w-full text-left p-4 border-b border-border-color border-opacity-50 hover:bg-white transition-colors cursor-pointer flex items-start gap-3 relative ${
                selectedMachine.id === machine.id ? 'bg-white shadow-sm' : ''
              }`}
            >
              {selectedMachine.id === machine.id && (
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-teal" />
              )}
              
              <div className={`mt-0.5 w-[10px] h-[10px] rounded-full shrink-0 ${
                machine.risk === 'Critical' ? 'bg-red shadow-[0_0_0_3px_var(--color-red-tint)]' :
                machine.risk === 'High' ? 'bg-amber shadow-[0_0_0_3px_var(--color-amber-tint)]' :
                'bg-blue text-white shadow-[0_0_0_3px_var(--color-blue-tint)]'
              }`} />
              
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[13.5px] text-ink truncate mb-0.5">{machine.name}</div>
                <div className="text-[11.5px] text-muted mb-2">{machine.zone}</div>
                
                <div className={`text-[10.5px] font-bold inline-block px-2 py-0.5 rounded-full ${
                  machine.risk === 'Critical' ? 'bg-red-tint text-red' :
                  machine.risk === 'High' ? 'bg-amber-tint text-[#9A6400]' :
                  'bg-blue-tint text-[#2258b0]'
                }`}>
                  {machine.risk} Risk
                </div>
              </div>
              
              <ChevronRight className="w-4 h-4 text-faint mt-1" />
            </button>
          ))}
        </div>
      </div>

      {/* Right Pane: Analysis & Guide */}
      <div className="flex-1 flex flex-col bg-white">
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedMachine.id}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="p-6 flex-1 overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-color">
              <div>
                <h2 className="text-[20px] font-head font-extrabold text-ink m-0 mb-1">{selectedMachine.name}</h2>
                <div className="text-[13px] text-muted flex items-center gap-1.5">
                  <span>{selectedMachine.zone}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-red font-semibold">
                    <Activity className="w-3.5 h-3.5" /> Predictive Failure Alert
                  </span>
                </div>
              </div>
              <button className="bg-teal hover:bg-teal-deep text-white px-4 py-2 rounded-lg text-[12px] font-bold border-none cursor-pointer transition-colors shadow-sm flex items-center gap-2">
                <Zap className="w-3.5 h-3.5" /> Auto-Raise Work Order
              </button>
            </div>

            <div className="mb-6 bg-red-tint/30 border border-red/20 rounded-[10px] p-4 flex gap-3 items-start">
              <AlertTriangle className="w-[18px] h-[18px] text-red shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-[13px] text-red mb-1">AI Root Cause Analysis</div>
                <div className="text-[13px] text-ink leading-relaxed">{selectedMachine.issue}</div>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="font-bold text-[14px] text-ink flex items-center gap-2">
                  <FileText className="w-[16px] h-[16px] text-teal" />
                  Recommended Resolution Guide
                </div>
                <div className="text-[11.5px] font-mono text-muted bg-[#F8F9FB] px-2 py-1 rounded border border-border-color">
                  Source: {selectedMachine.guideRef}
                </div>
              </div>
              
              <div className="border border-border-color rounded-[10px] p-5 bg-[#FAFBFE]">
                <p className="text-[12.5px] text-muted mb-4 leading-relaxed">
                  The Maintenance Agent has retrieved the relevant standard operating procedure and generated a step-by-step resolution plan specifically for this failure mode:
                </p>
                
                <div className="flex flex-col gap-3">
                  {selectedMachine.steps.map((step, idx) => (
                    <div key={idx} className="flex gap-3 items-start bg-white p-3 rounded-lg border border-border-color shadow-sm">
                      <div className="w-[20px] h-[20px] shrink-0 rounded-full bg-teal-tint text-teal-deep flex items-center justify-center text-[11px] font-bold mt-0.5">
                        {idx + 1}
                      </div>
                      <div className="text-[13px] text-ink leading-relaxed flex-1">
                        {step}
                      </div>
                      <button className="text-muted hover:text-green cursor-pointer border-none bg-transparent flex shrink-0 items-center gap-1 text-[11px] font-semibold transition-colors">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mark Done
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
