import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Database, Cpu, AlertTriangle, CheckCircle, RefreshCw, Send, ShieldCheck, FileDown, RotateCcw } from 'lucide-react';
import { agentService } from '../../services/api';
import { parseMarkdown } from '../../utils/markdownParser';
import { useStore } from '../../store';

interface AgentChatConsoleProps {
  agentName?: string;
}

export const AgentChatConsole: React.FC<AgentChatConsoleProps> = ({ agentName = 'reporting' }) => {
  const { explainableLogs, humanInLoop, reportingAgentState, setReportingAgentState, resetReportingAgentState } = useStore();
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ id: string; role: 'user'|'assistant'; text: string }>>([]);
  const [streaming, setStreaming] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const el = document.getElementById('maintenance-chat-scroll');
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, streaming]);

  const { query, model, status, result, errorMsg, showLogs } = reportingAgentState;

  const handleDownloadPdf = (pdfUrl: string) => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    // If maintenance agent, use websocket streaming chat
    if (agentName === 'maintenance') {
      const userId = String(Date.now());
      const userMsg = { id: userId, role: 'user' as const, text: query };
      setMessages((m) => [...m, userMsg]);
      setReportingAgentState({ status: 'running', result: null, errorMsg: '' });
      setStreaming(true);

      // open websocket
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const host = window.location.host;
      const wsUrl = `${protocol}://${host}/api/ws/agent/maintenance`;

      try {
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          wsRef.current?.send(JSON.stringify({ query }));
        };

        let assistantBuffer = '';
        let assistantId = `a-${Date.now()}`;

        wsRef.current.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            if (msg.type === 'event') {
              const data = msg.data;
              // If the backend streams partial assistant text pieces
              if (data?.content) {
                assistantBuffer += data.content;
                // upsert assistant message
                setMessages((cur) => {
                  const exists = cur.find((c) => c.id === assistantId);
                  if (exists) {
                    return cur.map((c) => (c.id === assistantId ? { ...c, text: assistantBuffer } : c));
                  }
                  return [...cur, { id: assistantId, role: 'assistant', text: assistantBuffer }];
                });
              }
              // if full messages array is sent
              if (data?.messages && Array.isArray(data.messages)) {
                const latest = data.messages[data.messages.length - 1];
                if (latest?.type === 'ai' && latest.content) {
                  assistantBuffer = latest.content;
                  setMessages((cur) => [...cur, { id: assistantId, role: 'assistant', text: assistantBuffer }]);
                }
              }
            } else if (msg.type === 'done') {
              setStreaming(false);
              setReportingAgentState({ status: 'success', result: { insights: assistantBuffer }, errorMsg: '' });
              wsRef.current?.close();
            } else if (msg.type === 'error') {
              setStreaming(false);
              setReportingAgentState({ status: 'error', errorMsg: msg.error || 'Stream error' });
              wsRef.current?.close();
            }
          } catch (e) {
            // ignore parse errors
          }
        };

        wsRef.current.onclose = () => {
          setStreaming(false);
        };

      } catch (err) {
        setStreaming(false);
        setReportingAgentState({ status: 'error', errorMsg: 'Failed to open streaming connection.' });
      }

      // clear query input
      setReportingAgentState({ query: '' });

      return;
    }

    // Fallback: existing non-streaming behavior (reporting agent)
    setLoading(true);
    setReportingAgentState({
      status: 'running',
      result: null,
      errorMsg: '',
    });

    try {
      let data = await agentService.query(query, model, agentName);
      
      if (data.status === 'requires_approval') {
        if (!humanInLoop) {
          // Auto-approve if HITL is disabled
          try {
            data = await agentService.approve(data);
            setReportingAgentState({
              result: data,
              status: 'success',
            });
          } catch (err: any) {
            setReportingAgentState({
              status: 'error',
              errorMsg: err.response?.data?.detail || 'Failed to execute auto-approved action.',
            });
          }
        } else {
          setReportingAgentState({
            result: data,
            status: 'requires_approval',
          });
        }
      } else if (data.status === 'blocked') {
        setReportingAgentState({
          status: 'error',
          errorMsg: `Blocked by AI Security Firewall: ${data.reason}`,
        });
      } else {
        setReportingAgentState({
          result: data,
          status: 'success',
        });
      }
    } catch (err: any) {
      setReportingAgentState({
        status: 'error',
        errorMsg: err.response?.data?.detail || 'An error occurred during workflow execution.',
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
      setReportingAgentState({
        result: data,
        status: 'success',
      });
    } catch (err: any) {
      setReportingAgentState({
        status: 'error',
        errorMsg: err.response?.data?.detail || 'Failed to execute database write action.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-panel border border-border-color rounded-[14px] p-6 mt-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Terminal className="text-teal-deep w-[20px] h-[20px]" />
          <h3 className="font-head text-[16px] font-bold m-0">
            {agentName === 'maintenance' ? 'Maintenance Agent Chat' : 'LangGraph SQL Reporting Agent'}
          </h3>
        </div>

        {status !== 'idle' && (
          <button
            type="button"
            onClick={resetReportingAgentState}
            className="flex items-center gap-1.5 text-[11.5px] font-semibold text-muted hover:text-red transition-colors bg-surface hover:bg-red-tint/30 border border-border-color rounded-lg px-2.5 py-1 cursor-pointer"
            title="Reset query and clear conversation state"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset State
          </button>
        )}
      </div>

      <p className="text-[12.5px] text-muted mb-4">
        {agentName === 'maintenance'
          ? <>Ask Deva about machine health, scheduled maintenance, or work orders (e.g. <i>"What is the health status of Machine-452?"</i>).</>
          : <>Ask Deva to pull telemetry or query orders (e.g. <i>"Show me completed quantity and planned quantity for WO-88213"</i> or <i>"Find machines in Zone 3"</i>).</>
        }
      </p>

      {/* If maintenance agent, render chat bubbles with streaming */}
      {agentName === 'maintenance' ? (
        <>
          <div className="mb-4">
            <div className="h-[420px] overflow-y-auto p-4 flex flex-col gap-3 bg-white rounded-[10px] border border-border-color" id="maintenance-chat-scroll">
              {messages.length === 0 && (
                <div className="text-[13px] text-muted">Start the maintenance conversation. Ask about machine health, schedules, or work orders.</div>
              )}

              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] p-3 rounded-xl shadow-sm ${m.role === 'assistant' ? 'bg-[#0d9488] text-white rounded-tl-none' : 'bg-gray-100 text-ink rounded-tr-none'}`}>
                    <div className="text-[13px] leading-relaxed whitespace-pre-line">{m.text}</div>
                  </div>
                </div>
              ))}
              {streaming && (
                <div className="flex justify-start">
                  <div className="max-w-[60%] p-2 rounded-xl bg-[#0d9488] text-white">
                    <div className="text-[13px]">Deva is typing...</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleQuery} className="flex gap-2 mb-5 items-center">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Ask Deva about Machine-452 or maintenance windows..."
                value={query}
                onChange={(e) => setReportingAgentState({ query: e.target.value })}
                disabled={streaming}
                className="w-full bg-[#FAFBFE] border border-border-color rounded-[999px] p-[10px_14px] text-[13px] text-ink focus:outline-none focus:border-teal/50"
              />
            </div>

            <button
              type="submit"
              disabled={streaming}
              className="bg-[#0d9488] text-white border-none rounded-full p-3 text-[12px] font-bold cursor-pointer hover:brightness-90 transition-colors flex items-center gap-1 shrink-0"
            >
              {streaming ? <RefreshCw className="animate-spin w-[14px] h-[14px]" /> : <Send className="w-[14px] h-[14px]" />}
            </button>
          </form>
        </>
      ) : (
        <form onSubmit={handleQuery} className="flex gap-2 mb-5">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Type your query to database..."
              value={query}
              onChange={(e) => setReportingAgentState({ query: e.target.value })}
              disabled={loading}
              className="w-full bg-[#FAFBFE] border border-border-color rounded-[9px] p-[10px_14px] text-[13px] text-ink focus:outline-none focus:border-teal/50"
            />
          </div>

          {/* Model selection removed — using automatic routing to the configured LLM gateway */}
          <div className="bg-white border border-border-color rounded-[9px] p-[10px] text-[12px] font-semibold text-muted flex items-center">
            Model: Auto
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-teal text-white border-none rounded-[9px] p-[10px_18px] text-[12px] font-bold cursor-pointer hover:bg-teal-deep transition-colors flex items-center gap-1 shrink-0"
          >
            {loading ? <RefreshCw className="animate-spin w-[14px] h-[14px]" /> : <Send className="w-[14px] h-[14px]" />}
            Send
          </button>
        </form>
      )}

      {/* Traversal Pipeline Logs (Toggleable, collapsed by default) */}
      {status !== 'idle' && explainableLogs && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setReportingAgentState({ showLogs: !showLogs })}
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
