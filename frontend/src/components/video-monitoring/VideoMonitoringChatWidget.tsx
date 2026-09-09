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
      text: '👋 Welcome to the Video Monitoring AI Safety Assistant. Powered by a 5-Agent Supervisor Mesh (General, System, Setup, Investigator, Video). Ask me about camera feeds, safety violations, or incident autopsies.',
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
              ? { ...msg, text: '⚠️ Unable to connect to backend multi-agent router.' }
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
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-full bg-teal-600 px-4 py-3.5 text-white shadow-lg shadow-teal-600/25 transition-all duration-200 hover:bg-teal-700 hover:shadow-xl hover:scale-[1.02] active:scale-95 border border-teal-500/30"
        aria-label="Toggle Video Monitoring AI Safety Assistant"
      >
        <div className="relative">
          <Bot className="w-5 h-5" />
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-teal-600" />
        </div>
        <span className="font-semibold text-[13px] hidden sm:inline tracking-wide">
          AI Safety Assistant
        </span>
      </button>

      {/* Floating Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[92vw] sm:w-[440px] h-[620px] max-h-[82vh] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="px-4 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600">
                <Bot className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-[14px] text-slate-900 truncate">
                    AI Safety Assistant
                  </h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-700 font-medium border border-teal-100 shrink-0">
                    5-Agent Mesh
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate">
                  RTSP · YOLO · Forensic Autopsy
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setIsGovernanceOpen(true)}
                className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                title="HITL Governance Settings"
              >
                <Sliders className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Active Agent Banner */}
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[12px] shrink-0">
            <span className="text-slate-500 font-medium">Active Agent</span>
            <div
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1.5 ${getAgentBadgeColor(
                activeAgent
              )}`}
            >
              {getAgentIcon(activeAgent)}
              <span>{activeAgent}</span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/40">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'bot' && (
                  <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div className={`max-w-[82%] ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.sender === 'bot' && msg.agent && (
                    <div className="flex items-center gap-1.5 mb-1 px-0.5">
                      <span className="text-[10px] font-semibold text-slate-500">{msg.agent}</span>
                      <span className="text-[9px] text-slate-400">{msg.timestamp}</span>
                    </div>
                  )}

                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${msg.sender === 'user'
                        ? 'bg-teal-600 text-white rounded-br-md shadow-sm'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md shadow-sm'
                      }`}
                  >
                    <p className="whitespace-pre-wrap">
                      {msg.text || (isStreaming && msg.id.startsWith('bot_') ? 'Thinking…' : '')}
                    </p>
                    {msg.widget && (
                      <div className="mt-2.5">
                        <ChatWidgetRenderer
                          payload={msg.widget}
                          onActionClick={handleActionClick}
                        />
                      </div>
                    )}
                  </div>

                  {msg.sender === 'user' && (
                    <div className="text-[9px] text-slate-400 text-right mt-1 px-0.5">
                      {msg.timestamp}
                    </div>
                  )}
                </div>

                {msg.sender === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}

            {isStreaming && (
              <div className="flex gap-2 items-center text-[12px] text-teal-600 font-medium">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Agent processing live stream telemetry…</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-3 py-2.5 bg-white border-t border-slate-100 flex gap-1.5 overflow-x-auto text-[11px] shrink-0">
            {[
              { label: '📹 List Cameras', prompt: 'List all active cameras and status' },
              { label: '🔍 Safety Autopsy', prompt: 'Investigate safety violations today' },
              { label: '🦺 PPE Counts', prompt: 'Show real-time PPE compliance & worker counts' },
              { label: '⚙️ Modify Rules', prompt: 'Update CAM-02 alert rule threshold' },
            ].map((chip) => (
              <button
                key={chip.label}
                onClick={() => handleSendMessage(chip.prompt)}
                disabled={isStreaming}
                className="px-2.5 py-1.5 rounded-full bg-slate-50 hover:bg-teal-50 text-slate-600 hover:text-teal-700 whitespace-nowrap border border-slate-200 hover:border-teal-200 transition-colors disabled:opacity-50"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder="Ask AI Safety Assistant…"
              disabled={isStreaming}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition disabled:opacity-60"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={isStreaming || !input.trim()}
              className="p-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-xl transition-all disabled:opacity-60"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* HITL Governance Drawer */}
      {isGovernanceOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-white border-l border-slate-200 h-full p-6 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex-1 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600">
                    <ShieldCheck className="w-4.5 h-4.5" />
                  </div>
                  <h3 className="text-[15px] font-semibold text-slate-900">
                    HITL Governance Settings
                  </h3>
                </div>
                <button
                  onClick={() => setIsGovernanceOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6 text-[13px]">
                {/* Threshold */}
                <div>
                  <div className="flex justify-between font-medium text-slate-800 mb-2">
                    <span>Auto-Approve Confidence Threshold</span>
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
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Actions below this confidence level require explicit operator approval.
                  </p>
                </div>

                {/* Mutation Controls */}
                <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="pr-3">
                    <span className="font-semibold text-slate-800 block">
                      Mandatory Mutation Controls
                    </span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">
                      Require human sign-off for camera & rule modifications
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      setGovernance({
                        ...governance,
                        requireHitlForMutations: !governance.requireHitlForMutations,
                      })
                    }
                    className={`w-11 h-6 rounded-full p-1 transition-colors shrink-0 ${governance.requireHitlForMutations ? 'bg-teal-600' : 'bg-slate-300'
                      }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${governance.requireHitlForMutations ? 'translate-x-5' : 'translate-x-0'
                        }`}
                    />
                  </button>
                </div>

                {/* Audio Alert */}
                <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="pr-3">
                    <span className="font-semibold text-slate-800 block">
                      Critical Alert Audio Siren
                    </span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">
                      Play audio chime on critical zone breaches
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      setGovernance({
                        ...governance,
                        alertAudioEnabled: !governance.alertAudioEnabled,
                      })
                    }
                    className={`w-11 h-6 rounded-full p-1 transition-colors shrink-0 ${governance.alertAudioEnabled ? 'bg-teal-600' : 'bg-slate-300'
                      }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${governance.alertAudioEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsGovernanceOpen(false)}
              className="w-full mt-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-[13px] transition-colors shadow-sm"
            >
              Save Governance Configuration
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default VideoMonitoringChatWidget;