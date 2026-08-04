import React from 'react';
import { motion } from 'framer-motion';
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
      
      <div className="flex justify-between items-center mt-[2px] text-[11.5px] text-teal-deep font-bold">
        <span>{pillarMeta[useCase.pillar].label}</span>
        <span>Details →</span>
      </div>
    </motion.div>
  );
};
