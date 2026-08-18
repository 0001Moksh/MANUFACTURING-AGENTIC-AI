"""
Voice AI Production Package
Multi-agent voice router with industrial operations support.

Production-grade features:
- Robust state machine with atomic transitions
- Retry logic with exponential backoff
- Circuit breaker for cascading failure prevention
- Structured JSON logging with request tracing
- Bounded resource management
- WebSocket error handling
"""

__version__ = "1.0.0"
__author__ = "Industrial AI Team"

from .config import config, Config
from .logging_config import get_logger, ContextualLogger
from .resilience import CircuitBreaker, RetryPolicy, with_timeout
from .manager import VoiceConversationManager, ConversationState
from .llm_stream import transcribe_audio, stream_llm_response, check_groq_health

__all__ = [
    "config",
    "Config",
    "get_logger",
    "ContextualLogger",
    "CircuitBreaker",
    "RetryPolicy",
    "with_timeout",
    "VoiceConversationManager",
    "ConversationState",
    "transcribe_audio",
    "stream_llm_response",
    "check_groq_health",
]
