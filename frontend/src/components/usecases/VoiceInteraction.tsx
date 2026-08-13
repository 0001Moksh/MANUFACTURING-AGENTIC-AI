import React, { useState, useEffect, useRef } from 'react';
import { Mic, AudioLines } from 'lucide-react';

interface VoiceInteractionProps {
  useCaseName: string;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
}

export const VoiceInteraction: React.FC<VoiceInteractionProps> = ({ useCaseName }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: 'msg-0',
    sender: 'agent',
    text: `Hi, I can answer questions about ${useCaseName}. What would you like to know?`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }]);

  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

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
    // Connect WebSocket
    const ws = new WebSocket('ws://localhost:8000/api/ws/voice');

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'transcript') {
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
        // Append text chunk to the last agent message without mutating
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
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
          }
          return newMsgs;
        });
      }
      else if (data.type === 'audio_chunk') {
        // Decode base64 to ArrayBuffer and play it
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
  }, []);

  const playAudioBuffer = (buffer: AudioBuffer) => {
    if (!audioContextRef.current) return;

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);

    const currentTime = audioContextRef.current.currentTime;
    // Schedule seamlessly
    const startTime = Math.max(currentTime, nextPlayTimeRef.current);

    source.start(startTime);
    nextPlayTimeRef.current = startTime + buffer.duration;

    activeSourceNodes.current.push(source);

    source.onended = () => {
      activeSourceNodes.current = activeSourceNodes.current.filter(n => n !== source);
    };
  };

  const stopAllAudioPlayback = () => {
    activeSourceNodes.current.forEach(source => {
      try { source.stop(); } catch (e) { }
    });
    activeSourceNodes.current = [];
    nextPlayTimeRef.current = audioContextRef.current?.currentTime || 0;
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

  return (
    <div className="flex flex-col h-full w-full bg-white rounded-[12px] border border-border-color shadow-sm overflow-hidden">
      <div className="bg-canvas border-b border-border-color p-[12px_16px] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-[8px]">
          <div className="w-[8px] h-[8px] bg-green rounded-full relative">
            <span className="absolute inset-0 bg-green rounded-full animate-ping opacity-75"></span>
          </div>
          <b className="text-[12.5px] font-head font-bold text-ink">Ask about this use case</b>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-[20px] flex flex-col gap-[16px] bg-[#FAFBFE] min-h-[300px]">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-[12px] p-[12px_16px] text-[13px] leading-relaxed shadow-sm
                ${msg.sender === 'user'
                  ? 'bg-navy-900 text-white rounded-br-[4px]'
                  : 'bg-white border border-border-color text-ink rounded-bl-[4px]'
                }`}
            >
              {msg.text}
              <div className={`text-[9.5px] mt-[6px] ${msg.sender === 'user' ? 'text-white/70' : 'text-muted'} text-right`}>
                {msg.timestamp}
              </div>
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex justify-start">
            <div className="bg-white border border-border-color rounded-[12px] rounded-bl-[4px] p-[12px_16px] flex gap-[4px] items-center">
              <span className="w-[6px] h-[6px] bg-navy-300 rounded-full animate-bounce"></span>
              <span className="w-[6px] h-[6px] bg-navy-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
              <span className="w-[6px] h-[6px] bg-navy-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-[20px] bg-white border-t border-border-color shrink-0 flex justify-center">
        {/* Voice Control Pill */}
        <button
          onClick={toggleListening}
          className={`relative flex items-center justify-between w-full max-w-[320px] p-[8px_8px_8px_20px] rounded-full transition-all duration-300 shadow-sm border ${isListening
            ? 'bg-navy-900 border-navy-900'
            : 'bg-navy-100 border-navy-100 hover:bg-navy-600'
            }`}
        >
          <div className="flex items-center gap-[12px]">
            <Mic className={`w-[18px] h-[18px] ${isListening ? 'text-white' : 'text-navy-400'}`} />
            <span className={`text-[14px] font-medium ${isListening ? 'text-white' : 'text-navy-300'}`}>
              {isListening ? 'Listening...' : 'Tap to speak'}
            </span>
          </div>

          <div className={`w-[44px] h-[44px] rounded-full flex items-center justify-center transition-all ${isListening
            ? 'bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.5)]'
            : 'bg-[#3b82f6] hover:bg-blue-500'
            }`}>
            <AudioLines className={`w-[20px] h-[20px] text-white ${isListening ? 'animate-pulse' : ''}`} />
          </div>
        </button>
      </div>
    </div>
  );
};
