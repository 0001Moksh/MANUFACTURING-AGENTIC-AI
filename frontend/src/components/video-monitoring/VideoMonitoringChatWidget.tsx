import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Bot, User, Sparkles, Sliders, ShieldAlert, RefreshCw, Cpu, Video, Wrench, Search, ShieldCheck } from 'lucide-react';
import { ChatWidgetRenderer, WidgetPayload } from './ChatWidgetRenderer';

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
    autoApproveThreshold: 0.90,
    requireHitlForMutations: true,
    alertAudioEnabled: true,
  });

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: "👋 Welcome to Video Monitoring AI Safety Assistant! Powered by a 5-Agent Supervisor Mesh (General, System, Setup, Investigator, Video). Ask me about camera feeds, safety violations, or incident autopsies.",
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
    if (name.includes('video')) return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    if (name.includes('investigat')) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    if (name.includes('setup')) return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    if (name.includes('system')) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  };

  const getAgentIcon = (agentName: string) => {
    const name = agentName.toLowerCase();
    if (name.includes('video')) return <Video className="w-3 h-3 text-cyan-400" />;
    if (name.includes('investigat')) return <Search className="w-3 h-3 text-amber-400" />;
    if (name.includes('setup')) return <Wrench className="w-3 h-3 text-purple-400" />;
    if (name.includes('system')) return <Cpu className="w-3 h-3 text-emerald-400" />;
    return <Sparkles className="w-3 h-3 text-blue-400" />;
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
            } catch (e) {
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
              prev.map((msg) => (msg.id === botMsgId ? { ...msg, text: msg.text + chunk } : msg))
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
      // Fallback to standard chat endpoint if SSE streaming is interrupted
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
              ? { ...msg, text: data.reply || 'Request completed.', agent: data.active_agent || 'General Agent' }
              : msg
          )
        );
      } catch (e) {
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
        className="fixed bottom-6 right-6 z-40 p-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-full shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center gap-3 border border-white/20"
        aria-label="Toggle Video Monitoring AI Safety Assistant"
      >
        <div className="relative">
          <Bot className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-ping" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900" />
        </div>
        <span className="font-bold text-sm hidden sm:inline tracking-wide">AI Safety Assistant</span>
      </button>

      {/* Floating Chat Modal */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[92vw] sm:w-[480px] h-[640px] max-h-[85vh] bg-slate-950/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl shadow-inner text-white">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white">AI Safety Assistant</h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono border border-indigo-500/30">
                    5-Agent Mesh
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">RTSP Stream + YOLO + Forensic Autopsy</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsGovernanceOpen(!isGovernanceOpen)}
                className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800/80 rounded-lg transition-colors"
                title="HITL Governance Settings"
              >
                <Sliders className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Active Agent Router Banner */}
          <div className="px-4 py-1.5 bg-slate-900/90 border-b border-slate-800/60 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Active Agent:</span>
            <div className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border flex items-center gap-1.5 ${getAgentBadgeColor(activeAgent)}`}>
              {getAgentIcon(activeAgent)}
              <span>{activeAgent}</span>
            </div>
          </div>

          {/* Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-950/50">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.sender === 'bot' && (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-md">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-[85%] ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.sender === 'bot' && msg.agent && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-bold text-slate-400">{msg.agent}</span>
                      <span className="text-[9px] text-slate-500">{msg.timestamp}</span>
                    </div>
                  )}

                  <div
                    className={`p-3 rounded-2xl text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-blue-600 text-white rounded-br-none shadow-md'
                        : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text || (isStreaming ? 'Thinking...' : '')}</p>
                    {msg.widget && <ChatWidgetRenderer payload={msg.widget} onActionClick={handleActionClick} />}
                  </div>

                  {msg.sender === 'user' && (
                    <div className="text-[9px] text-slate-500 text-right mt-1">{msg.timestamp}</div>
                  )}
                </div>

                {msg.sender === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {isStreaming && (
              <div className="flex gap-2 items-center text-xs text-indigo-400 font-mono animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Agent processing live stream telemetry...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompt Chips */}
          <div className="px-3 py-2 bg-slate-900/60 border-t border-slate-800/80 flex gap-1.5 overflow-x-auto text-[11px]">
            <button
              onClick={() => handleSendMessage('List all active cameras and status')}
              className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 whitespace-nowrap border border-slate-700 transition-colors"
            >
              📹 List Cameras
            </button>
            <button
              onClick={() => handleSendMessage('Investigate safety violations today')}
              className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 whitespace-nowrap border border-slate-700 transition-colors"
            >
              🔍 Safety Autopsy
            </button>
            <button
              onClick={() => handleSendMessage('Show real-time PPE compliance & worker counts')}
              className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 whitespace-nowrap border border-slate-700 transition-colors"
            >
              🦺 PPE Counts
            </button>
            <button
              onClick={() => handleSendMessage('Update CAM-02 alert rule threshold')}
              className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 whitespace-nowrap border border-slate-700 transition-colors"
            >
              ⚙️ Modify Rules
            </button>
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask AI Safety Assistant..."
              disabled={isStreaming}
              className="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={isStreaming || !input.trim()}
              className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-xl transition-all disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* HITL Governance Drawer Slide-Over */}
      {isGovernanceOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-slate-950 border-l border-slate-800 h-full p-6 flex flex-col justify-between shadow-2xl animate-slideLeft">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
                <div className="flex items-center gap-2.5 text-amber-400 font-bold">
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base text-white">HITL Governance Settings</h3>
                </div>
                <button onClick={() => setIsGovernanceOpen(false)} className="text-slate-400 hover:text-white p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6 text-xs text-slate-300">
                {/* Auto Approve Threshold Slider */}
                <div>
                  <div className="flex justify-between font-medium text-slate-200 mb-2">
                    <span>Auto-Approve Confidence Threshold</span>
                    <span className="font-mono text-indigo-400 font-bold">{(governance.autoApproveThreshold * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.50"
                    max="0.99"
                    step="0.01"
                    value={governance.autoApproveThreshold}
                    onChange={(e) => setGovernance({ ...governance, autoApproveThreshold: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Actions below this confidence level require explicit operator approval.</p>
                </div>

                {/* Require HITL for Mutations Toggle */}
                <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div>
                    <span className="font-semibold text-slate-200 block">Mandatory Mutation Controls</span>
                    <span className="text-[11px] text-slate-400">Require human sign-off for camera & rule modifications</span>
                  </div>
                  <button
                    onClick={() => setGovernance({ ...governance, requireHitlForMutations: !governance.requireHitlForMutations })}
                    className={`w-11 h-6 rounded-full p-1 transition-colors ${governance.requireHitlForMutations ? 'bg-indigo-600' : 'bg-slate-700'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${governance.requireHitlForMutations ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Audio Alarm Toggle */}
                <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div>
                    <span className="font-semibold text-slate-200 block">Critical Alert Audio Siren</span>
                    <span className="text-[11px] text-slate-400">Play audio chime on critical zone breaches</span>
                  </div>
                  <button
                    onClick={() => setGovernance({ ...governance, alertAudioEnabled: !governance.alertAudioEnabled })}
                    className={`w-11 h-6 rounded-full p-1 transition-colors ${governance.alertAudioEnabled ? 'bg-indigo-600' : 'bg-slate-700'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${governance.alertAudioEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsGovernanceOpen(false)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs transition-colors"
            >
              Save Governance Configuration
            </button>
          </div>
        </div>
      )}
    </>
  );
};
