import React, { useState } from 'react';
import { Terminal, Database, Cpu, AlertTriangle, CheckCircle, RefreshCw, Send, ShieldCheck, FileDown } from 'lucide-react';
import { agentService } from '../../services/api';
import { parseMarkdown } from '../../utils/markdownParser';
import { useStore } from '../../store';

export const AgentChatConsole: React.FC = () => {
  const [query, setQuery] = useState('');
  const [model, setModel] = useState('gemini-3.5-flash');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'requires_approval' | 'error'>('idle');
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const { explainableLogs, humanInLoop } = useStore();

  const handleDownloadPdf = (pdfUrl: string) => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setStatus('running');
    setResult(null);
    setErrorMsg('');

    try {
      let data = await agentService.query(query, model);
      setResult(data);
      
      if (data.status === 'requires_approval') {
        if (!humanInLoop) {
          // Auto-approve if HITL is disabled
          try {
            data = await agentService.approve(data);
            setResult(data);
            setStatus('success');
          } catch (err: any) {
            setStatus('error');
            setErrorMsg(err.response?.data?.detail || 'Failed to execute auto-approved action.');
          }
        } else {
          setStatus('requires_approval');
        }
      } else if (data.status === 'blocked') {
        setStatus('error');
        setErrorMsg(`Blocked by AI Security Firewall: ${data.reason}`);
      } else {
        setStatus('success');
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.response?.data?.detail || 'An error occurred during workflow execution.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!result || !result.workflow_id) return;

    setLoading(true);
    setStatus('running');

    try {
      const data = await agentService.approve(result);
      setResult(data);
      setStatus('success');
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.response?.data?.detail || 'Failed to execute database write action.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-panel border border-border-color rounded-[14px] p-6 mt-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Terminal className="text-teal-deep w-[20px] h-[20px]" />
        <h3 className="font-head text-[16px] font-bold m-0">LangGraph SQL Reporting Agent</h3>
      </div>

      <p className="text-[12.5px] text-muted mb-4">
        Ask Deva to pull telemetry or query orders (e.g. <i>"Show me completed quantity and planned quantity for WO-88213"</i> or <i>"Find machines in Zone 3"</i>).
      </p>

      <form onSubmit={handleQuery} className="flex gap-2 mb-5">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Type your query to database..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
            className="w-full bg-[#FAFBFE] border border-border-color rounded-[9px] p-[10px_14px] text-[13px] text-ink focus:outline-none focus:border-teal/50"
          />
        </div>

        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={loading}
          className="bg-white border border-border-color rounded-[9px] p-[10px] text-[12px] font-semibold text-muted cursor-pointer"
        >
          <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
          <option value="groq/llama-3.3-70b-versatile">Llama 3.3 70B (Groq)</option>
        </select>

        <button
          type="submit"
          disabled={loading}
          className="bg-teal text-white border-none rounded-[9px] p-[10px_18px] text-[12px] font-bold cursor-pointer hover:bg-teal-deep transition-colors flex items-center gap-1 shrink-0"
        >
          {loading ? <RefreshCw className="animate-spin w-[14px] h-[14px]" /> : <Send className="w-[14px] h-[14px]" />}
          Send
        </button>
      </form>

      {/* Traversal Pipeline Logs (Toggleable, collapsed by default) */}
      {status !== 'idle' && explainableLogs && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowLogs(!showLogs)}
            className="text-[11.5px] font-semibold text-teal hover:text-teal-deep flex items-center gap-1 cursor-pointer bg-transparent border-none py-1 focus:outline-none"
          >
            {showLogs ? "Hide execution trace logs ▲" : "Show execution trace logs ▼"}
          </button>

          {showLogs && (
            <div className="bg-[#101423] text-[#A6ACCD] font-mono text-[11px] rounded-[10px] p-4 mt-2 select-none max-h-[220px] overflow-y-auto">
              <div className="text-[#89DDFF] border-b border-[#2C324A] pb-2 mb-2 flex items-center justify-between">
                <span>[LangGraph State Machine Logs]</span>
                {loading && <span className="text-[#F07178] animate-pulse">EXECUTING...</span>}
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Cpu className="text-[#C792EA] w-[14px] h-[14px]" />
                  <span>Initializing AgentState dictionary...</span>
                </div>

                {result?.execution_steps?.map((step: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 pl-3">
                    <CheckCircle className="text-[#C3E88D] w-[12px] h-[12px]" />
                    <span className={step.includes("Paused") ? "text-[#FFCB6B] font-bold animate-pulse" : "text-[#C3E88D]"}>
                      {step}
                    </span>
                  </div>
                ))}

                {status === 'requires_approval' && (
                  <div className="flex items-center gap-2 pl-3 text-[#FF5370] font-bold">
                    <AlertTriangle className="w-[12px] h-[12px] animate-bounce" />
                    <span>INTERRUPT: Action requires admin permission!</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Security Block alert */}
      {status === 'error' && errorMsg && (
        <div className="bg-red-tint border border-red text-red rounded-[10px] p-4 flex gap-3 items-start mb-4">
          <AlertTriangle className="w-[18px] h-[18px] shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-[13.5px]">Access Denied / Query Failed</div>
            <div className="text-[12.5px] mt-0.5 leading-relaxed">{errorMsg}</div>
          </div>
        </div>
      )}

      {/* Human-in-the-Loop Gate dialog */}
      {status === 'requires_approval' && (
        <div className="bg-amber-tint border border-amber text-[#9A6400] rounded-[10px] p-4 flex flex-col md:flex-row gap-4 items-center justify-between mb-4">
          <div className="flex gap-3 items-start">
            <ShieldCheck className="w-[22px] h-[22px] text-amber shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-[13.5px]">Human-In-The-Loop Approval Pending</div>
              <div className="text-[12px] mt-0.5 leading-relaxed">
                The agent identified this instruction as a database write action. Confirming this action will execute the query: <code>{result?.sql_query}</code>.
              </div>
            </div>
          </div>
          <button
            onClick={handleApprove}
            disabled={loading}
            className="bg-amber text-white border-none rounded-[8px] p-[8px_16px] text-[11.5px] font-bold cursor-pointer hover:bg-[#805300] transition-colors shrink-0"
          >
            Approve & Execute Action
          </button>
        </div>
      )}

      {/* Successful Output Display */}
      {status === 'success' && result && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-border-color pb-3">
            <div className={`text-[11px] font-bold tracking-[0.3px] uppercase ${(result.error_message || result.insights?.includes("Unable to complete database search")) ? 'text-red' : 'text-muted'
              }`}>
              {(result.error_message || result.insights?.includes("Unable to complete database search")) ? 'Execution Failed' : 'Execution Completed'}
            </div>
            {!(result.error_message || result.insights?.includes("Unable to complete database search")) && result.pdf_url && (
              <button
                onClick={() => handleDownloadPdf(result.pdf_url)}
                className="bg-teal hover:bg-teal-deep text-white border-none rounded-[8px] p-[6px_14px] text-[11.5px] font-bold cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <FileDown className="w-[14px] h-[14px]" />
                Download PDF Report
              </button>
            )}
          </div>
          {result.sql_query && (
            <div className="border border-border-color rounded-[9px] overflow-hidden">
              <div className="bg-white/50 border-b border-border-color p-[8px_14px] text-[11px] font-bold flex items-center gap-1 text-muted">
                <Database className="w-[12px] h-[12px]" />
                Generated SELECT Query (Safe-Scoped)
              </div>
              <pre className="m-0 p-3 bg-[#F8F9FB] font-mono text-[12px] text-ink overflow-x-auto select-all">
                {result.sql_query}
              </pre>
            </div>
          )}

          <div className="border border-teal/20 rounded-[9px] overflow-hidden bg-teal-tint/10">
            <div className="bg-teal-tint/20 border-b border-teal/20 p-[8px_14px] text-[11px] font-bold text-teal-deep">
              Agent Narrative Insights & Action Recommendations
            </div>
            <div
              className="p-4 text-[13px] text-ink leading-relaxed prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2"
              dangerouslySetInnerHTML={{ __html: parseMarkdown(result.insights || '') }}
            />
          </div>

          {result.cost_usd > 0 && (
            <div className="text-right text-[10px] text-faint font-mono">
              Model cost: ${result.cost_usd.toFixed(6)} USD
            </div>
          )}
        </div>
      )}
    </div>
  );
};
