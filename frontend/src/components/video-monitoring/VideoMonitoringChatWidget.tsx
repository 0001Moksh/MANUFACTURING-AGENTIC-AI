import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  X,
  Send,
  Bot,
  Sparkles,
  Sliders,
  Cpu,
  Video,
  Wrench,
  Search,
  ShieldCheck,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useAppStore } from '../../store';
import { ChatWidgetRenderer } from './ChatWidgetRenderer';
import type { WidgetPayload } from './ChatWidgetRenderer';
import { ExecutionTraceWidget, type ExecutionTracePayload } from './ExecutionTraceWidget';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  agent?: string;
  widget?: WidgetPayload;
  telemetry?: ExecutionTracePayload;
  timestamp: string;
}

interface GovernanceSettings {
  autoApproveThreshold: number;
  requireHitlForMutations: boolean;
  alertAudioEnabled: boolean;
}

export const VideoMonitoringChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isGovernanceOpen, setIsGovernanceOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [, setActiveAgent] = useState<string>('General Agent');
  const [threadId] = useState<string>(() => `thread_${Math.random().toString(36).substring(2, 9)}`);

  // Traceability toggle sync with global Admin Console
  const explainableLogs = useAppStore((state: any) => state.explainableLogs);

  const [governance, setGovernance] = useState<GovernanceSettings>({
    autoApproveThreshold: 0.9,
    requireHitlForMutations: true,
    alertAudioEnabled: true,
  });

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'Welcome to Deva Assistant — your multi-agent video monitoring system. Powered by a 5-agent specialist mesh (General, System, Setup, Investigator, Video). Ask about cameras, safety violations, or incident forensics.',
      agent: 'General Agent',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  const getAgentBadgeColor = (agentName: string) => {
    const name = agentName.toLowerCase();
    if (name.includes('video')) return 'bg-cyan-950/90 text-cyan-300 border-cyan-800/60';
    if (name.includes('investigat')) return 'bg-amber-950/90 text-amber-300 border-amber-800/60';
    if (name.includes('setup')) return 'bg-purple-950/90 text-purple-300 border-purple-800/60';
    if (name.includes('system')) return 'bg-emerald-950/90 text-emerald-300 border-emerald-800/60';
    return 'bg-slate-800/90 text-teal-300 border-slate-700';
  };

  const getAgentIcon = (agentName: string) => {
    const name = agentName.toLowerCase();
    if (name.includes('video')) return <Video className="w-3 h-3" />;
    if (name.includes('investigat')) return <Search className="w-3 h-3" />;
    if (name.includes('setup')) return <Wrench className="w-3 h-3" />;
    if (name.includes('system')) return <Cpu className="w-3 h-3" />;
    return <Sparkles className="w-3 h-3" />;
  };

  const handleSendMessage = async (textToSend?: string) => {
    const messageText = textToSend || input;
    if (!messageText.trim() || isStreaming) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: messageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsStreaming(true);

    const botMsgId = `bot_${Date.now()}`;
    const botMsg: ChatMessage = {
      id: botMsgId,
      sender: 'bot',
      text: '',
      agent: 'Deva Assistant',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, botMsg]);

    try {
      const response = await fetch('/api/agents/video-monitoring/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          thread_id: threadId,
          user_id: 'operator_1',
          hitl_context: governance,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Streaming failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const block of lines) {
          if (!block.trim()) continue;

          let eventType = 'token';
          let dataJson: any = {};

          const eventMatch = block.match(/^event:\s*(.+)$/m);
          if (eventMatch) eventType = eventMatch[1].trim();

          const dataMatch = block.match(/^data:\s*(.+)$/m);
          if (dataMatch) {
            try {
              dataJson = JSON.parse(dataMatch[1].trim());
            } catch {
              dataJson = { text: dataMatch[1].trim() };
            }
          }

          if (eventType === 'agent_switch') {
            const agentName = dataJson.agent || 'Deva Assistant';
            setActiveAgent(agentName);
            setMessages((prev) =>
              prev.map((msg) => (msg.id === botMsgId ? { ...msg, agent: agentName } : msg))
            );
          } else if (eventType === 'token') {
            const chunk = dataJson.text || '';
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === botMsgId ? { ...msg, text: msg.text + chunk } : msg
              )
            );
          } else if (eventType === 'telemetry') {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === botMsgId ? { ...msg, telemetry: dataJson } : msg
              )
            );
          } else if (eventType === 'widget') {
            setMessages((prev) =>
              prev.map((msg) => (msg.id === botMsgId ? { ...msg, widget: dataJson } : msg))
            );
          } else if (eventType === 'done') {
            if (dataJson.telemetry) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === botMsgId && !msg.telemetry
                    ? { ...msg, telemetry: dataJson.telemetry }
                    : msg
                )
              );
            }
          }
        }
      }
    } catch (err) {
      console.error('SSE Stream error, falling back to JSON:', err);
      try {
        const res = await fetch('/api/agents/video-monitoring/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: messageText, thread_id: threadId }),
        });
        const data = await res.json();
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMsgId
              ? {
                ...msg,
                text: data.reply || 'Request completed.',
                agent: data.active_agent || 'General Agent',
                telemetry: data.telemetry,
                widget: data.widget,
              }
              : msg
          )
        );
      } catch {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMsgId
              ? {
                ...msg,
                text: 'Deva Assistant: Unable to connect to backend safety services. Please verify network connectivity.',
              }
              : msg
          )
        );
      }
    } finally {
      setIsStreaming(false);
    }
  };

  const handleActionClick = (actionId: string, label: string) => {
    handleSendMessage(`[HITL Decision]: ${label} (Action ID: ${actionId})`);
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-teal-600 px-3.5 py-3 text-white shadow-lg shadow-teal-600/25 transition-all duration-200 hover:bg-teal-700 hover:shadow-xl hover:scale-[1.02] active:scale-95 border border-teal-500/30 cursor-pointer"
        aria-label="Toggle Deva Assistant"
      >
        <div className="relative">
          <Bot className="w-5 h-5" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border-2 border-teal-600" />
        </div>
      </button>

      {/* Floating Chat Panel */}
      {isOpen && (
        <div
          className={
            isFullscreen
              ? 'fixed inset-0 z-50 w-screen h-screen max-w-none max-h-none bg-slate-950 border-0 rounded-none shadow-none flex flex-col overflow-hidden'
              : 'fixed bottom-22 right-6 z-50 w-[92vw] sm:w-[500px] h-[660px] max-h-[85vh] bg-slate-950 border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200'
          }
        >
          {/* Header */}
          <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8.5 w-8.5 items-center justify-center rounded-lg bg-teal-600 text-white shrink-0 shadow-sm">
                <Bot className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[15px] font-semibold text-slate-100 tracking-tight">
                    Deva
                  </span>
                  <span className="text-[10px] font-semibold text-teal-300 bg-teal-950/80 px-1.5 py-0.5 rounded border border-teal-800/60">
                    Safety Agent Mesh
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">Video Monitoring & Safety Intelligence</p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Mode'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsGovernanceOpen(true)}
                className="p-1.5 text-slate-400 hover:text-teal-400 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                title="HITL Governance Settings"
              >
                <Sliders className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3.5 bg-slate-950">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`w-full max-w-[92%] ${msg.sender === 'user' ? 'items-end ml-auto' : 'items-start'}`}>
                  {msg.sender === 'bot' && msg.agent && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-t-md border ${getAgentBadgeColor(
                          msg.agent
                        )}`}
                      >
                        {getAgentIcon(msg.agent)}
                        {msg.agent}
                      </span>
                      <span className="text-[10px] text-slate-500">{msg.timestamp}</span>
                    </div>
                  )}

                  <div
                    className={`px-3.5 py-2.5 rounded-xl text-[13px] leading-relaxed shadow-md ${msg.sender === 'user'
                      ? 'bg-teal-600 text-white rounded-br-sm ml-auto max-w-[85%]'
                      : 'bg-slate-900/95 border border-slate-800 text-slate-100 rounded-tl-sm w-full'
                      }`}
                  >
                    {msg.sender === 'user' ? (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    ) : msg.text ? (
                      <div className="prose prose-invert prose-sm max-w-none text-slate-100 text-[13px] leading-relaxed break-words">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm as any]}
                          components={{
                            table: ({ node, ...props }) => (
                              <div className="my-2.5 overflow-x-auto rounded-lg border border-slate-800 shadow-md bg-slate-950">
                                <table className="w-full text-left text-xs border-collapse bg-slate-950" {...props} />
                              </div>
                            ),
                            thead: ({ node, ...props }) => (
                              <thead className="bg-slate-800/90 text-cyan-400 font-semibold border-b border-slate-700 text-[11px] uppercase tracking-wider" {...props} />
                            ),
                            th: ({ node, ...props }) => (
                              <th className="py-2 px-2.5 font-bold text-cyan-400" {...props} />
                            ),
                            td: ({ node, ...props }) => {
                              const childrenStr = String(props.children);
                              const isOnline = childrenStr.includes('ONLINE');
                              const isOffline = childrenStr.includes('OFFLINE');
                              const isCritical = childrenStr.includes('CRITICAL');
                              const isWarning = childrenStr.includes('WARNING');
                              const isCompliant = childrenStr.includes('COMPLIANT') || childrenStr.includes('YES');

                              if (isOnline || isCompliant) {
                                return (
                                  <td className="py-2 px-2.5 border-t border-slate-800/80 text-slate-200">
                                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded text-[11px] border border-emerald-800/60">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                      {props.children}
                                    </span>
                                  </td>
                                );
                              }
                              if (isOffline || isCritical) {
                                return (
                                  <td className="py-2 px-2.5 border-t border-slate-800/80 text-slate-200">
                                    <span className="inline-flex items-center gap-1 font-semibold text-red-400 bg-red-950/60 px-1.5 py-0.5 rounded text-[11px] border border-red-800/60">
                                      {props.children}
                                    </span>
                                  </td>
                                );
                              }
                              if (isWarning) {
                                return (
                                  <td className="py-2 px-2.5 border-t border-slate-800/80 text-slate-200">
                                    <span className="inline-flex items-center gap-1 font-semibold text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded text-[11px] border border-amber-800/60">
                                      {props.children}
                                    </span>
                                  </td>
                                );
                              }
                              return <td className="py-2 px-2.5 border-t border-slate-800/80 text-slate-200" {...props} />;
                            },
                            h1: ({ node, ...props }) => (
                              <h1 className="text-[15px] font-bold text-slate-100 mt-2 mb-1.5 tracking-tight" {...props} />
                            ),
                            h2: ({ node, ...props }) => (
                              <h2 className="text-[14px] font-bold text-slate-100 mt-2 mb-1 tracking-tight" {...props} />
                            ),
                            h3: ({ node, ...props }) => (
                              <h3 className="text-[13px] font-bold text-slate-100 mt-1.5 mb-1" {...props} />
                            ),
                            h4: ({ node, ...props }) => (
                              <h4 className="text-[12px] font-bold text-slate-200 mt-1 mb-0.5" {...props} />
                            ),
                            ul: ({ node, ...props }) => (
                              <ul className="list-disc pl-4 space-y-1 my-1.5 text-slate-300" {...props} />
                            ),
                            ol: ({ node, ...props }) => (
                              <ol className="list-decimal pl-4 space-y-1 my-1.5 text-slate-300" {...props} />
                            ),
                            blockquote: ({ node, ...props }) => (
                              <blockquote className="border-l-3 border-teal-500 bg-slate-900/80 pl-2.5 py-1 my-1.5 text-slate-200 italic rounded-r text-[12px]" {...props} />
                            ),
                            code: ({ node, inline, ...props }: any) =>
                              inline ? (
                                <code className="bg-slate-800 text-cyan-300 px-1 py-0.5 rounded font-mono text-[11px] border border-slate-700" {...props} />
                              ) : (
                                <code className="block bg-slate-950 text-emerald-400 p-2.5 rounded-lg font-mono text-[11px] my-2 overflow-x-auto border border-slate-800" {...props} />
                              ),
                          }}
                        >
                          {msg.text}
                        </ReactMarkdown>
                      </div>
                    ) : isStreaming && msg.id.startsWith('bot_') ? (
                      <span className="inline-flex items-center gap-2 text-slate-400 text-xs py-1">
                        <span className="font-medium text-slate-300">Analyzing safety telemetry</span>
                        <span className="flex gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:-0.3s]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:-0.15s]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce" />
                        </span>
                      </span>
                    ) : null}

                    {/* Interactive Widget */}
                    {msg.widget && (
                      <div className="mt-2.5">
                        <ChatWidgetRenderer
                          payload={msg.widget}
                          onActionClick={handleActionClick}
                        />
                      </div>
                    )}

                    {/* Expandable Traceability Telemetry Widget */}
                    {msg.sender === 'bot' && (explainableLogs || msg.telemetry) && msg.telemetry && (
                      <ExecutionTraceWidget trace={msg.telemetry} />
                    )}
                  </div>

                  {msg.sender === 'user' && (
                    <div className="text-[10px] text-slate-500 text-right mt-1 px-1">
                      {msg.timestamp}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Action Suggestion Chips */}
          {/* <div className="px-3 py-2 bg-slate-900 border-t border-slate-800 flex items-center gap-1.5 overflow-x-auto text-[11px] shrink-0 no-scrollbar">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider shrink-0">Quick:</span>
            <button
              onClick={() => handleSendMessage('How many cameras do we have and their status?')}
              disabled={isStreaming}
              className="px-2 py-0.5 bg-slate-800 border border-slate-700 hover:border-cyan-500 hover:text-cyan-300 rounded-full text-slate-300 shrink-0 transition-colors cursor-pointer"
            >
              Camera Status
            </button>
            <button
              onClick={() => handleSendMessage('Show active safety alerts and PPE compliance by zone')}
              disabled={isStreaming}
              className="px-2 py-0.5 bg-slate-800 border border-slate-700 hover:border-cyan-500 hover:text-cyan-300 rounded-full text-slate-300 shrink-0 transition-colors cursor-pointer"
            >
              PPE Compliance
            </button>
            <button
              onClick={() => handleSendMessage('Investigate incident INC-8891')}
              disabled={isStreaming}
              className="px-2 py-0.5 bg-slate-800 border border-slate-700 hover:border-amber-500 hover:text-amber-300 rounded-full text-slate-300 shrink-0 transition-colors cursor-pointer"
            >
              Investigate Incident
            </button>
            <button
              onClick={() => handleSendMessage('Show live feed for Luxsphere')}
              disabled={isStreaming}
              className="px-2 py-0.5 bg-slate-800 border border-slate-700 hover:border-cyan-500 hover:text-cyan-300 rounded-full text-slate-300 shrink-0 transition-colors cursor-pointer"
            >
              Live Feed Luxsphere
            </button>
            <button
              onClick={() => handleSendMessage('How many persons visible in Luxsphere? Are they wearing helmets?')}
              disabled={isStreaming}
              className="px-2 py-0.5 bg-slate-800 border border-slate-700 hover:border-cyan-500 hover:text-cyan-300 rounded-full text-slate-300 shrink-0 transition-colors cursor-pointer"
            >
              VLM Scene Check
            </button>
          </div> */}

          {/* Input Box */}
          <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder="Ask Deva Assistant about cameras, safety alerts, zones…"
              disabled={isStreaming}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-[13px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition disabled:opacity-60"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={isStreaming || !input.trim()}
              className="p-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white disabled:text-slate-500 rounded-lg transition-all disabled:opacity-60 cursor-pointer shadow-sm shadow-cyan-900/30"
              title="Send Query"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* HITL Governance Drawer */}
      {isGovernanceOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-sm bg-white border-l border-slate-200 h-full p-5 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex-1 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-500/10 text-teal-600">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <h3 className="text-[14px] font-semibold text-slate-900">
                    HITL Governance Settings
                  </h3>
                </div>
                <button
                  onClick={() => setIsGovernanceOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition cursor-pointer"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <div className="space-y-5 text-[13px]">
                {/* Auto Approve Threshold */}
                <div>
                  <div className="flex justify-between font-medium text-slate-800 mb-1.5">
                    <span>Auto-Approve Threshold</span>
                    <span className="font-mono text-teal-600 font-bold">
                      {(governance.autoApproveThreshold * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.50"
                    max="0.99"
                    step="0.01"
                    value={governance.autoApproveThreshold}
                    onChange={(e) =>
                      setGovernance({
                        ...governance,
                        autoApproveThreshold: parseFloat(e.target.value),
                      })
                    }
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Rule mutations and safety changes below this confidence level require operator approval.
                  </p>
                </div>

                {/* Mandatory Mutation Controls */}
                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="pr-2">
                    <span className="font-semibold text-slate-800 block text-[13px]">
                      Mandatory Mutation Controls
                    </span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">
                      Require operator confirmation for camera & zone mutations
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      setGovernance({
                        ...governance,
                        requireHitlForMutations: !governance.requireHitlForMutations,
                      })
                    }
                    className={`w-10 h-5.5 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer ${governance.requireHitlForMutations ? 'bg-teal-600' : 'bg-slate-300'
                      }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${governance.requireHitlForMutations ? 'translate-x-4.5' : 'translate-x-0'
                        }`}
                    />
                  </button>
                </div>

                {/* Critical Alert Audio */}
                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="pr-2">
                    <span className="font-semibold text-slate-800 block text-[13px]">
                      Critical Alert Audio
                    </span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">
                      Play chime on critical zone breaches
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      setGovernance({
                        ...governance,
                        alertAudioEnabled: !governance.alertAudioEnabled,
                      })
                    }
                    className={`w-10 h-5.5 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer ${governance.alertAudioEnabled ? 'bg-teal-600' : 'bg-slate-300'
                      }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${governance.alertAudioEnabled ? 'translate-x-4.5' : 'translate-x-0'
                        }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsGovernanceOpen(false)}
              className="w-full mt-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg text-[13px] transition-colors shadow-sm cursor-pointer"
            >
              Save Configuration
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default VideoMonitoringChatWidget;