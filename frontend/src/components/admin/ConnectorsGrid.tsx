import React from 'react';
import { Database, Radio, Activity } from 'lucide-react';
import { useStore } from '../../store';
import { useIntegrations } from '../../services/IntegrationContext';

// ─── Card definitions ─────────────────────────────────────────────────────────

interface IntegrationCardDef {
  key: string;
  iconType: 'mes' | 'va' | 'grafana';
  title: string;
  desc: string;
  dbLabel: string;
  connectedLabel: string;
  pendingLabel: string;
  engineLabel: string;
  protocolLabel: string;
}

const INTEGRATION_CARDS: IntegrationCardDef[] = [
  {
    key: 'MES',
    iconType: 'mes',
    title: 'MES',
    desc: 'Line-level throughput, machine status and control telemetry. Powers scheduling, maintenance, energy and reporting agents.',
    dbLabel: 'SQL Server (mes_new)',
    connectedLabel: 'SQL Server (mes_new)',
    pendingLabel: 'Pending',
    engineLabel: 'MS SQL Server',
    protocolLabel: 'ODBC / PyODBC 1433',
  },
  {
    key: 'Video Analytics',
    iconType: 'va',
    title: 'Video Analytics',
    desc: 'Existing camera infrastructure for safety and site monitoring. Powers PPE compliance, behaviour detection and spill-detection agents.',
    dbLabel: 'Construction DB (construction_db)',
    connectedLabel: 'Construction DB',
    pendingLabel: 'Pending',
    engineLabel: 'PostgreSQL 5432',
    protocolLabel: 'RTSP / Snapshot Proxy',
  },
  {
    key: 'Grafana IoT Application',
    iconType: 'grafana',
    title: 'Grafana IoT Application',
    desc: 'Real-time equipment telemetry dashboards, sensor time-series data, and industrial IoT alert streaming integration.',
    dbLabel: 'Grafana Server (192.168.10.130:3000)',
    connectedLabel: 'Grafana Server',
    pendingLabel: 'Pending',
    engineLabel: 'Grafana IoT / InfluxDB',
    protocolLabel: 'HTTP API / Telemetry Stream',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export const ConnectorsGrid: React.FC = () => {
  const { telemetryStats } = useStore();
  const { integrationStates, loading, toggleIntegration } = useIntegrations();

  const mesDbConnected = telemetryStats?.mes_db_status?.connected ?? false;
  const vaDbConnected = telemetryStats?.video_analytics_db_status?.connected ?? false;
  const grafanaDbConnected =
    (telemetryStats as any)?.grafana_status?.status === 'CONNECTED' ||
    (telemetryStats as any)?.grafana_status?.dashboards_active === true;

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[14px]">
        {INTEGRATION_CARDS.map(card => {
          const isEnabled = integrationStates[card.key] ?? integrationStates[card.title] ?? true;
          let isDbConnected = false;
          if (card.key === 'MES') isDbConnected = mesDbConnected;
          else if (card.key === 'Video Analytics') isDbConnected = vaDbConnected;
          else if (card.key === 'Grafana IoT Application') isDbConnected = grafanaDbConnected;

          const isLive = isDbConnected && isEnabled;

          return (
            <div
              key={card.key}
              className={`border border-border-color bg-panel rounded-[14px] p-[18px_20px] flex flex-col justify-between gap-[14px] transition-all duration-300 ${
                !isEnabled ? 'opacity-55 grayscale-[0.25]' : 'hover:shadow-sm hover:border-teal/30'
              }`}
            >
              <div className="flex flex-col gap-[12px]">
                {/* Title row */}
                <div className="flex items-center justify-between gap-[12px]">
                  <div className="flex items-center gap-[10px] min-w-0">
                    <div
                      className={`w-[34px] h-[34px] rounded-[8px] flex items-center justify-center shrink-0 ${
                        card.iconType === 'mes'
                          ? 'bg-teal-tint text-teal'
                          : card.iconType === 'va'
                          ? 'bg-purple-tint text-purple'
                          : 'bg-[#E8F1FF] text-[#0B63E5]'
                      }`}
                    >
                      {card.iconType === 'mes' && <Database className="w-[18px] h-[18px]" />}
                      {card.iconType === 'va' && <Radio className="w-[18px] h-[18px]" />}
                      {card.iconType === 'grafana' && <Activity className="w-[18px] h-[18px]" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-head font-bold text-[14px] leading-tight truncate text-ink">{card.title}</div>
                      <div className="text-[10.5px] text-faint font-mono mt-[2px] truncate">{card.dbLabel}</div>
                    </div>
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

                {/* Engine & Protocol info */}
                <div className="p-[10px_12px] rounded-[8px] bg-canvas border border-border-color/60 text-[11.5px] flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-muted">
                    <span>Platform Engine:</span>
                    <span className="font-mono font-medium text-ink">{card.engineLabel}</span>
                  </div>
                  <div className="flex items-center justify-between text-muted">
                    <span>Protocol:</span>
                    <span className="font-mono text-ink">{card.protocolLabel}</span>
                  </div>
                </div>
              </div>

              {/* Status footer */}
              <div className="flex items-center justify-between pt-[10px] border-t border-border-color/60">
                {/* Connection status badge */}
                {isLive ? (
                  <div className="inline-flex items-center gap-[6px] text-[10.5px] font-bold text-green bg-green-tint py-[3px] px-[10px] rounded-[20px]">
                    <span className="w-[5px] h-[5px] rounded-full bg-green animate-pulse" />
                    {card.connectedLabel}
                  </div>
                ) : isEnabled ? (
                  /* Enabled but fallback */
                  <div className="inline-flex items-center gap-[6px] text-[10.5px] font-bold text-[#9A6400] bg-amber-tint py-[3px] px-[10px] rounded-[20px]">
                    <span className="w-[5px] h-[5px] rounded-full bg-amber animate-pulse" />
                    Local InfluxDB (Simulated)
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
