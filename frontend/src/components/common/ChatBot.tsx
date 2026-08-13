import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Maximize2, Minimize2, Send, Bot, Maximize, Mic, MicOff, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { agentService } from '../../services/api';
import { parseMarkdown } from '../../utils/markdownParser';

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  isStreaming?: boolean;
};

const TypewriterText: React.FC<{ text: string; onComplete?: () => void }> = ({ text, onComplete }) => {
  const [displayedText, setDisplayedText] = useState('');
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  
  useEffect(() => {
    let i = 0;
    setDisplayedText('');
    const timer = setInterval(() => {
      setDisplayedText(text.substring(0, i));
      i++;
      if (i > text.length) {
        clearInterval(timer);
        if (onCompleteRef.current) onCompleteRef.current();
      }
    }, 15); // streaming speed
    return () => clearInterval(timer);
  }, [text]);

  return <div dangerouslySetInnerHTML={{ __html: parseMarkdown(displayedText) }} className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2" />;
};

const FormattedText: React.FC<{ text: string }> = ({ text }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const html = parseMarkdown(text);
  const hasTable = html.includes('<table');

  return (
    <div className="relative">
      <div 
        dangerouslySetInnerHTML={{ __html: html }} 
        className={`prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 ${hasTable && !isExpanded ? 'max-h-[300px] overflow-hidden' : ''}`} 
      />
      {hasTable && !isExpanded && (
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-canvas to-transparent flex items-end justify-center pb-2">
          <button 
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-1.5 text-xs font-bold text-teal bg-white/90 shadow-sm border border-border-color px-3 py-1.5 rounded-full hover:bg-teal hover:text-white transition-colors"
          >
            <Maximize className="w-3.5 h-3.5" /> View Full Data
          </button>
        </div>
      )}
      {hasTable && isExpanded && (
        <div className="mt-2 text-center">
          <button 
            onClick={() => setIsExpanded(false)}
            className="text-xs font-bold text-muted hover:text-ink underline"
          >
            Show Less
          </button>
        </div>
      )}
    </div>
  );
};

export const ChatBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', text: 'Hi, I am Deva. How can I assist you today in your operations?', sender: 'bot' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isWaiting, setIsWaiting] = useState(false);
  
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isWaiting]);

  useEffect(() => {
    // Initialize Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(transcript);
        // Automatically send after voice input
        setTimeout(() => {
          handleSendMessage(transcript);
        }, 500);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
    
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      window.speechSynthesis.cancel(); // Stop any speaking
      setIsSpeaking(false);
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    
    window.speechSynthesis.cancel(); // Cancel any ongoing speech
    
    // Strip markdown for speech
    const cleanText = text.replace(/[#_*`]/g, '').replace(/<[^>]*>?/gm, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  };

  const handleSendMessage = async (textToUse?: string) => {
    const query = typeof textToUse === 'string' ? textToUse.trim() : inputValue.trim();
    if (!query) return;
    const newUserMsg: Message = { id: Date.now().toString(), text: query, sender: 'user' };
    setMessages(prev => [...prev, newUserMsg]);
    setInputValue('');
    setIsWaiting(true);

    try {
      const response = await agentService.query(query);
      const textResponse = response.insights || response.error_message || 'I processed your request but no insights were returned.';
      const botResponse: Message = { 
        id: (Date.now() + 1).toString(), 
        text: textResponse, 
        sender: 'bot',
        isStreaming: true
      };
      setMessages(prev => [...prev, botResponse]);
      speakText(textResponse);
    } catch (error: any) {
      console.error('ChatBot query error:', error, error.response?.data);
      const errorMsgText = 'Sorry, I encountered an error while processing your request.';
      const errorMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        text: errorMsgText, 
        sender: 'bot',
        isStreaming: true
      };
      setMessages(prev => [...prev, errorMsg]);
      speakText(errorMsgText);
    } finally {
      setIsWaiting(false);
    }
  };

  const markStreamingComplete = (id: string) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, isStreaming: false } : m));
  };

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 p-4 bg-teal text-white rounded-full shadow-xl hover:bg-teal-deep transition-colors z-50 flex items-center justify-center cursor-pointer"
          >
            <MessageSquare className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
              ...(isFullScreen ? { 
                bottom: 0, right: 0, width: '100vw', height: '100vh', borderRadius: 0 
              } : { 
                bottom: 24, right: 24, width: 380, height: 600, borderRadius: 16 
              })
            }}
            exit={{ opacity: 0, y: 50, scale: 0.9, transition: { duration: 0.2 } }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed bg-panel border border-border-color shadow-2xl flex flex-col z-50 overflow-hidden ${isFullScreen ? '' : 'rounded-2xl'}`}
            style={{ 
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)'
            }}
          >
            <div className="flex items-center justify-between p-4 border-b border-border-color bg-canvas">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-teal-tint flex items-center justify-center text-teal-deep">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-ink text-sm m-0 flex items-center gap-2">
                    Deva Agent
                    {isSpeaking && (
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-teal"></span>
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-muted m-0">{isSpeaking ? 'Speaking...' : 'Online'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isSpeaking && (
                  <button 
                    onClick={stopSpeaking}
                    className="p-1.5 text-red hover:bg-red-tint rounded-md transition-colors cursor-pointer mr-2 flex items-center gap-1 text-[11px] font-bold"
                    title="Stop speaking"
                  >
                    <VolumeX className="w-4 h-4" /> Stop
                  </button>
                )}
                <button 
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="p-1.5 text-muted hover:text-ink hover:bg-panel rounded-md transition-colors cursor-pointer"
                >
                  {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-muted hover:text-ink hover:bg-panel rounded-md transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-panel">
              {messages.map((msg, index) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[90%] p-3 text-sm ${
                      msg.sender === 'user' 
                        ? 'bg-teal text-white rounded-2xl rounded-tr-sm whitespace-pre-wrap' 
                        : 'bg-canvas text-ink border border-border-color rounded-2xl rounded-tl-sm'
                    }`}
                  >
                    {msg.sender === 'bot' && msg.isStreaming ? (
                      <TypewriterText text={msg.text} onComplete={() => markStreamingComplete(msg.id)} />
                    ) : msg.sender === 'bot' ? (
                      <FormattedText text={msg.text} />
                    ) : (
                      msg.text
                    )}
                  </div>
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-border-color bg-canvas">
              <div className="flex gap-2">
                <button
                  onClick={toggleListening}
                  className={`p-2.5 rounded-xl transition-colors flex items-center justify-center cursor-pointer ${
                    isListening 
                      ? 'bg-red text-white animate-pulse' 
                      : 'bg-panel border border-border-color text-muted hover:text-ink hover:border-teal'
                  }`}
                  title={isListening ? "Stop listening" : "Start voice input"}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={isListening ? "Listening..." : "Type your message..."}
                  disabled={isListening}
                  className="flex-1 bg-panel border border-border-color rounded-xl px-4 py-2.5 text-sm text-ink placeholder-faint focus:outline-none focus:border-teal transition-colors disabled:opacity-50"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputValue.trim() || isWaiting || isListening}
                  className="bg-teal hover:bg-teal-deep disabled:opacity-50 disabled:hover:bg-teal text-white p-2.5 rounded-xl transition-colors flex items-center justify-center cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
