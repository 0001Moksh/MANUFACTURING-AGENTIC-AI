import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings2 } from 'lucide-react';
import { type UseCase, pillarMeta, adminTemplates } from '../../data/mockData';

interface UseCaseModalProps {
  useCase: UseCase | null;
  onClose: () => void;
}

const tagColors: Record<string, string> = {
  AGENTIC: 'bg-amber-tint text-[#9A6400]',
  GENAI: 'bg-purple-tint text-[#5b4fd6]',
  VOICE: 'bg-teal-tint text-teal-deep',
  VISION: 'bg-red-tint text-[#B23A3A]',
  ML: 'bg-green-tint text-[#1a8f5f]',
  IOT: 'bg-blue-tint text-[#2258b0]',
};

export const UseCaseModal: React.FC<UseCaseModalProps> = ({ useCase, onClose }) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!useCase) return null;

  const cfgRows = (adminTemplates[useCase.tags[0]] || [])
    .concat(adminTemplates[useCase.tags[1]] ? adminTemplates[useCase.tags[1]].slice(0, 1) : []);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-navy-950/55 backdrop-blur-[2px] flex items-center justify-center z-50 p-[26px]" onClick={onClose}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 8 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
          className="bg-panel rounded-[16px] max-w-[760px] w-full max-h-[88vh] overflow-y-auto shadow-2xl flex flex-col"
        >
          <div className="p-[22px_26px] border-b border-border-color flex gap-[14px] items-start">
            <div>
              <span className="font-mono text-[11px] text-faint bg-canvas rounded-[6px] py-[2px] px-[6px]">
                UC{String(useCase.id).padStart(2, '0')} · {pillarMeta[useCase.pillar].label}
              </span>
              <div className="flex gap-[5px] flex-wrap mt-[8px]">
                {useCase.tags.map(t => (
                  <span key={t} className={`text-[9.5px] font-bold tracking-[0.4px] py-[3px] px-[7px] rounded-[5px] uppercase ${tagColors[t]}`}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <button 
              onClick={onClose}
              className="ml-auto bg-canvas border border-border-color w-[30px] h-[30px] rounded-[8px] flex items-center justify-center text-muted hover:text-ink hover:bg-black/5 transition-colors cursor-pointer"
            >
              <X className="w-[15px] h-[15px]" />
            </button>
          </div>
          
          <div className="p-[22px_26px]">
            <h3 className="font-head text-[19px] m-[2px_0_10px] font-extrabold">{useCase.title}</h3>
            <div className="text-[13.5px] text-ink leading-[1.6] mb-[14px]">{useCase.desc}</div>
            
            <div className="bg-teal-tint border border-[#BFE7E7] rounded-[10px] p-[12px_14px] text-[12.5px] text-teal-deep mb-[20px]">
              <b className="text-ink font-bold">Impact:</b> {useCase.impact}
            </div>
            
            <div className="border border-dashed border-[#C9D2E6] rounded-[12px] p-[16px_18px] bg-[#FAFBFE]">
              <div className="flex items-center gap-[8px] mb-[12px]">
                <Settings2 className="w-[16px] h-[16px] text-navy-700" />
                <b className="text-[12.5px] font-head font-bold">Admin & usability controls for this use case</b>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
                <div className="bg-white border border-border-color rounded-[9px] p-[10px_12px]">
                  <div className="text-[10px] text-faint uppercase tracking-[0.4px] font-bold mb-[4px]">Enabled for</div>
                  <div className="text-[12.5px] font-semibold text-ink">6 of 6 plants</div>
                </div>
                <div className="bg-white border border-border-color rounded-[9px] p-[10px_12px]">
                  <div className="text-[10px] text-faint uppercase tracking-[0.4px] font-bold mb-[4px]">Rollout status</div>
                  <div className="text-[12.5px] font-semibold text-ink">{useCase.status === 'live' ? 'Live in production' : 'Pilot — 2 sites'}</div>
                </div>
                {cfgRows.map((r, i) => (
                  <div key={i} className="bg-white border border-border-color rounded-[9px] p-[10px_12px]">
                    <div className="text-[10px] text-faint uppercase tracking-[0.4px] font-bold mb-[4px]">{r[0]}</div>
                    <div className="text-[12.5px] font-semibold text-ink">{r[1]}</div>
                  </div>
                ))}
                <div className="bg-white border border-border-color rounded-[9px] p-[10px_12px]">
                  <div className="text-[10px] text-faint uppercase tracking-[0.4px] font-bold mb-[4px]">Human approval required</div>
                  <div className="text-[12.5px] font-semibold text-ink flex items-center gap-[6px]">
                    <span className="w-[28px] h-[16px] rounded-[20px] bg-green relative shrink-0">
                      <span className="absolute w-[12px] h-[12px] bg-white rounded-full top-[2px] right-[2px]" />
                    </span>
                    {useCase.tags.includes('AGENTIC') ? 'Yes, for high-risk actions' : 'No — advisory only'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
