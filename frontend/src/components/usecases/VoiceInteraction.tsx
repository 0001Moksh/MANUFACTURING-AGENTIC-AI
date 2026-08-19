import React, { useState, useEffect, useRef } from 'react';
import { Mic, AudioLines, ShieldCheck, Eye, Wrench, Sparkles, Send, Volume2 } from 'lucide-react';
import { websocketUrl } from '../../config/api';

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
}

const AGENT_OPTIONS = [
  { id: 'auto', label: 'Auto Router', icon: <Sparkles className="w-3.5 h-3.5 text-teal-deep" /> },
  { id: 'safety_quality', label: 'Safety & Quality', icon: <ShieldCheck className="w-3.5 h-3.5 text-teal-600" /> },
  { id: 'ppe_vision', label: 'PPE & CCTV Vision', icon: <Eye className="w-3.5 h-3.5 text-amber-600" /> },
  { id: 'maintenance', label: 'Maintenance Agent', icon: <Wrench className="w-3.5 h-3.5 text-blue-600" /> },
];

const SAMPLE_QUERIES: Record<string, string[]> = {
  auto: [
    "Are there any hard hat violations today?",
    "Show quality inspection reports for this week",
    "Predict equipment failure risk for machines"
  ],
  safety_quality: [
    "Which site has the highest material defects this month?",
    "Show active quality holds",
    "List top common quality failure reasons"
  ],
  ppe_vision: [
    "Any active PPE violations or zone breaches?",
    "Show top broken HSE rules this month",
    "List night shift safety incidents"
  ],
  maintenance: [
    "Predict machine failure probability",
    "Check vibration anomalies across lines",
    "Show active work orders"
  ]
};

