import React, { useEffect, useRef, useState } from 'react';
import { Activity, Bot, ChevronDown, CirclePlus, Clock3, Coins, Send, X, Zap } from 'lucide-react';
import { energyAgentService, type EnergyAgentTrace, type EnergyAgentHistoryMessage } from '../../services/energyAgentService';

type ChatMessage = EnergyAgentHistoryMessage & {
  id: string;
  trace?: EnergyAgentTrace;
};

const QUICK_PROMPTS = [
  'Summarize the latest voltage and current readings',
  'Which devices have signals outside configured limits?',
  'Compare temperature and vibration across devices',
  'Can this telemetry support kWh calculations?',
];

function createThreadId() {
  return globalThis.crypto?.randomUUID?.() ?? `energy-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatCost(value: number) {
  return value < 0.0001 ? `$${value.toFixed(8)}` : `$${value.toFixed(6)}`;
}

export const EnergyAgentChatWidget: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [threadId, setThreadId] = useState(createThreadId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  const startNewConversation = () => {
    setThreadId(createThreadId());
    setMessages([]);
    setDraft('');
    setError('');
  };

  const sendMessage = async (rawMessage: string) => {
    const message = rawMessage.trim();
    if (!message || sending) return;
    setError('');
    setDraft('');
    setSending(true);
    setMessages((current) => [...current, { id: `${Date.now()}-user`, role: 'user', content: message }]);
    const history: EnergyAgentHistoryMessage[] = messages.slice(-12).map(({ role, content }) => ({ role, content }));
    try {
      const result = await energyAgentService.chat(message, threadId, history);
      setThreadId(result.thread_id);
      setMessages((current) => [...current, {
        id: `${Date.now()}-assistant`,
        role: 'assistant',
        content: result.reply,
        trace: result.trace,
      }]);
    } catch (requestError: any) {
      const detail = requestError?.response?.data?.detail || requestError?.message || 'The Energy Agent could not complete this request.';
      setError(String(detail));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-[100]">
      {open && (
        <section
          id="energy-agent-chat-panel"
          role="dialog"
          aria-label="Chat with Energy Agent"
          className="absolute bottom-[68px] right-0 flex max-h-[min(700px,calc(100dvh-110px))] w-[min(390px,calc(100vw-2.5rem))] flex-col overflow-hidden border border-[#D8E2EC] bg-white shadow-[0_18px_60px_rgba(18,43,72,0.22)]"
        >
          <header className="flex items-center justify-between border-b border-[#E5EBF2] bg-[#F8FAFC] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E6F5F3] text-teal-deep"><Zap className="h-4 w-4" /></span>
              <div>
                <h2 className="m-0 text-sm font-bold text-ink">Energy Agent</h2>
                <span className="text-[10px] text-muted">Live InfluxDB analysis</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={startNewConversation} disabled={sending} title="New conversation" aria-label="New conversation" className="inline-flex h-8 w-8 items-center justify-center border-0 bg-transparent text-muted hover:bg-[#EAF0F6] hover:text-ink disabled:opacity-40"><CirclePlus className="h-4 w-4" /></button>
              <button type="button" onClick={() => setOpen(false)} title="Close chat" aria-label="Close chat" className="inline-flex h-8 w-8 items-center justify-center border-0 bg-transparent text-muted hover:bg-[#EAF0F6] hover:text-ink"><X className="h-4 w-4" /></button>
            </div>
          </header>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EAF3FC] text-[#3E80C1]"><Bot className="h-4 w-4" /></span>
                  <div className="max-w-[88%] border border-[#E7EDF4] bg-[#F8FAFC] px-3 py-2.5 text-xs leading-5 text-[#34445A]">
                    Ask about current machine signals, trends, or configured alerts. I’ll ground each answer in live InfluxDB data.
                  </div>
                </div>
                <div className="pl-9">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">Quick questions</div>
                  <div className="flex flex-col gap-1.5">
                    {QUICK_PROMPTS.map((prompt) => <button key={prompt} type="button" onClick={() => void sendMessage(prompt)} disabled={sending} className="border border-[#E1E9F1] bg-white px-2.5 py-2 text-left text-[10px] leading-4 text-[#34516D] hover:border-teal hover:bg-[#F5FBFA] disabled:opacity-50">{prompt}</button>)}
                  </div>
                </div>
              </div>
            )}

            {messages.map((message) => (
              <article key={message.id} className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.role === 'assistant' && <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EAF3FC] text-[#3E80C1]"><Bot className="h-4 w-4" /></span>}
                <div className={`max-w-[88%] min-w-0 px-3 py-2.5 ${message.role === 'user' ? 'bg-[#E8F2FD] text-[#253E5C]' : 'border border-[#E7EDF4] bg-[#F8FAFC] text-[#34445A]'}`}>
                  <div className="whitespace-pre-wrap break-words text-xs leading-5">{message.content}</div>
                  {message.trace && <TraceDetails trace={message.trace} />}
                </div>
              </article>
            ))}

            {sending && <div className="flex items-center gap-2 pl-9 text-[11px] text-muted"><span className="h-2 w-2 animate-pulse rounded-full bg-teal" /> Querying live telemetry and preparing analysis...</div>}
            {error && <div role="alert" className="ml-9 border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] leading-4 text-rose-800">{error}</div>}
            <div ref={endRef} />
          </div>

          <form onSubmit={(event) => { event.preventDefault(); void sendMessage(draft); }} className="border-t border-[#E5EBF2] bg-white p-3">
            <div className="flex items-end gap-2 border border-[#DDE6EF] bg-white px-2.5 py-2 focus-within:border-teal">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(draft); } }}
                disabled={sending}
                rows={1}
                maxLength={3000}
                placeholder="Ask about voltage, current, alerts..."
                aria-label="Message Energy Agent"
                className="max-h-24 min-h-6 flex-1 resize-y border-0 bg-transparent p-0 text-xs leading-5 text-ink outline-none placeholder:text-[#91A0B2] disabled:opacity-60"
              />
              <button type="submit" disabled={sending || !draft.trim()} title="Send message" aria-label="Send message" className="flex h-8 w-8 shrink-0 items-center justify-center border-0 bg-[#147FC1] text-white hover:bg-[#116EA8] disabled:cursor-not-allowed disabled:opacity-40"><Send className="h-4 w-4" /></button>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[9px] text-muted"><span>Answers use the configured telemetry window.</span><span>{draft.length}/3000</span></div>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? 'Close Energy Agent chat' : 'Open Energy Agent chat'}
        aria-expanded={open}
        aria-controls="energy-agent-chat-panel"
        title="Chat with Energy Agent"
        className="flex h-14 w-14 items-center justify-center rounded-full border-0 bg-[#147FC1] text-white shadow-[0_8px_24px_rgba(20,127,193,0.35)] transition-transform hover:scale-105 hover:bg-[#116EA8]"
      >
        {open ? <ChevronDown className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>
    </div>
  );
};

function TraceDetails({ trace }: { trace: EnergyAgentTrace }) {
  return (
    <details className="mt-2 border-t border-[#DFE7EF] pt-2">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[10px] font-semibold text-[#51708E]">
        <Activity className="h-3.5 w-3.5" /> Trace · {trace.execution_time_sec.toFixed(2)}s · {trace.tokens.total_tokens} tokens
      </summary>
      <div className="mt-2 space-y-1.5 text-[10px] text-[#52657A]">
        <div className="flex items-center justify-between gap-2"><span>Model</span><span className="truncate font-mono text-right">{trace.model || 'Unavailable'}</span></div>
        <div className="flex items-center justify-between gap-2"><span>Prompt / completion</span><span className="font-mono">{trace.tokens.prompt_tokens} / {trace.tokens.completion_tokens}</span></div>
        <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1"><Coins className="h-3 w-3" /> Estimated cost</span><span className="font-mono">{formatCost(trace.cost_usd)}</span></div>
        <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> Data source</span><span>{trace.data_source} · {trace.telemetry_range}</span></div>
        {trace.tools_used.map((tool) => <div key={tool.name} className="flex items-center justify-between gap-2"><span>Tool · {tool.name}</span><span>{tool.status} · {tool.device_count} devices</span></div>)}
        <div className="truncate border-t border-[#E4EAF0] pt-1 font-mono text-[9px] text-[#718198]">Thread {trace.thread_id}</div>
      </div>
    </details>
  );
}