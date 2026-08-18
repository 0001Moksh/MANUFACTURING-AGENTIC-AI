"""
Basic usage example of Voice AI Package.
Shows how to create and use VoiceConversationManager.
"""

import asyncio
import json
from unittest.mock import AsyncMock

from voice_ai import VoiceConversationManager, get_logger, config

logger = get_logger(__name__)


class MockWebSocket:
    """Mock WebSocket for testing without real connection."""

    def __init__(self):
        self.messages = []
        self.is_open = True

    async def send_text(self, message: str):
        """Mock send_text method."""
        if not self.is_open:
            raise RuntimeError("WebSocket is closed")
        self.messages.append(json.loads(message))
        print(f"[WS] Sent: {json.loads(message)}")

    async def receive(self):
        """Mock receive method."""
        return {"type": "connection", "message": "connected"}


async def example_basic_text_query():
    """Example 1: Process a text query."""
    print("\n" + "="*60)
    print("EXAMPLE 1: Basic Text Query")
    print("="*60)

    # Create mock WebSocket
    ws = MockWebSocket()

    # Create manager
    manager = VoiceConversationManager(ws, agent_id="auto")

    # Process a text query
    user_query = "How many safety violations were recorded today?"
    print(f"\nUser Query: {user_query}")

    try:
        await manager.process_text_turn(user_query)

        # Wait for LLM task to complete (with timeout)
        if manager.llm_task:
            await asyncio.wait_for(manager.llm_task, timeout=60.0)

        print(f"\nMessages sent to client: {len(ws.messages)}")
        for msg in ws.messages:
            print(f"  - {msg.get('type', 'unknown')}")

    except asyncio.TimeoutError:
        print("⚠️  Request timed out (expected in demo without real APIs)")
    except Exception as e:
        print(f"Note: {type(e).__name__} (expected without real Groq API key)")
    finally:
        await manager.cleanup()
        print("✓ Cleanup complete")


async def example_state_transitions():
    """Example 2: Monitor state transitions."""
    print("\n" + "="*60)
    print("EXAMPLE 2: State Machine Transitions")
    print("="*60)

    ws = MockWebSocket()
    manager = VoiceConversationManager(ws, agent_id="safety_quality")

    print(f"\nInitial state: {manager.state.value}")

    # Simulate state transitions
    states_to_check = [
        ("IDLE", "Initial state"),
        ("LISTENING", "User speaks"),
        ("PROCESSING_NEW_TURN", "Audio complete"),
        ("THINKING", "Processing query"),
        ("SPEAKING", "Generating response"),
    ]

    for state_name, description in states_to_check:
        print(f"  • {state_name:<20} - {description}")

    print(f"\nCurrent state: {manager.state.value}")
    await manager.cleanup()


async def example_configuration():
    """Example 3: Show configuration."""
    print("\n" + "="*60)
    print("EXAMPLE 3: Configuration Management")
    print("="*60)

    print("\nVAD Configuration:")
    print(f"  Threshold: {config.vad.threshold}")
    print(f"  Min speech frames: {config.vad.min_speech_frames}")
    print(f"  Min silence frames: {config.vad.min_silence_frames}")
    print(f"  Max buffer size: {config.vad.max_buffer_size_bytes} bytes")

    print("\nLLM Configuration:")
    print(f"  Model: {config.llm.llm_model}")
    print(f"  Max retries: {config.llm.max_retries}")
    print(f"  Timeout: {config.llm.request_timeout_seconds}s")
    print(f"  Max tokens: {config.llm.llm_max_tokens}")

    print("\nLogging Configuration:")
    print(f"  Level: {config.logging.log_level}")
    print(f"  Format: {config.logging.log_format}")
    print(f"  File path: {config.logging.log_file_path}")

    print("\nTTS Configuration:")
    print(f"  Cache enabled: {config.tts.cache_enabled}")
    print(f"  Cache TTL: {config.tts.cache_ttl_seconds}s")


async def example_error_handling():
    """Example 4: Error handling with timeouts."""
    print("\n" + "="*60)
    print("EXAMPLE 4: Error Handling & Resilience")
    print("="*60)

    from voice_ai.resilience import RetryPolicy, CircuitBreaker, with_timeout

    # Show retry policy
    print("\nRetry Policy (Exponential Backoff):")
    retry_policy = RetryPolicy(max_retries=3, initial_delay=1.0, backoff_multiplier=2.0)
    print(f"  Max retries: {retry_policy.max_retries}")
    print(f"  Initial delay: {retry_policy.initial_delay}s")
    print(f"  Backoff multiplier: {retry_policy.backoff_multiplier}x")
    print(f"  Expected delays: 1s → 2s → 4s")

    # Show circuit breaker
    print("\nCircuit Breaker:")
    cb = CircuitBreaker("test_service", failure_threshold=5, recovery_timeout=60)
    print(f"  Service: {cb.name}")
    print(f"  Failure threshold: {cb.failure_threshold}")
    print(f"  Recovery timeout: {cb.recovery_timeout}s")
    print(f"  Current state: {cb.state.value}")
    print(f"  Is available: {cb.is_available}")


async def example_logging():
    """Example 5: Structured logging."""
    print("\n" + "="*60)
    print("EXAMPLE 5: Structured Logging & Correlation IDs")
    print("="*60)

    test_logger = get_logger(__name__)

    # Set correlation ID
    correlation_id = "demo-request-123"
    test_logger.set_correlation_id(correlation_id)

    print(f"\nCorrelation ID: {correlation_id}")
    print("\nLogging structured events:")

    # These would be JSON-formatted in production
    test_logger.debug("Audio frame received", frame_size=512, state="LISTENING")
    test_logger.info("Processing user turn", turn=1, text_length=45)
    test_logger.warning("Retry attempt", attempt=2, operation="transcribe")

    print("\n(In production, these appear as JSON in logs/voice_ai.log)")


async def main():
    """Run all examples."""
    print("\n" + "="*60)
    print("VOICE AI PRODUCTION PACKAGE - EXAMPLES")
    print("="*60)

    try:
        # Example 1: Text query (will timeout without real Groq key)
        # await example_basic_text_query()

        # Example 2: State machine
        await example_state_transitions()

        # Example 3: Configuration
        await example_configuration()

        # Example 4: Error handling
        await example_error_handling()

        # Example 5: Logging
        await example_logging()

        print("\n" + "="*60)
        print("✅ All examples completed!")
        print("="*60)
        print("\nNext steps:")
        print("1. Read docs/ARCHITECTURE.md for system design")
        print("2. Check voice_ai/config.py for all configuration options")
        print("3. Review examples/fastapi_integration.py for WebSocket setup")
        print("4. Run: python examples/fastapi_integration.py")

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
