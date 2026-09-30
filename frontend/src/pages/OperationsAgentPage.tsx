import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowDown,
    ArrowLeft,
    Check,
    ChevronDown,
    ClipboardCheck,
    ClipboardList,
    Copy,
    Factory,
    FileText,
    FileUp,
    Loader2,
    Maximize2,
    Minimize2,
    Plus,
    Send,
    Share2,
    X,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    operationsAgentService,
    type OperationsCitation,
    type OperationsDocument,
} from '../services/operationsAgent';
import { AgentExecutionIndicator } from '../components/common/AgentExecutionIndicator';
import { AgentTelemetryFooter } from '../components/common/AgentTelemetryFooter';
import { parseMarkdown } from '../utils/markdownParser';
import type { TurnTelemetry, ActiveToolStep } from '../types/telemetry';
import { createEstimatedTelemetry } from '../utils/telemetryHelper';

// ─── Types & constants ────────────────────────────────────────────────────────

type ChatItem = {
    id: string;
    role: 'assistant' | 'user';
    text: string;
    timestamp?: string;
    citations?: OperationsCitation[];
    telemetry?: TurnTelemetry;
};

const QUICK_START = [
    { label: 'Generate Shift Report', icon: ClipboardList, query: 'According to SOP-OPS-001, what information belongs in a shift report?' },
    { label: 'Check Work Order Compliance', icon: ClipboardCheck, query: 'How should I verify work-step compliance according to SOP-OPS-002?' },
    { label: 'Achievement %', icon: FileText, query: 'How should achievement percentage be calculated, and when is it N/A?' },
    { label: 'Shift Handover', icon: FileText, query: 'Which items should be included in a shift handover?' },
];

const SUGGESTED_QUERIES = [
    { label: 'Shift Report', query: QUICK_START[0].query },
    { label: 'Achievement %', query: QUICK_START[2].query },
    { label: 'Downtime', query: 'What does SOP-OPS-001 require when reporting downtime?' },
    { label: 'Shift Handover', query: QUICK_START[3].query },
    { label: 'Work-Step Check', query: QUICK_START[1].query },
    { label: 'Agent Data & Ownership', query: 'What data sources does the Operations Agent use?' },
];

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const newThreadId = () => `operations-${crypto.randomUUID()}`;
const errorDetail = (e: unknown) =>
    (e as { response?: { data?: { detail?: string } } }).response?.data?.detail;

// ─── SOP viewer helpers ───────────────────────────────────────────────────────

type Block = { heading: string; lines: string[] };

