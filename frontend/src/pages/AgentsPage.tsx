import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AgentCard } from '../components/agents/AgentCard';
import { agents, AGENT_INTEGRATION_DEPENDENCY } from '../data/mockData';
import { useIntegrations } from '../services/IntegrationContext';

const ACTIVE_AGENT_NAMES = new Set([
  'Maintenance Agent',
  'Reporting Agent',
  'Safety & Quality Agent',
  'Permit-to-Work Agent',
  'PPE & Behavior Vision Agent',
  'Incident & Investigation Agent',
]);

// ─── Simple toast helper ──────────────────────────────────────────────────────

interface Toast {
  id: number;
  message: string;
}

let _toastId = 0;

const ToastList: React.FC<{ toasts: Toast[] }> = ({ toasts }) => (
  <div className="fixed bottom-[24px] left-1/2 -translate-x-1/2 flex flex-col items-center gap-[8px] z-[9999] pointer-events-none">
    <AnimatePresence>
      {toasts.map(t => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ duration: 0.22 }}
          className="bg-[#2A1800] text-amber-100 text-[12.5px] font-medium px-[18px] py-[10px] rounded-[10px] shadow-xl border border-amber/30 max-w-[420px] text-center leading-[1.4]"
        >
          ⚠️ {t.message}
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

export const AgentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeAgentName, setActiveAgentName] = useState('Maintenance Agent');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const { integrationStates } = useIntegrations();
  const activeAgents = agents.filter(agent => ACTIVE_AGENT_NAMES.has(agent.n));
  const upcomingAgents = agents.filter(agent => !ACTIVE_AGENT_NAMES.has(agent.n));

  /** Show a temporary toast that auto-dismisses after 3.5 s */
  const showToast = useCallback((message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  /** Returns a user-friendly guard message if the agent's integration is disabled, else null */
  const getBlockReason = useCallback(
    (agentName: string): string | null => {
      const required = AGENT_INTEGRATION_DEPENDENCY[agentName] ?? null;
      if (required !== null && integrationStates[required] === false) {
        return required === 'MES'
          ? `Please connect your MES application so we can use the ${agentName}.`
          : `Please connect Video Analytics so we can use the ${agentName}.`;
      }
      return null;
    },
    [integrationStates]
  );

  const handleAgentClick = (agentName: string) => {
    if (!ACTIVE_AGENT_NAMES.has(agentName)) return;
    // Guard: check if the required integration is disabled
    const blockReason = getBlockReason(agentName);
    if (blockReason) {
      showToast(blockReason);
      return; // do not navigate
    }

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
    } else if (
      agentName === 'Incident & Investigation Agent' ||
      agentName === 'Incident and Investigation Agent' ||
      agentName === 'Incident & Investigation'
    ) {
      navigate('/agents/incident-investigation');
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
          AI Agent Portfolio
        </h2>
        <p className="m-0 text-muted text-[13.5px] max-w-[720px] leading-relaxed">
          Each agent can be toggled per site by a Plant Digital Head. Agents whose data source is
          disabled in <span className="font-semibold">Admin Console → Integrations</span> are marked
          as <span className="font-semibold text-[#9A6400]">Requires Connection</span> and cannot be
          launched until the integration is re-enabled.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[14px]">
        {activeAgents.map((a, i) => (
          <AgentCard
            key={i}
            agent={a}
            isSelected={activeAgentName === a.n}
            isComingSoon={!ACTIVE_AGENT_NAMES.has(a.n)}
            onClick={() => handleAgentClick(a.n)}
          />
        ))}
      </div>

      <hr className="my-9 border-0 border-t border-border-color" />
      <section aria-labelledby="future-agents-heading">
        <h3 id="future-agents-heading" className="font-head text-[18px] font-extrabold text-ink m-[0_0_16px]">
          Future Capabilities &amp; Coming Soon
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[14px]">
          {upcomingAgents.map(a => (
            <AgentCard
              key={a.n}
              agent={a}
              isSelected={activeAgentName === a.n}
              isComingSoon
              onClick={() => handleAgentClick(a.n)}
            />
          ))}
        </div>
      </section>

      {/* Toast layer */}
      <ToastList toasts={toasts} />
    </motion.div>
  );
};
