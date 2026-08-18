"""
Structured logging configuration for the Voice AI production layer.
Uses structlog for JSON-formatted output with correlation IDs.
Writes to a rotating file handler in addition to stdout.
"""

import logging
import logging.handlers
import os
import uuid
from typing import Optional

import structlog

from app.voice.config import voice_config

# Ensure the log directory exists
log_dir = os.path.dirname(voice_config.logging.log_file_path)
if log_dir:
    os.makedirs(log_dir, exist_ok=True)

# Configure structlog
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer(),
    ],
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)

# Standard library logging level
_log_level = getattr(logging, voice_config.logging.log_level.upper(), logging.INFO)

logging.basicConfig(
    format="%(message)s",
    level=_log_level,
)

# Rotating file handler
try:
    _file_handler = logging.handlers.RotatingFileHandler(
        voice_config.logging.log_file_path,
        maxBytes=voice_config.logging.max_log_file_size_mb * 1024 * 1024,
        backupCount=voice_config.logging.backup_log_count,
        encoding="utf-8",
    )
    _file_handler.setLevel(_log_level)
    logging.getLogger().addHandler(_file_handler)
except Exception:
    # Don't crash the server if log file can't be created (e.g., in tests)
    pass


class ContextualLogger:
    """
    Context-aware logger wrapper around structlog.
    Automatically injects correlation_id into every log call,
    enabling full request tracing across all voice modules.
    """

    def __init__(self, name: str):
        self.logger = structlog.get_logger(name)
        self._correlation_id: Optional[str] = None

    @property
    def correlation_id(self) -> str:
        """Get or lazily create a correlation ID for this logger context."""
        if not self._correlation_id:
            self._correlation_id = str(uuid.uuid4())[:12]
        return self._correlation_id

    def set_correlation_id(self, correlation_id: str):
        """Explicitly set a correlation ID (e.g. 'voice-a1b2c3d4')."""
        self._correlation_id = correlation_id

    def _with_context(self, **kwargs):
        """Bind standard context fields to every log call."""
        return self.logger.bind(correlation_id=self.correlation_id, **kwargs)

    def info(self, message: str, **kwargs):
        self._with_context(**kwargs).info(message)

    def warning(self, message: str, **kwargs):
        self._with_context(**kwargs).warning(message)

    def error(self, message: str, exc_info: bool = False, **kwargs):
        ctx = self._with_context(**kwargs)
        if exc_info:
            ctx.exception(message)
        else:
            ctx.error(message)

    def debug(self, message: str, **kwargs):
        self._with_context(**kwargs).debug(message)

    def critical(self, message: str, **kwargs):
        self._with_context(**kwargs).critical(message)


def get_logger(name: str) -> ContextualLogger:
    """
    Get a production-grade contextualized logger for a voice module.

    Usage:
        logger = get_logger(__name__)
        logger.set_correlation_id("voice-req-abc123")
        logger.info("Processing audio frame", frame_size=512, state="LISTENING")
    """
    return ContextualLogger(name)
