import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Settings2,
  Sparkles,
  CheckCircle2,
  AudioLines,
  ChevronDown,
  Workflow,
  ShieldCheck,
} from 'lucide-react';
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

  const [settings, setSettings] = useState({
    is_enabled: false,
    email: '',
    schedule_time: '08:00',
    prompt: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
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
          if (!data.error) setSettings(data);
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
        <button
          onClick={() => navigate('/use-cases')}
          className="text-navy-600 hover:underline"
        >
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
      className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-4 flex flex-col min-h-0 h-[calc(100vh-72px)]"
    >
      {/* Back Nav */}
      <div className="mb-4 shrink-0">
        <button
          onClick={() => navigate('/use-cases')}
          className="flex items-center gap-1.5 text-muted hover:text-navy-800 transition-colors text-[13px] font-semibold bg-transparent border-none cursor-pointer p-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Use-Case Library
        </button>
      </div>

      {/* Voice Banner */}
      {isVoiceInteraction && (
        <div className="bg-gradient-to-r from-[#0B1730] via-[#12365A] to-[#0A627B] text-white rounded-2xl shadow-sm shrink-0 border border-[#185F78] overflow-hidden mb-4">
          <div className="flex items-center justify-between gap-4 px-5 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-cyan-300/15 border border-cyan-200/30 flex items-center justify-center shrink-0">
                <AudioLines className="w-[18px] h-[18px] text-cyan-200" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-head text-[17px] font-extrabold m-0 text-white truncate">
                    Voice Interaction Layer
                  </h1>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-200 bg-emerald-400/10 border border-emerald-300/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                    Live
                  </span>
                </div>
                <p className="m-0 mt-0.5 text-[11.5px] text-white/70 truncate">
                  Hands-free access to connected manufacturing intelligence.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden md:flex items-center gap-1.5">
                {useCase.poweredBy?.map((agentName) => (
                  <span
                    key={agentName}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 border border-white/15 px-2 py-1 text-[10.5px] font-semibold text-white/90"
                  >
                    {agentName.includes('Safety') ? (
                      <ShieldCheck className="w-3 h-3 text-emerald-200" />
                    ) : (
                      <Workflow className="w-3 h-3 text-cyan-200" />
                    )}
                    {agentName}
                  </span>
                ))}
              </div>
              <button
                onClick={() => setVoiceBannerExpanded((v) => !v)}
                className="flex items-center gap-1.5 text-[11.5px] font-semibold text-white/90 hover:text-white bg-white/10 hover:bg-white/15 border border-white/15 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <motion.span
                  animate={{ rotate: voiceBannerExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center"
                >
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
                <div className="border-t border-white/10 px-5 py-4 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                  <div>
                    <p className="m-0 max-w-3xl text-[13px] leading-relaxed text-white/80">
                      {useCase.desc}
                    </p>
                    <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                      {useCase.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-cyan-100/10 border border-cyan-100/15 px-2 py-1 text-[10px] font-bold tracking-wide text-cyan-100"
                        >
                          {tag}
                        </span>
                      ))}
                      <span className="rounded-md bg-white/10 border border-white/10 px-2 py-1 text-[10px] font-semibold text-white/75">
                        Voice input
                      </span>
                      <span className="rounded-md bg-white/10 border border-white/10 px-2 py-1 text-[10px] font-semibold text-white/75">
                        English & Hindi
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/10 border border-white/15 px-3.5 py-3 min-w-[260px]">
                    <div className="text-[10px] uppercase tracking-[0.08em] font-bold text-cyan-100/70 mb-2">
                      Integrated AI workforce
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {useCase.poweredBy?.map((agentName) => (
                        <span
                          key={agentName}
                          className="inline-flex items-center gap-1.5 rounded-md bg-[#071B34]/45 border border-white/10 px-2 py-1.5 text-[11px] font-semibold text-white"
                        >
                          {agentName.includes('Safety') ? (
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-200" />
                          ) : (
                            <Workflow className="w-3.5 h-3.5 text-cyan-200" />
                          )}
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

      {/* Main Content Panel */}
      <div className="bg-panel rounded-2xl shadow-sm border border-border-color flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Header (non-voice) */}
        {!isVoiceInteraction && (
          <div className="px-6 py-5 border-b border-border-color shrink-0 bg-gradient-to-r from-[#0B1730] via-[#0F2545] to-[#0A4D68]">
            <div className="flex items-center gap-2.5 mb-2 flex-wrap">
              <span className="font-mono text-[11px] text-white/70 bg-white/10 border border-white/10 rounded-md py-0.5 px-2">
                UC{String(useCase.id).padStart(2, '0')} · {pillarMeta[useCase.pillar].label}
              </span>
              {useCase.status === 'live' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-400/10 border border-emerald-400/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              )}
            </div>

            <h1 className="font-head text-[22px] m-0 mb-2.5 font-extrabold text-white">
              {useCase.title}
            </h1>

            <div className="flex gap-1.5 flex-wrap">
              {useCase.tags.map((t) => (
                <span
                  key={t}
                  className={`text-[10px] font-bold tracking-[0.4px] py-1 px-2 rounded-md uppercase ${tagColors[t]}`}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Body */}
        <div
          className={`flex-1 min-h-0 flex flex-col ${
            isVoiceInteraction
              ? 'overflow-hidden p-0'
              : 'overflow-y-auto custom-scrollbar p-6 md:p-8'
          }`}
        >
          {/* Description + Impact + Powered By (non-voice) */}
          {!isVoiceInteraction && (
            <>
           

              {useCase.poweredBy && useCase.poweredBy.length > 0 && (
                <div className="mb-6 flex items-center gap-3 flex-wrap">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-[0.5px]">
                    Powered by AI Workforce
                  </span>
                  <div className="flex gap-2 flex-wrap">
                    {useCase.poweredBy.map((agentName) => (
                      <button
                        key={agentName}
                        onClick={() => {
                          if (agentName === 'Reporting Agent') navigate('/agents/reporting');
                          else if (agentName === 'Maintenance Agent') navigate('/agents/maintenance');
                          else if (agentName === 'Safety & Quality Agent') navigate('/agents/safety-quality');
                          else if (agentName === 'PPE & Behavior Vision Agent') navigate('/agents/ppe-vision');
                          else if (
                            agentName === 'Permit-to-Work Agent' ||
                            agentName === 'Permit to Work Agent'
                          )
                            navigate('/agents/permit-to-work');
                          else navigate('/agents');
                        }}
                        className="bg-navy-900 hover:bg-teal text-white text-[11px] font-semibold py-1 px-3 rounded-full transition-all cursor-pointer border-none flex items-center gap-1.5 shadow-sm active:scale-95"
                      >
                        <span>🤖</span>
                        {agentName}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Main content area */}
          <div
            className={`flex-1 min-h-0 ${
              isVoiceInteraction
                ? 'flex flex-col'
                : isDailyReporting
                ? ''
                : 'grid lg:grid-cols-2 gap-6'
            }`}
          >
            {/* ── Daily Reporting (Screenshot layout) ── */}
            {!isVoiceInteraction && isDailyReporting && (
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-5">
                {/* LEFT: Configuration */}
                <div className="border border-dashed border-[#C9D2E6] rounded-2xl p-5 md:p-6 bg-[#FAFBFE] flex flex-col">
                  <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Settings2 className="w-[18px] h-[18px] text-navy-700" />
                      <b className="text-[14px] font-head font-bold text-ink">
                        Automated Daily Reporting Configuration
                      </b>
                    </div>

                    {/* Enable Autonomic Reporting */}
                    <div className="flex items-center gap-2.5">
                      <span className="text-[13px] font-semibold text-ink">
                        Enable Autonomic Reporting
                      </span>
                      <button
                        onClick={() =>
                          setSettings((s) => ({ ...s, is_enabled: !s.is_enabled }))
                        }
                        className={`w-10 h-6 rounded-full relative transition-colors cursor-pointer border-none ${
                          settings.is_enabled ? 'bg-green' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${
                            settings.is_enabled ? 'left-[18px]' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-5 flex-1">
                    {/* HITL Toggle */}
                    <div className="rounded-xl border border-[#C9DCEB] bg-[#F3FAFE] p-3.5 flex items-center gap-3">
                      <button
                        onClick={() => void updateReportingHitl()}
                        disabled={isUpdatingHitl}
                        className={`w-10 h-6 rounded-full relative transition-colors cursor-pointer border-none disabled:opacity-50 shrink-0 ${
                          reportingHitlEnabled ? 'bg-teal' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${
                            reportingHitlEnabled ? 'left-[18px]' : 'left-0.5'
                          }`}
                        />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-ink">
                          Human-in-the-Loop Approval
                        </div>
                        <div className="mt-0.5 text-[11.5px] text-muted">
                          When enabled with the global governance switch, generated PDFs wait
                          for approval before dispatch.
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${
                          globalHitlEnabled && reportingHitlEnabled
                            ? 'bg-green-tint text-green'
                            : 'bg-amber-tint text-[#9A6400]'
                        }`}
                      >
                        {globalHitlEnabled && reportingHitlEnabled
                          ? 'Effective'
                          : globalHitlEnabled
                          ? 'Enable locally'
                          : 'Global OFF'}
                      </span>
                    </div>

                    {/* Agent Prompt */}
                    <div className="flex-1 flex flex-col">
                      <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-2">
                        Agent Prompt
                      </label>
                      <textarea
                        value={settings.prompt}
                        onChange={(e) =>
                          setSettings((s) => ({ ...s, prompt: e.target.value }))
                        }
                        className="w-full flex-1 min-h-[220px] border border-border-color rounded-xl p-3.5 text-[13px] outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/10 font-mono resize-y shadow-sm transition-all bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* RIGHT: Quick Actions */}
                <div className="border border-dashed border-[#C9D2E6] rounded-2xl p-5 bg-[#FAFBFE] flex flex-col h-fit">
                  <div className="text-[12px] font-bold text-ink uppercase tracking-wider mb-4">
                    Quick Actions & Controls
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">
                        Recipient Email
                      </label>
                      <input
                        type="email"
                        value={settings.email}
                        onChange={(e) =>
                          setSettings((s) => ({ ...s, email: e.target.value }))
                        }
                        placeholder="team@example.com"
                        className="w-full border border-border-color rounded-xl p-2.5 px-3.5 text-[13.5px] outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/10 shadow-sm transition-all bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">
                        Schedule Time (Daily)
                      </label>
                      <input
                        type="time"
                        value={settings.schedule_time}
                        onChange={(e) =>
                          setSettings((s) => ({ ...s, schedule_time: e.target.value }))
                        }
                        className="w-full border border-border-color rounded-xl p-2.5 px-3.5 text-[13.5px] outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/10 shadow-sm transition-all bg-white"
                      />
                    </div>

                    <div className="pt-2">
                      <AnimatePresence>
                        {justSaved && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="mb-2.5 text-[12.5px] font-semibold text-emerald-600 flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Saved successfully
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <button
                        onClick={saveSettings}
                        disabled={isSaving}
                        className="w-full bg-navy-900 hover:bg-navy-800 text-white text-[13.5px] font-bold py-2.5 px-4 rounded-xl transition-all disabled:opacity-50 shadow-sm cursor-pointer border-none active:scale-[0.98]"
                      >
                        {isSaving ? 'Saving...' : 'Save Configuration'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Generic Admin Controls (other use cases) */}
            {!isVoiceInteraction && !isDailyReporting && (
              <div className="flex flex-col">
                <div className="border border-dashed border-[#C9D2E6] rounded-2xl p-5 md:p-6 bg-[#FAFBFE] flex flex-col">
                  <div className="flex items-center gap-2 mb-4">
                    <Settings2 className="w-[18px] h-[18px] text-navy-700" />
                    <b className="text-[14px] font-head font-bold text-ink">
                      Admin & usability controls for this use case
                    </b>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-white border border-border-color rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="text-[11px] text-faint uppercase tracking-[0.5px] font-bold mb-1.5">
                        Enabled for
                      </div>
                      <div className="text-[13.5px] font-semibold text-ink">6 of 6 plants</div>
                    </div>
                    <div className="bg-white border border-border-color rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="text-[11px] text-faint uppercase tracking-[0.5px] font-bold mb-1.5">
                        Rollout status
                      </div>
                      <div className="text-[13.5px] font-semibold text-ink">
                        {useCase.status === 'live' ? 'Live in production' : 'Pilot — 2 sites'}
                      </div>
                    </div>
                    {cfgRows.map((r, i) => (
                      <div
                        key={i}
                        className="bg-white border border-border-color rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="text-[11px] text-faint uppercase tracking-[0.5px] font-bold mb-1.5">
                          {r[0]}
                        </div>
                        <div className="text-[13.5px] font-semibold text-ink">{r[1]}</div>
                      </div>
                    ))}
                    <div className="bg-white border border-border-color rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="text-[11px] text-faint uppercase tracking-[0.5px] font-bold mb-1.5">
                        Human approval required
                      </div>
                      <div className="text-[13.5px] font-semibold text-ink flex items-center gap-2">
                        <span className="w-8 h-[18px] rounded-full bg-green relative shrink-0">
                          <span className="absolute w-3.5 h-3.5 bg-white rounded-full top-0.5 right-0.5 shadow-sm" />
                        </span>
                        {useCase.tags.includes('AGENTIC')
                          ? 'Yes, for high-risk actions'
                          : 'No — advisory only'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Voice Interaction */}
            {!isDailyReporting && (
              <div
                className={
                  isVoiceInteraction
                    ? 'flex-1 min-h-0 w-full'
                    : 'min-h-[400px] h-[480px] lg:h-auto'
                }
              >
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