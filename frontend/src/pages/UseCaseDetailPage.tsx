import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Settings2, Sparkles, CheckCircle2, AudioLines, ChevronDown, Workflow, ShieldCheck } from 'lucide-react';
import { useCases, pillarMeta, adminTemplates } from '../data/mockData';
import { VoiceInteraction } from '../components/usecases/VoiceInteraction';
import { API_BASE_URL } from '../config/api';
import { api } from '../services/api';

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
  const useCase = useCases.find((u) => u.id === Number(id));

  const [settings, setSettings] = React.useState({
    is_enabled: false,
    email: '',
    schedule_time: '08:00',
    prompt: '',
  });
  const [isSaving, setIsSaving] = React.useState(false);
  const [justSaved, setJustSaved] = React.useState(false);
  const [voiceBannerExpanded, setVoiceBannerExpanded] = useState(false);
  const [reportingHitlEnabled, setReportingHitlEnabled] = useState(false);
  const [globalHitlEnabled, setGlobalHitlEnabled] = useState(false);
  const [isUpdatingHitl, setIsUpdatingHitl] = useState(false);

  useEffect(() => {
    if (useCase && useCase.id === 9) {
      navigate('/use-cases/safety-site-intelligence', { replace: true });
      return;
    }

    if (useCase && useCase.id === 1) {
      fetch(`${API_BASE_URL}/agent-reporting/settings`)
        .then((res) => res.json())
        .then((data) => {
          if (!data.error) {
            setSettings(data);
          }
        })
        .catch((err) => console.error('Failed to load settings', err));
      fetch(`${API_BASE_URL}/use-cases/daily-operations-reporting/governance`)
        .then((res) => res.json())
        .then((data) => {
          setReportingHitlEnabled(Boolean(data.hitl_enabled));
          setGlobalHitlEnabled(Boolean(data.global_hitl_enabled));
        })
        .catch((err) => console.error('Failed to load reporting governance', err));
    }
  }, [useCase, navigate]);

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      await fetch(`${API_BASE_URL}/agent-reporting/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save settings', err);
    }
    setIsSaving(false);
  };

  const updateReportingHitl = async () => {
    if (isUpdatingHitl) return;
    const next = !reportingHitlEnabled;
    setIsUpdatingHitl(true);
    try {
      await api.put('/use-cases/daily-operations-reporting/governance', { enabled: next });
      setReportingHitlEnabled(next);
    } catch (err) {
      console.error('Failed to update reporting HITL setting', err);
    } finally {
      setIsUpdatingHitl(false);
    }
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

  const cfgRows = (adminTemplates[useCase.tags[0]] || []).concat(
    adminTemplates[useCase.tags[1]] ? adminTemplates[useCase.tags[1]].slice(0, 1) : []
  );

  const isDailyReporting = useCase.id === 1;
  const isVoiceInteraction = useCase.id === 2;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-[1440px] mx-auto h-[calc(100vh-80px)] px-1 py-1 flex flex-col overflow-hidden"
    >
      {/* ── Back Nav ── */}
      <div className="mb-[16px] flex items-center gap-4 shrink-0">
        <button
          onClick={() => navigate('/use-cases')}
          className="flex mt-3 items-center gap-[6px] text-muted hover:text-navy-800 transition-colors text-[13px] font-semibold bg-transparent border-none cursor-pointer p-0"
        >
          <ArrowLeft className="w-[14px] h-[14px]" /> Back to Use-Case Library
        </button>
      </div>

      {/* ── Main Panel ── */}
      {isVoiceInteraction && (
        <div className="bg-gradient-to-r from-[#0B1730] via-[#12365A] to-[#0A627B] text-white rounded-[16px] shadow-sm shrink-0 border border-[#185F78] overflow-hidden mb-3">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-[11px] bg-cyan-300/15 border border-cyan-200/30 flex items-center justify-center shrink-0">
                <AudioLines className="w-[18px] h-[18px] text-cyan-200" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-head text-[17px] font-extrabold m-0 text-white truncate">Voice Interaction Layer</h1>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-200 bg-emerald-400/10 border border-emerald-300/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" /> Live
                  </span>
                </div>
                <p className="m-0 mt-0.5 text-[11.5px] text-white/70 truncate">Hands-free access to connected manufacturing intelligence.</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden md:flex items-center gap-1.5">
                {useCase.poweredBy?.map((agentName) => (
                  <span key={agentName} className="inline-flex items-center gap-1.5 rounded-[8px] bg-white/10 border border-white/15 px-2 py-1 text-[10.5px] font-semibold text-white/90">
                    {agentName.includes('Safety') ? <ShieldCheck className="w-3 h-3 text-emerald-200" /> : <Workflow className="w-3 h-3 text-cyan-200" />}
                    {agentName}
                  </span>
                ))}
              </div>
              <button
                onClick={() => setVoiceBannerExpanded((expanded) => !expanded)}
                className="flex items-center gap-1.5 text-[11.5px] font-semibold text-white/90 hover:text-white bg-white/10 hover:bg-white/15 border border-white/15 px-2.5 py-1.5 rounded-[9px] transition-colors cursor-pointer"
                title={voiceBannerExpanded ? 'Collapse use case details' : 'Expand use case details'}
              >
                <motion.span animate={{ rotate: voiceBannerExpanded ? 180 : 0 }} transition={{ duration: 0.2 }} className="flex items-center">
                  <ChevronDown className="w-3.5 h-3.5" />
                </motion.span>
                {voiceBannerExpanded ? 'Collapse' : 'Expand'}
              </button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {voiceBannerExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="border-t border-white/10 px-4 py-3.5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                  <div>
                    <p className="m-0 max-w-3xl text-[13px] leading-relaxed text-white/80">{useCase.desc}</p>
                    <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                      {useCase.tags.map((tag) => (
                        <span key={tag} className="rounded-md bg-cyan-100/10 border border-cyan-100/15 px-2 py-1 text-[10px] font-bold tracking-wide text-cyan-100">{tag}</span>
                      ))}
                      <span className="rounded-md bg-white/10 border border-white/10 px-2 py-1 text-[10px] font-semibold text-white/75">Voice input</span>
                      <span className="rounded-md bg-white/10 border border-white/10 px-2 py-1 text-[10px] font-semibold text-white/75">English & Hindi</span>
                    </div>
                  </div>

                  <div className="rounded-[12px] bg-white/10 border border-white/15 px-3 py-2.5 min-w-[270px]">
                    <div className="text-[10px] uppercase tracking-[0.08em] font-bold text-cyan-100/70 mb-2">Integrated AI workforce</div>
                    <div className="flex gap-1.5 flex-wrap">
                      {useCase.poweredBy?.map((agentName) => (
                        <span key={agentName} className="inline-flex items-center gap-1.5 rounded-md bg-[#071B34]/45 border border-white/10 px-2 py-1.5 text-[11px] font-semibold text-white">
                          {agentName.includes('Safety') ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-200" /> : <Workflow className="w-3.5 h-3.5 text-cyan-200" />}
                          {agentName}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className={`bg-panel rounded-[16px] shadow-sm border border-border-color flex flex-col flex-1 overflow-hidden min-h-0 ${isVoiceInteraction ? 'p-0' : ''}`}>
        {/* Header */}
        {!isVoiceInteraction && <div className="p-[20px_28px] border-b border-border-color flex gap-[14px] items-start shrink-0 bg-gradient-to-r from-[#0B1730] via-[#0F2545] to-[#0A4D68]">
          <div className="flex-1">
            <div className="flex items-center gap-[10px] mb-[8px] flex-wrap">
              <span className="font-mono text-[11px] text-white/70 bg-white/10 border border-white/10 rounded-[6px] py-[2px] px-[8px]">
                UC{String(useCase.id).padStart(2, '0')} · {pillarMeta[useCase.pillar].label}
              </span>
              {useCase.status === 'live' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-400/10 border border-emerald-400/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              )}
            </div>

            <h1 className="font-head text-[24px] m-[0_0_10px] font-extrabold text-white">{useCase.title}</h1>

            <div className="flex gap-[6px] flex-wrap">
              {useCase.tags.map((t) => (
                <span
                  key={t}
                  className={`text-[10px] font-bold tracking-[0.4px] py-[4px] px-[8px] rounded-[5px] uppercase ${tagColors[t]}`}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>}

        {/* Body */}
        <div className={`${isVoiceInteraction ? 'p-0 overflow-hidden' : 'p-[24px_32px] overflow-y-auto custom-scrollbar'} flex flex-col flex-1 min-h-0`}>
          {!isVoiceInteraction && <>
          <div className="text-[14.5px] text-ink leading-[1.6] mb-[18px] max-w-[800px]">{useCase.desc}</div>

          <div className="bg-teal-tint border border-[#BFE7E7] rounded-[10px] p-[16px_20px] text-[13.5px] text-teal-deep mb-[24px] max-w-[800px] flex items-start gap-2">
            <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-teal-deep" />
            <span>
              <b className="text-ink font-bold">Impact:</b> {useCase.impact}
            </span>
          </div>

          {useCase.poweredBy && useCase.poweredBy.length > 0 && (
            <div className="mb-[24px] flex items-center gap-[12px] flex-wrap">
              <span className="text-[11px] font-bold text-muted uppercase tracking-[0.5px]">Powered by AI Workforce</span>
              <div className="flex gap-[8px] flex-wrap">
                {useCase.poweredBy.map((agentName) => (
                  <button
                    key={agentName}
                    onClick={() => {
                      if (agentName === 'Reporting Agent') {
                        navigate('/agents/reporting');
                      } else if (agentName === 'Maintenance Agent') {
                        navigate('/agents/maintenance');
                      } else if (agentName === 'Safety & Quality Agent') {
                        navigate('/agents/safety-quality');
                      } else if (agentName === 'PPE & Behavior Vision Agent') {
                        navigate('/agents/ppe-vision');
                      } else if (agentName === 'Permit-to-Work Agent' || agentName === 'Permit to Work Agent') {
                        navigate('/agents/permit-to-work');
                      } else {
                        navigate('/agents');
                      }
                    }}
                    className="bg-navy-900 hover:bg-teal text-white text-[11px] font-semibold py-[4px] px-[12px] rounded-full transition-all cursor-pointer border-none flex items-center gap-1 shadow-sm active:scale-95"
                  >
                    <span>🤖</span>
                    {agentName}
                  </button>
                ))}
              </div>
            </div>
          )}
          </>}

          <div className={`${isVoiceInteraction || isDailyReporting ? 'flex-1' : 'grid lg:grid-cols-2 gap-[24px] flex-1'}`}>
            {!isVoiceInteraction && (
              <div className={`flex flex-col h-full ${isDailyReporting ? 'max-w-[840px]' : ''}`}>
                {isDailyReporting ? (
                  <div className="border border-dashed border-[#C9D2E6] rounded-[14px] p-[20px_24px] bg-[#FAFBFE] h-full flex flex-col">
                    <div className="flex items-center gap-[8px] mb-[20px]">
                      <Settings2 className="w-[18px] h-[18px] text-navy-700" />
                      <b className="text-[14px] font-head font-bold text-ink">Automated Daily Reporting Configuration</b>
                    </div>

                    <div className="flex flex-col gap-[20px] flex-1">
                      <div className="rounded-[12px] border border-[#C9DCEB] bg-[#F3FAFE] p-3.5 flex items-center gap-3">
                        <button
                          onClick={() => void updateReportingHitl()}
                          disabled={isUpdatingHitl}
                          className={`w-[40px] h-[24px] rounded-full relative transition-colors cursor-pointer border-none disabled:opacity-50 ${reportingHitlEnabled ? 'bg-teal' : 'bg-gray-300'}`}
                          title="Require an approval after PDF generation and before dispatch"
                        >
                          <span className={`absolute top-[2px] w-[20px] h-[20px] bg-white rounded-full transition-all shadow-sm ${reportingHitlEnabled ? 'left-[18px]' : 'left-[2px]'}`} />
                        </button>
                        <div className="flex-1">
                          <div className="text-[13px] font-bold text-ink">Human-in-the-Loop Approval</div>
                          <div className="mt-0.5 text-[11.5px] text-muted">When enabled with the global governance switch, generated PDFs wait for approval before dispatch.</div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${globalHitlEnabled && reportingHitlEnabled ? 'bg-green-tint text-green' : 'bg-amber-tint text-[#9A6400]'}`}>{globalHitlEnabled && reportingHitlEnabled ? 'Effective' : globalHitlEnabled ? 'Enable locally' : 'Global OFF'}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setSettings((s) => ({ ...s, is_enabled: !s.is_enabled }))}
                          className={`w-[40px] h-[24px] rounded-full relative transition-colors cursor-pointer border-none ${
                            settings.is_enabled ? 'bg-green' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`absolute top-[2px] w-[20px] h-[20px] bg-white rounded-full transition-all shadow-sm ${
                              settings.is_enabled ? 'left-[18px]' : 'left-[2px]'
                            }`}
                          />
                        </button>
                        <span className="text-[14px] font-semibold text-ink">Enable Autonomic Reporting</span>
                      </div>

                      <div className="grid grid-cols-2 gap-[16px]">
                        <div>
                          <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-2">
                            Recipient Email
                          </label>
                          <input
                            type="email"
                            value={settings.email}
                            onChange={(e) => setSettings((s) => ({ ...s, email: e.target.value }))}
                            placeholder="team@example.com"
                            className="w-full border border-border-color rounded-[10px] p-[10px_14px] text-[14px] outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/10 shadow-sm transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-2">
                            Schedule Time (Daily)
                          </label>
                          <input
                            type="time"
                            value={settings.schedule_time}
                            onChange={(e) => setSettings((s) => ({ ...s, schedule_time: e.target.value }))}
                            className="w-full border border-border-color rounded-[10px] p-[10px_14px] text-[14px] outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/10 shadow-sm transition-all"
                          />
                        </div>
                      </div>

                      <div className="flex-1 flex flex-col">
                        <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-2">
                          Agent Prompt
                        </label>
                        <textarea
                          value={settings.prompt}
                          onChange={(e) => setSettings((s) => ({ ...s, prompt: e.target.value }))}
                          className="w-full flex-1 border border-border-color rounded-[10px] p-[12px_14px] text-[13px] outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/10 font-mono resize-none shadow-sm min-h-[120px] transition-all"
                        />
                      </div>

                      <div className="flex justify-end items-center gap-3 mt-auto pt-[16px]">
                        <AnimatePresence>
                          {justSaved && (
                            <motion.span
                              initial={{ opacity: 0, x: 8 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0 }}
                              className="text-[12.5px] font-semibold text-emerald-600 flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-4 h-4" /> Saved
                            </motion.span>
                          )}
                        </AnimatePresence>
                        <button
                          onClick={saveSettings}
                          disabled={isSaving}
                          className="bg-navy-900 hover:bg-navy-800 text-white text-[14px] font-bold py-[10px] px-[20px] rounded-[10px] transition-all disabled:opacity-50 shadow-sm cursor-pointer border-none active:scale-95"
                        >
                          {isSaving ? 'Saving...' : 'Save Configuration'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border border-dashed border-[#C9D2E6] rounded-[14px] p-[20px_24px] bg-[#FAFBFE] flex flex-col h-full">
                    <div className="flex items-center gap-[8px] mb-[16px]">
                      <Settings2 className="w-[18px] h-[18px] text-navy-700" />
                      <b className="text-[14px] font-head font-bold text-ink">Admin & usability controls for this use case</b>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
                      <div className="bg-white border border-border-color rounded-[12px] p-[14px_16px] shadow-sm hover:shadow-md transition-shadow">
                        <div className="text-[11px] text-faint uppercase tracking-[0.5px] font-bold mb-[6px]">Enabled for</div>
                        <div className="text-[13.5px] font-semibold text-ink">6 of 6 plants</div>
                      </div>
                      <div className="bg-white border border-border-color rounded-[12px] p-[14px_16px] shadow-sm hover:shadow-md transition-shadow">
                        <div className="text-[11px] text-faint uppercase tracking-[0.5px] font-bold mb-[6px]">Rollout status</div>
                        <div className="text-[13.5px] font-semibold text-ink">
                          {useCase.status === 'live' ? 'Live in production' : 'Pilot — 2 sites'}
                        </div>
                      </div>
                      {cfgRows.map((r, i) => (
                        <div key={i} className="bg-white border border-border-color rounded-[12px] p-[14px_16px] shadow-sm hover:shadow-md transition-shadow">
                          <div className="text-[11px] text-faint uppercase tracking-[0.5px] font-bold mb-[6px]">{r[0]}</div>
                          <div className="text-[13.5px] font-semibold text-ink">{r[1]}</div>
                        </div>
                      ))}
                      <div className="bg-white border border-border-color rounded-[12px] p-[14px_16px] shadow-sm hover:shadow-md transition-shadow">
                        <div className="text-[11px] text-faint uppercase tracking-[0.5px] font-bold mb-[6px]">
                          Human approval required
                        </div>
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
            )}

            {!isDailyReporting && (
              <div className={isVoiceInteraction ? 'flex-1 min-h-0 w-full' : 'h-[500px] lg:h-auto min-h-[400px]'}>
                <VoiceInteraction
                  useCaseName={useCase.title}
                  defaultAgent={
                    useCase.poweredBy?.includes('Safety & Quality Agent')
                      ? 'safety_quality'
                      : useCase.poweredBy?.includes('PPE & Behavior Vision Agent')
                      ? 'ppe_vision'
                      : useCase.poweredBy?.includes('Maintenance Agent')
                      ? 'maintenance'
                      : 'auto'
                  }
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default UseCaseDetailPage;
