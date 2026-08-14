import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AgentCard } from '../components/agents/AgentCard';
import { agents } from '../data/mockData';

export const AgentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeAgentName, setActiveAgentName] = useState('Operations Agent');

  const handleAgentClick = (agentName: string) => {
    if (agentName === 'Reporting Agent') {
      navigate('/agents/reporting');
    } else if (agentName === 'Maintenance Agent') {
      navigate('/agents/maintenance');
    } else if (agentName === 'Safety & Quality Agent') {
      navigate('/agents/safety-quality');
    } else if (agentName === 'PPE & Behavior Vision Agent') {
      navigate('/agents/ppe-vision');
    } else {
      setActiveAgentName(agentName);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-[20px]">
        <div className="text-[11px] font-bold tracking-[1.2px] text-teal-deep uppercase mb-[6px]">
          Always On, Always Acting
        </div>
        <h2 className="font-head text-[24px] m-[0_0_6px] font-extrabold text-ink">
          13 Specialized AI Agents
        </h2>
        <p className="m-0 text-muted text-[13.5px] max-w-[720px] leading-relaxed">
          Each agent can be toggled per site by a Plant Digital Head. Turning an agent off here is simulated — thresholds, schedules and escalation contacts are configurable per agent.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[14px] mb-8">
        {agents.map((a, i) => (
          <AgentCard 
            key={i} 
            agent={a} 
            isSelected={activeAgentName === a.n}
            onClick={() => handleAgentClick(a.n)}
          />
        ))}
      </div>
    </motion.div>
  );
};



