import React, { useState } from 'react';
import {
  Terminal,
  Database,
  Cpu,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  RotateCcw,
  FileText,
  Maximize2,
  ExternalLink,
  Code2,
  BarChart3,
  Sparkles,
  X,
} from 'lucide-react';
import { agentService, reportApprovalService } from '../../services/api';
import { parseMarkdown } from '../../utils/markdownParser';
import { useStore } from '../../store';
import { AgentExecutionIndicator } from '../common/AgentExecutionIndicator';
import { AgentTelemetryFooter } from '../common/AgentTelemetryFooter';
import { createEstimatedTelemetry } from '../../utils/telemetryHelper';
import { reportPdfUrl } from '../../config/api';

const getRequestErrorMessage = (error: any, fallback: string) => {
  const responseData = error?.response?.data;
  const detail = responseData?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (detail && typeof detail === 'object') return JSON.stringify(detail);

  const message = responseData?.message || responseData?.error;
  if (typeof message === 'string' && message.trim()) {
    const code = responseData?.code ? `${responseData.code}: ` : '';
    return `${code}${message}`;
  }
  if (typeof error?.message === 'string' && error.message.trim()) return error.message;
  return fallback;
};

export const AgentChatConsole: React.FC = () => {
  const {
    explainableLogs,
    humanInLoop,
    reportingAgentState,
    setReportingAgentState,
    resetReportingAgentState,
  } = useStore();

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pdf' | 'insights' | 'queries' | 'data'>('pdf');
  const [isFullscreenPdf, setIsFullscreenPdf] = useState(false);

  const { query, model, status, result, errorMsg, showLogs } = reportingAgentState;

  const handleOpenPdfNewTab = (pdfUrl: string) => {
    if (pdfUrl) window.open(reportPdfUrl(pdfUrl), '_blank', 'noopener,noreferrer');
  };

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setReportingAgentState({ status: 'running', result: null, errorMsg: '' });
    setActiveTab('pdf');

    try {
      let data = await agentService.query(query, model, 'reporting');
      if (data.status === 'requires_approval') {
        if (!humanInLoop) {
          data = await agentService.approve(data);
          setReportingAgentState({ result: data, status: 'success' });
        } else {
          setReportingAgentState({ result: data, status: 'requires_approval' });
        }
      } else if (data.status === 'blocked') {
        setReportingAgentState({
          status: 'error',
          errorMsg: `Blocked by AI Security Firewall: ${data.reason}`,
        });
      } else {
        setReportingAgentState({ result: data, status: 'success' });
      }
    } catch (err: any) {
      setReportingAgentState({
        status: 'error',
        errorMsg: getRequestErrorMessage(
          err,
          'An error occurred during multi-source workflow execution.'
        ),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveReport = async () => {
    if (!result?.approval_key) return;
    setLoading(true);
    try {
      const decision = await reportApprovalService.decide(
        result.approval_key,
        'approve',
        'Approved via Reporting Agent Console'
      );
      setReportingAgentState({
        status: 'success',
        result: {
          ...result,
          insights:
            decision.message ||
            (decision.status === 'SENT'
              ? 'Report successfully approved and sent.'
              : 'Report approved. Email delivery status: ' +
                (decision.email_status || 'unknown') +
                '.'),
        },
      });
    } catch (err: any) {
      setReportingAgentState({
        errorMsg: getRequestErrorMessage(err, 'Failed to approve report.'),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!result || !result.workflow_id) return;
    setLoading(true);
    setReportingAgentState({ status: 'running' });
    try {
      const data = await agentService.approve(result);
      setReportingAgentState({ result: data, status: 'success' });
    } catch (err: any) {
      setReportingAgentState({
        status: 'error',
        errorMsg: getRequestErrorMessage(err, 'Failed to execute database write action.'),
      });
    } finally {
      setLoading(false);
    }
  };

  const pdfUrl = reportPdfUrl(result?.pdf_url);
  const pdfFilename = pdfUrl ? new URL(pdfUrl).pathname.split('/').pop() : '';

  return (
    <div className="bg-panel border border-border-color rounded-2xl p-5 md:p-6 mt-4 shadow-sm">
      {/* ── Console Header ── */}
      <div className="flex items-start sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-teal/10 border border-teal/20 flex items-center justify-center shrink-0">
            <Terminal className="text-teal-deep w-[18px] h-[18px]" />
          </div>
          <div className="min-w-0">
            <h3 className="font-head text-[15px] sm:text-[16px] font-bold m-0 text-ink leading-tight">
              Agentic Daily Operations &amp; Resources Reporting
            </h3>
            <p className="text-[11px] text-muted m-0 mt-0.5 font-medium">v3 · Multi-source pipeline</p>
          </div>
        </div>

        {status !== 'idle' && (
          <button
            type="button"
            onClick={resetReportingAgentState}
            className="flex items-center gap-1.5 text-[11.5px] font-semibold text-muted hover:text-red transition-colors bg-surface hover:bg-red-tint/30 border border-border-color rounded-lg px-2.5 py-1.5 cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        )}
      </div>

      <p className="text-[12.5px] text-muted mb-4 leading-relaxed">
        Query production orders, vision inspection metrics, or real-time InfluxDB machine telemetry to
        generate executive PDF reports.
      </p>

      {/* ── Query Input Form ── */}
      <form onSubmit={handleQuery} className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="e.g. Daily operations report for Line 1 including production output, telemetry, and safety violations over the last 24 hours..."
            value={query}
            onChange={(e) => setReportingAgentState({ query: e.target.value })}
            disabled={loading}
            className="w-full bg-[#FAFBFE] border border-border-color rounded-xl p-[11px_14px] text-[13px] text-ink placeholder:text-muted/70 focus:outline-none focus:border-teal/50 focus:ring-2 focus:ring-teal/10 transition-shadow"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-white border border-border-color rounded-xl px-3 py-[11px] text-[12px] font-semibold text-muted flex items-center shrink-0">
            Model: Auto
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-teal text-white border-none rounded-xl px-4 py-[11px] text-[12px] font-bold cursor-pointer hover:bg-teal-deep transition-colors flex items-center gap-1.5 shrink-0 disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? (
              <RefreshCw className="animate-spin w-[14px] h-[14px]" />
            ) : (
              <Send className="w-[14px] h-[14px]" />
            )}
            Generate Report
          </button>
        </div>
      </form>

      {/* ── State Machine Trace Logs ── */}
      {status !== 'idle' && explainableLogs && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setReportingAgentState({ showLogs: !showLogs })}
            className="text-[11.5px] font-semibold text-teal hover:text-teal-deep flex items-center gap-1 cursor-pointer bg-transparent border-none py-1 focus:outline-none"
          >
            {showLogs ? 'Hide execution trace logs ▲' : 'Show execution trace logs ▼'}
          </button>
          {showLogs && (
            <div className="bg-[#101423] text-[#A6ACCD] font-mono text-[11px] rounded-xl p-4 mt-2 select-none max-h-[220px] overflow-y-auto border border-[#2C324A]/60">
              <div className="text-[#89DDFF] border-b border-[#2C324A] pb-2 mb-2 flex items-center justify-between">
                <span>[Multi-Source State Machine Logs]</span>
                {loading && <span className="text-[#F07178] animate-pulse">EXECUTING...</span>}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Cpu className="text-[#C792EA] w-[14px] h-[14px] shrink-0" />
                  <span>Initializing v3 Multi-Database Pipeline (MES + Video Analytics + InfluxDB)...</span>
                </div>
                {result?.execution_steps?.map((step: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 pl-3">
                    <CheckCircle className="text-[#C3E88D] w-[12px] h-[12px] shrink-0" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Error Notification ── */}
      {status === 'error' && errorMsg && (
        <div className="bg-red-tint border border-red/40 text-red rounded-xl p-4 flex gap-3 items-start mb-4">
          <AlertTriangle className="w-[18px] h-[18px] shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-[13.5px]">Access Denied / Query Failed</div>
            <div className="text-[12.5px] mt-0.5 leading-relaxed opacity-90">{errorMsg}</div>
          </div>
        </div>
      )}

      {/* ── HITL Approval Banner ── */}
      {status === 'requires_approval' && (
        <div className="bg-amber-tint border border-amber/50 text-[#9A6400] rounded-xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-4">
          <div className="flex gap-3 items-start">
            <ShieldCheck className="w-[22px] h-[22px] text-amber shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-[13.5px]">Human-In-The-Loop Approval Required</div>
              <div className="text-[12px] mt-0.5 leading-relaxed">
                {result?.approval_key ? (
                  'The generated operations report is ready for review below. Review the document preview and approve to finalize and dispatch.'
                ) : (
                  <>
                    The agent identified this instruction as requiring confirmation. Confirming this
                    action will execute: <code className="text-[11px] bg-black/5 px-1 rounded">{result?.sql_query}</code>.
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
            {result?.approval_key ? (
              <button
                onClick={handleApproveReport}
                disabled={loading}
                className="w-full md:w-auto bg-amber hover:bg-[#805300] text-white border-none rounded-lg px-4 py-2 text-[11.5px] font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-70"
              >
                {loading ? (
                  <RefreshCw className="animate-spin w-3.5 h-3.5" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" />
                )}
                Approve &amp; Dispatch Report
              </button>
            ) : (
              <button
                onClick={handleApprove}
                disabled={loading}
                className="w-full md:w-auto bg-amber text-white border-none rounded-lg px-4 py-2 text-[11.5px] font-bold cursor-pointer hover:bg-[#805300] transition-colors shrink-0 disabled:opacity-70"
              >
                Approve &amp; Execute Action
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Loading Animation ── */}
      {loading && (
        <div className="mb-4">
          <AgentExecutionIndicator
            activeSteps={[
              {
                tool_name: 'execute_v3_operations_report_pipeline',
                friendly_label:
                  'Executing v3 Multi-Source Operations Reporting Pipeline (MES + Video Analytics + InfluxDB)...',
                status: 'executing',
                startTime: Date.now(),
              },
            ]}
            isStreaming={true}
            agentName="Agentic Daily Operations & Resources Reporting"
          />
        </div>
      )}

      {/* ── Result Area ── */}
      {(status === 'success' || (status === 'requires_approval' && pdfUrl)) && result && (
        <div className="flex flex-col gap-4 mt-1">
          {/* Tabs + Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-color pb-3">
            <div className="flex items-center gap-1 bg-[#F1F3F9] p-1 rounded-xl overflow-x-auto">
              {pdfUrl && (
                <button
                  type="button"
                  onClick={() => setActiveTab('pdf')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer border-none whitespace-nowrap ${
                    activeTab === 'pdf'
                      ? 'bg-white text-teal shadow-xs'
                      : 'bg-transparent text-muted hover:text-ink'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  PDF Preview
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveTab('insights')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer border-none whitespace-nowrap ${
                  activeTab === 'insights'
                    ? 'bg-white text-teal shadow-xs'
                    : 'bg-transparent text-muted hover:text-ink'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Narrative Insights
              </button>
              {result.sql_query && (
                <button
                  type="button"
                  onClick={() => setActiveTab('queries')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer border-none whitespace-nowrap ${
                    activeTab === 'queries'
                      ? 'bg-white text-teal shadow-xs'
                      : 'bg-transparent text-muted hover:text-ink'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  Queries
                </button>
              )}
              {result.sql_result && result.sql_result.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('data')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer border-none whitespace-nowrap ${
                    activeTab === 'data'
                      ? 'bg-white text-teal shadow-xs'
                      : 'bg-transparent text-muted hover:text-ink'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  Data Tables
                </button>
              )}
            </div>

            {pdfUrl && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsFullscreenPdf(true)}
                  className="flex items-center gap-1.5 bg-surface hover:bg-white text-ink border border-border-color px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold cursor-pointer transition-colors shadow-2xs"
                  title="Expand Fullscreen PDF Preview"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-muted" />
                  Fullscreen
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenPdfNewTab(pdfUrl)}
                  className="flex items-center gap-1.5 bg-surface hover:bg-white text-ink border border-border-color px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold cursor-pointer transition-colors shadow-2xs"
                  title="Open PDF in new browser window"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-muted" />
                  Open New Tab
                </button>
              </div>
            )}
          </div>

          {/* ── TAB 1: PDF Preview ── */}
          {activeTab === 'pdf' && pdfUrl && (
            <div className="border border-border-color rounded-xl overflow-hidden bg-white shadow-sm flex flex-col">
              <div className="bg-[#F8F9FD] border-b border-border-color px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-teal/10 border border-teal/25 flex items-center justify-center shrink-0">
                    <FileText className="w-3.5 h-3.5 text-teal" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12px] font-bold text-ink truncate">
                      {pdfFilename || 'Generated Operations Report.pdf'}
                    </div>
                    <div className="text-[10.5px] text-muted mt-0.5">Embedded multi-signal telemetry charts</div>
                  </div>
                </div>
                <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                  Publication Ready
                </span>
              </div>

              <div className="w-full relative bg-[#525659] flex items-center justify-center min-h-[640px]">
                <iframe
                  src={`${pdfUrl}#toolbar=1&navpanes=0&view=FitH`}
                  className="w-full h-[660px] border-none"
                  title="Manufacturing Operations Report Preview"
                />
              </div>

              <div className="px-4 py-2.5 bg-surface border-t border-border-color text-[11.5px] text-muted">
                Multi-page executive report · ReportLab &amp; Matplotlib downsampled signals
              </div>
            </div>
          )}

          {/* ── TAB 2: Narrative Insights ── */}
          {activeTab === 'insights' && (
            <div className="border border-teal/20 rounded-xl overflow-hidden bg-teal-tint/10">
              <div className="bg-teal-tint/25 border-b border-teal/20 px-4 py-2.5 text-[12px] font-bold text-teal-deep flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal shrink-0" />
                <span>Agent Narrative Insights &amp; Operational Findings</span>
              </div>
              <div
                className="p-5 text-[13px] text-ink leading-relaxed prose prose-sm max-w-none prose-p:my-1.5 prose-headings:my-2 prose-ul:my-1.5"
                dangerouslySetInnerHTML={{
                  __html: parseMarkdown(result.insights || 'No narrative generated.'),
                }}
              />
              <div className="px-5 pb-4">
                <AgentTelemetryFooter
                  telemetry={createEstimatedTelemetry(
                    result.execution_time_sec || 1.25,
                    (result.execution_steps || ['execute_v3_operations_report_pipeline']).map(
                      (s: string) => ({
                        name: s,
                        status: 'completed',
                      })
                    ),
                    query,
                    result.insights || ''
                  )}
                  rawText={result.insights}
                />
              </div>
            </div>
          )}

          {/* ── TAB 3: Queries ── */}
          {activeTab === 'queries' && result.sql_query && (
            <div className="border border-border-color rounded-xl overflow-hidden">
              <div className="bg-[#F8F9FB] border-b border-border-color px-4 py-2.5 text-[11.5px] font-bold flex items-center gap-1.5 text-muted">
                <Database className="w-3.5 h-3.5 text-teal" />
                <span>Generated Multi-Source Queries (MSSQL / Postgres / InfluxDB Flux)</span>
              </div>
              <pre className="m-0 p-4 bg-[#101423] font-mono text-[12px] text-[#A6ACCD] overflow-x-auto select-all leading-relaxed max-h-[480px]">
                {result.sql_query}
              </pre>
            </div>
          )}

          {/* ── TAB 4: Data Tables ── */}
          {activeTab === 'data' && result.sql_result && result.sql_result.length > 0 && (
            <div className="flex flex-col gap-4">
              {result.sql_result.map((tableData: any, idx: number) => (
                <div
                  key={idx}
                  className="border border-border-color rounded-xl overflow-hidden bg-white shadow-sm"
                >
                  <div className="bg-[#F8F9FB] border-b border-border-color px-4 py-2.5 flex items-center justify-between gap-3">
                    <span className="font-bold text-[12px] text-ink truncate">
                      [{tableData.database || 'Database'}] {tableData.table}
                    </span>
                    <span className="text-[11px] text-muted font-medium shrink-0">
                      Up to 20 of {tableData.rows} records
                    </span>
                  </div>
                  {tableData.data && tableData.data.length > 0 ? (
                    <div className="overflow-x-auto max-h-[320px]">
                      <table className="w-full text-left text-[11.5px] border-collapse">
                        <thead>
                          <tr className="bg-[#F3F4F8] border-b border-border-color text-muted font-semibold sticky top-0">
                            {Object.keys(tableData.data[0] || {}).map((col, cIdx) => (
                              <th key={cIdx} className="p-2.5 whitespace-nowrap">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tableData.data.map((row: any, rIdx: number) => (
                            <tr
                              key={rIdx}
                              className="border-b border-border-color/50 hover:bg-[#F9FAFC] transition-colors"
                            >
                              {Object.values(row).map((val: any, vIdx: number) => (
                                <td key={vIdx} className="p-2.5 whitespace-nowrap text-ink">
                                  {typeof val === 'object' ? JSON.stringify(val) : String(val ?? '')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-4 text-[12px] text-muted">No data records returned for this source.</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Fullscreen PDF Viewer ── */}
      {isFullscreenPdf && pdfUrl && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex flex-col p-3 md:p-5 animate-fadeIn">
          <div className="bg-[#101423] text-white rounded-t-xl px-4 py-3 flex items-center justify-between border-b border-[#2C324A] gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-teal-300 shrink-0" />
              <span className="font-bold text-[13px] sm:text-[14px] truncate">
                {pdfFilename || 'Operations Report PDF Preview'}
              </span>
              <span className="hidden sm:inline text-[10.5px] bg-teal-500/20 text-teal-300 border border-teal-400/30 px-2 py-0.5 rounded-full ml-1 shrink-0">
                Executive View
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleOpenPdfNewTab(pdfUrl)}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white border border-white/10 px-3 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open Tab
              </button>
              <button
                type="button"
                onClick={() => setIsFullscreenPdf(false)}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white border-none cursor-pointer transition-colors"
                title="Close Fullscreen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 bg-[#525659] rounded-b-xl overflow-hidden min-h-0">
            <iframe
              src={`${pdfUrl}#toolbar=1&navpanes=1&view=FitH`}
              className="w-full h-full border-none"
              title="Fullscreen PDF Preview"
            />
          </div>
        </div>
      )}
    </div>
  );
};