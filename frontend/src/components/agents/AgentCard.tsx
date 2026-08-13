import React, { useState } from 'react';
import { type Agent } from '../../data/mockData';
import { agentService } from '../../services/api';

interface AgentCardProps {
  agent: Agent;
  onClick?: () => void;
  isSelected?: boolean;
}

export const AgentCard: React.FC<AgentCardProps> = ({ agent, onClick, isSelected }) => {
  const [isOn, setIsOn] = useState(true);

  const handleToggle = async () => {
    const nextState = !isOn;
    setIsOn(nextState);
    try {
      await agentService.toggleAgent(agent.n, nextState);
    } catch (err) {
      console.error('Failed to toggle agent', err);
    }
  };

  return (
    <div 
      onClick={onClick}
      className={`bg-panel border rounded-[13px] p-[16px_18px] flex flex-col hover:border-teal/50 hover:shadow-sm transition-all duration-300 cursor-pointer ${
        isSelected ? 'border-teal shadow-md ring-1 ring-teal/20' : 'border-border-color'
      }`}
    >
      <div className="flex items-center gap-[10px] mb-[10px]">
        <div className={`w-[9px] h-[9px] rounded-full shrink-0 ${
          agent.status === 'active' 
            ? 'bg-green shadow-[0_0_0_3px_var(--color-green-tint)]' 
            : 'bg-amber shadow-[0_0_0_3px_var(--color-amber-tint)]'
        }`} />
        <div className="font-head font-bold text-[13.5px] flex-1 truncate">
          {agent.n}
        </div>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            handleToggle();
          }}
          className={`w-[34px] h-[19px] rounded-[20px] relative border-none shrink-0 transition-colors cursor-pointer ${
            isOn ? 'bg-green' : 'bg-[#D7DCE8]'
          }`}
        >
          <div className={`absolute w-[15px] h-[15px] bg-white rounded-full top-[2px] transition-all duration-200 ${
            isOn ? 'right-[2px]' : 'left-[2px]'
          }`} />
        </button>
      </div>
      
      <div className="text-[12px] text-muted leading-[1.5] mb-[12px] flex-1">
        {agent.desc}
      </div>
      
      <div className="flex justify-between text-[11px] text-faint border-t border-border-color pt-[10px] font-mono">
        <span>{agent.sig}</span>
        <span>{agent.last}</span>
      </div>
    </div>
  );
};
