import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Bot,
  User,
  Sparkles,
  Sliders,
  RefreshCw,
  Cpu,
  Video,
  Wrench,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { ChatWidgetRenderer } from './ChatWidgetRenderer';
import type { WidgetPayload } from './ChatWidgetRenderer';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  agent?: string;
  widget?: WidgetPayload;
  timestamp: string;
}

interface GovernanceSettings {
  autoApproveThreshold: number;
  requireHitlForMutations: boolean;
  alertAudioEnabled: boolean;
}

export const VideoMonitoringChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isGovernanceOpen, setIsGovernanceOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string>('General Agent');
  const [threadId] = useState<string>(() => `thread_${Math.random().toString(36).substring(2, 9)}`);
  const [governance, setGovernance] = useState<GovernanceSettings>({
    autoApproveThreshold: 0.9,
    requireHitlForMutations: true,
    alertAudioEnabled: true,
  });
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'Welcome to Deva Assistant — your multi-agent video monitoring system. Powered by a 5-agent mesh (General, System, Setup, Investigator, Video). Ask about cameras, safety violations, or incidents.',
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
    if (name.includes('video')) return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    if (name.includes('investigat')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (name.includes('setup')) return 'bg-purple-50 text-purple-700 border-purple-200';
    if (name.includes('system')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    return 'bg-teal-50 text-teal-700 border-teal-200';
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
      agent: 'General Agent',
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
            const agentName = dataJson.agent || 'General Agent';
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
          } else if (eventType === 'widget') {
            setMessages((prev) =>
              prev.map((msg) => (msg.id === botMsgId ? { ...msg, widget: dataJson } : msg))
            );
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
              }
              : msg
          )
        );
      } catch {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMsgId
              ? { ...msg, text: 'Deva this Side:⚠️ Unable to connect to your backend ' }
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
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-teal-600 px-3.5 py-3 text-white shadow-lg shadow-teal-600/25 transition-all duration-200 hover:bg-teal-700 hover:shadow-xl hover:scale-[1.02] active:scale-95 border border-teal-500/30"
        aria-label="Toggle Deva Assistant"
      >
        <div className="relative">
          <Bot className="w-5 h-5" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border-2 border-teal-600" />
        </div>
      </button>

      {/* Floating Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-22 right-6 z-50 w-[90vw] sm:w-[400px] h-[560px] max-h-[80vh] bg-white border border-slate-200 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="px-3.5 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-white shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[15px] font-semibold text-slate-900 tracking-tight">
                    Deva
                  </span>
                  <span className="text-[10px] font-medium text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100">
                    Assistant
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 truncate">Multi-agent video monitoring</p>
              </div>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={() => setIsGovernanceOpen(true)}
                className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors"
                title="HITL Governance Settings"
              >
                <Sliders className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-slate-50/50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >

                <div className={`max-w-[70%] ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.sender === 'bot' && msg.agent && (
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-tl-lg rounded-tr-lg border ${getAgentBadgeColor(
                          msg.agent
                        )}`}
                      >
                        {getAgentIcon(msg.agent)}
                        {msg.agent}
                      </span>
                      <span className="text-[9px] text-slate-400">{msg.timestamp}</span>
                    </div>
                  )}
                  <div
                    className={`px-3 py-2 rounded-xl text-[13px] leading-relaxed ${msg.sender === 'user'
                        ? 'bg-teal-600 text-white rounded-br-sm shadow-sm'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-tl shadow-sm'
                      }`}
                  >
                    <p className="whitespace-pre-wrap">
                      {msg.text ? (
                        msg.text
                      ) : isStreaming && msg.id.startsWith("bot_") ? (
                        <span className="inline-flex items-center gap-1.5 text-gray-500">
                          <span>Thinking</span>
                          <span className="flex gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]" />
                            <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]" />
                            <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" />
                          </span>
                        </span>
                      ) : (
                        ""
                      )}
                    </p>


                    {msg.widget && (
                      <div className="mt-2">
                        <ChatWidgetRenderer
                          payload={msg.widget}
                          onActionClick={handleActionClick}
                        />
                      </div>
                    )}
                  </div>
                  {msg.sender === 'user' && (
                    <div className="text-[9px] text-slate-400 text-right mt-0.5 px-0.5">
                      {msg.timestamp}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder="Ask Deva Assistant…"
              disabled={isStreaming}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition disabled:opacity-60"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={isStreaming || !input.trim()}
              className="p-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-lg transition-all disabled:opacity-60"
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
                    HITL Governance
                  </h3>
                </div>
                <button
                  onClick={() => setIsGovernanceOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <div className="space-y-5 text-[13px]">
                {/* Threshold */}
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
                    Actions below this level need operator approval.
                  </p>
                </div>

                {/* Mutation Controls */}
                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="pr-2">
                    <span className="font-semibold text-slate-800 block text-[13px]">
                      Mandatory Mutation Controls
                    </span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">
                      Require sign-off for camera & rule changes
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      setGovernance({
                        ...governance,
                        requireHitlForMutations: !governance.requireHitlForMutations,
                      })
                    }
                    className={`w-10 h-5.5 rounded-full p-0.5 transition-colors shrink-0 ${governance.requireHitlForMutations ? 'bg-teal-600' : 'bg-slate-300'
                      }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${governance.requireHitlForMutations ? 'translate-x-4.5' : 'translate-x-0'
                        }`}
                    />
                  </button>
                </div>

                {/* Audio Alert */}
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
                    className={`w-10 h-5.5 rounded-full p-0.5 transition-colors shrink-0 ${governance.alertAudioEnabled ? 'bg-teal-600' : 'bg-slate-300'
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
              className="w-full mt-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg text-[13px] transition-colors shadow-sm"
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