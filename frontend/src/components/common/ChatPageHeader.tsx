import React from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ChatPageHeaderProps {
  title: string;
  description: string;
  tags?: string[];
  onNewConversation: () => void;
  backLabel?: string;
}

/** Shared header for chat-driven agent and use-case experiences. */
export const ChatPageHeader: React.FC<ChatPageHeaderProps> = ({
  title,
  description,
  tags = [],
  onNewConversation,
  backLabel = 'Back to AI Agents',
}) => {
  const navigate = useNavigate();

  return (
    <header className="rounded-[20px] border border-navy-700/50 bg-gradient-to-r from-navy-900 via-navy-800 to-teal-deep p-5 md:p-6 text-white shadow-sm shrink-0">
      <div className="mb-5 flex items-center justify-between gap-3">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-white/75 hover:bg-white/10 hover:text-white transition-colors cursor-pointer border-none">
          <ArrowLeft className="w-4 h-4" /> {backLabel}
        </button>
        <button onClick={onNewConversation} className="inline-flex items-center gap-2 rounded-[10px] border border-white/20 bg-white/10 px-3 py-2 text-[12px] font-bold text-white hover:bg-white/20 transition-colors cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5" /> New Conversation
        </button>
      </div>
      <h1 className="font-head text-[25px] md:text-[28px] font-extrabold leading-tight m-0">{title}</h1>
      <p className="mt-2 mb-0 max-w-[850px] text-[13.5px] leading-relaxed text-white/80">{description}</p>
      {tags.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{tags.map(tag => <span key={tag} className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10.5px] font-semibold text-white/90">{tag}</span>)}</div>}
    </header>
  );
};
