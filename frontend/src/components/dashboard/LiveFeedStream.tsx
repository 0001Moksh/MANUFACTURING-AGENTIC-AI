import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { feedPool } from '../../data/mockData';

interface FeedItem {
  id: string;
  agent: string;
  msg: string;
  sev: string;
  time: string;
}

const sevColor: Record<string, string> = {
  red: 'bg-red',
  amber: 'bg-amber',
  green: 'bg-green'
};

export const LiveFeedStream: React.FC = () => {
  const [feed, setFeed] = useState<FeedItem[]>([]);

  useEffect(() => {
    // Initial feed setup
    const initialFeed: FeedItem[] = [];
    for (let i = 0; i < 6; i++) {
      const pick = feedPool[Math.floor(Math.random() * feedPool.length)];
      initialFeed.push({
        id: Math.random().toString(36).substr(2, 9),
        agent: pick[0],
        msg: pick[1],
        sev: pick[2],
        time: new Date(Date.now() - i * 60000).toLocaleTimeString('en-GB')
      });
    }
    setFeed(initialFeed);

    let ws: WebSocket | null = null;
    let fallbackInterval: any = null;

    const startFallback = () => {
      if (fallbackInterval) return;
      fallbackInterval = setInterval(() => {
        const pick = feedPool[Math.floor(Math.random() * feedPool.length)];
        setFeed(prev => {
          const newItem = {
            id: Math.random().toString(36).substr(2, 9),
            agent: pick[0],
            msg: pick[1],
            sev: pick[2],
            time: new Date().toLocaleTimeString('en-GB')
          };
          return [newItem, ...prev].slice(0, 14);
        });
      }, 6000);
    };

    const connectWS = () => {
      try {
        ws = new WebSocket('ws://localhost:8000/api/ws/telemetry');
        
        ws.onmessage = (event) => {
          try {
            const newItem = JSON.parse(event.data);
            if (newItem.status === 'ack') return; // Skip ack messages
            setFeed(prev => {
              // Avoid duplicates
              if (prev.some(item => item.id === newItem.id)) return prev;
              return [newItem, ...prev].slice(0, 14);
            });
          } catch (e) {
            console.error('Error parsing WS message', e);
          }
        };

        ws.onclose = () => {
          console.log('WS connection closed. Reverting to local simulation.');
          startFallback();
        };

        ws.onerror = () => {
          if (ws) ws.close();
        };
      } catch (err) {
        console.error('Failed to create WS client', err);
        startFallback();
      }
    };

    connectWS();

    return () => {
      if (ws) ws.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, []);

  return (
    <div className="bg-panel border border-border-color rounded-[14px] overflow-hidden flex flex-col h-full">
      <div className="flex items-center gap-[10px] p-[16px_18px] border-b border-border-color bg-white/50 backdrop-blur-sm z-10 sticky top-0">
        <h3 className="font-head text-[14.5px] m-0 flex-1 font-bold">Live Agent Activity</h3>
        <span className="inline-flex items-center gap-[5px] text-[10px] font-bold tracking-[0.5px] text-white bg-red py-[3px] px-[8px] rounded-[20px]">
          <span className="w-[5px] h-[5px] rounded-full bg-white animate-pulse" />
          LIVE
        </span>
      </div>
      
      <div className="max-h-[390px] overflow-y-auto p-[6px_0] flex-1 relative">
        <AnimatePresence initial={false}>
          {feed.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex gap-[11px] p-[11px_18px] border-b border-[#F1F3F8] text-[12.5px] hover:bg-[#FAFBFE] transition-colors"
            >
              <div className={`w-[8px] h-[8px] rounded-full mt-[5px] shrink-0 ${sevColor[item.sev]}`} />
              <div className="flex-1">
                <span className="font-bold text-ink mr-1">{item.agent}</span>
                <span className="text-muted leading-relaxed">{item.msg}</span>
              </div>
              <div className="font-mono text-[10.5px] text-faint whitespace-nowrap pt-[2px]">
                {item.time}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
