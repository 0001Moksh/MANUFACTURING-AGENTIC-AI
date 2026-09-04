import React from 'react';
import { type Agent, useCases, AGENT_INTEGRATION_DEPENDENCY } from '../../data/mockData';
import { AlertTriangle } from 'lucide-react';
import { agentService } from '../../services/api';
import { useIntegrations } from '../../services/IntegrationContext';
import { useNavigate } from 'react-router-dom';

interface AgentCardProps {
  agent: Agent;
  onClick?: () => void;
  isSelected?: boolean;
  isComingSoon?: boolean;
}

export const AgentCard: React.FC<AgentCardProps> = ({ agent, onClick, isSelected, isComingSoon = false }) => {
  const navigate = useNavigate();
  const { integrationStates, agentStates, toggleAgentState } = useIntegrations();
  const isAgentEnabled = agentStates[agent.n] ?? true;

  const poweredUseCases = useCases.filter(u => u.poweredBy?.includes(agent.n));

  // Determine if this agent's required integration is disabled
  const requiredIntegration = AGENT_INTEGRATION_DEPENDENCY[agent.n] ?? null;
  const integrationBlocked =
    requiredIntegration !== null && integrationStates[requiredIntegration] === false;

  const handleToggle = async () => {
    const nextState = !isAgentEnabled;
    await toggleAgentState(agent.n, nextState);
    try {
      await agentService.toggleAgent(agent.n, nextState);
    } catch (err) {
      console.error('Failed to toggle agent', err);
    }
  };

  const isBlocked = integrationBlocked || !isAgentEnabled;

  return (
    <div
      onClick={isBlocked || isComingSoon ? undefined : onClick}
      className={`bg-panel border rounded-[13px] p-[16px_18px] flex flex-col transition-all duration-300 ${
        isComingSoon
          ? 'opacity-90 grayscale-0 cursor-not-allowed border-dashed border-border-color bg-[#F8F9FC]'
          : isBlocked
          ? 'opacity-60 grayscale-[0.3] cursor-not-allowed border-border-color bg-[#FAFBFD]'
          : isSelected
          ? 'border-teal shadow-md ring-1 ring-teal/20 hover:border-teal/50 hover:shadow-sm cursor-pointer'
          : 'border-border-color hover:border-teal/50 hover:shadow-sm cursor-pointer'
      }`}
    >
      <div className="flex items-center gap-[10px] mb-[10px]">
        {/* Status dot — grey if integration blocked or agent disabled */}
        <div
          className={`w-[9px] h-[9px] rounded-full shrink-0 ${
            isBlocked || isComingSoon
              ? 'bg-[#B0BAD4]'
              : agent.status === 'active'
              ? 'bg-green shadow-[0_0_0_3px_var(--color-green-tint)]'
              : 'bg-amber shadow-[0_0_0_3px_var(--color-amber-tint)]'
          }`}
        />
        <div className="font-head font-bold text-[13.5px] flex-1 truncate">{agent.n}</div>
        {isComingSoon && <span className="text-[9px] font-extrabold tracking-[0.6px] py-[3px] px-[7px] rounded-[5px] bg-navy-900 text-white border border-navy-800 shadow-sm whitespace-nowrap">COMING SOON</span>}

        {/* Agent on/off toggle — functional for admins */}
        {!isComingSoon && (
        <button
          disabled={isComingSoon}
          onClick={e => {
            e.stopPropagation();
            handleToggle();
          }}
          title={isAgentEnabled ? "Disable AI Agent" : "Enable AI Agent"}
          className={`w-[34px] h-[19px] rounded-[20px] relative border-none shrink-0 transition-colors ${isComingSoon ? 'cursor-not-allowed bg-[#D7DCE8]' : 'cursor-pointer'} ${
            isAgentEnabled ? 'bg-green' : 'bg-[#D7DCE8]'
          }`}
        >
          <div
            className={`absolute w-[15px] h-[15px] bg-white rounded-full top-[2px] transition-all duration-200 ${
              isAgentEnabled ? 'right-[2px]' : 'left-[2px]'
            }`}
          />
        </button>
        )}
      </div>

      <div className="text-[12px] text-muted leading-[1.5] mb-[10px] flex-1">{agent.desc}</div>

      {/* "Requires Connection" warning banner */}
      {integrationBlocked && !isComingSoon && (
        <div className="mb-[10px] flex items-start gap-[6px] bg-amber-tint border border-amber/20 rounded-[8px] px-[10px] py-[7px]">
          <AlertTriangle className="w-4 h-4 text-amber shrink-0 mt-0.5" />
          <div className="text-[10.5px] text-[#9A6400] leading-[1.45] font-medium">
            Requires <span className="font-bold">{requiredIntegration}</span> — enable it in{' '}
            <span className="font-bold">Admin Console → Integrations</span>.
          </div>
        </div>
      )}

      {/* Powered Use Cases Badge section */}
      <div className="mb-2.5 pt-2 border-t border-border-color/60">
        <div className="text-[10px] font-bold text-faint uppercase tracking-wider mb-1 flex items-center justify-between">
          <span>
            Powers {poweredUseCases.length} Use Case{poweredUseCases.length !== 1 ? 's' : ''}
          </span>
        </div>
        {poweredUseCases.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {poweredUseCases.map(uc => (
              <button
                key={uc.id}
                disabled={isComingSoon}
                onClick={e => {
                  e.stopPropagation();
                  navigate(`/use-cases/${uc.id}`);
                }}
                className={`bg-canvas text-ink text-[10px] font-medium py-0.5 px-2 rounded border border-border-color/80 transition-colors truncate max-w-[190px] ${isComingSoon ? 'cursor-not-allowed' : 'hover:bg-teal-tint hover:text-teal-deep cursor-pointer'}`}
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
