"""
Structured logging configuration for production.
Uses structlog for JSON logging with correlation IDs.
"""

import logging
import logging.handlers
import structlog
from datetime import datetime
from typing import Optional
import uuid
from config import config

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

# Standard library logging configuration
logging.basicConfig(
    format="%(message)s",
    stream=None,  # Disable stdout; use file handler instead
    level=getattr(logging, config.logging.log_level),
)

# File handler with rotation
file_handler = logging.handlers.RotatingFileHandler(
    config.logging.log_file_path,
    maxBytes=config.logging.max_log_file_size_mb * 1024 * 1024,
    backupCount=config.logging.backup_log_count,
)
file_handler.setLevel(getattr(logging, config.logging.log_level))

root_logger = logging.getLogger()
root_logger.addHandler(file_handler)


class ContextualLogger:
    """
    Wrapper around structlog for context-aware logging.
    Adds correlation IDs, request metadata, etc.
    """

    def __init__(self, name: str):
        self.logger = structlog.get_logger(name)
        self._correlation_id: Optional[str] = None

    @property
    def correlation_id(self) -> str:
        """Get or create correlation ID for this log context."""
        if not self._correlation_id:
            self._correlation_id = str(uuid.uuid4())
        return self._correlation_id

    def set_correlation_id(self, correlation_id: str):
        """Set correlation ID for tracking request flow."""
        self._correlation_id = correlation_id

    def _with_context(self, **kwargs):
        """Add standard context to all log calls."""
        context = {
            "correlation_id": self.correlation_id,
            **kwargs,
        }
        return self.logger.bind(**context)

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
    """Get a contextualized logger instance."""
    return ContextualLogger(name)


# Example usage:
# logger = get_logger(__name__)
# logger.set_correlation_id("req-123")
# logger.info("Processing audio frame", frame_size=512, state="LISTENING")
