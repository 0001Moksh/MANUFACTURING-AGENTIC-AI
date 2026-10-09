import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';

type VoiceLanguage = 'auto' | 'hi-IN' | 'en-IN' | 'en-US';
type TranscriptResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<TranscriptResult> };
type RecognitionErrorEvent = { error: string };
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  webkitAudioContext?: typeof AudioContext;
}
interface VoiceMessage {
  id: string;
  role: 'You' | 'Deva';
  text: string;
  time: string;
}

const LANGUAGE_OPTIONS: { value: VoiceLanguage; label: string; hint: string; instruction: string; sample: string }[] = [
  {
    value: 'auto',
    label: 'Auto / Hinglish',
    hint: 'Deva replies in the language you speak.',
    instruction: 'Reply in the same language and script the user used in their message.',
    sample: 'Namaste, main Deva hoon. Aap mujhse kuch bhi pooch sakte hain.',
  },
  {
    value: 'hi-IN',
    label: 'Hindi',
    hint: 'Deva always replies in Hindi (Devanagari).',
    instruction: 'Reply ONLY in Hindi, written in Devanagari script. Do not use English sentences.',
    sample: 'नमस्ते, मैं देवा हूँ। आप मुझसे कुछ भी पूछ सकते हैं।',
  },
  {
    value: 'en-IN',
    label: 'Hinglish',
    hint: 'Deva replies in Hindi + English mix, Roman letters.',
    instruction:
      'Reply ONLY in Hinglish: Hindi mixed with English, written in Roman (English) letters. Never use Devanagari script.',
    sample: 'Namaste, main Deva hoon. Aap kaise hain? Bataiye main kya help kar sakta hoon.',
  },
  {
    value: 'en-US',
    label: 'English',
    hint: 'Deva always replies in English.',
    instruction: 'Reply ONLY in English, even if the user speaks Hindi or Hinglish. Do not use Hindi words or Devanagari script.',
    sample: 'Hello, I am Deva. This is how I sound at the current speed and volume.',
  },
];

const MAX_LATENCY_POINTS = 12;
const BAR_COUNT = 9;
const DEVANAGARI = /[\u0900-\u097f]/;

