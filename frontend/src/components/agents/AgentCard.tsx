import React, { useState } from 'react';
import { type Agent, useCases } from '../../data/mockData';
import { agentService } from '../../services/api';
import { useNavigate } from 'react-router-dom';

interface AgentCardProps {
  agent: Agent;
  onClick?: () => void;
  isSelected?: boolean;
}

export const AgentCard: React.FC<AgentCardProps> = ({ agent, onClick, isSelected }) => {
  const navigate = useNavigate();
  const [isOn, setIsOn] = useState(true);

  const poweredUseCases = useCases.filter(u => u.poweredBy?.includes(agent.n));

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
      
      <div className="text-[12px] text-muted leading-[1.5] mb-[10px] flex-1">
        {agent.desc}
      </div>

      {/* Powered Use Cases Badge section */}
      <div className="mb-2.5 pt-2 border-t border-border-color/60">
        <div className="text-[10px] font-bold text-faint uppercase tracking-wider mb-1 flex items-center justify-between">
          <span>Powers {poweredUseCases.length} Use Case{poweredUseCases.length !== 1 ? 's' : ''}</span>
        </div>
        {poweredUseCases.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {poweredUseCases.map(uc => (
              <button
                key={uc.id}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/use-cases/${uc.id}`);
                }}
                className="bg-canvas hover:bg-teal-tint hover:text-teal-deep text-ink text-[10px] font-medium py-0.5 px-2 rounded border border-border-color/80 transition-colors truncate max-w-[190px] cursor-pointer"
                title={uc.title}
              >
                UC{String(uc.id).padStart(2, '0')}: {uc.title}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-[10px] text-faint italic">Infrastructure / Universal Agent</div>
        )}
      </div>

      {agent.n === 'Reporting Agent' && (
        <div className="mb-2.5">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal bg-teal-tint/60 px-2 py-0.5 rounded border border-teal/20">
            Open LangGraph SQL Console ↗
          </span>
        </div>
      )}
      
      <div className="flex justify-between text-[11px] text-faint border-t border-border-color pt-[10px] font-mono">
        <span>{agent.sig}</span>
        <span>{agent.last}</span>
      </div>
    </div>
  );
};
