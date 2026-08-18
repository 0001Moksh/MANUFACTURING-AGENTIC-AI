"""
Production configuration for the Voice AI System.
Centralizes all magic numbers and API keys.
Supports environment variable overrides for dev / staging / prod.
"""

import os
from dataclasses import dataclass
from typing import Dict

from dotenv import load_dotenv

# Load .env before any dataclass defaults are evaluated
load_dotenv()


@dataclass
class VADConfig:
    """Voice Activity Detection settings."""
    sample_rate: int = int(os.getenv("VAD_SAMPLE_RATE", "16000"))
    threshold: float = float(os.getenv("VAD_THRESHOLD", "0.015"))
    min_speech_frames: int = int(os.getenv("VAD_MIN_SPEECH_FRAMES", "3"))
    min_silence_frames: int = int(os.getenv("VAD_MIN_SILENCE_FRAMES", "8"))
    max_buffer_size_bytes: int = int(os.getenv("VAD_MAX_BUFFER_SIZE", str(2 * 1024 * 1024)))  # 2 MB


@dataclass
class TTSConfig:
    """Text-to-Speech settings."""
    en_voice: str = os.getenv("TTS_EN_VOICE", "en-US-ChristopherNeural")
    hi_voice: str = os.getenv("TTS_HI_VOICE", "hi-IN-MadhurNeural")
    cache_enabled: bool = os.getenv("TTS_CACHE_ENABLED", "true").lower() == "true"
    cache_ttl_seconds: int = int(os.getenv("TTS_CACHE_TTL", str(3600)))
    cache_max_size: int = int(os.getenv("TTS_CACHE_MAX_SIZE", "500"))
    request_timeout_seconds: int = int(os.getenv("TTS_TIMEOUT", "15"))


@dataclass
class LLMConfig:
    """LLM & Transcription settings."""
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    whisper_model: str = os.getenv("WHISPER_MODEL", "whisper-large-v3")
    llm_model: str = os.getenv("LLM_MODEL", "llama-3.1-8b-instant")
    llm_temperature: float = float(os.getenv("LLM_TEMPERATURE", "0.3"))
    llm_max_tokens: int = int(os.getenv("LLM_MAX_TOKENS", "200"))
    request_timeout_seconds: int = int(os.getenv("LLM_TIMEOUT", "30"))
    transcription_timeout_seconds: int = int(os.getenv("TRANSCRIPTION_TIMEOUT", "15"))

    # Retry configuration
    max_retries: int = int(os.getenv("LLM_MAX_RETRIES", "3"))
    retry_delay_seconds: float = float(os.getenv("LLM_RETRY_DELAY", "1.0"))
    retry_backoff_multiplier: float = float(os.getenv("LLM_RETRY_BACKOFF", "2.0"))

    # Circuit breaker
    circuit_breaker_failure_threshold: int = int(os.getenv("CB_FAILURE_THRESHOLD", "5"))
    circuit_breaker_recovery_timeout: int = int(os.getenv("CB_RECOVERY_TIMEOUT", "60"))


@dataclass
class RouterConfig:
    """Agent routing configuration."""
    use_ml_router: bool = os.getenv("USE_ML_ROUTER", "false").lower() == "true"
    ml_router_model_path: str = os.getenv("ML_ROUTER_MODEL_PATH", "models/router.pkl")
    ml_confidence_threshold: float = float(os.getenv("ML_CONFIDENCE_THRESHOLD", "0.7"))
    default_fallback_agent: str = os.getenv("DEFAULT_FALLBACK_AGENT", "general")


@dataclass
class VoiceConversationConfig:
    """VoiceConversationManager settings."""
    # History management
    max_history_size: int = int(os.getenv("MAX_HISTORY_SIZE", "50"))

    # State machine timeouts
    thinking_timeout_seconds: int = int(os.getenv("THINKING_TIMEOUT", "45"))
    speaking_timeout_seconds: int = int(os.getenv("SPEAKING_TIMEOUT", "120"))

    # Sentence chunking for TTS
    min_sentences_for_tts_batch: int = int(os.getenv("MIN_SENTENCES_TTS_BATCH", "2"))
    max_chars_per_tts_call: int = int(os.getenv("MAX_CHARS_PER_TTS", "500"))

    # Whisper hallucination filtering
    hallucination_min_length: int = int(os.getenv("HALLUCINATION_MIN_LENGTH", "10"))
    hallucination_confidence_threshold: float = float(os.getenv("HALLUCINATION_CONF", "0.5"))


@dataclass
class LoggingConfig:
    """Structured logging configuration."""
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    log_format: str = os.getenv("LOG_FORMAT", "json")  # json or text
    enable_request_tracing: bool = os.getenv("ENABLE_REQUEST_TRACING", "true").lower() == "true"
    log_file_path: str = os.getenv("LOG_FILE_PATH", "logs/voice_ai.log")
    max_log_file_size_mb: int = int(os.getenv("MAX_LOG_SIZE_MB", "100"))
    backup_log_count: int = int(os.getenv("BACKUP_LOG_COUNT", "5"))


@dataclass
class MetricsConfig:
    """Metrics & Monitoring configuration."""
    enable_metrics: bool = os.getenv("ENABLE_METRICS", "true").lower() == "true"
    metrics_prefix: str = os.getenv("METRICS_PREFIX", "voice_ai")
    metrics_backend: str = os.getenv("METRICS_BACKEND", "prometheus")  # prometheus, datadog, cloudwatch


class VoiceConfig:
    """Unified voice configuration object."""

    def __init__(self):
        self.vad = VADConfig()
        self.tts = TTSConfig()
        self.llm = LLMConfig()
        self.router = RouterConfig()
        self.voice_conversation = VoiceConversationConfig()
        self.logging = LoggingConfig()
        self.metrics = MetricsConfig()
        self._validate()

    def _validate(self):
        """Validate required configuration."""
        if not self.llm.groq_api_key:
            raise ValueError(
                "GROQ_API_KEY environment variable is not set. "
                "Add it to backend/.env to enable voice features."
            )
        if self.voice_conversation.max_history_size < 10:
            raise ValueError("MAX_HISTORY_SIZE must be at least 10")

    def to_dict(self) -> Dict:
        """Export config as dictionary (for logging/debug). API key is redacted."""
        return {
            "vad": self.vad.__dict__,
            "tts": self.tts.__dict__,
            "llm": {k: v for k, v in self.llm.__dict__.items() if k != "groq_api_key"},
            "router": self.router.__dict__,
            "voice_conversation": self.voice_conversation.__dict__,
            "logging": self.logging.__dict__,
            "metrics": self.metrics.__dict__,
        }


# Global config instance — imported by all voice modules
voice_config = VoiceConfig()
