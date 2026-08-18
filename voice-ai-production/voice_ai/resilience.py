"""
Production-grade resilience patterns: Retry logic, Circuit Breaker, Timeout handling.
"""

import asyncio
import time
from typing import Callable, TypeVar, Optional, Any
from datetime import datetime, timedelta
from enum import Enum
from logging_config import get_logger

logger = get_logger(__name__)

T = TypeVar("T")


class CircuitBreakerState(Enum):
    CLOSED = "closed"  # Normal operation
    OPEN = "open"  # Failing; reject calls
    HALF_OPEN = "half_open"  # Testing if service recovered


class CircuitBreaker:
    """
    Prevents cascading failures by monitoring error rates.

    States:
    - CLOSED: Requests pass through normally
    - OPEN: Reject requests immediately (fail-fast)
    - HALF_OPEN: Allow single request to test recovery
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
        self.last_recovery_attempt: Optional[datetime] = None

    def call(self, func: Callable[..., T], *args, **kwargs) -> T:
        """Execute function with circuit breaker protection."""
        if self.state == CircuitBreakerState.OPEN:
            if self._should_attempt_recovery():
                self.state = CircuitBreakerState.HALF_OPEN
                logger.info(
                    f"Circuit breaker {self.name} entering HALF_OPEN state",
                    state=self.state.value,
                )
            else:
                raise Exception(
                    f"Circuit breaker {self.name} is OPEN. Service unavailable."
                )

        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise

    async def call_async(self, func: Callable[..., T], *args, **kwargs) -> T:
        """Execute async function with circuit breaker protection."""
        if self.state == CircuitBreakerState.OPEN:
            if self._should_attempt_recovery():
                self.state = CircuitBreakerState.HALF_OPEN
                logger.info(
                    f"Circuit breaker {self.name} entering HALF_OPEN state",
                    state=self.state.value,
                )
            else:
                raise Exception(
                    f"Circuit breaker {self.name} is OPEN. Service unavailable."
                )

        try:
            result = await func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise

    def _on_success(self):
        """Reset failure count on success."""
        if self.state == CircuitBreakerState.HALF_OPEN:
            self.state = CircuitBreakerState.CLOSED
            logger.info(
                f"Circuit breaker {self.name} recovered",
                state=self.state.value,
            )

        self.failure_count = 0
        self.last_failure_time = None

    def _on_failure(self):
        """Increment failure count; open if threshold exceeded."""
        self.failure_count += 1
        self.last_failure_time = datetime.now()

        if self.failure_count >= self.failure_threshold:
            self.state = CircuitBreakerState.OPEN
            logger.error(
                f"Circuit breaker {self.name} opened after {self.failure_count} failures",
                state=self.state.value,
            )

    def _should_attempt_recovery(self) -> bool:
        """Check if enough time has passed to attempt recovery."""
        if not self.last_failure_time:
            return False

        time_since_failure = datetime.now() - self.last_failure_time
        return time_since_failure.total_seconds() >= self.recovery_timeout

    @property
    def is_available(self) -> bool:
        """Check if circuit breaker allows requests."""
        return self.state != CircuitBreakerState.OPEN


class RetryPolicy:
    """
    Configurable retry logic with exponential backoff.
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
        Execute async function with retry logic and exponential backoff.
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
                        f"Attempt {attempt + 1}/{self.max_retries + 1} failed for {operation_name}",
                        operation=operation_name,
                        attempt=attempt + 1,
                        max_attempts=self.max_retries + 1,
                        retry_delay=delay,
                        error=str(e),
                    )

                    await asyncio.sleep(delay)
                    delay = min(delay * self.backoff_multiplier, self.max_delay)
                else:
                    logger.error(
                        f"All retries exhausted for {operation_name}",
                        operation=operation_name,
                        total_attempts=self.max_retries + 1,
                        error=str(e),
                    )

        raise last_exception


async def with_timeout(
    coro,
    timeout_seconds: float,
    operation_name: str = "operation",
):
    """
    Execute coroutine with timeout and graceful error handling.
    """
    try:
        return await asyncio.wait_for(coro, timeout=timeout_seconds)
    except asyncio.TimeoutError:
        logger.error(
            f"Operation {operation_name} timed out",
            operation=operation_name,
            timeout_seconds=timeout_seconds,
        )
        raise TimeoutError(
            f"{operation_name} did not complete within {timeout_seconds}s"
        )


# Global circuit breakers for external services
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

agent_circuit_breakers = {}  # Per-agent circuit breakers


def get_agent_circuit_breaker(agent_id: str) -> CircuitBreaker:
    """Get or create circuit breaker for an agent."""
    if agent_id not in agent_circuit_breakers:
        agent_circuit_breakers[agent_id] = CircuitBreaker(
            f"agent_{agent_id}",
            failure_threshold=3,
            recovery_timeout=30,
        )
    return agent_circuit_breakers[agent_id]
