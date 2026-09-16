import React, { useState, useEffect } from 'react';
import {
  Activity,
  Server,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Sliders,
  Globe,
  Key,
  Save,
  Eye,
  EyeOff,
  AlertCircle,
  Database,
  Radio,
} from 'lucide-react';
import { useStore } from '../../store';
import { useIntegrations } from '../../services/IntegrationContext';

interface ToastNotice {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

let _noticeId = 0;

export const ConnectorsGrid: React.FC = () => {
  const { telemetryStats } = useStore();
  const {
    integrations,
    integrationStates,
    loading,
    toggleIntegration,
    testIntegrationConnection,
    saveIntegrationConfig,
  } = useIntegrations();

  // Local form states for Grafana card
  const [grafanaUrl, setGrafanaUrl] = useState('http://192.168.10.130:3000');
  const [grafanaToken, setGrafanaToken] = useState('');
  const [grafanaOrgId, setGrafanaOrgId] = useState(1);
  const [showToken, setShowToken] = useState(false);

  // Testing & saving states
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, {
    success: boolean;
    status: string;
    message: string;
    latency_ms: number;
  }>>({});
  const [toasts, setToasts] = useState<ToastNotice[]>([]);

  // Sync initial Grafana integration data from backend
  useEffect(() => {
    const gItem = integrations.find(i => i.name.toLowerCase().includes('grafana'));
    if (gItem) {
      if (gItem.server_url) setGrafanaUrl(gItem.server_url);
      if (gItem.api_token) setGrafanaToken(gItem.api_token);
      if (gItem.org_id) setGrafanaOrgId(gItem.org_id);
      if (gItem.status && gItem.status !== 'UNTESTED') {
        setTestResults(prev => ({
          ...prev,
          grafana: {
            success: gItem.status === 'CONNECTED',
            status: gItem.status || 'UNTESTED',
            message: gItem.details || (gItem.status === 'CONNECTED' ? 'Connected to Grafana' : 'Disconnected'),
            latency_ms: 0,
          },
        }));
      }
    }
  }, [integrations]);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = ++_noticeId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const handleTestConnection = async (type: 'grafana' | 'mes' | 'video_analytics') => {
    setTestingKey(type);
    try {
      let payload: any = { integration_type: type };
      if (type === 'grafana') {
        payload = {
          integration_type: 'grafana',
          server_url: grafanaUrl,
          api_token: grafanaToken,
          org_id: Number(grafanaOrgId) || 1,
        };
      }

      const res = await testIntegrationConnection(payload);
      setTestResults(prev => ({ ...prev, [type]: res }));

      if (res.success) {
        showToast('success', `Success: Connection verified (${res.latency_ms}ms)`);
      } else {
        showToast('error', `Error: ${res.message || 'Failed to reach server'}`);
      }
    } catch (err: any) {
      showToast('error', `Error: ${err?.message || 'Connection test failed'}`);
    } finally {
      setTestingKey(null);
    }
  };

  const handleSaveGrafana = async () => {
    setSavingKey('grafana');
    try {
      const isEnabled = integrationStates['Grafana IoT Application'] ?? integrationStates['Grafana'] ?? true;
      const res = await saveIntegrationConfig({
        name: 'Grafana IoT Application',
        is_enabled: isEnabled,
        server_url: grafanaUrl.trim(),
        api_token: grafanaToken.trim(),
        org_id: Number(grafanaOrgId) || 1,
      });

      if (res.success) {
        showToast('success', 'Grafana IoT configuration saved successfully.');
      } else {
        showToast('error', `Save failed: ${res.message}`);
      }
    } catch (err: any) {
      showToast('error', `Save error: ${err?.message || 'Failed to save'}`);
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted text-[13px] py-6">
        <RefreshCw className="w-4 h-4 animate-spin text-teal" />
        <span>Loading integration configurations and health states...</span>
      </div>
    );
  }

  const mesDbConnected = telemetryStats?.mes_db_status?.connected ?? false;
  const vaDbConnected = telemetryStats?.video_analytics_db_status?.connected ?? false;
  const isMesEnabled = integrationStates['MES'] ?? true;
  const isVaEnabled = integrationStates['Video Analytics'] ?? true;
  const isGrafanaEnabled = integrationStates['Grafana IoT Application'] ?? integrationStates['Grafana'] ?? true;

  const grafanaTest = testResults['grafana'];
  const grafanaItem = integrations.find(i => i.name.toLowerCase().includes('grafana'));
  const grafanaStatus = grafanaTest?.status || grafanaItem?.status || 'UNTESTED';
  const isGrafanaConnected = isGrafanaEnabled && (grafanaStatus === 'CONNECTED' || grafanaTest?.success === true);

  return (
    <div className="flex flex-col gap-[16px] relative">
      {/* Toast Notifications Overlay */}
      {toasts.length > 0 && (
        <div className="fixed top-[20px] right-[24px] flex flex-col gap-[10px] z-[99999] pointer-events-none">
          {toasts.map(t => (
            <div
              key={t.id}
              className={`p-[12px_16px] rounded-[10px] shadow-lg border text-[12.5px] font-medium flex items-center gap-[10px] max-w-[380px] pointer-events-auto transition-all ${
                t.type === 'success'
                  ? 'bg-[#0E241B] border-green/40 text-[#A3F3CA]'
                  : t.type === 'error'
                  ? 'bg-[#2A1010] border-red-500/40 text-[#FFC4C4]'
                  : 'bg-panel border-border-color text-ink'
              }`}
            >
              {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-green shrink-0" />}
              {t.type === 'error' && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
              {t.type === 'info' && <AlertCircle className="w-4 h-4 text-teal shrink-0" />}
              <span className="leading-snug">{t.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Header Note */}
      <div className="flex items-start justify-between gap-4 p-[14px_16px] rounded-[12px] bg-panel border border-border-color">
        <div className="flex items-start gap-[10px]">
          <Sliders className="w-4 h-4 text-teal mt-[2px] shrink-0" />
          <p className="text-[12.5px] text-muted leading-relaxed m-0">
            Enterprise connectivity suite for manufacturing AI agents. Configure credentials, test real-time
            endpoint availability, and toggle data source activation. Agents requiring an inactive or disconnected
            data pipeline will safely guard actions until restored.
          </p>
        </div>
      </div>

      {/* Connectors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[16px]">
        {/* ── CARD 1: MES (SQL Server) ── */}
        <div
          className={`border border-border-color bg-panel rounded-[14px] p-[18px_20px] flex flex-col justify-between gap-[14px] transition-all duration-300 ${
            !isMesEnabled ? 'opacity-60 grayscale-[0.25]' : 'hover:shadow-sm hover:border-teal/30'
          }`}
        >
          <div className="flex flex-col gap-[12px]">
            {/* Title & Toggle */}
            <div className="flex items-center justify-between gap-[12px]">
              <div className="flex items-center gap-[10px]">
                <div className="w-[34px] h-[34px] rounded-[8px] bg-teal-tint flex items-center justify-center text-teal">
                  <Database className="w-[18px] h-[18px]" />
                </div>
                <div>
                  <div className="font-head font-bold text-[14px] leading-tight text-ink">MES</div>
                  <div className="text-[10.5px] text-faint font-mono mt-[2px]">SQL Server (mes_new)</div>
                </div>
              </div>

              <button
                onClick={() => toggleIntegration('MES', isMesEnabled)}
                title={isMesEnabled ? 'Disable MES' : 'Enable MES'}
                className={`relative w-[38px] h-[21px] rounded-[20px] border-none shrink-0 transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                  isMesEnabled ? 'bg-green focus:ring-green/40' : 'bg-[#D7DCE8] focus:ring-border-color'
                }`}
              >
                <div
                  className={`absolute w-[17px] h-[17px] bg-white rounded-full top-[2px] transition-all duration-200 shadow-sm ${
                    isMesEnabled ? 'right-[2px]' : 'left-[2px]'
                  }`}
                />
              </button>
            </div>

            {/* Description */}
            <div className="text-[12px] text-muted leading-[1.55]">
              Line-level throughput, machine status and control telemetry. Powers scheduling, maintenance, energy and reporting agents.
            </div>

            {/* Live details indicator */}
            <div className="p-[10px_12px] rounded-[8px] bg-canvas border border-border-color/60 text-[11.5px] flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-muted">
                <span>Database Engine:</span>
                <span className="font-mono font-medium text-ink">MS SQL Server</span>
              </div>
              <div className="flex items-center justify-between text-muted">
                <span>Protocol:</span>
                <span className="font-mono text-ink">ODBC / PyODBC 1433</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-[10px] pt-[12px] border-t border-border-color/60">
            <div className="flex items-center justify-between">
              {/* DB status badge */}
              {mesDbConnected && isMesEnabled ? (
                <div className="inline-flex items-center gap-[6px] text-[10.5px] font-bold text-green bg-green-tint py-[3px] px-[10px] rounded-[20px]">
                  <span className="w-[5px] h-[5px] rounded-full bg-green animate-pulse" />
                  SQL Server Connected
                </div>
              ) : isMesEnabled ? (
                <div className="inline-flex items-center gap-[6px] text-[10.5px] font-bold text-[#9A6400] bg-amber-tint py-[3px] px-[10px] rounded-[20px]">
                  <span className="w-[5px] h-[5px] rounded-full bg-amber animate-pulse" />
                  Local SQLite Fallback
                </div>
              ) : (
                <div className="inline-flex items-center gap-[6px] text-[10.5px] font-bold text-muted bg-[#EEF0F5] py-[3px] px-[10px] rounded-[20px]">
                  <span className="w-[5px] h-[5px] rounded-full bg-[#B0BAD4]" />
                  Disabled
                </div>
              )}

              <button
                onClick={() => handleTestConnection('mes')}
                disabled={testingKey === 'mes'}
                className="inline-flex items-center gap-[6px] text-[11px] font-medium py-[4px] px-[10px] rounded-[6px] border border-border-color bg-panel hover:bg-canvas text-ink transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${testingKey === 'mes' ? 'animate-spin text-teal' : ''}`} />
                <span>{testingKey === 'mes' ? 'Pinging...' : 'Test Connection'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── CARD 2: Video Analytics (PostgreSQL) ── */}
        <div
          className={`border border-border-color bg-panel rounded-[14px] p-[18px_20px] flex flex-col justify-between gap-[14px] transition-all duration-300 ${
            !isVaEnabled ? 'opacity-60 grayscale-[0.25]' : 'hover:shadow-sm hover:border-teal/30'
          }`}
        >
          <div className="flex flex-col gap-[12px]">
            {/* Title & Toggle */}
            <div className="flex items-center justify-between gap-[12px]">
              <div className="flex items-center gap-[10px]">
                <div className="w-[34px] h-[34px] rounded-[8px] bg-purple-tint flex items-center justify-center text-purple">
                  <Radio className="w-[18px] h-[18px]" />
                </div>
                <div>
                  <div className="font-head font-bold text-[14px] leading-tight text-ink">Video Analytics</div>
                  <div className="text-[10.5px] text-faint font-mono mt-[2px]">Construction DB (construction_ai)</div>
                </div>
              </div>

              <button
                onClick={() => toggleIntegration('Video Analytics', isVaEnabled)}
                title={isVaEnabled ? 'Disable Video Analytics' : 'Enable Video Analytics'}
                className={`relative w-[38px] h-[21px] rounded-[20px] border-none shrink-0 transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                  isVaEnabled ? 'bg-green focus:ring-green/40' : 'bg-[#D7DCE8] focus:ring-border-color'
                }`}
              >
                <div
                  className={`absolute w-[17px] h-[17px] bg-white rounded-full top-[2px] transition-all duration-200 shadow-sm ${
                    isVaEnabled ? 'right-[2px]' : 'left-[2px]'
                  }`}
                />
              </button>
            </div>

            {/* Description */}
            <div className="text-[12px] text-muted leading-[1.55]">
              Existing camera infrastructure for safety and site monitoring. Powers PPE compliance, behaviour detection and spill-detection agents.
            </div>

            {/* Live details indicator */}
            <div className="p-[10px_12px] rounded-[8px] bg-canvas border border-border-color/60 text-[11.5px] flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-muted">
                <span>Database Engine:</span>
                <span className="font-mono font-medium text-ink">PostgreSQL 5432</span>
              </div>
              <div className="flex items-center justify-between text-muted">
                <span>Stream Protocol:</span>
                <span className="font-mono text-ink">RTSP / Snapshot Proxy</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-[10px] pt-[12px] border-t border-border-color/60">
            <div className="flex items-center justify-between">
              {/* DB status badge */}
              {vaDbConnected && isVaEnabled ? (
                <div className="inline-flex items-center gap-[6px] text-[10.5px] font-bold text-green bg-green-tint py-[3px] px-[10px] rounded-[20px]">
                  <span className="w-[5px] h-[5px] rounded-full bg-green animate-pulse" />
                  PostgreSQL Connected
                </div>
              ) : isVaEnabled ? (
                <div className="inline-flex items-center gap-[6px] text-[10.5px] font-bold text-[#9A6400] bg-amber-tint py-[3px] px-[10px] rounded-[20px]">
                  <span className="w-[5px] h-[5px] rounded-full bg-amber animate-pulse" />
                  Local DB Fallback
                </div>
              ) : (
                <div className="inline-flex items-center gap-[6px] text-[10.5px] font-bold text-muted bg-[#EEF0F5] py-[3px] px-[10px] rounded-[20px]">
                  <span className="w-[5px] h-[5px] rounded-full bg-[#B0BAD4]" />
                  Disabled
                </div>
              )}

              <button
                onClick={() => handleTestConnection('video_analytics')}
                disabled={testingKey === 'video_analytics'}
                className="inline-flex items-center gap-[6px] text-[11px] font-medium py-[4px] px-[10px] rounded-[6px] border border-border-color bg-panel hover:bg-canvas text-ink transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${testingKey === 'video_analytics' ? 'animate-spin text-teal' : ''}`} />
                <span>{testingKey === 'video_analytics' ? 'Pinging...' : 'Test Connection'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── CARD 3: Grafana IoT Application (Extended Engine) ── */}
        <div
          className={`border border-border-color bg-panel rounded-[14px] p-[18px_20px] flex flex-col justify-between gap-[14px] transition-all duration-300 md:col-span-2 lg:col-span-1 ${
            !isGrafanaEnabled ? 'opacity-60 grayscale-[0.25]' : 'hover:shadow-sm hover:border-teal/30'
          }`}
        >
          <div className="flex flex-col gap-[12px]">
            {/* Title & Toggle */}
            <div className="flex items-center justify-between gap-[12px]">
              <div className="flex items-center gap-[10px]">
                <div className="w-[34px] h-[34px] rounded-[8px] bg-[#E8F1FF] flex items-center justify-center text-[#0B63E5]">
                  <Activity className="w-[18px] h-[18px]" />
                </div>
                <div>
                  <div className="font-head font-bold text-[14px] leading-tight text-ink">Grafana IoT Application</div>
                  <div className="text-[10.5px] text-faint font-mono mt-[2px]">Telemetry, Dashboards & Alerts</div>
                </div>
              </div>

              <button
                onClick={() => toggleIntegration('Grafana IoT Application', isGrafanaEnabled)}
                title={isGrafanaEnabled ? 'Disable Grafana IoT' : 'Enable Grafana IoT'}
                className={`relative w-[38px] h-[21px] rounded-[20px] border-none shrink-0 transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                  isGrafanaEnabled ? 'bg-green focus:ring-green/40' : 'bg-[#D7DCE8] focus:ring-border-color'
                }`}
              >
                <div
                  className={`absolute w-[17px] h-[17px] bg-white rounded-full top-[2px] transition-all duration-200 shadow-sm ${
                    isGrafanaEnabled ? 'right-[2px]' : 'left-[2px]'
                  }`}
                />
              </button>
            </div>

            {/* Description */}
            <div className="text-[12px] text-muted leading-[1.55]">
              Real-time equipment telemetry dashboards, sensor time-series data, and industrial IoT alert streaming integration.
            </div>

            {/* Form Inputs */}
            <div className="flex flex-col gap-[10px] p-[12px] rounded-[10px] bg-canvas border border-border-color/60">
              {/* Server URL Input */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-muted flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-teal" />
                  <span>Server URL</span>
                </label>
                <input
                  type="text"
                  value={grafanaUrl}
                  onChange={e => setGrafanaUrl(e.target.value)}
                  placeholder="http://192.168.10.130:3000"
                  className="w-full text-[12px] font-mono px-2.5 py-1.5 rounded-[6px] bg-panel border border-border-color text-ink placeholder:text-faint focus:outline-none focus:border-teal transition-colors"
                />
              </div>

              {/* Token Input */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-muted flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-teal" />
                    <span>API / Service Token</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="text-[10px] text-teal hover:underline flex items-center gap-1 bg-transparent border-none cursor-pointer"
                  >
                    {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showToken ? 'Hide' : 'Show'}</span>
                  </button>
                </label>
                <input
                  type={showToken ? 'text' : 'password'}
                  value={grafanaToken}
                  onChange={e => setGrafanaToken(e.target.value)}
                  placeholder="glsa_... / Influx / Service Token"
                  className="w-full text-[12px] font-mono px-2.5 py-1.5 rounded-[6px] bg-panel border border-border-color text-ink placeholder:text-faint focus:outline-none focus:border-teal transition-colors"
                />
              </div>

              {/* Org ID Input */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-muted flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-teal" />
                  <span>Org ID</span>
                </label>
                <input
                  type="number"
                  value={grafanaOrgId}
                  onChange={e => setGrafanaOrgId(Number(e.target.value))}
                  min={1}
                  className="w-full text-[12px] font-mono px-2.5 py-1.5 rounded-[6px] bg-panel border border-border-color text-ink placeholder:text-faint focus:outline-none focus:border-teal transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Action Row & Live Status */}
          <div className="flex flex-col gap-[10px] pt-[12px] border-t border-border-color/60">
            {/* Real-time Status Badge */}
            <div className="flex items-center justify-between">
              {!isGrafanaEnabled ? (
                <div className="inline-flex items-center gap-[6px] text-[10.5px] font-bold text-muted bg-[#EEF0F5] py-[3px] px-[10px] rounded-[20px]">
                  <span className="w-[5px] h-[5px] rounded-full bg-[#B0BAD4]" />
                  Disabled
                </div>
              ) : isGrafanaConnected ? (
                <div className="inline-flex items-center gap-[6px] text-[10.5px] font-bold text-green bg-green-tint py-[3px] px-[10px] rounded-[20px]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green" />
                  <span>Connected {grafanaTest?.latency_ms ? `(${grafanaTest.latency_ms}ms)` : ''}</span>
                </div>
              ) : grafanaStatus === 'DISCONNECTED' ? (
                <div className="inline-flex items-center gap-[6px] text-[10.5px] font-bold text-red-600 bg-red-50 py-[3px] px-[10px] rounded-[20px]">
                  <XCircle className="w-3.5 h-3.5 text-red-500" />
                  <span>Disconnected</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-[6px] text-[10.5px] font-bold text-muted bg-[#EEF0F5] py-[3px] px-[10px] rounded-[20px]">
                  <span className="w-[5px] h-[5px] rounded-full bg-[#B0BAD4]" />
                  Untested
                </div>
              )}

              {/* Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveGrafana}
                  disabled={savingKey === 'grafana'}
                  className="inline-flex items-center gap-[5px] text-[11px] font-medium py-[4px] px-[10px] rounded-[6px] border border-border-color bg-panel hover:bg-canvas text-ink transition-colors cursor-pointer disabled:opacity-50"
                  title="Save configuration parameters"
                >
                  <Save className={`w-3 h-3 ${savingKey === 'grafana' ? 'animate-pulse text-teal' : ''}`} />
                  <span>{savingKey === 'grafana' ? 'Saving...' : 'Save'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTestConnection('grafana')}
                  disabled={testingKey === 'grafana'}
                  className="inline-flex items-center gap-[5px] text-[11px] font-medium py-[4px] px-[10px] rounded-[6px] bg-teal hover:bg-teal-hover text-white transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                  title="Test live connection to Grafana server"
                >
                  <RefreshCw className={`w-3 h-3 ${testingKey === 'grafana' ? 'animate-spin' : ''}`} />
                  <span>{testingKey === 'grafana' ? 'Testing...' : 'Test Connection'}</span>
                </button>
              </div>
            </div>

            {/* Test result message snippet if available */}
            {grafanaTest?.message && (
              <div
                className={`text-[11px] px-2.5 py-1.5 rounded-[6px] border leading-tight ${
                  grafanaTest.success
                    ? 'bg-green-tint/40 border-green/30 text-green font-medium'
                    : 'bg-red-50/60 border-red-200 text-red-700'
                }`}
              >
                {grafanaTest.message}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