const newThreadId = () =>
  globalThis.crypto?.randomUUID?.() ?? `voice-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const clock = () =>
  new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Autocorrelation pitch detector. Returns Hz, or null when there is no clear voiced sound. */
const detectPitch = (buf: Float32Array, sampleRate: number): number | null => {
  const size = buf.length;
  let sumSq = 0;
  for (let i = 0; i < size; i += 1) sumSq += buf[i] * buf[i];
  if (Math.sqrt(sumSq / size) < 0.015) return null;

  const minLag = Math.floor(sampleRate / 450);
  const maxLag = Math.min(Math.floor(sampleRate / 70), Math.floor(size / 2));
  const win = size - maxLag;
  const corrs = new Float32Array(maxLag + 2);
  let bestCorr = 0;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let dot = 0;
    let e1 = 0;
    let e2 = 0;
    for (let i = 0; i < win; i += 2) {
      const a = buf[i];
      const b = buf[i + lag];
      dot += a * b;
      e1 += a * a;
      e2 += b * b;
    }
    const corr = dot / Math.sqrt(e1 * e2 + 1e-9);
    corrs[lag] = corr;
    if (corr > bestCorr) bestCorr = corr;
  }
  if (bestCorr < 0.55) return null;
  // Take the first strong peak so we do not lock onto an octave below the real pitch.
  for (let lag = minLag + 1; lag < maxLag; lag += 1) {
    if (corrs[lag] > bestCorr * 0.9 && corrs[lag] >= corrs[lag - 1] && corrs[lag] >= corrs[lag + 1]) {
      return sampleRate / lag;
    }
  }
  return null;
};

const pickVoice = (lang: string): SpeechSynthesisVoice | null => {
  const voices = window.speechSynthesis.getVoices();
  const wanted = lang.toLowerCase();
  const exact = voices.filter((v) => v.lang.toLowerCase().replace('_', '-') === wanted);
  const loose = voices.filter((v) => v.lang.toLowerCase().startsWith(wanted.slice(0, 2)));
  const pool = exact.length ? exact : loose;
  // Remote "Google" voices in Chrome ignore rate, so prefer on-device voices when one exists.
  return pool.find((v) => v.localService) ?? pool[0] ?? null;
};

/* ---------- small presentational pieces ---------- */

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{children}</div>
);

const Stat: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col items-center justify-center gap-1.5 px-2 py-3">
    <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</span>
    <div className="flex h-5 items-center font-mono text-sm font-bold text-slate-800">{children}</div>
  </div>
);

const Sparkline: React.FC<{ points: number[] }> = ({ points }) => {
  const width = 240;
  const height = 56;
  if (points.length < 2) {
    return (
      <div className="flex h-14 items-center justify-center font-mono text-[10px] text-slate-300">
        Waiting for replies…
      </div>
    );
  }
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = Math.max(max - min, 1);
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * (width - 12) + 6;
    const y = height - 8 - ((p - min) / span) * (height - 16);
    return [x, y] as const;
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-14 w-full" preserveAspectRatio="none" aria-hidden>
      <polyline
        points={coords.map(([x, y]) => `${x},${y}`).join(' ')}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {coords.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.2" fill="#fff" stroke="#3b82f6" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
};

/* ---------- main component ---------- */

export const VoiceAgentConsole: React.FC = () => {
  const [language, setLanguage] = useState<VoiceLanguage>('auto');
  const [rate, setRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [bargeIn, setBargeIn] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState('Microphone stopped.');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [latencies, setLatencies] = useState<number[]>([]);

  // Latest settings live in refs so callbacks created earlier (e.g. the running
  // speech recognizer) never use stale language / speed / volume values.
  const languageRef = useRef<VoiceLanguage>('auto');
  const rateRef = useRef(1);
  const volumeRef = useRef(1);
  const bargeInRef = useRef(true);
  const vizStateRef = useRef({ listening: false, speaking: false, sending: false });

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const startRecognitionRef = useRef<() => void>(() => undefined);
  const listeningRef = useRef(false);
  const speakingRef = useRef(false);
  const interruptedRef = useRef(false);
  const transcriptRef = useRef('');
  const submitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const threadIdRef = useRef(newThreadId());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isSendingRef = useRef(false);

  // audio analysis
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    languageRef.current = language;
    // Restart the recognizer so it picks up the new recognition language right away.
    if (listeningRef.current) recognitionRef.current?.stop();
  }, [language]);
  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);
  useEffect(() => {
    bargeInRef.current = bargeIn;
  }, [bargeIn]);
  useEffect(() => {
    vizStateRef.current = { listening: isListening, speaking: isSpeaking, sending: isSending };
  }, [isListening, isSpeaking, isSending]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isSending]);

  // Prime the browser's voice list (it loads asynchronously).
  useEffect(() => {
    window.speechSynthesis?.getVoices();
  }, []);

  /* ----- microphone level / pitch analysis ----- */

  const stopMeter = useCallback(() => {
    analyserRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
  }, []);

  const startMeter = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!listeningRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const Ctx = window.AudioContext ?? (window as SpeechRecognitionWindow).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      void ctx.resume();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.6;
      ctx.createMediaStreamSource(stream).connect(analyser);
      streamRef.current = stream;
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
    } catch {
      // The visualizer is optional; speech recognition still works without it.
    }
  }, []);

  /* ----- speech output ----- */

  const speak = useCallback((text: string, lang: VoiceLanguage, queue = false) => {
    if (!window.speechSynthesis || !text) return;
    if (!queue) window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    // Devanagari text needs a Hindi voice no matter which language is selected.
    const spokenLang = DEVANAGARI.test(text) ? 'hi-IN' : lang === 'auto' ? 'en-IN' : lang;
    utterance.lang = spokenLang;
    utterance.rate = rateRef.current;
    utterance.volume = volumeRef.current;
    utterance.voice = pickVoice(spokenLang);
    utterance.onstart = () => {
      speakingRef.current = true;
      setIsSpeaking(true);
      setStatus('Speaking — interrupt me any time.');
    };
    utterance.onend = () => {
      speakingRef.current = false;
      setIsSpeaking(false);
      setStatus(listeningRef.current ? 'Listening...' : 'Microphone stopped.');
    };
    utterance.onerror = () => {
      speakingRef.current = false;
      setIsSpeaking(false);
      if (listeningRef.current) setStatus('Listening...');
    };
    window.speechSynthesis.speak(utterance);
  }, []);

  const previewVoice = () => {
    const option = LANGUAGE_OPTIONS.find((o) => o.value === languageRef.current) ?? LANGUAGE_OPTIONS[0];
    speak(option.sample, languageRef.current);
  };

  /* ----- chat ----- */

  const sendMessage = useCallback(
    async (messageText: string) => {
      const query = messageText.trim();
      if (!query || isSendingRef.current) return;

      const selected = languageRef.current;
      const option = LANGUAGE_OPTIONS.find((o) => o.value === selected) ?? LANGUAGE_OPTIONS[0];
      const wasInterrupted = interruptedRef.current;
      interruptedRef.current = false;
      transcriptRef.current = '';
      setInput('');
      setMessages((current) => [...current, { id: `user-${Date.now()}`, role: 'You', text: query, time: clock() }]);
      isSendingRef.current = true;
      setIsSending(true);
      setStatus('Thinking...');

      if (wasInterrupted) {
        const acknowledgement =
          selected === 'hi-IN' || (selected === 'auto' && DEVANAGARI.test(query))
            ? 'हम्म, हाँ, मैं समझ रहा हूँ। आपकी बात को पहले वाले सवाल के साथ देखता हूँ।'
            : selected === 'en-US'
              ? 'Hmm, yes, I understand. I will include that with your earlier question.'
              : 'Hmm, haan, main samajh raha hoon. Aapki baat ko pehle wale sawaal ke saath dekhta hoon.';
        speak(acknowledgement, selected);
      }

      const body = wasInterrupted
        ? `The user interrupted your previous spoken answer to add this follow-up: ${query}\nPlease answer the follow-up in the context of the preceding conversation.`
        : query;

      const startedAt = performance.now();
      try {
        const response = await api.post<{ reply: string }>('/voice-agent/chat', {
          // The instruction is placed inside the message so the reply language follows the
          // dropdown even if the backend ignores the extra `language` fields below.
          message: `[Response language: ${option.instruction}]\n\n${body}`,
          language: selected,
          language_instruction: option.instruction,
          thread_id: threadIdRef.current,
        });
        const elapsed = Math.round(performance.now() - startedAt);
        setLatencies((current) => [...current, elapsed].slice(-MAX_LATENCY_POINTS));
        const reply = response.data.reply?.trim();
        if (!reply) throw new Error('Deva returned an empty response.');
        setMessages((current) => [...current, { id: `deva-${Date.now()}`, role: 'Deva', text: reply, time: clock() }]);
        speak(reply, languageRef.current, wasInterrupted);
        setStatus('Speaking...');
      } catch (error) {
        const detail =
          (error as { response?: { data?: { detail?: string } }; message?: string }).response?.data?.detail ??
          (error as { message?: string }).message ??
          'Unable to reach Deva. Please try again.';
        setStatus(`Request failed: ${detail}`);
      } finally {
        isSendingRef.current = false;
        setIsSending(false);
      }
    },
    [speak],
  );

  const flushTranscript = useCallback(() => {
    if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
    submitTimerRef.current = null;
    const finalTranscript = transcriptRef.current.trim();
    if (finalTranscript) void sendMessage(finalTranscript);
  }, [sendMessage]);

  const startRecognition = useCallback(() => {
    if (!listeningRef.current) return;
    const SpeechRecognition =
      (window as SpeechRecognitionWindow).SpeechRecognition ??
      (window as SpeechRecognitionWindow).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      listeningRef.current = false;
      setIsListening(false);
      stopMeter();
      setStatus('Speech recognition is not supported here. Open this page in Chrome or Edge.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    const selected = languageRef.current;
    recognition.lang = selected === 'auto' ? 'hi-IN' : selected;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0].transcript;
        if (event.results[index].isFinal) final += transcript;
        else interim += transcript;
      }

      if (speakingRef.current && bargeInRef.current && (interim.trim() || final.trim())) {
        window.speechSynthesis?.cancel();
        speakingRef.current = false;
        setIsSpeaking(false);
        interruptedRef.current = true;
        setStatus('Interrupted — listening to your follow-up...');
      }

      if (final.trim()) transcriptRef.current = `${transcriptRef.current} ${final.trim()}`.trim();
      const liveText = `${transcriptRef.current} ${interim.trim()}`.trim();
      if (liveText) {
        setInput(liveText);
        if (final.trim()) {
          if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
          submitTimerRef.current = setTimeout(flushTranscript, 950);
          setStatus('Heard you. Sending shortly...');
        } else if (!speakingRef.current) {
          setStatus('Listening...');
        }
      }
    };
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture') {
        listeningRef.current = false;
        setIsListening(false);
        stopMeter();
        setStatus('Microphone access blocked. Allow it in browser site settings, then start the microphone again.');
      } else if (!['no-speech', 'aborted'].includes(event.error)) {
        setStatus(`Speech recognition error: ${event.error}`);
      }
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      if (listeningRef.current) window.setTimeout(() => startRecognitionRef.current(), 200);
    };

    try {
      recognition.start();
      setStatus('Listening...');
    } catch (error) {
      listeningRef.current = false;
      setIsListening(false);
      stopMeter();
      setStatus(`Could not start the microphone: ${(error as Error).message}`);
    }
  }, [flushTranscript, stopMeter]);

  useEffect(() => {
    startRecognitionRef.current = startRecognition;
  }, [startRecognition]);

  const startListening = () => {
    if (!window.isSecureContext) {
      setStatus('Microphone access requires HTTPS or localhost.');
      return;
    }
    listeningRef.current = true;
    setIsListening(true);
    startRecognition();
    void startMeter();
  };

  const stopListening = useCallback(() => {
    listeningRef.current = false;
    setIsListening(false);
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    stopMeter();
    setStatus('Microphone stopped.');
  }, [stopMeter]);

  const startNewConversation = () => {
    stopListening();
    window.speechSynthesis?.cancel();
    speakingRef.current = false;
    setIsSpeaking(false);
    interruptedRef.current = false;
    transcriptRef.current = '';
    threadIdRef.current = newThreadId();
    setMessages([]);
    setLatencies([]);
    setInput('');
    setStatus('New conversation ready.');
  };

  useEffect(
    () => () => {
      listeningRef.current = false;
      recognitionRef.current?.stop();
      if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
      window.speechSynthesis?.cancel();
      analyserRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      void audioCtxRef.current?.close().catch(() => undefined);
    },
    [],
  );

  /* ----- galaxy canvas: stars, spectrum, pitch-reactive waveform ----- */

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;

    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const stars = Array.from({ length: 160 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.3 + 0.25,
      tw: Math.random() * Math.PI * 2,
      sp: Math.random() * 0.01 + 0.002,
      layer: Math.random(),
    }));
    let shooting: { x: number; y: number; vx: number; vy: number; life: number } | null = null;

    const timeData = new Float32Array(2048);
    const freqData = new Uint8Array(1024);
    const halfBars = BAR_COUNT * 4; // 36 spectrum bars mirrored left/right
    const barVals = new Float32Array(halfBars);
    const bandVals = new Float32Array(BAR_COUNT);

    let last = performance.now();
    let t = 0;
    let frame = 0;
    let level = 0;
    let hue = 215;
    let pitch: number | null = null;
    let silentFrames = 0;
    let p01 = 0.3;
    let raf = 0;

    const draw = (now: number) => {
      const s = vizStateRef.current;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      frame += 1;

      const analyser = analyserRef.current;
      const haveAudio = Boolean(analyser && s.listening);
      let rms = 0;
      if (analyser && haveAudio) {
        analyser.getFloatTimeDomainData(timeData);
        analyser.getByteFrequencyData(freqData);
        let sum = 0;
        for (let i = 0; i < timeData.length; i += 1) sum += timeData[i] * timeData[i];
        rms = Math.sqrt(sum / timeData.length);
      }
      const micLevel = clamp01(rms * 6);
      const userActive = haveAudio && micLevel > 0.06;
      const mode: 'user' | 'speaking' | 'thinking' | 'listening' | 'idle' = userActive
        ? 'user'
        : s.speaking
          ? 'speaking'
          : s.sending
            ? 'thinking'
            : s.listening
              ? 'listening'
              : 'idle';

      // overall energy
      let target = 0.04 + 0.02 * Math.sin(t * 1.5);
      if (mode === 'user') target = micLevel;
      else if (mode === 'speaking')
        target = 0.35 + 0.25 * Math.abs(Math.sin(t * 5.3)) * Math.abs(Math.sin(t * 2.1 + 1)) + 0.08 * Math.sin(t * 13);
      else if (mode === 'thinking') target = 0.18;
      else if (mode === 'listening') target = 0.08 + micLevel * 0.5;
      level += (target - level) * 0.22;

      // pitch (every 3rd frame – autocorrelation is the expensive part)
      if (frame % 3 === 0) {
        const sampleRate = audioCtxRef.current?.sampleRate ?? 48000;
        const detected = mode === 'user' ? detectPitch(timeData, sampleRate) : null;
        if (detected) {
          pitch = pitch ? pitch * 0.7 + detected * 0.3 : detected;
          silentFrames = 0;
        } else {
          silentFrames += 1;
          if (silentFrames > 12) pitch = null;
        }
      }
      if (pitch) {
        const goal = clamp01(Math.log2(pitch / 80) / Math.log2(420 / 80));
        p01 += (goal - p01) * 0.15;
      } else {
        p01 += (0.3 - p01) * 0.02;
      }

      const hueTarget =
        mode === 'user' ? 215 + p01 * 115 : mode === 'speaking' ? 268 + 28 * Math.sin(t * 0.8) : mode === 'thinking' ? 190 : 215;
      hue += (hueTarget - hue) * 0.1;
      const col = (l: number, a: number) => `hsla(${hue.toFixed(0)},90%,${l}%,${a})`;

      // ---- background ----
      ctx.fillStyle = '#02030a';
      ctx.fillRect(0, 0, w, h);

      let g = ctx.createRadialGradient(w * 0.2, h * 0.25, 0, w * 0.2, h * 0.25, w * 0.55);
      g.addColorStop(0, 'hsla(262,80%,45%,0.16)');
      g.addColorStop(1, 'hsla(262,80%,45%,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      g = ctx.createRadialGradient(w * 0.85, h * 0.8, 0, w * 0.85, h * 0.8, w * 0.5);
      g.addColorStop(0, 'hsla(200,85%,42%,0.12)');
      g.addColorStop(1, 'hsla(200,85%,42%,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2 - 12;
      const baseR = Math.min(w * 0.5, h * 1.05) * 0.4;

      g = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 3.4);
      g.addColorStop(0, col(50, 0.12 + level * 0.28));
      g.addColorStop(1, col(50, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // ---- stars ----
      const drift = 1 + level * 3;
      for (const star of stars) {
        const x = (star.x + t * star.sp * (0.4 + star.layer) * drift) % 1;
        const a = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * (1 + star.layer * 2) + star.tw))) * (0.45 + star.layer * 0.55);
        const r = star.r * (0.7 + star.layer * 0.6);
        ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x * w, star.y * h, r, 0, Math.PI * 2);
        ctx.fill();
        if (star.r > 1.1) {
          ctx.fillStyle = `rgba(190,210,255,${(a * 0.14).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x * w, star.y * h, r * 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (!shooting && Math.random() < 0.004) {
        shooting = { x: Math.random() * w * 0.7, y: Math.random() * h * 0.4, vx: 360, vy: 150, life: 1 };
      }
      if (shooting) {
        shooting.x += shooting.vx * dt;
        shooting.y += shooting.vy * dt;
        shooting.life -= dt * 1.6;
        if (shooting.life <= 0) {
          shooting = null;
        } else {
          const tail = ctx.createLinearGradient(shooting.x, shooting.y, shooting.x - shooting.vx * 0.14, shooting.y - shooting.vy * 0.14);
          tail.addColorStop(0, `rgba(255,255,255,${shooting.life.toFixed(2)})`);
          tail.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.strokeStyle = tail;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(shooting.x, shooting.y);
          ctx.lineTo(shooting.x - shooting.vx * 0.14, shooting.y - shooting.vy * 0.14);
          ctx.stroke();
        }
      }

      // ---- faint guide rings ----
      ctx.lineWidth = 1;
      [1.0, 1.55, 2.1].forEach((m, i) => {
        ctx.strokeStyle = col(70, 0.1 - i * 0.025);
        ctx.beginPath();
        ctx.arc(cx, cy, baseR * m * (1 + level * 0.03), 0, Math.PI * 2);
        ctx.stroke();
      });

      // ---- radial spectrum ----
      for (let j = 0; j < halfBars; j += 1) {
        let v: number;
        if (haveAudio && (mode === 'user' || mode === 'listening')) {
          const bin = 2 + Math.floor(Math.pow(j / (halfBars - 1), 1.5) * 260);
          v = Math.pow(freqData[bin] / 255, 1.4);
        } else if (mode === 'speaking') {
          v = (0.2 + 0.6 * Math.abs(Math.sin(t * 3 + j * 0.5)) * Math.abs(Math.sin(t * 1.7 + j * 0.23))) * (0.4 + level);
        } else {
          v = 0.05 + 0.04 * Math.sin(t * 2 + j * 0.4);
        }
        barVals[j] = v > barVals[j] ? v : barVals[j] * 0.85 + v * 0.15;
      }
      ctx.lineCap = 'round';
      ctx.lineWidth = 2.4;
      const total = halfBars * 2;
      for (let i = 0; i < total; i += 1) {
        const j = i < halfBars ? i : total - 1 - i;
        const v = barVals[j];
        const ang = (i / total) * Math.PI * 2 - Math.PI / 2;
        const r0 = baseR * 1.05;
        const r1 = r0 + 3 + v * baseR * 0.85;
        ctx.strokeStyle = `hsla(${(hue + j * 2).toFixed(0)},95%,${60 + v * 15}%,${(0.3 + v * 0.7).toFixed(2)})`;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
        ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
        ctx.stroke();
      }

      // ---- pitch waveform ring: more ripples = higher pitch ----
      const K = 220;
      const waveR = baseR * 0.82;
      const synthK = mode === 'speaking' ? 6 + 2 * Math.sin(t * 0.6) : 3;
      ctx.beginPath();
      for (let k = 0; k <= K; k += 1) {
        const u = k / K;
        const window = Math.sin(Math.PI * u);
        let wave: number;
        if (mode === 'user') {
          wave = Math.max(-1, Math.min(1, timeData[Math.floor(u * (timeData.length - 1))] * 4));
        } else {
          wave = Math.sin(u * Math.PI * 2 * synthK + t * 4) * Math.min(1, level * 1.6);
        }
        const r = waveR + wave * baseR * 0.38 * window;
        const ang = u * Math.PI * 2 - Math.PI / 2;
        const px = cx + Math.cos(ang) * r;
        const py = cy + Math.sin(ang) * r;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = col(50, 0.1);
      ctx.fill();
      ctx.shadowBlur = 14;
      ctx.shadowColor = col(60, 0.9);
      ctx.strokeStyle = col(72, 0.95);
      ctx.lineWidth = 1.7;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // ---- core orb ----
      const coreR = baseR * 0.55 * (1 + level * 0.15);
      g = ctx.createRadialGradient(cx - coreR * 0.3, cy - coreR * 0.3, 2, cx, cy, coreR);
      g.addColorStop(0, col(88, 1));
      g.addColorStop(0.5, col(58, 0.95));
      g.addColorStop(1, col(32, 0.9));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();

      // ---- thinking arc ----
      if (mode === 'thinking') {
        ctx.strokeStyle = col(72, 0.9);
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(cx, cy, baseR * 1.75, t * 2.4, t * 2.4 + 1.7);
        ctx.stroke();
        ctx.strokeStyle = col(72, 0.45);
        ctx.beginPath();
        ctx.arc(cx, cy, baseR * 1.75, t * 2.4 + Math.PI, t * 2.4 + Math.PI + 0.9);
        ctx.stroke();
      }

      // ---- orbiting particles (faster when pitch is higher) ----
      for (let i = 0; i < 3; i += 1) {
        const orbitR = baseR * (1.55 + i * 0.4);
        const ang = t * (0.5 + i * 0.3) * (1 + p01 * 1.6) * (i % 2 ? -1 : 1) + i * 2.1;
        const px = cx + Math.cos(ang) * orbitR;
        const py = cy + Math.sin(ang) * orbitR;
        ctx.fillStyle = col(80, 0.2);
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = col(85, 0.95);
        ctx.beginPath();
        ctx.arc(px, py, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // ---- HUD text + pitch gauge ----
      ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textBaseline = 'middle';
      const stateLabel = {
        user: 'YOU ARE SPEAKING',
        speaking: 'DEVA SPEAKING',
        thinking: 'PROCESSING',
        listening: 'LISTENING',
        idle: 'STANDBY',
      }[mode];
      ctx.textAlign = 'left';
      ctx.fillStyle = s.listening ? 'rgba(52,211,153,0.95)' : 'rgba(148,163,184,0.7)';
      ctx.fillText(s.listening ? '● LIVE' : '○ MIC OFF', 14, 16);
      ctx.fillStyle = 'rgba(226,232,240,0.75)';
      if (w >= 420) ctx.fillText(stateLabel, 14, h - 16);

      const gaugeW = Math.min(150, w * 0.3);
      const gx = cx - gaugeW / 2;
      const gy = h - 16;
      const grad = ctx.createLinearGradient(gx, 0, gx + gaugeW, 0);
      grad.addColorStop(0, 'hsl(215,90%,60%)');
      grad.addColorStop(0.5, 'hsl(272,90%,65%)');
      grad.addColorStop(1, 'hsl(330,90%,65%)');
      ctx.globalAlpha = pitch ? 0.9 : 0.35;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(gx, gy - 2, gaugeW, 4, 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (pitch) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(gx + p01 * gaugeW, gy, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.font = '600 8px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = 'rgba(148,163,184,0.8)';
      ctx.textAlign = 'right';
      ctx.fillText('LOW', gx - 6, gy);
      ctx.textAlign = 'left';
      ctx.fillText('HIGH', gx + gaugeW + 6, gy);

      ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'right';
      if (w >= 420) {
        const band = p01 < 0.33 ? 'LOW' : p01 < 0.66 ? 'MID' : 'HIGH';
        ctx.fillStyle = pitch ? col(78, 1) : 'rgba(148,163,184,0.55)';
        ctx.fillText(pitch ? `PITCH ${band} · ${Math.round(pitch)} Hz` : 'PITCH —', w - 14, h - 16);
      }

      // ---- mini equalizer in the stats row ----
      for (let b = 0; b < BAR_COUNT; b += 1) {
        let v: number;
        if (haveAudio && (mode === 'user' || mode === 'listening')) {
          const from = 2 + Math.floor(Math.pow(b / BAR_COUNT, 1.6) * 200);
          const to = 2 + Math.floor(Math.pow((b + 1) / BAR_COUNT, 1.6) * 200) + 1;
          let acc = 0;
          for (let n = from; n < to; n += 1) acc += freqData[n];
          v = Math.pow(acc / (to - from) / 255, 1.2) * 1.4;
        } else if (mode === 'speaking') {
          v = 0.25 + 0.6 * Math.abs(Math.sin(t * 6 + b * 0.9));
        } else {
          v = 0.08;
        }
        bandVals[b] = v > bandVals[b] ? v : bandVals[b] * 0.8 + v * 0.2;
        const el = barRefs.current[b];
        if (el) {
          el.style.transform = `scaleY(${Math.max(0.1, Math.min(1, bandVals[b])).toFixed(3)})`;
          el.style.backgroundColor = `hsl(${(hue + b * 4).toFixed(0)},85%,58%)`;
        }
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  const lastLatency = latencies.length ? latencies[latencies.length - 1] : null;
  const avgLatency = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;
  const fmtMs = (v: number | null) => (v === null ? '—' : v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${v}ms`);
  const languageOption = LANGUAGE_OPTIONS.find((o) => o.value === language) ?? LANGUAGE_OPTIONS[0];

  return (
    <div className="flex h-full min-h-[640px] flex-col gap-4 overflow-y-auto bg-slate-100 p-4 text-slate-800">
      {/* Header card */}
      <header className="flex shrink-0 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="m-0 truncate text-base font-bold tracking-tight text-slate-900">Deva AI Engine</h1>
            <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <span className={`h-1.5 w-1.5 rounded-full ${isListening ? 'animate-pulse bg-emerald-500' : 'bg-slate-400'}`} />
              {isListening ? 'Mic live' : 'Mic muted'}
            </span>
          </div>
          <p className="m-0 mt-1 truncate font-mono text-[11px] italic text-slate-500">
            Multilingual Hindi/Hinglish Synthesizer v2.4
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={startNewConversation}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            New chat
          </button>
          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            className={`rounded-full border px-5 py-2 text-xs font-bold transition-colors ${
              isListening
                ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'
                : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
            }`}
          >
            {isListening ? 'Stop Mic' : 'Start Mic'}
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(280px,5fr)_7fr]">
        {/* Left: controls */}
        <aside className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
            <h2 className="m-0 text-[13px] font-bold uppercase leading-tight tracking-wide text-slate-800">
              Audio Input &amp;
              <br />
              Parameters
            </h2>
            <span className="text-right font-mono text-[10px] font-semibold uppercase leading-tight tracking-wider text-slate-400">
              I/O
              <br />
              Controls
            </span>
          </div>

          <div>
            <label className="flex items-center justify-between gap-3 text-[13px]">
              <span className="text-slate-600">Primary Language</span>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as VoiceLanguage)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="m-0 mt-1.5 text-[10px] italic text-slate-400">{languageOption.hint}</p>
          </div>

          <div>
            <label className="flex items-center justify-between gap-3 text-[13px]">
              <span className="text-slate-600">Speech Rate</span>
              <span className="flex items-center gap-3">
                <input
                  aria-label="Speech rate"
                  type="range"
                  min="0.6"
                  max="1.6"
                  step="0.05"
                  value={rate}
                  onChange={(event) => setRate(Number(event.target.value))}
                  className="w-24 accent-blue-600"
                />
                <span className="w-16 rounded-lg bg-slate-100 py-1.5 text-center font-mono text-xs font-semibold tabular-nums text-slate-800">
                  {rate.toFixed(2)}x
                </span>
              </span>
            </label>
            <p className="m-0 mt-1.5 text-[10px] italic text-slate-400">How fast Deva talks. Applies to the next reply.</p>
          </div>

          <div>
            <label className="flex items-center justify-between gap-3 text-[13px]">
              <span className="text-slate-600">Voice Volume</span>
              <span className="flex items-center gap-3">
                <input
                  aria-label="Voice volume"
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(event) => setVolume(Number(event.target.value))}
                  className="w-24 accent-blue-600"
                />
                <span className="w-16 rounded-lg bg-slate-100 py-1.5 text-center font-mono text-xs font-semibold tabular-nums text-slate-800">
                  {Math.round(volume * 100)}%
                </span>
              </span>
            </label>
            <p className="m-0 mt-1.5 text-[10px] italic text-slate-400">How loud Deva speaks (not your microphone).</p>
          </div>

          <button
            type="button"
            onClick={previewVoice}
            className="w-full rounded-lg border border-blue-200 bg-blue-50 py-2 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100"
          >
            ▶ Test voice with these settings
          </button>

          <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <div>
              <div className="text-[13px] font-semibold text-slate-800">Barge-In Interrupt</div>
              <div className="text-[10px] italic text-slate-400">Allow user vocal override</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={bargeIn}
              aria-label="Barge-in interrupt"
              onClick={() => setBargeIn((v) => !v)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${bargeIn ? 'bg-blue-600' : 'bg-slate-300'}`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                  bargeIn ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          <div className="mt-auto">
            <div className="mb-1 flex items-center justify-between">
              <SectionLabel>Latency Telemetry</SectionLabel>
              <span className="font-mono text-[10px] font-semibold text-blue-600">{fmtMs(avgLatency)} AVG</span>
            </div>
            <Sparkline points={latencies} />
          </div>
        </aside>

        {/* Right: HUD + log */}
        <section className="flex min-h-[520px] flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="m-0 text-[13px] font-bold uppercase tracking-wide text-slate-800">Voice Galaxy HUD</h2>
            <span className="font-mono text-[11px] font-semibold italic text-blue-600">Gemini + Groq</span>
          </div>

          <div className="grid shrink-0 grid-cols-3 divide-x divide-slate-200 rounded-xl border border-slate-200 bg-slate-50">
            <Stat label="Turns">{messages.length}</Stat>
            <Stat label="Latency">{fmtMs(lastLatency)}</Stat>
            <Stat label="Voice">
              <div className="flex h-5 items-end gap-[3px]" aria-label="Live voice level">
                {Array.from({ length: BAR_COUNT }, (_, i) => (
                  <span
                    key={i}
                    ref={(el) => {
                      barRefs.current[i] = el;
                    }}
                    className="h-full w-[3px] origin-bottom rounded-full bg-slate-300"
                    style={{ transform: 'scaleY(0.1)' }}
                  />
                ))}
              </div>
            </Stat>
          </div>

          {/* Galaxy card */}
          <div className="relative h-[290px] shrink-0 overflow-hidden rounded-2xl border border-slate-800 bg-black shadow-lg shadow-slate-900/20 ring-1 ring-inset ring-white/5">
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label="Voice visualizer" />
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-2 flex items-center justify-between">
              <SectionLabel>Active Speech Log</SectionLabel>
              <span
                role="status"
                aria-live="polite"
                className="max-w-[60%] truncate font-mono text-[10px] text-slate-400"
                title={status}
              >
                {status}
              </span>
            </div>

            <div
              aria-label="Conversation history"
              className="min-h-[160px] flex-1 space-y-3 overflow-y-auto rounded-xl bg-slate-50/60 p-1 pr-2"
            >
              {messages.length === 0 && !isSending && (
                <div className="flex h-full min-h-32 items-center justify-center text-center text-xs text-slate-400">
                  Start the mic or type a message to talk to Deva.
                </div>
              )}
              {messages.map((message) => {
                const isUser = message.role === 'You';
                return (
                  <article
                    key={message.id}
                    className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm ${
                      isUser ? 'ml-auto bg-blue-600 text-white' : 'mr-auto border border-slate-200 bg-white text-slate-800'
                    }`}
                  >
                    <div
                      className={`mb-1 flex items-center justify-between gap-6 font-mono text-[10px] ${
                        isUser ? 'text-blue-100' : 'text-slate-400'
                      }`}
                    >
                      <span>{isUser ? 'User' : 'Deva AI'}</span>
                      <span>{message.time}</span>
                    </div>
                    <div className="whitespace-pre-wrap">{message.text}</div>
                  </article>
                );
              })}
              {isSending && (
                <article className="mr-auto max-w-[88%] rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm">
                  <div className="mb-1 font-mono text-[10px] text-slate-400">Deva AI</div>
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                  </div>
                </article>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <form
            className="flex shrink-0 items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage(input);
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Aap kya help chahte hain? (Type turn...)"
              className="min-w-0 flex-1 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-[13px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="submit"
              disabled={!input.trim() || isSending}
              className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSending ? 'Sending…' : 'Send'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};