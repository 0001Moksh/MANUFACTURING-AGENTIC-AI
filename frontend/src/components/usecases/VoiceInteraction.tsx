import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  AudioLines,
  ShieldCheck,
  Eye,
  Wrench,
  Sparkles,
  Send,
  Volume2,
  RefreshCw,
  Copy,
  Check,
  ArrowDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { websocketUrl } from '../../config/api';
import { AgentTelemetryFooter } from '../common/AgentTelemetryFooter';
import type { TurnTelemetry } from '../../types/telemetry';

interface VoiceInteractionProps {
  useCaseName?: string;
  defaultAgent?: 'auto' | 'safety_quality' | 'ppe_vision' | 'maintenance';
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  agentName?: string;
  telemetry?: TurnTelemetry;
}

const AGENT_OPTIONS = [
  { id: 'auto', label: 'Auto Router', icon: <Sparkles className="w-3.5 h-3.5 text-teal-deep" /> },
  { id: 'safety_quality', label: 'Safety & Quality', icon: <ShieldCheck className="w-3.5 h-3.5 text-teal-600" /> },
  { id: 'ppe_vision', label: 'PPE & CCTV Vision', icon: <Eye className="w-3.5 h-3.5 text-amber-600" /> },
  { id: 'maintenance', label: 'Maintenance Agent', icon: <Wrench className="w-3.5 h-3.5 text-blue-600" /> },
];

const SAMPLE_QUERIES: Record<string, string[]> = {
  auto: [
    'Are there any hard hat violations today?',
    'Show quality inspection reports for this week',
    'Predict equipment failure risk for machines',
  ],
  safety_quality: [
    'Which site has the highest material defects this month?',
    'Show active quality holds',
    'List top common quality failure reasons',
  ],
  ppe_vision: [
    'Any active PPE violations or zone breaches?',
    'Show top broken HSE rules this month',
    'List night shift safety incidents',
  ],
  maintenance: [
    'Predict machine failure probability',
    'Check vibration anomalies across lines',
    'Show active work orders',
  ],
};