const toBlocks = (content: string): Block[] => {
    const blocks: Block[] = [{ heading: '', lines: [] }];
    content.split('\n').forEach((line) => {
        if (/^#{1,6}\s/.test(line)) blocks.push({ heading: line.replace(/^#{1,6}\s+/, ''), lines: [line] });
        else blocks[blocks.length - 1].lines.push(line);
    });
    return blocks.filter((b) => b.heading || b.lines.some((l) => l.trim()));
};

const isCited = (heading: string, citations: OperationsCitation[]) =>
    !!heading &&
    citations.some((c) => {
        const s = String(c.section ?? '').trim().toLowerCase();
        return !!s && heading.toLowerCase().includes(s);
    });

// ─── Message bubble ───────────────────────────────────────────────────────────

const MessageBubble: React.FC<{
    msg: ChatItem;
    copiedId: string | null;
    onCopy: (id: string, text: string) => void;
    onCitation: (c: OperationsCitation, all: OperationsCitation[]) => void;
}> = ({ msg, copiedId, onCopy, onCitation }) => {
    const isUser = msg.role === 'user';
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
        >
            {!isUser && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white shrink-0 shadow-xs mt-1">
                    <Factory className="w-3.5 h-3.5" />
                </div>
            )}

            <div
                className={`group relative max-w-[900px] rounded-[16px] p-3 text-[13.5px] leading-relaxed shadow-2xs transition-shadow hover:shadow-sm ${isUser ? 'bg-navy-900 text-white rounded-tr-[4px]' : 'bg-white text-ink border border-border-color rounded-tl-[4px]'
                    }`}
            >
                <button
                    onClick={() => onCopy(msg.id, msg.text)}
                    title="Copy message"
                    className={`absolute -top-2.5 ${isUser ? '-left-2.5' : '-right-2.5'} opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity w-6 h-6 rounded-full bg-white border border-border-color shadow-sm flex items-center justify-center cursor-pointer hover:bg-canvas`}
                >
                    {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-muted" />}
                </button>

                <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2">
                    <div dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.text) }} />
                </div>

                {!isUser && msg.citations && msg.citations.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border-color/70 flex flex-wrap gap-1.5" aria-label="Sources">
                        {msg.citations.map((c, i) => (
                            <button
                                key={`${c.document_id}-${c.section}-${c.page}-${i}`}
                                onClick={() => onCitation(c, msg.citations ?? [])}
                                title="Open this source in the SOP viewer"
                                className="inline-flex items-center rounded-[6px] bg-teal-tint/70 hover:bg-teal-tint px-2 py-1 text-[10px] font-medium text-teal-deep border-0 cursor-pointer"
                            >
                                Source: {c.document_id}, §{c.section}, Page {c.page ?? 'not numbered'}
                            </button>
                        ))}
                    </div>
                )}

                {!isUser && <AgentTelemetryFooter telemetry={msg.telemetry} rawText={msg.text} />}

                {msg.timestamp && (
                    <div className={`text-[10px] mt-1.5 ${isUser ? 'text-white/50 text-right' : 'text-muted'}`}>{msg.timestamp}</div>
                )}
            </div>

            {isUser && (
                <div className="w-7 h-7 rounded-full bg-navy-800 flex items-center justify-center text-white shrink-0 shadow-xs mt-1">
                    <span className="text-[11px] font-bold">U</span>
                </div>
            )}
        </motion.div>
    );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export const OperationsAgentPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [threadId, setThreadId] = useState(() => searchParams.get('thread') || newThreadId());
    const [messages, setMessages] = useState<ChatItem[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [linkCopied, setLinkCopied] = useState(false);
    const [heroExpanded, setHeroExpanded] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const [activeSteps, setActiveSteps] = useState<ActiveToolStep[]>([]);

    const [sopList, setSopList] = useState<OperationsDocument[]>([]);
    const [loadingDocs, setLoadingDocs] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [selectedSOP, setSelectedSOP] = useState<OperationsDocument | null>(null);
    const [isSOPViewerOpen, setIsSOPViewerOpen] = useState(false);
    const [sopContent, setSopContent] = useState<Record<string, string>>({});
    const [loadingContent, setLoadingContent] = useState(false);
    const [contentError, setContentError] = useState('');
    const [activeCitations, setActiveCitations] = useState<OperationsCitation[]>([]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const firstHighlightRef = useRef<HTMLDivElement>(null);

    const isEmpty = messages.length === 0;

    const scrollToBottom = useCallback((smooth = true) => {
        messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }, []);

    useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

    useEffect(() => {
        let mounted = true;
        operationsAgentService.listDocuments()
            .then((r) => { if (mounted) setSopList(r.documents); })
            .catch(() => { if (mounted) setUploadError('Unable to load the SOP list. Refresh to try again.'); })
            .finally(() => { if (mounted) setLoadingDocs(false); });
        return () => { mounted = false; };
    }, []);

    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = 'auto';
        ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
    }, [input]);

    useEffect(() => {
        if (!isExpanded) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsExpanded(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isExpanded]);

    useEffect(() => {
        if (isSOPViewerOpen && selectedSOP && sopContent[selectedSOP.path]) {
            firstHighlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [isSOPViewerOpen, selectedSOP, sopContent, activeCitations]);

    const handleScroll = () => {
        const el = scrollContainerRef.current;
        if (!el) return;
        setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 250);
    };

    // ── SOP actions ──
    const openSOP = async (doc: OperationsDocument, citations: OperationsCitation[] = []) => {
        setSelectedSOP(doc);
        setIsSOPViewerOpen(true);
        setActiveCitations(citations.filter((c) => c.document_id === doc.document_id));
        setContentError('');
        if (sopContent[doc.path] !== undefined) return;
        setLoadingContent(true);
        try {
            const r = await operationsAgentService.getDocumentContent(doc.path);
            setSopContent((cur) => ({ ...cur, [doc.path]: r.content }));
        } catch (e) {
            setContentError(errorDetail(e) || 'This document could not be loaded.');
        } finally {
            setLoadingContent(false);
        }
    };

    const openCitation = (c: OperationsCitation, all: OperationsCitation[]) => {
        const doc = sopList.find((d) => d.document_id === c.document_id);
        if (doc) void openSOP(doc, all);
    };

    const uploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const el = e.currentTarget;
        const files = Array.from(el.files ?? []);
        if (!files.length) return;
        setUploading(true);
        setUploadError('');
        try {
            for (const f of files) {
                const r = await operationsAgentService.uploadDocument(f);
                setSopList(r.documents);
            }
        } catch (err) {
            setUploadError(errorDetail(err) || 'The document could not be uploaded. Use a PDF, Markdown or text file.');
        } finally {
            setUploading(false);
            el.value = '';
        }
    };

    // ── Chat actions ──
    const handleSend = async (textToSend?: string) => {
        const prompt = (textToSend ?? input).trim();
        if (!prompt || loading) return;

        setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text: prompt, timestamp: now() }]);
        setInput('');
        setLoading(true);

        const start = performance.now();
        setActiveSteps([
            { tool_name: 'search_sop_documents', friendly_label: 'Searching indexed Operations SOPs...', status: 'executing', startTime: Date.now() },
        ]);

        try {
            const res = await operationsAgentService.chat(prompt, threadId);
            const elapsed = (performance.now() - start) / 1000;
            setActiveSteps((prev) => prev.map((s) => ({ ...s, status: 'completed', durationSec: elapsed })));
            setMessages((prev) => [
                ...prev,
                {
                    id: `a-${Date.now()}`,
                    role: 'assistant',
                    text: res.reply,
                    citations: res.citations,
                    timestamp: now(),
                    telemetry: createEstimatedTelemetry(elapsed, [{ name: 'search_sop_documents', status: 'completed' }], prompt, res.reply),
                },
            ]);
            if (res.citations?.length) {
                setActiveCitations(
                    selectedSOP ? res.citations.filter((c) => c.document_id === selectedSOP.document_id) : res.citations,
                );
            }
        } catch (e) {
            setMessages((prev) => [
                ...prev,
                {
                    id: `e-${Date.now()}`,
                    role: 'assistant',
                    text: errorDetail(e) || 'The Operations Agent could not be reached. Make sure the backend is running, then try again.',
                    timestamp: now(),
                },
            ]);
        } finally {
            setLoading(false);
            setActiveSteps([]);
        }
    };

    const handleCopy = (id: string, text: string) => {
        void navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleNewChat = () => {
        setThreadId(newThreadId());
        setMessages([]);
        setInput('');
        setActiveSteps([]);
        setActiveCitations([]);
        setSearchParams({}, { replace: true });
    };

    const handleShare = async () => {
        const url = new URL(window.location.href);
        url.searchParams.set('thread', threadId);
        try {
            await navigator.clipboard.writeText(url.toString());
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        } catch { /* clipboard blocked */ }
    };

    const viewerBlocks = useMemo(() => {
        const c = selectedSOP ? sopContent[selectedSOP.path] : undefined;
        return c ? toBlocks(c) : [];
    }, [selectedSOP, sopContent]);

    const viewerCitations = useMemo(
        () => activeCitations.filter((c) => c.document_id === selectedSOP?.document_id),
        [activeCitations, selectedSOP],
    );
    const firstHighlightIdx = viewerBlocks.findIndex((b) => isCited(b.heading, viewerCitations));

    const heroBtn =
        'flex items-center gap-1.5 text-[11.5px] font-semibold text-white/85 hover:text-white bg-white/10 hover:bg-white/15 border border-white/10 px-2.5 py-1.5 rounded-[10px] transition-colors cursor-pointer';

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={
                isExpanded
                    ? 'fixed inset-0 z-50 bg-canvas flex flex-col gap-1 w-full overflow-hidden'
                    : 'h-[calc(100vh-22px)] flex flex-col gap-1 w-full px-0 overflow-hidden'
            }
        >
            {/* ── Top bar ── */}
            {!isExpanded && (
                <div className="flex items-center justify-between pt-2 shrink-0 px-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center pt-2 gap-2 text-[13px] font-semibold text-muted hover:text-teal transition-colors bg-transparent border-none cursor-pointer p-0"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                </div>
            )}

            {/* ── Hero banner ── */}
            <div className="bg-gradient-to-r from-[#0B1730] via-[#0D2040] to-[#00808A] text-white rounded-[16px] shadow-sm shrink-0 border border-navy-700/50 overflow-hidden mx-3 mt-1">
                <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-teal-500/20 border border-teal-400/40 flex items-center justify-center shrink-0">
                            <Factory className="w-3.5 h-3.5 text-teal-300" />
                        </div>
                        <h1 className="font-head text-[16px] font-extrabold m-0 text-white truncate">Operations Agent</h1>
                        <span className="hidden sm:inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-300 bg-emerald-400/10 border border-emerald-400/30 px-2 py-0.5 rounded-full ml-1 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Live
                        </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.md,.txt,application/pdf,text/markdown,text/plain"
                            multiple
                            onChange={(e) => void uploadFiles(e)}
                            className="hidden"
                        />
                        <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className={`${heroBtn} disabled:opacity-60`} title="Upload an SOP">
                            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
                            <span className="hidden sm:inline">{uploading ? 'Indexing...' : 'Upload SOP'}</span>
                        </button>

                        <button onClick={handleNewChat} className={heroBtn} title="Start a new chat">
                            <Plus className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">New Chat</span>
                        </button>

                        <button
                            onClick={() => setHeroExpanded((v) => !v)}
                            className={heroBtn}
                            title={heroExpanded ? 'Hide details' : 'Show details'}
                            aria-expanded={heroExpanded}
                        >
                            <motion.span animate={{ rotate: heroExpanded ? 180 : 0 }} transition={{ duration: 0.2 }} className="flex items-center">
                                <ChevronDown className="w-3.5 h-3.5" />
                            </motion.span>
                        </button>
                    </div>
                </div>

                <AnimatePresence initial={false}>
                    {heroExpanded && (
                        <motion.div
                            key="hero-detail"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: 'easeInOut' }}
                            className="overflow-hidden"
                        >
                            <div className="px-4 pb-4 pt-1 border-t border-white/10">
                                <p className="text-white/80 text-[13px] max-w-[840px] mt-2 mb-0 leading-relaxed">
                                    Answers questions from the indexed Operations SOPs: shift reporting, production metric definitions, handovers and work-step verification. It does not query live MES data.
                                </p>
                               

                                {/* ── SOP list ── */}
                                <section aria-label="Operations SOPs" className="mt-3 px-3 py-2 bg-white/10 border border-white/10 rounded-[12px]">
                                    <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar">
                                        <span>
                                            {loadingDocs ? 'Loading SOPs...' : `SOPs (${sopList.length})`}
                                        </span>
                                        {!loadingDocs && sopList.length === 0 && (
                                            <span className="text-[11px] text-white/70">No SOPs indexed yet. Upload a PDF, Markdown or text file.</span>
                                        )}
                                        {sopList.map((doc) => {
                                            const active = isSOPViewerOpen && selectedSOP?.path === doc.path;
                                            return (
                                                <button
                                                    key={doc.path}
                                                    onClick={() => void openSOP(doc)}
                                                    title={`View ${doc.name}`}
                                                    className={`bg-white/10 rounded-[12px] px-3 py-2 border border-white/10 text-center ${active
                                                            ? 'border-teal-300 bg-teal-400/20 text-white'
                                                            : 'border-white/15 bg-white/5 text-white/85 hover:bg-white/15'
                                                        }`}
                                                >
                                                    <FileText className="w-3 h-3 text-teal-300 shrink-0" />
                                                    <span className="font-semibold truncate">{doc.document_id}</span>
                                                    <span className="text-white/60"> {doc.type}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {uploadError && <p role="alert" className="m-0 mt-1.5 text-[11px] text-red-300">{uploadError}</p>}
                                </section>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>



            {/* ── Workspace: chat + SOP viewer ── */}
            <div className="flex-1 flex overflow-hidden min-h-0 md:mx-2 relative">
                <div className="flex-1 min-w-0 grid grid-rows-[1fr_auto] min-h-0 relative">
                    {/* Messages */}
                    <div
                        ref={scrollContainerRef}
                        onScroll={handleScroll}
                        className="overflow-y-auto overflow-x-hidden p-3 md:p-4 space-y-3 custom-scrollbar min-h-0"
                    >
                        {isEmpty && !loading ? (
                            <div className="h-full flex items-center justify-center">
                                <div className="w-full max-w-[640px] bg-white border border-border-color rounded-[16px] p-5">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-9 h-9 rounded-[10px] bg-teal-tint text-teal-deep flex items-center justify-center shrink-0">
                                            <Factory className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h2 className="m-0 text-[15px] font-bold text-ink">Ask about your Operations SOPs</h2>
                                            <p className="m-0 text-[12px] text-muted">Answers cite the SOP section they came from. Live MES data is not connected.</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {QUICK_START.map(({ label, icon: Icon, query }) => (
                                            <button
                                                key={label}
                                                onClick={() => void handleSend(query)}
                                                className="flex items-center gap-2 text-left rounded-[10px] border border-border-color bg-canvas hover:border-teal-300 hover:bg-teal-50 px-3 py-2.5 text-[12.5px] font-semibold text-ink cursor-pointer transition-colors active:scale-95"
                                            >
                                                <Icon className="w-4 h-4 text-teal shrink-0" />
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <AnimatePresence initial={false}>
                                {messages.map((m) => (
                                    <MessageBubble key={m.id} msg={m} copiedId={copiedId} onCopy={handleCopy} onCitation={openCitation} />
                                ))}
                            </AnimatePresence>
                        )}

                        <div className="pl-10">
                            <AgentExecutionIndicator activeSteps={activeSteps} isStreaming={loading} agentName="Operations Agent" />
                        </div>
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Jump to latest */}
                    <AnimatePresence>
                        {showScrollBtn && (
                            <motion.button
                                initial={{ opacity: 0, y: 8, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 8, scale: 0.9 }}
                                onClick={() => scrollToBottom()}
                                className="absolute bottom-24 right-4 z-10 flex items-center gap-1.5 bg-navy-900 text-white text-[11.5px] font-semibold px-3 py-1.5 rounded-full shadow-lg hover:bg-navy-800 transition-colors cursor-pointer border-none"
                            >
                                <ArrowDown className="w-3.5 h-3.5" /> Latest
                            </motion.button>
                        )}
                    </AnimatePresence>

                    {/* Quick ask + input */}
                    <div className="border-t border-border-color bg-white p-2.5 md:p-3 space-y-2 shrink-0">
                        {!isEmpty && (
                            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar text-[12px]">
                                <span className="text-[10.5px] font-bold text-muted uppercase tracking-wider shrink-0">Quick Ask:</span>
                                {SUGGESTED_QUERIES.map((sq) => (
                                    <button
                                        key={sq.label}
                                        onClick={() => void handleSend(sq.query)}
                                        disabled={loading}
                                        className="shrink-0 bg-canvas hover:bg-teal-50 text-ink hover:text-teal-900 border border-border-color hover:border-teal-300 px-3 py-1.5 rounded-full transition-all text-[11.5px] font-medium cursor-pointer disabled:opacity-50 active:scale-95"
                                    >
                                        {sq.label}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="flex gap-2 items-end">
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        void handleSend();
                                    }
                                }}
                                rows={1}
                                placeholder="Ask about shift reports, handovers, downtime, or work-step checks..."
                                className="flex-1 resize-none rounded-[12px] border border-border-color bg-canvas px-3.5 py-2 text-[13.5px] outline-none focus:border-teal-deep focus:ring-2 focus:ring-teal-500/20 transition-all placeholder:text-muted max-h-[140px]"
                            />
                            <button
                                onClick={() => void handleSend()}
                                disabled={loading || !input.trim()}
                                className="inline-flex items-center gap-2 rounded-[12px] bg-gradient-to-r from-navy-900 to-navy-800 hover:from-navy-800 hover:to-navy-700 px-4 py-2.5 text-white font-semibold text-[13.5px] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer border-none active:scale-95"
                            >
                                <Send className="w-4 h-4" /> Send
                            </button>
                        </div>
                    </div>
                </div>

                {/* SOP viewer drawer */}
                <AnimatePresence>
                    {isSOPViewerOpen && selectedSOP && (
                        <motion.aside
                            key="sop-viewer"
                            aria-label={`SOP viewer: ${selectedSOP.name}`}
                            initial={{ x: 40, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 40, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="absolute inset-y-0 right-0 z-20 w-full md:static md:w-[420px] md:shrink-0 flex flex-col bg-white border-l border-border-color md:border md:rounded-[12px] md:ml-2 min-h-0"
                        >
                            <div className="flex items-start justify-between gap-2 p-3 border-b border-border-color shrink-0">
                                <div className="min-w-0">
                                    <h2 className="m-0 text-[13px] font-bold text-ink truncate">{selectedSOP.document_id}</h2>
                                    <p className="m-0 text-[10.5px] text-muted truncate">{selectedSOP.name}</p>
                                    {viewerCitations.length > 0 && (
                                        <p className="m-0 mt-1 text-[10.5px] text-teal-deep">
                                            Highlighted: sections cited in the latest answer
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={() => setIsSOPViewerOpen(false)}
                                    aria-label="Close SOP viewer"
                                    className="p-1 rounded-[6px] text-muted hover:text-ink hover:bg-canvas border-0 bg-transparent cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 min-h-0">
                                {loadingContent && (
                                    <div className="flex items-center gap-2 text-muted text-[12px]" role="status">
                                        <Loader2 className="w-4 h-4 animate-spin text-teal" /> Loading document...
                                    </div>
                                )}
                                {contentError && <p role="alert" className="m-0 text-[12px] text-red-700">{contentError}</p>}
                                {!loadingContent && !contentError && viewerBlocks.length === 0 && (
                                    <p className="m-0 text-[12px] text-muted">This document has no readable text.</p>
                                )}
                                {viewerBlocks.map((b, i) => {
                                    const hit = isCited(b.heading, viewerCitations);
                                    return (
                                        <div
                                            key={`${b.heading}-${i}`}
                                            ref={i === firstHighlightIdx ? firstHighlightRef : undefined}
                                            className={`mb-1 rounded-[6px] px-2 py-1 ${hit ? 'bg-amber-100 border-l-4 border-amber-400' : ''}`}
                                        >
                                            <pre className="m-0 whitespace-pre-wrap break-words font-sans text-[12px] leading-relaxed text-ink">
                                                {b.lines.join('\n')}
                                            </pre>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.aside>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

export default OperationsAgentPage;