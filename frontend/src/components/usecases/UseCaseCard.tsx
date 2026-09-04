import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { type UseCase, pillarMeta, AGENT_INTEGRATION_DEPENDENCY } from '../../data/mockData';
import { useIntegrations } from '../../services/IntegrationContext';

interface UseCaseCardProps {
  useCase: UseCase;
  onClick: () => void;
  isComingSoon?: boolean;
}

const tagColors: Record<string, string> = {
  AGENTIC: 'bg-amber-tint text-[#9A6400]',
  GENAI: 'bg-purple-tint text-[#5b4fd6]',
  VOICE: 'bg-teal-tint text-teal-deep',
  VISION: 'bg-red-tint text-[#B23A3A]',
  ML: 'bg-green-tint text-[#1a8f5f]',
  IOT: 'bg-blue-tint text-[#2258b0]',
};

/**
 * Returns the first blocked dependency (offline agent or missing integration) for this use case,
 * or null if all dependencies are satisfied.
 */
function useBlockedDependency(useCase: UseCase): { type: 'agent' | 'integration'; name: string } | null {
  const { integrationStates, agentStates } = useIntegrations();
  if (!useCase.poweredBy || useCase.poweredBy.length === 0) return null;

  for (const agentName of useCase.poweredBy) {
    // 1. Check if the AI Agent itself has been disabled by Admin
    if (agentStates[agentName] === false) {
      return { type: 'agent', name: agentName };
    }

    // 2. Check if the required integration for the AI Agent is disabled
    const required = AGENT_INTEGRATION_DEPENDENCY[agentName] ?? null;
    if (required !== null && integrationStates[required] === false) {
      return { type: 'integration', name: required };
    }
  }
  return null;
}

export const UseCaseCard: React.FC<UseCaseCardProps> = ({ useCase, onClick, isComingSoon: forcedComingSoon = false }) => {
  const navigate = useNavigate();
  const blockedDep = useBlockedDependency(useCase);
  const isComingSoon = forcedComingSoon || useCase.status === 'pilot';
  const isBlocked = blockedDep !== null || isComingSoon;

  return (
    <motion.div
      whileHover={
        isBlocked
          ? {}
          : { y: -4, boxShadow: '0 10px 24px -12px rgba(20,33,61,0.25)', borderColor: '#CBD6EE' }
      }
      onClick={isBlocked ? undefined : onClick}
      className={`bg-panel border border-border-color rounded-[13px] p-[16px_17px] flex flex-col gap-[9px] transition-colors ${
        isBlocked
          ? 'opacity-90 grayscale-0 cursor-not-allowed border-dashed bg-[#F8F9FC]'
          : 'cursor-pointer hover:border-border-color/80'
      }`}
    >
      {/* Header row: UC code + status badge */}
      <div className="flex items-start gap-[10px]">
        <span className="font-mono text-[10.5px] text-faint bg-canvas rounded-[6px] py-[2px] px-[6px] shrink-0">
          UC{String(useCase.id).padStart(2, '0')}
        </span>

        {/* Status chip — replaced with "Unavailable - Agent Offline" or "Requires Integration" badge when blocked */}
        {isComingSoon ? (
          <span className="ml-auto text-[9.5px] font-extrabold tracking-[0.6px] py-[3px] px-[8px] rounded-[5px] bg-navy-900 text-white border border-navy-800 shadow-sm whitespace-nowrap">COMING SOON</span>
        ) : blockedDep?.type === 'agent' ? (
          <span className="ml-auto inline-flex items-center gap-[4px] text-[9.5px] font-bold tracking-[0.4px] py-[2px] px-[8px] rounded-[20px] bg-red-100 text-red-700 border border-red-200 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            Unavailable - Agent Offline
          </span>
        ) : blockedDep?.type === 'integration' ? (
          <span className="ml-auto inline-flex items-center gap-[4px] text-[9.5px] font-bold tracking-[0.4px] py-[2px] px-[8px] rounded-[20px] bg-amber-tint text-[#9A6400] whitespace-nowrap">
            <span>⚠</span>
            Requires {blockedDep.name}
          </span>
        ) : (
          <span
            className={`ml-auto text-[9.5px] font-bold tracking-[0.4px] py-[2px] px-[7px] rounded-[20px] ${
              useCase.status === 'live' ? 'bg-green-tint text-green' : 'bg-amber-tint text-[#9A6400]'
            }`}
          >
            {useCase.status === 'live' ? 'LIVE' : 'PILOT'}
          </span>
        )}
      </div>

      <div className="font-head text-[14px] font-bold leading-[1.3]">{useCase.title}</div>

      <div className="flex gap-[5px] flex-wrap">
        {useCase.tags.map(t => (
          <span
            key={t}
            className={`text-[9.5px] font-bold tracking-[0.4px] py-[3px] px-[7px] rounded-[5px] uppercase ${tagColors[t]}`}
          >
            {t}
          </span>
        ))}
      </div>

      <div className="text-[12px] text-muted leading-[1.5] flex-1">{useCase.desc}</div>

      {/* Warning banner when blocked */}
      {isComingSoon ? (
        <div className="flex items-center gap-[6px] bg-canvas border border-border-color rounded-[7px] px-[9px] py-[6px]">
          <span className="text-[10.5px] text-faint font-medium">This roadmap use case is not available yet.</span>
        </div>
      ) : blockedDep?.type === 'agent' ? (
        <div className="flex items-center gap-[6px] bg-red-50 border border-red-200/80 rounded-[7px] px-[9px] py-[6px]">
          <span className="text-[12px]">🚫</span>
          <span className="text-[10.5px] text-red-700 font-medium">
            Powering agent <span className="font-bold">{blockedDep.name}</span> is disabled in AI Agents portfolio.
          </span>
        </div>
      ) : blockedDep?.type === 'integration' && (
        <div className="flex items-center gap-[6px] bg-amber-tint/60 border border-amber/15 rounded-[7px] px-[9px] py-[6px]">
          <span className="text-[12px]">🔌</span>
          <span className="text-[10.5px] text-[#9A6400] font-medium">
            Connect <span className="font-bold">{blockedDep.name}</span> in Admin Console to activate.
          </span>
        </div>
      )}

      {useCase.poweredBy && useCase.poweredBy.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap pt-2 border-t border-border-color/60 text-[10.5px]">
          <span className="text-faint font-semibold uppercase text-[9.5px]">Powered by:</span>
          {useCase.poweredBy.map(agentName => (
            <button
              key={agentName}
              disabled={isComingSoon}
              onClick={e => {
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
              className={`font-semibold px-1.5 py-0.5 rounded text-[9.5px] transition-colors border-none ${isComingSoon ? 'bg-canvas text-faint cursor-not-allowed' : 'bg-teal-tint/60 hover:bg-teal hover:text-white text-teal-deep cursor-pointer'}`}
            >
              {agentName}
            </button>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center mt-[2px] text-[11.5px] text-teal-deep font-bold border-t border-border-color/40 pt-2">
        <span>{pillarMeta[useCase.pillar].label}</span>
        {!isBlocked && <span>Details →</span>}
      </div>
    </motion.div>
  );
};
