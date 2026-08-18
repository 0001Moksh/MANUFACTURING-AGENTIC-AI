import React from 'react';
import { useStore } from '../../store';
import { useIntegrations } from '../../services/IntegrationContext';

// ─── Card definitions ─────────────────────────────────────────────────────────

interface IntegrationCardDef {
  key: 'MES' | 'Video Analytics';
  icon: string;
  title: string;
  desc: string;
  dbLabel: string;         // label shown inside the status badge
  connectedLabel: string;  // badge text when integration is enabled + DB connected
  pendingLabel: string;    // badge text when disabled / not connected
}

const INTEGRATION_CARDS: IntegrationCardDef[] = [
  {
    key: 'MES',
    icon: '🏭',
    title: 'MES',
    desc: 'Line-level throughput, machine status and control telemetry. Powers scheduling, maintenance, energy and reporting agents.',
    dbLabel: 'SQL Server (mes_new)',
    connectedLabel: 'SQL Server (mes_new)',
    pendingLabel: 'Pending',
  },
  {
    key: 'Video Analytics',
    icon: '🎥',
    title: 'Video Analytics',
    desc: 'Existing camera infrastructure for safety and site monitoring. Powers PPE compliance, behaviour detection and spill-detection agents.',
    dbLabel: 'Construction DB (construction_db)',
    connectedLabel: 'Construction DB',
    pendingLabel: 'Pending',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export const ConnectorsGrid: React.FC = () => {
  const { telemetryStats } = useStore();
  const { integrationStates, loading, toggleIntegration } = useIntegrations();
  const mesDbConnected = telemetryStats?.mes_db_status?.connected ?? false;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted text-[13px] py-4">
        <span className="w-[8px] h-[8px] rounded-full bg-border-color animate-pulse" />
        Loading integration status…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[12px]">
      {/* Header note */}
      <p className="text-[12.5px] text-muted leading-relaxed m-0">
        Enable or disable each data source below. Agents that depend on a disabled integration will be
        marked as <span className="font-semibold text-[#9A6400]">Requires Connection</span> across the
        platform until re-enabled.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-[14px]">
        {INTEGRATION_CARDS.map(card => {
          const isEnabled = integrationStates[card.key] ?? true;
          // MES additionally reflects real SQL Server connection state
          const isLive = card.key === 'MES' ? (mesDbConnected && isEnabled) : isEnabled;

          return (
            <div
              key={card.key}
              className={`border border-border-color bg-panel rounded-[14px] p-[18px_20px] flex flex-col gap-[14px] transition-all duration-300 ${
                !isEnabled ? 'opacity-55 grayscale-[0.25]' : 'hover:shadow-sm hover:border-teal/30'
              }`}
            >
              {/* Title row */}
              <div className="flex items-center gap-[12px]">
                <div className="w-[38px] h-[38px] rounded-[10px] bg-canvas flex items-center justify-center text-[18px] shrink-0 border border-border-color">
                  {card.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-head font-bold text-[14px] leading-tight">{card.title}</div>
                  <div className="text-[10.5px] text-faint font-mono mt-[2px]">{card.dbLabel}</div>
                </div>

                {/* Enable / Disable toggle */}
                <button
                  onClick={e => {
                    e.stopPropagation();
                    toggleIntegration(card.key, isEnabled);
                  }}
                  title={isEnabled ? `Disable ${card.title}` : `Enable ${card.title}`}
                  className={`relative w-[38px] h-[21px] rounded-[20px] border-none shrink-0 transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                    isEnabled ? 'bg-green focus:ring-green/40' : 'bg-[#D7DCE8] focus:ring-border-color'
                  }`}
                >
                  <div
                    className={`absolute w-[17px] h-[17px] bg-white rounded-full top-[2px] transition-all duration-200 shadow-sm ${
                      isEnabled ? 'right-[2px]' : 'left-[2px]'
                    }`}
                  />
                </button>
              </div>

              {/* Description */}
              <div className="text-[12px] text-muted leading-[1.55]">{card.desc}</div>

              {/* Status footer */}
              <div className="flex items-center justify-between pt-[10px] border-t border-border-color/60">
                {/* DB connection badge */}
                {isLive ? (
                  <div className="inline-flex items-center gap-[6px] text-[10.5px] font-bold text-green bg-green-tint py-[3px] px-[10px] rounded-[20px]">
                    <span className="w-[5px] h-[5px] rounded-full bg-green animate-pulse" />
                    {card.connectedLabel}
                  </div>
                ) : isEnabled && card.key === 'MES' ? (
                  /* MES enabled but falling back to SQLite */
                  <div className="inline-flex items-center gap-[6px] text-[10.5px] font-bold text-[#9A6400] bg-amber-tint py-[3px] px-[10px] rounded-[20px]">
                    <span className="w-[5px] h-[5px] rounded-full bg-amber animate-pulse" />
                    Local SQLite (Simulated)
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-[6px] text-[10.5px] font-bold text-muted bg-[#EEF0F5] py-[3px] px-[10px] rounded-[20px]">
                    <span className="w-[5px] h-[5px] rounded-full bg-[#B0BAD4]" />
                    {card.pendingLabel}
                  </div>
                )}

                {/* Enabled / Disabled pill */}
                <span
                  className={`text-[10.5px] font-bold py-[3px] px-[10px] rounded-[20px] transition-colors ${
                    isEnabled
                      ? 'bg-green-tint text-green'
                      : 'bg-[#EEF0F5] text-muted'
                  }`}
                >
                  {isEnabled ? '● Enabled' : '○ Disabled'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
