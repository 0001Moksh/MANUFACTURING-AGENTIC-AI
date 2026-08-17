import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { type UseCase, pillarMeta } from '../../data/mockData';

interface UseCaseCardProps {
  useCase: UseCase;
  onClick: () => void;
}

const tagColors: Record<string, string> = {
  AGENTIC: 'bg-amber-tint text-[#9A6400]',
  GENAI: 'bg-purple-tint text-[#5b4fd6]',
  VOICE: 'bg-teal-tint text-teal-deep',
  VISION: 'bg-red-tint text-[#B23A3A]',
  ML: 'bg-green-tint text-[#1a8f5f]',
  IOT: 'bg-blue-tint text-[#2258b0]',
};

export const UseCaseCard: React.FC<UseCaseCardProps> = ({ useCase, onClick }) => {
  const navigate = useNavigate();

  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: '0 10px 24px -12px rgba(20,33,61,0.25)', borderColor: '#CBD6EE' }}
      onClick={onClick}
      className="bg-panel border border-border-color rounded-[13px] p-[16px_17px] flex flex-col gap-[9px] cursor-pointer transition-colors"
    >
      <div className="flex items-start gap-[10px]">
        <span className="font-mono text-[10.5px] text-faint bg-canvas rounded-[6px] py-[2px] px-[6px] shrink-0">
          UC{String(useCase.id).padStart(2, '0')}
        </span>
        <span className={`ml-auto text-[9.5px] font-bold tracking-[0.4px] py-[2px] px-[7px] rounded-[20px] ${
          useCase.status === 'live' ? 'bg-green-tint text-green' : 'bg-amber-tint text-[#9A6400]'
        }`}>
          {useCase.status === 'live' ? 'LIVE' : 'PILOT'}
        </span>
      </div>
      
      <div className="font-head text-[14px] font-bold leading-[1.3]">
        {useCase.title}
      </div>
      
      <div className="flex gap-[5px] flex-wrap">
        {useCase.tags.map(t => (
          <span key={t} className={`text-[9.5px] font-bold tracking-[0.4px] py-[3px] px-[7px] rounded-[5px] uppercase ${tagColors[t]}`}>
            {t}
          </span>
        ))}
      </div>
      
      <div className="text-[12px] text-muted leading-[1.5] flex-1">
        {useCase.desc}
      </div>

      {useCase.poweredBy && useCase.poweredBy.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap pt-2 border-t border-border-color/60 text-[10.5px]">
          <span className="text-faint font-semibold uppercase text-[9.5px]">Powered by:</span>
          {useCase.poweredBy.map(agentName => (
            <button
              key={agentName}
              onClick={(e) => {
                e.stopPropagation();
                if (agentName === 'Reporting Agent') {
                  navigate('/agents/reporting');
                } else if (agentName === 'Maintenance Agent') {
                  navigate('/agents/maintenance');
                } else if (agentName === 'Safety & Quality Agent') {
                  navigate('/agents/safety-quality');
                } else if (agentName === 'PPE & Behavior Vision Agent') {
                  navigate('/agents/ppe-vision');
                } else if (agentName === 'Permit-to-Work Agent' || agentName === 'Permit to Work Agent') {
                  navigate('/agents/permit-to-work');
                } else {
                  navigate('/agents');
                }
              }}
              className="bg-teal-tint/60 hover:bg-teal hover:text-white text-teal-deep font-semibold px-1.5 py-0.5 rounded text-[9.5px] transition-colors border-none cursor-pointer"
            >
              {agentName}
            </button>
          ))}
        </div>
      )}
      
      <div className="flex justify-between items-center mt-[2px] text-[11.5px] text-teal-deep font-bold border-t border-border-color/40 pt-2">
        <span>{pillarMeta[useCase.pillar].label}</span>
        <span>Details →</span>
      </div>
    </motion.div>
  );
};