export const VoiceInteraction: React.FC<VoiceInteractionProps> = ({
  useCaseName = "Industrial AI Operations",
  defaultAgent = 'auto'
}) => {
  const [selectedAgent, setSelectedAgent] = useState<string>(defaultAgent);
  const [activeAgentBadge, setActiveAgentBadge] = useState<string>('');
  const [inputText, setInputText] = useState<string>('');

  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: 'msg-0',
    sender: 'agent',
    text: `Hello sir! I am Deva, your Voice Interaction Layer. You can speak or type your query in English or Hindi. I will query the live agent database tools, display the results, and speak the response back to you.`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    agentName: 'Voice Assistant (Deva)'
  }]);

  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Playback state
  const nextPlayTimeRef = useRef<number>(0);
  const activeSourceNodes = useRef<AudioBufferSourceNode[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  useEffect(() => {
    // Connect WebSocket with active agent parameter
    const wsUrl = `${websocketUrl('/ws/voice')}?agent=${selectedAgent}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'agent_routed') {
        setActiveAgentBadge(data.agent_name || '');
      }
      else if (data.type === 'transcript') {
        setMessages(prev => [...prev, {
          id: `msg-${Date.now()}`,
          sender: data.role,
          text: data.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
        setIsThinking(true);
      }
      else if (data.type === 'agent_text_chunk') {
        setIsThinking(false);
        setMessages(prev => {
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
              agentName: activeAgentBadge || 'Deva'
            });
          }
          return newMsgs;
        });
      }
      else if (data.type === 'audio_chunk') {
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
          console.error("Failed to decode/play audio chunk", e);
        }
      }
      else if (data.type === 'stop_audio') {
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

    // Ensure AudioContext is active so speech plays upon arrival
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    wsRef.current.send(JSON.stringify({
      type: 'query_text',
      text: query
    }));

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
      activeSourceNodes.current = activeSourceNodes.current.filter(n => n !== source);
      if (activeSourceNodes.current.length === 0) {
        setIsPlayingAudio(false);
      }
    };
  };

  const stopAllAudioPlayback = () => {
    activeSourceNodes.current.forEach(source => {
      try { source.stop(); } catch (e) { }
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
        }
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
      console.error("Failed to start listening", err);
    }
  };

  const stopListening = () => {
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsListening(false);
  };

  const currentSampleQueries = SAMPLE_QUERIES[selectedAgent] || SAMPLE_QUERIES.auto;

  return (
    <div className="flex flex-col h-full w-full bg-white rounded-[16px] border border-border-color shadow-sm overflow-hidden">
      {/* ── Top Header with Agent Selection ── */}
      <div className="bg-canvas border-b border-border-color p-[14px_18px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-[10px]">
          <div className="w-[9px] h-[9px] bg-green rounded-full relative">
            <span className="absolute inset-0 bg-green rounded-full animate-ping opacity-75"></span>
          </div>
          <div>
            <b className="text-[13px] font-head font-bold text-ink block">Voice &amp; Speech Layer (Deva)</b>
            <span className="text-[11px] text-muted">{useCaseName}</span>
          </div>
        </div>

        {/* Agent Selector Pills */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-border-color shrink-0 flex-wrap">
          {AGENT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => handleAgentChange(opt.id)}
              className={`flex items-center gap-1.5 text-[11.5px] px-2.5 py-1 rounded-lg transition-all font-medium border-none cursor-pointer ${
                selectedAgent === opt.id
                  ? 'bg-navy-900 text-white shadow-xs font-semibold'
                  : 'bg-transparent text-muted hover:text-ink hover:bg-canvas'
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Messages Chat View ── */}
      <div className="flex-1 overflow-y-auto p-[20px] flex flex-col gap-[16px] bg-[#FAFBFE] min-h-[300px]">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-[14px] p-[12px_18px] text-[13.5px] leading-relaxed shadow-xs
                ${msg.sender === 'user'
                  ? 'bg-gradient-to-br from-[#0B1730] to-[#162B50] text-white rounded-br-[4px]'
                  : 'bg-white border border-border-color text-ink rounded-bl-[4px]'
                }`}
            >
              {msg.agentName && msg.sender === 'agent' && (
                <div className="text-[10.5px] font-bold text-teal-deep uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {msg.agentName}
                </div>
              )}
              {msg.text}
              <div className={`text-[9.5px] mt-[6px] ${msg.sender === 'user' ? 'text-white/70' : 'text-muted'} text-right`}>
                {msg.timestamp}
              </div>
            </div>
          </div>
        ))}

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

      {/* ── Suggested Prompts ── */}
      <div className="px-5 pt-2 pb-1 bg-white border-t border-border-color/60 flex items-center gap-1.5 overflow-x-auto">
        <span className="text-[11px] text-muted font-medium shrink-0">Try asking:</span>
        {currentSampleQueries.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSendText(q)}
            className="text-[11.5px] px-2.5 py-1 rounded-full border border-teal/40 text-teal-700 hover:bg-teal/5 bg-transparent cursor-pointer shrink-0 font-medium transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* ── Text Input Box & Voice Button Bottom Bar ── */}
      <div className="p-[14px_20px] bg-white border-t border-border-color shrink-0 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {/* Query Text Box */}
          <div className="flex-1 flex items-center relative rounded-[14px] border border-border-color bg-canvas focus-within:border-teal-deep transition-all">
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
              className="w-full bg-transparent px-4 py-3 text-[13.5px] outline-none text-ink placeholder:text-muted/70"
            />
            {inputText.trim() && (
              <button
                onClick={() => handleSendText()}
                className="mr-2 p-2 rounded-xl bg-teal-deep text-white hover:bg-teal-600 transition-colors border-none cursor-pointer flex items-center justify-center"
                title="Send query"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Voice Microphone Toggle Pill */}
          <button
            onClick={toggleListening}
            className={`flex items-center gap-2 p-[10px_16px] rounded-[14px] transition-all border cursor-pointer shrink-0 font-semibold text-[13px] ${
              isListening
                ? 'bg-navy-900 border-navy-900 text-white ring-2 ring-blue-400/40 shadow-sm'
                : 'bg-canvas border-border-color text-ink hover:border-teal-deep'
            }`}
            title={isListening ? 'Stop listening' : 'Tap to speak'}
          >
            <div className={`w-[22px] h-[22px] rounded-full flex items-center justify-center ${
              isListening ? 'bg-blue-600' : 'bg-teal-deep'
            }`}>
              {isListening ? (
                <AudioLines className="w-3.5 h-3.5 text-white animate-pulse" />
              ) : (
                <Mic className="w-3.5 h-3.5 text-white" />
              )}
            </div>
            <span className="hidden sm:inline">
              {isListening ? 'Listening...' : 'Voice'}
            </span>
          </button>
        </div>

        <div className="flex items-center justify-between text-[10.5px] text-muted px-1">
          <span>Type or speak • Spoken answers powered by Edge TTS &amp; Live Agent Tools</span>
          <span>Press Enter to send</span>
        </div>
      </div>
    </div>
  );
};
