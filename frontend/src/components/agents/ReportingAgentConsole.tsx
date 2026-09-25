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
  FileDown,
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

export const AgentChatConsole: React.FC = () => {
  const { explainableLogs, humanInLoop, reportingAgentState, setReportingAgentState, resetReportingAgentState } = useStore();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pdf' | 'insights' | 'queries' | 'data'>('pdf');
  const [isFullscreenPdf, setIsFullscreenPdf] = useState(false);

  const { query, model, status, result, errorMsg, showLogs } = reportingAgentState;

  const handleDownloadPdf = (pdfUrl: string) => {
    if (!pdfUrl) return;
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = pdfUrl.split('/').pop() || 'operations_report.pdf';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenPdfNewTab = (pdfUrl: string) => {
    if (pdfUrl) window.open(pdfUrl, '_blank', 'noopener,noreferrer');
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
        setReportingAgentState({ status: 'error', errorMsg: `Blocked by AI Security Firewall: ${data.reason}` });
      } else {
        setReportingAgentState({ result: data, status: 'success' });
      }
    } catch (err: any) {
      setReportingAgentState({
        status: 'error',
        errorMsg: err.response?.data?.detail || 'An error occurred during multi-source workflow execution.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveReport = async () => {
    if (!result?.approval_key) return;
    setLoading(true);
    try {
      await reportApprovalService.decide(result.approval_key, 'approve', 'Approved via Reporting Agent Console');
      setReportingAgentState({
        status: 'success',
        result: {
          ...result,
          insights: result.insights || 'Report successfully approved and released for dispatch.',
        }
      });
    } catch (err: any) {
      setReportingAgentState({
        errorMsg: err.response?.data?.detail || 'Failed to approve report.'
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
        errorMsg: err.response?.data?.detail || 'Failed to execute database write action.'
      });
    } finally {
      setLoading(false);
    }
  };

  const pdfFilename = result?.pdf_url ? result.pdf_url.split('/').pop() : '';

  return (
    <div className="bg-panel border border-border-color rounded-[14px] p-5 md:p-6 mt-4 shadow-sm">
      {/* ── Console Header ── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Terminal className="text-teal-deep w-[20px] h-[20px]" />
          <h3 className="font-head text-[16px] font-bold m-0 text-ink">
            Agentic Daily Operations &amp; Resources Reporting (v3)
          </h3>
        </div>
        {status !== 'idle' && (
          <button
            type="button"
            onClick={resetReportingAgentState}
            className="flex items-center gap-1.5 text-[11.5px] font-semibold text-muted hover:text-red transition-colors bg-surface hover:bg-red-tint/30 border border-border-color rounded-lg px-2.5 py-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset State
          </button>
        )}
      </div>

      <p className="text-[12.5px] text-muted mb-4">
        Query production orders, vision inspection metrics, or real-time InfluxDB machine telemetry to generate executive PDF reports.
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
            className="w-full bg-[#FAFBFE] border border-border-color rounded-[9px] p-[10px_14px] text-[13px] text-ink focus:outline-none focus:border-teal/50"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-white border border-border-color rounded-[9px] p-[10px] text-[12px] font-semibold text-muted flex items-center shrink-0">
            Model: Auto
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-teal text-white border-none rounded-[9px] p-[10px_18px] text-[12px] font-bold cursor-pointer hover:bg-teal-deep transition-colors flex items-center gap-1.5 shrink-0"
          >
            {loading ? <RefreshCw className="animate-spin w-[14px] h-[14px]" /> : <Send className="w-[14px] h-[14px]" />} Generate Report
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
            <div className="bg-[#101423] text-[#A6ACCD] font-mono text-[11px] rounded-[10px] p-4 mt-2 select-none max-h-[220px] overflow-y-auto">
              <div className="text-[#89DDFF] border-b border-[#2C324A] pb-2 mb-2 flex items-center justify-between">
                <span>[Multi-Source State Machine Logs]</span>
                {loading && <span className="text-[#F07178] animate-pulse">EXECUTING...</span>}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Cpu className="text-[#C792EA] w-[14px] h-[14px]" />
                  <span>Initializing v3 Multi-Database Pipeline (MES + Video Analytics + InfluxDB)...</span>
                </div>
                {result?.execution_steps?.map((step: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 pl-3">
                    <CheckCircle className="text-[#C3E88D] w-[12px] h-[12px]" />
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
        <div className="bg-red-tint border border-red text-red rounded-[10px] p-4 flex gap-3 items-start mb-4">
          <AlertTriangle className="w-[18px] h-[18px] shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-[13.5px]">Access Denied / Query Failed</div>
            <div className="text-[12.5px] mt-0.5 leading-relaxed">{errorMsg}</div>
          </div>
        </div>
      )}

      {/* ── HITL Approval Banner ── */}
      {status === 'requires_approval' && (
        <div className="bg-amber-tint border border-amber text-[#9A6400] rounded-[10px] p-4 flex flex-col md:flex-row gap-4 items-center justify-between mb-4">
          <div className="flex gap-3 items-start">
            <ShieldCheck className="w-[22px] h-[22px] text-amber shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-[13.5px]">Human-In-The-Loop Approval Required</div>
              <div className="text-[12px] mt-0.5 leading-relaxed">
                {result?.approval_key ? (
                  'The generated operations report is ready for review below. Review the document preview and approve to finalize and dispatch.'
                ) : (
                  <>The agent identified this instruction as requiring confirmation. Confirming this action will execute: <code>{result?.sql_query}</code>.</>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {result?.approval_key ? (
              <button
                onClick={handleApproveReport}
                disabled={loading}
                className="bg-amber hover:bg-[#805300] text-white border-none rounded-[8px] p-[8px_16px] text-[11.5px] font-bold cursor-pointer transition-colors flex items-center gap-1.5 shadow-xs"
              >
                {loading ? <RefreshCw className="animate-spin w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />} Approve &amp; Dispatch Report
              </button>
            ) : (
              <button
                onClick={handleApprove}
                disabled={loading}
                className="bg-amber text-white border-none rounded-[8px] p-[8px_16px] text-[11.5px] font-bold cursor-pointer hover:bg-[#805300] transition-colors shrink-0"
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
                friendly_label: 'Executing v3 Multi-Source Operations Reporting Pipeline (MES + Video Analytics + InfluxDB)...',
                status: 'executing',
                startTime: Date.now(),
              },
            ]}
            isStreaming={true}
            agentName="Agentic Daily Operations & Resources Reporting"
          />
        </div>
      )}

      {/* ── Result Area with Live PDF Preview, Tabs & Insights ── */}
      {(status === 'success' || (status === 'requires_approval' && result?.pdf_url)) && result && (
        <div className="flex flex-col gap-4 mt-2">
          {/* Top Bar with Tabs and Download Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-color pb-3">
            {/* View Mode Navigation Tabs */}
            <div className="flex items-center gap-1 bg-[#F1F3F9] p-1 rounded-xl">
              {result.pdf_url && (
                <button
                  type="button"
                  onClick={() => setActiveTab('pdf')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer border-none ${
                    activeTab === 'pdf'
                      ? 'bg-white text-teal shadow-xs'
                      : 'bg-transparent text-muted hover:text-ink'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" /> PDF Preview
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveTab('insights')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer border-none ${
                  activeTab === 'insights'
                    ? 'bg-white text-teal shadow-xs'
                    : 'bg-transparent text-muted hover:text-ink'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" /> Narrative Insights
              </button>
              {result.sql_query && (
                <button
                  type="button"
                  onClick={() => setActiveTab('queries')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer border-none ${
                    activeTab === 'queries'
                      ? 'bg-white text-teal shadow-xs'
                      : 'bg-transparent text-muted hover:text-ink'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" /> Queries (SQL / Flux)
                </button>
              )}
              {result.sql_result && result.sql_result.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('data')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer border-none ${
                    activeTab === 'data'
                      ? 'bg-white text-teal shadow-xs'
                      : 'bg-transparent text-muted hover:text-ink'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" /> Data Tables
                </button>
              )}
            </div>

            {/* Quick Action Buttons */}
            {result.pdf_url && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsFullscreenPdf(true)}
                  className="flex items-center gap-1.5 bg-surface hover:bg-white text-ink border border-border-color px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold cursor-pointer transition-colors shadow-2xs"
                  title="Expand Fullscreen PDF Preview"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-muted" /> Fullscreen
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenPdfNewTab(result.pdf_url)}
                  className="flex items-center gap-1.5 bg-surface hover:bg-white text-ink border border-border-color px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold cursor-pointer transition-colors shadow-2xs"
                  title="Open PDF in new browser window"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-muted" /> Open New Tab
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadPdf(result.pdf_url)}
                  className="bg-teal hover:bg-teal-deep text-white border-none rounded-lg px-3 py-1.5 text-[11.5px] font-bold cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <FileDown className="w-3.5 h-3.5" /> Download PDF
                </button>
              </div>
            )}
          </div>

          {/* ── TAB 1: Live Interactive PDF Report Preview ── */}
          {activeTab === 'pdf' && result.pdf_url && (
            <div className="border border-border-color rounded-[12px] overflow-hidden bg-white shadow-sm flex flex-col">
              {/* PDF Preview Top Meta Bar */}
              <div className="bg-[#F8F9FD] border-b border-border-color px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-md bg-teal-500/10 border border-teal-400/30 flex items-center justify-center shrink-0">
                    <FileText className="w-3.5 h-3.5 text-teal" />
                  </div>
                  <span className="text-[12px] font-bold text-ink truncate">
                    {pdfFilename || 'Generated Operations Report.pdf'}
                  </span>
                  <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full shrink-0">
                    Publication Ready (v3)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted font-medium">
                  <span>Embedded Multi-Signal Telemetry Charts</span>
                </div>
              </div>

              {/* Embedded PDF Viewer Frame */}
              <div className="w-full relative bg-[#525659] flex items-center justify-center min-h-[640px]">
                <iframe
                  src={`${result.pdf_url}#toolbar=1&navpanes=0&view=FitH`}
                  className="w-full h-[660px] border-none"
                  title="Manufacturing Operations Report Preview"
                />
              </div>

              {/* PDF Viewer Footer Helper */}
              <div className="p-3 bg-surface border-t border-border-color flex flex-wrap items-center justify-between text-[11.5px] text-muted">
                <span>
                  Showing multi-page executive report rendered with ReportLab &amp; Matplotlib downsampled signals.
                </span>
                <button
                  type="button"
                  onClick={() => handleDownloadPdf(result.pdf_url)}
                  className="text-teal hover:text-teal-deep font-bold underline bg-transparent border-none cursor-pointer p-0"
                >
                  Save a copy locally →
                </button>
              </div>
            </div>
          )}

          {/* ── TAB 2: Agent Narrative Insights ── */}
          {activeTab === 'insights' && (
            <div className="border border-teal/20 rounded-[10px] overflow-hidden bg-teal-tint/10">
              <div className="bg-teal-tint/20 border-b border-teal/20 p-[10px_16px] text-[12px] font-bold text-teal-deep flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-teal" />
                  <span>Agent Narrative Insights &amp; Operational Findings</span>
                </div>
              </div>
              <div
                className="p-5 text-[13px] text-ink leading-relaxed prose prose-sm max-w-none prose-p:my-1.5 prose-headings:my-2 prose-ul:my-1.5"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(result.insights || 'No narrative generated.') }}
              />
              <div className="px-5 pb-4">
                <AgentTelemetryFooter
                  telemetry={createEstimatedTelemetry(
                    result.execution_time_sec || 1.25,
                    (result.execution_steps || ['execute_v3_operations_report_pipeline']).map((s: string) => ({
                      name: s,
                      status: 'completed',
                    })),
                    query,
                    result.insights || ''
                  )}
                  rawText={result.insights}
                />
              </div>
            </div>
          )}

          {/* ── TAB 3: Executed Safe SQL & Flux Telemetry Queries ── */}
          {activeTab === 'queries' && result.sql_query && (
            <div className="border border-border-color rounded-[10px] overflow-hidden">
              <div className="bg-[#F8F9FB] border-b border-border-color p-[10px_14px] text-[11.5px] font-bold flex items-center gap-1.5 text-muted">
                <Database className="w-3.5 h-3.5 text-teal" />
                <span>Generated Multi-Source Queries (MSSQL / Postgres / InfluxDB Flux)</span>
              </div>
              <pre className="m-0 p-4 bg-[#101423] font-mono text-[12px] text-[#A6ACCD] overflow-x-auto select-all leading-relaxed max-h-[480px]">
                {result.sql_query}
              </pre>
            </div>
          )}

          {/* ── TAB 4: Raw Data Tables Preview ── */}
          {activeTab === 'data' && result.sql_result && result.sql_result.length > 0 && (
            <div className="flex flex-col gap-4">
              {result.sql_result.map((tableData: any, idx: number) => (
                <div key={idx} className="border border-border-color rounded-[10px] overflow-hidden bg-white">
                  <div className="bg-[#F8F9FB] border-b border-border-color p-[10px_14px] flex items-center justify-between">
                    <span className="font-bold text-[12px] text-ink">
                      [{tableData.database || 'Database'}] {tableData.table}
                    </span>
                    <span className="text-[11px] text-muted font-medium">
                      Showing up to 20 of {tableData.rows} records
                    </span>
                  </div>
                  {tableData.data && tableData.data.length > 0 ? (
                    <div className="overflow-x-auto max-h-[320px]">
                      <table className="w-full text-left text-[11.5px] border-collapse">
                        <thead>
                          <tr className="bg-[#F3F4F8] border-b border-border-color text-muted font-semibold">
                            {Object.keys(tableData.data[0] || {}).map((col, cIdx) => (
                              <th key={cIdx} className="p-2.5 whitespace-nowrap">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tableData.data.map((row: any, rIdx: number) => (
                            <tr key={rIdx} className="border-b border-border-color/50 hover:bg-[#F9FAFC]">
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

      {/* ── Fullscreen PDF Viewer Modal ── */}
      {isFullscreenPdf && result?.pdf_url && (
        <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex flex-col p-4 md:p-6 animate-fadeIn">
          {/* Modal Header */}
          <div className="bg-[#101423] text-white rounded-t-[14px] px-5 py-3 flex items-center justify-between border-b border-[#2C324A]">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-teal-300" />
              <span className="font-bold text-[14px] truncate">{pdfFilename || 'Operations Report PDF Preview'}</span>
              <span className="text-[10.5px] bg-teal-500/20 text-teal-300 border border-teal-400/30 px-2 py-0.5 rounded-full ml-2">
                Executive Fullscreen View
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleDownloadPdf(result.pdf_url)}
                className="flex items-center gap-1.5 bg-teal hover:bg-teal-deep text-white border-none px-3 py-1.5 rounded-lg text-[12px] font-bold cursor-pointer transition-colors"
              >
                <FileDown className="w-3.5 h-3.5" /> Download
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

          {/* Modal Body / Iframe */}
          <div className="flex-1 bg-[#525659] rounded-b-[14px] overflow-hidden">
            <iframe
              src={`${result.pdf_url}#toolbar=1&navpanes=1&view=FitH`}
              className="w-full h-full border-none"
              title="Fullscreen PDF Preview"
            />
          </div>
        </div>
      )}
    </div>
  );
};
