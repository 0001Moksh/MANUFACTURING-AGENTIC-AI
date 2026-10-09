import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { VoiceAgentConsole } from '../components/usecases/VoiceAgentConsole';

export const VoiceAgentPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <main className="h-[calc(100vh-64px)] min-h-[620px] overflow-y-auto bg-[#F3F6F8] p-3 sm:p-5">
      <div className="mx-auto flex h-full max-w-[1440px] flex-col">
        <button
          type="button"
          onClick={() => navigate('/use-cases')}
          className="mb-3 inline-flex w-fit items-center gap-1.5 border-0 bg-transparent p-0 text-xs font-semibold text-slate-600 transition-colors hover:text-teal-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to use-case library
        </button>
        <section className="min-h-0 flex-1 overflow-hidden rounded-xl border border-[#D9E2E9] bg-white shadow-sm">
          <VoiceAgentConsole />
        </section>
      </div>
    </main>
  );
};
