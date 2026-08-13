import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Settings2 } from 'lucide-react';
import { useCases, pillarMeta, adminTemplates } from '../data/mockData';
import { VoiceInteraction } from '../components/usecases/VoiceInteraction';

const tagColors: Record<string, string> = {
  AGENTIC: 'bg-amber-tint text-[#9A6400]',
  GENAI: 'bg-purple-tint text-[#5b4fd6]',
  VOICE: 'bg-teal-tint text-teal-deep',
  VISION: 'bg-red-tint text-[#B23A3A]',
  ML: 'bg-green-tint text-[#1a8f5f]',
  IOT: 'bg-blue-tint text-[#2258b0]',
};

export const UseCaseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const useCase = useCases.find(u => u.id === Number(id));

  const [settings, setSettings] = React.useState({
    is_enabled: false,
    email: '',
    schedule_time: '08:00',
    prompt: ''
  });
  const [isSaving, setIsSaving] = React.useState(false);

  useEffect(() => {
    if (useCase && useCase.id === 1) {
      fetch('http://localhost:8000/api/agent-reporting/settings')
        .then(res => res.json())
        .then(data => {
          if (!data.error) {
            setSettings(data);
          }
        })
        .catch(err => console.error("Failed to load settings", err));
    }
  }, [useCase]);

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      await fetch('http://localhost:8000/api/agent-reporting/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
    } catch (err) {
      console.error("Failed to save settings", err);
    }
    setIsSaving(false);
  };

  if (!useCase) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh]">
        <h2 className="text-2xl font-bold text-ink mb-4">Use Case not found</h2>
        <button onClick={() => navigate('/use-cases')} className="text-navy-600 hover:underline">
          Return to Library
        </button>
      </div>
    );
  }

  const cfgRows = (adminTemplates[useCase.tags[0]] || [])
    .concat(adminTemplates[useCase.tags[1]] ? adminTemplates[useCase.tags[1]].slice(0, 1) : []);

  const isDailyReporting = useCase.id === 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-[1200px] mx-auto h-[calc(100vh-80px)] flex flex-col"
    >
      <div className="mb-[20px] flex items-center gap-4">
        <button 
          onClick={() => navigate('/use-cases')}
          className="flex items-center gap-[6px] text-muted hover:text-navy-800 transition-colors text-[13px] font-semibold"
        >
          <ArrowLeft className="w-[14px] h-[14px]" /> Back to Use-Case Library
        </button>
      </div>

      <div className="bg-panel rounded-[16px] shadow-sm border border-border-color flex flex-col flex-1 overflow-hidden min-h-0">
        <div className="p-[24px_32px] border-b border-border-color flex gap-[14px] items-start shrink-0">
          <div>
            <div className="flex items-center gap-[12px] mb-[8px]">
               <span className="font-mono text-[11px] text-faint bg-canvas rounded-[6px] py-[2px] px-[6px]">
                  UC{String(useCase.id).padStart(2, '0')} · {pillarMeta[useCase.pillar].label}
               </span>
               {useCase.status === 'live' && (
                  <span className="text-[10px] font-bold text-green uppercase tracking-[0.5px]">LIVE</span>
               )}
            </div>
            
            <h1 className="font-head text-[28px] m-[0_0_12px] font-extrabold text-ink">{useCase.title}</h1>
            
            <div className="flex gap-[5px] flex-wrap">
              {useCase.tags.map(t => (
                <span key={t} className={`text-[10px] font-bold tracking-[0.4px] py-[4px] px-[8px] rounded-[5px] uppercase ${tagColors[t]}`}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
        
        <div className="p-[24px_32px] flex flex-col flex-1 overflow-y-auto custom-scrollbar">
          <div className="text-[14.5px] text-ink leading-[1.6] mb-[20px] max-w-[800px]">
            {useCase.desc}
          </div>
          
          <div className="bg-teal-tint border border-[#BFE7E7] rounded-[10px] p-[16px_20px] text-[13.5px] text-teal-deep mb-[24px] max-w-[800px]">
            <b className="text-ink font-bold">Impact:</b> {useCase.impact}
          </div>

          <div className="mb-[24px] flex items-center gap-[12px]">
            <span className="text-[11px] font-bold text-muted uppercase tracking-[0.5px]">Powered by</span>
            <div className="flex gap-[8px]">
              <span className="bg-navy-900 text-white text-[11px] font-semibold py-[4px] px-[10px] rounded-full">
                Operations Agent
              </span>
              <span className="bg-navy-900 text-white text-[11px] font-semibold py-[4px] px-[10px] rounded-full">
                Safety & Quality Agent
              </span>
            </div>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-[24px] flex-1">
             <div className="flex flex-col h-full">
                {isDailyReporting ? (
                <div className="border border-dashed border-[#C9D2E6] rounded-[12px] p-[20px_24px] bg-[#FAFBFE] h-full flex flex-col">
                    <div className="flex items-center gap-[8px] mb-[20px]">
                    <Settings2 className="w-[18px] h-[18px] text-navy-700" />
                    <b className="text-[14px] font-head font-bold text-ink">Automated Daily Reporting Configuration</b>
                    </div>
                    
                    <div className="flex flex-col gap-[20px] flex-1">
                    <div className="flex items-center gap-3">
                        <button 
                        onClick={() => setSettings(s => ({ ...s, is_enabled: !s.is_enabled }))}
                        className={`w-[40px] h-[24px] rounded-full relative transition-colors ${settings.is_enabled ? 'bg-green' : 'bg-gray-300'}`}
                        >
                        <span className={`absolute top-[2px] w-[20px] h-[20px] bg-white rounded-full transition-all shadow-sm ${settings.is_enabled ? 'left-[18px]' : 'left-[2px]'}`} />
                        </button>
                        <span className="text-[14px] font-semibold text-ink">Enable Autonomic Reporting</span>
                    </div>

                    <div className="grid grid-cols-2 gap-[16px]">
                        <div>
                        <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-2">Recipient Email</label>
                        <input 
                            type="email" 
                            value={settings.email}
                            onChange={e => setSettings(s => ({ ...s, email: e.target.value }))}
                            placeholder="team@example.com"
                            className="w-full border border-border-color rounded-[8px] p-[10px_14px] text-[14px] outline-none focus:border-navy-500 shadow-sm"
                        />
                        </div>
                        <div>
                        <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-2">Schedule Time (Daily)</label>
                        <input 
                            type="time" 
                            value={settings.schedule_time}
                            onChange={e => setSettings(s => ({ ...s, schedule_time: e.target.value }))}
                            className="w-full border border-border-color rounded-[8px] p-[10px_14px] text-[14px] outline-none focus:border-navy-500 shadow-sm"
                        />
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col">
                        <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-2">Agent Prompt</label>
                        <textarea 
                        value={settings.prompt}
                        onChange={e => setSettings(s => ({ ...s, prompt: e.target.value }))}
                        className="w-full flex-1 border border-border-color rounded-[8px] p-[12px_14px] text-[13px] outline-none focus:border-navy-500 font-mono resize-none shadow-sm min-h-[120px]"
                        />
                    </div>

                    <div className="flex justify-end mt-auto pt-[16px]">
                        <button 
                        onClick={saveSettings}
                        disabled={isSaving}
                        className="bg-navy-900 hover:bg-navy-800 text-white text-[14px] font-bold py-[10px] px-[20px] rounded-[8px] transition-colors disabled:opacity-50 shadow-sm"
                        >
                        {isSaving ? 'Saving...' : 'Save Configuration'}
                        </button>
                    </div>
                    </div>
                </div>
                ) : (
                <div className="border border-dashed border-[#C9D2E6] rounded-[12px] p-[20px_24px] bg-[#FAFBFE] flex flex-col h-full">
                    <div className="flex items-center gap-[8px] mb-[16px]">
                    <Settings2 className="w-[18px] h-[18px] text-navy-700" />
                    <b className="text-[14px] font-head font-bold text-ink">Admin & usability controls for this use case</b>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
                    <div className="bg-white border border-border-color rounded-[10px] p-[14px_16px] shadow-sm">
                        <div className="text-[11px] text-faint uppercase tracking-[0.5px] font-bold mb-[6px]">Enabled for</div>
                        <div className="text-[13.5px] font-semibold text-ink">6 of 6 plants</div>
                    </div>
                    <div className="bg-white border border-border-color rounded-[10px] p-[14px_16px] shadow-sm">
                        <div className="text-[11px] text-faint uppercase tracking-[0.5px] font-bold mb-[6px]">Rollout status</div>
                        <div className="text-[13.5px] font-semibold text-ink">{useCase.status === 'live' ? 'Live in production' : 'Pilot — 2 sites'}</div>
                    </div>
                    {cfgRows.map((r, i) => (
                        <div key={i} className="bg-white border border-border-color rounded-[10px] p-[14px_16px] shadow-sm">
                        <div className="text-[11px] text-faint uppercase tracking-[0.5px] font-bold mb-[6px]">{r[0]}</div>
                        <div className="text-[13.5px] font-semibold text-ink">{r[1]}</div>
                        </div>
                    ))}
                    <div className="bg-white border border-border-color rounded-[10px] p-[14px_16px] shadow-sm">
                        <div className="text-[11px] text-faint uppercase tracking-[0.5px] font-bold mb-[6px]">Human approval required</div>
                        <div className="text-[13.5px] font-semibold text-ink flex items-center gap-[8px]">
                        <span className="w-[32px] h-[18px] rounded-[20px] bg-green relative shrink-0">
                            <span className="absolute w-[14px] h-[14px] bg-white rounded-full top-[2px] right-[2px] shadow-sm" />
                        </span>
                        {useCase.tags.includes('AGENTIC') ? 'Yes, for high-risk actions' : 'No — advisory only'}
                        </div>
                    </div>
                    </div>
                </div>
                )}
             </div>

             <div className="h-[500px] lg:h-auto min-h-[400px]">
                <VoiceInteraction useCaseName={useCase.title} />
             </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