export const VoiceInteraction: React.FC<VoiceInteractionProps> = ({
  useCaseName = 'Industrial AI Operations',
  defaultAgent = 'auto',
}) => {
  const [selectedAgent, setSelectedAgent] = useState<string>(defaultAgent);
  const [activeAgentBadge, setActiveAgentBadge] = useState<string>('');
  const [inputText, setInputText] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-0',
      sender: 'agent',
      text: `Hello sir! I am Deva, your Voice Interaction Layer. You can speak or type your query in English or Hindi. I will query the live agent database tools, display the results, and speak the response back to you.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      agentName: 'Voice Assistant (Deva)',
    },
  ]);

  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const nextPlayTimeRef = useRef<number>(0);
  const activeSourceNodes = useRef<AudioBufferSourceNode[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking, scrollToBottom]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distanceFromBottom > 250);
  };

  useEffect(() => {
    const wsUrl = `${websocketUrl('/ws/voice')}?agent=${selectedAgent}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'agent_routed') {
        setActiveAgentBadge(data.agent_name || '');
      } else if (data.type === 'transcript') {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            sender: data.role,
            text: data.text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        setIsThinking(true);
      } else if (data.type === 'agent_text_chunk') {
        setIsThinking(false);
        setMessages((prev) => {
          const newMsgs = [...prev];
          const lastMsg = newMsgs[newMsgs.length - 1];
          if (lastMsg && lastMsg.sender === 'agent' && lastMsg.id === `gen-${data.generation_id}`) {
            newMsgs[newMsgs.length - 1] = { ...lastMsg, text: lastMsg.text + data.text };
          } else {
            newMsgs.push({
              id: `gen-${data.generation_id}`,
              sender: 'agent',
              text: data.text,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              agentName: activeAgentBadge || 'Deva',
            });
          }
          return newMsgs;
        });
      } else if (data.type === 'telemetry') {
        setMessages((prev) => {
          const messagesWithTelemetry = [...prev];
          const lastAgentIndex = messagesWithTelemetry.map((message) => message.sender).lastIndexOf('agent');
          if (lastAgentIndex >= 0) {
            messagesWithTelemetry[lastAgentIndex] = {
              ...messagesWithTelemetry[lastAgentIndex],
              telemetry: data as TurnTelemetry,
            };
          }
          return messagesWithTelemetry;
        });
      } else if (data.type === 'audio_chunk') {
        if (!audioContextRef.current) return;
        try {
          const binaryString = window.atob(data.audio);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          const audioBuffer = await audioContextRef.current.decodeAudioData(bytes.buffer);
          playAudioBuffer(audioBuffer);
        } catch (e) {
          console.error('Failed to decode/play audio chunk', e);
        }
      } else if (data.type === 'stop_audio') {
        stopAllAudioPlayback();
      }
    };

    wsRef.current = ws;

    return () => {
      ws.close();
      stopListening();
    };
  }, [selectedAgent]);

  const handleAgentChange = (newAgent: string) => {
    setSelectedAgent(newAgent);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'set_agent', agent: newAgent }));
    }
  };

  const handleSendText = (textToSend?: string) => {
    const query = (textToSend ?? inputText).trim();
    if (!query || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    wsRef.current.send(
      JSON.stringify({
        type: 'query_text',
        text: query,
      })
    );

    setInputText('');
  };

  const playAudioBuffer = (buffer: AudioBuffer) => {
    if (!audioContextRef.current) return;

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);

    const currentTime = audioContextRef.current.currentTime;
    const startTime = Math.max(currentTime, nextPlayTimeRef.current);

    source.start(startTime);
    nextPlayTimeRef.current = startTime + buffer.duration;
    setIsPlayingAudio(true);

    activeSourceNodes.current.push(source);
    source.onended = () => {
      activeSourceNodes.current = activeSourceNodes.current.filter((n) => n !== source);
      if (activeSourceNodes.current.length === 0) {
        setIsPlayingAudio(false);
      }
    };
  };

  const stopAllAudioPlayback = () => {
    activeSourceNodes.current.forEach((source) => {
      try {
        source.stop();
      } catch (e) { }
    });
    activeSourceNodes.current = [];
    nextPlayTimeRef.current = audioContextRef.current?.currentTime || 0;
    setIsPlayingAudio(false);
  };

  const toggleListening = async () => {
    if (isListening) {
      stopListening();
    } else {
      await startListening();
    }
  };

  const startListening = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      await audioContextRef.current.audioWorklet.addModule('/VoiceStreamingWorklet.js');

      const source = audioContextRef.current.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContextRef.current, 'voice-streaming-worklet');

      workletNode.port.onmessage = (event) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(event.data);
        }
      };

      source.connect(workletNode);
      workletNode.connect(audioContextRef.current.destination);
      workletNodeRef.current = workletNode;

      setIsListening(true);
    } catch (err) {
      console.error('Failed to start listening', err);
    }
  };

  const stopListening = () => {
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsListening(false);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const currentSampleQueries = SAMPLE_QUERIES[selectedAgent] || SAMPLE_QUERIES.auto;

  const startNewConversation = () => {
    stopAllAudioPlayback();
    setInputText('');
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'agent',
        text: 'New conversation started. You can speak or type your query in English or Hindi.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        agentName: 'Voice Assistant (Deva)',
      },
    ]);
  };

  return (
    <div className="flex flex-col h-full w-full rounded-[12px] shadow-lg overflow-hidden">
      {/* ── Top Header with Agent Selection ── */}
      <div className="px-5 py-3 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-[6px] h-[6px] bg-green rounded-full" />
          <div className="min-w-0">{useCaseName}
          </div>
        </div>

        {/* Agent Selector Pills */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={startNewConversation}
            className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#125A78] px-3 py-2 text-[11px] font-bold text-white hover:bg-[#0D4861] transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" /> New Conversation
          </button>
          <div className="hidden">
            {AGENT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleAgentChange(opt.id)}
                className={`flex items-center gap-1.5 text-[11.5px] px-2.5 py-1 rounded-lg transition-all font-medium border-none cursor-pointer ${selectedAgent === opt.id
                  ? 'bg-white text-[#153247] shadow-xs font-semibold'
                  : 'bg-transparent text-muted hover:text-ink hover:bg-canvas'
                  }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Messages Chat View ── */}
      <div className="flex-1 relative min-h-[390px]">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto p-4 md:p-5 flex flex-col gap-3 custom-scrollbar"
        >
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`group relative max-w-[78%] rounded-[10px] p-3 md:p-3.5 text-[13px] leading-relaxed shadow-xs transition-shadow hover:shadow-sm
                      ${isUser
                        ? 'bg-[#155E7A] text-white rounded-br-[3px]'
                        : 'bg-[#F8FCFF] border border-[#C9DCEB] text-[#153247] rounded-bl-[3px]'
                      }`}
                  >
                    <button
                      onClick={() => handleCopy(msg.id, msg.text)}
                      title="Copy message"
                      className={`absolute -top-2.5 ${isUser ? '-left-2.5' : '-right-2.5'} opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity w-6 h-6 rounded-full bg-white border border-border-color shadow-sm flex items-center justify-center cursor-pointer hover:bg-canvas`}
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3 text-muted" />
                      )}
                    </button>

                    {msg.agentName && !isUser && (
                      <div className="text-[11px] font-bold text-teal-deep uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        {msg.agentName}
                      </div>
                    )}
                    <span className="whitespace-pre-wrap">{msg.text}</span>
                    {!isUser && msg.telemetry && <AgentTelemetryFooter telemetry={msg.telemetry} rawText={msg.text} />}
                    <div className={`text-[10px] mt-[6px] ${isUser ? 'text-white/70' : 'text-muted'} text-right`}>
                      {msg.timestamp}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {isThinking && (
            <div className="flex justify-start">
              <div className="bg-white border border-border-color rounded-[14px] rounded-bl-[4px] p-[12px_18px] flex gap-[6px] items-center text-[12px] text-muted">
                <span className="w-[6px] h-[6px] bg-teal-500 rounded-full animate-bounce"></span>
                <span className="w-[6px] h-[6px] bg-teal-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                <span className="w-[6px] h-[6px] bg-teal-700 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                <span className="ml-2 font-medium italic">Deva is querying live agent tools...</span>
              </div>
            </div>
          )}

          {isPlayingAudio && (
            <div className="flex justify-end">
              <div className="bg-teal-50 border border-teal-200 text-teal-800 text-[11.5px] font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-xs">
                <Volume2 className="w-3.5 h-3.5 animate-pulse text-teal-600" />
                <span>Speaking audio response...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Jump to latest button */}
        <AnimatePresence>
          {showScrollBtn && (
            <motion.button
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              onClick={() => scrollToBottom()}
              className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 bg-navy-900 text-white text-[11.5px] font-semibold px-3 py-1.5 rounded-full shadow-lg hover:bg-navy-800 transition-colors cursor-pointer border-none"
            >
              <ArrowDown className="w-3.5 h-3.5" /> Latest
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── Suggested Prompts ── */}
      <div className="px-5 py-2.5 bg-[#EAF5FC] border-t border-[#C9DCEB] flex items-center gap-2 overflow-x-auto custom-scrollbar">
        <span className="text-[11px] text-[#47677A] font-semibold shrink-0">Try asking:</span>
        {currentSampleQueries.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSendText(q)}
            className="text-[11px] px-2.5 py-1 rounded-full border border-[#A9CDDF] text-[#28647C] hover:bg-white bg-[#F7FCFF] cursor-pointer shrink-0 font-medium transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* ── Text Input Box & Voice Button Bottom Bar ── */}
      <div className="px-5 py-3 bg-[#F7FCFF] border-t border-[#C9DCEB] shrink-0 flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          {/* Query Text Box */}
          <div className="flex-1 flex items-center relative rounded-[6px] border border-[#B8D1E0] bg-white focus-within:border-[#2A7898] transition-all">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSendText();
                }
              }}
              placeholder="Type your query (English / Hindi) or tap mic to speak..."
              className="w-full bg-transparent px-3 py-2.5 text-[13px] outline-none text-[#153247] placeholder:text-[#7590A1]"
            />
            {inputText.trim() && (
              <button
                onClick={() => handleSendText()}
                className="mr-1.5 p-1.5 rounded-[5px] bg-[#125A78] text-white hover:bg-[#0D4861] transition-colors border-none cursor-pointer flex items-center justify-center"
                title="Send query"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Voice Microphone Toggle Pill */}
          <button
            onClick={toggleListening}
            className={`flex items-center gap-1.5 p-2 rounded-[6px] transition-all border cursor-pointer shrink-0 font-semibold text-[11px] ${isListening
              ? 'bg-[#155E7A] border-[#155E7A] text-white shadow-sm'
              : 'bg-[#155E7A] border-[#155E7A] text-white hover:bg-[#0D4861]'
              }`}
            title={isListening ? 'Stop listening' : 'Tap to speak'}
          >
            <div className="w-[18px] h-[18px] rounded-full flex items-center justify-center bg-[#0D4861]">
              {isListening ? <AudioLines className="w-3.5 h-3.5 text-white animate-pulse" /> : <Mic className="w-3.5 h-3.5 text-white" />}
            </div>
            <span className="hidden sm:inline">{isListening ? 'Listening...' : 'Voice'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceInteraction;
