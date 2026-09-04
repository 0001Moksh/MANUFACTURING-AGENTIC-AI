"""
Production-grade resilience patterns for the Voice AI layer.
Implements: Retry with exponential backoff, Circuit Breaker, Timeout handling.

These patterns prevent cascading failures and ensure graceful degradation
when Groq API or Edge TTS experiences transient issues.
"""

import asyncio
from datetime import datetime
from enum import Enum
from typing import Callable, Optional, TypeVar

from app.voice.logging_config import get_logger

logger = get_logger(__name__)

T = TypeVar("T")


class CircuitBreakerState(Enum):
    CLOSED = "closed"    # Normal: requests pass through
    OPEN = "open"        # Failing: reject immediately (fail-fast)
    HALF_OPEN = "half_open"  # Recovery test: allow single request


class CircuitBreaker:
    """
    Prevents cascading failures by monitoring error rates.

    State transitions:
      CLOSED → OPEN      after `failure_threshold` consecutive failures
      OPEN   → HALF_OPEN after `recovery_timeout` seconds
      HALF_OPEN → CLOSED on first success
      HALF_OPEN → OPEN   on failure
    """

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout

        self.state = CircuitBreakerState.CLOSED
        self.failure_count = 0
        self.last_failure_time: Optional[datetime] = None

    async def call_async(self, func: Callable[..., T], *args, **kwargs) -> T:
        """Execute an async function with circuit breaker protection."""
        if self.state == CircuitBreakerState.OPEN:
            if self._should_attempt_recovery():
                self.state = CircuitBreakerState.HALF_OPEN
                logger.info(
                    f"Circuit breaker '{self.name}' entering HALF_OPEN",
                    circuit_breaker=self.name,
                    state=self.state.value,
                )
            else:
                raise Exception(
                    f"Circuit breaker '{self.name}' is OPEN — service unavailable."
                )

        try:
            result = await func(*args, **kwargs)
            self._on_success()
            return result
        except Exception:
            self._on_failure()
            raise

    def _on_success(self):
        if self.state == CircuitBreakerState.HALF_OPEN:
            logger.info(
                f"Circuit breaker '{self.name}' recovered → CLOSED",
                circuit_breaker=self.name,
            )
        self.state = CircuitBreakerState.CLOSED
        self.failure_count = 0
        self.last_failure_time = None

    def _on_failure(self):
        self.failure_count += 1
        self.last_failure_time = datetime.now()
        if self.failure_count >= self.failure_threshold:
            self.state = CircuitBreakerState.OPEN
            logger.error(
                f"Circuit breaker '{self.name}' OPENED after {self.failure_count} failures",
                circuit_breaker=self.name,
                failure_count=self.failure_count,
            )

    def _should_attempt_recovery(self) -> bool:
        if not self.last_failure_time:
            return False
        elapsed = (datetime.now() - self.last_failure_time).total_seconds()
        return elapsed >= self.recovery_timeout

    @property
    def is_available(self) -> bool:
        """True if the circuit breaker will allow the next request through."""
        if self.state == CircuitBreakerState.OPEN:
            # Automatically transition to HALF_OPEN if recovery window has passed
            if self._should_attempt_recovery():
                self.state = CircuitBreakerState.HALF_OPEN
                return True
            return False
        return True


class RetryPolicy:
    """
    Configurable retry logic with exponential backoff.
    Only retries transient exceptions; does not retry on success.
    """

    def __init__(
        self,
        max_retries: int = 3,
        initial_delay: float = 1.0,
        backoff_multiplier: float = 2.0,
        max_delay: float = 60.0,
    ):
        self.max_retries = max_retries
        self.initial_delay = initial_delay
        self.backoff_multiplier = backoff_multiplier
        self.max_delay = max_delay

    async def execute(
        self,
        func: Callable[..., T],
        *args,
        operation_name: str = "operation",
        **kwargs,
    ) -> T:
        """
        Execute an async callable with retry and exponential backoff.
        Raises the last exception if all retries are exhausted.
        """
        last_exception = None
        delay = self.initial_delay

        for attempt in range(self.max_retries + 1):
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                last_exception = e

                if attempt < self.max_retries:
                    logger.warning(
                        f"Attempt {attempt + 1}/{self.max_retries + 1} failed for '{operation_name}'",
                        operation=operation_name,
                        attempt=attempt + 1,
                        max_attempts=self.max_retries + 1,
                        retry_delay_seconds=delay,
                        error=str(e),
                    )
                    await asyncio.sleep(delay)
                    delay = min(delay * self.backoff_multiplier, self.max_delay)
                else:
                    logger.error(
                        f"All retries exhausted for '{operation_name}'",
                        operation=operation_name,
                        total_attempts=self.max_retries + 1,
                        error=str(e),
                    )

        raise last_exception  # type: ignore[misc]


async def with_timeout(
    coro,
    timeout_seconds: float,
    operation_name: str = "operation",
):
    """
    Execute a coroutine with a hard timeout.
    Raises TimeoutError with a descriptive message on expiry.
    """
    try:
        return await asyncio.wait_for(coro, timeout=timeout_seconds)
    except asyncio.TimeoutError:
        logger.error(
            f"Operation '{operation_name}' timed out after {timeout_seconds}s",
            operation=operation_name,
            timeout_seconds=timeout_seconds,
        )
        raise TimeoutError(
            f"'{operation_name}' did not complete within {timeout_seconds}s"
        )


# ── Global circuit breakers for external services ────────────────────────────
# Import these in llm_stream.py, tts_stream.py etc. to share state across calls.

groq_circuit_breaker = CircuitBreaker(
    "groq_api",
    failure_threshold=5,
    recovery_timeout=60,
)

edge_tts_circuit_breaker = CircuitBreaker(
    "edge_tts_api",
    failure_threshold=5,
    recovery_timeout=60,
)

# Per-agent circuit breakers (created on demand)
_agent_circuit_breakers: dict[str, CircuitBreaker] = {}


def get_agent_circuit_breaker(agent_id: str) -> CircuitBreaker:
    """Get or create a circuit breaker for a specific agent."""
    if agent_id not in _agent_circuit_breakers:
        _agent_circuit_breakers[agent_id] = CircuitBreaker(
            f"agent_{agent_id}",
            failure_threshold=3,
            recovery_timeout=30,
        )
    return _agent_circuit_breakers[agent_id]
