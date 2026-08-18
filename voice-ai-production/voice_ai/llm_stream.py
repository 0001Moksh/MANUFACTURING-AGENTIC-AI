"""
Production-grade LLM & Transcription module with:
- Retry logic with exponential backoff
- Circuit breaker pattern for cascading failure prevention
- Proper timeout handling
- Request tracing and error recovery
"""

import os
import io
import wave
from typing import AsyncGenerator
from groq import AsyncGroq
from dotenv import load_dotenv

from config import config
from logging_config import get_logger
from resilience import (
    RetryPolicy,
    groq_circuit_breaker,
    with_timeout,
)

load_dotenv()

logger = get_logger(__name__)

# Initialize Groq client
client = AsyncGroq(api_key=config.llm.groq_api_key)

# Retry policy for transient failures
transcription_retry_policy = RetryPolicy(
    max_retries=config.llm.max_retries,
    initial_delay=config.llm.retry_delay_seconds,
    backoff_multiplier=config.llm.retry_backoff_multiplier,
)

llm_retry_policy = RetryPolicy(
    max_retries=config.llm.max_retries,
    initial_delay=config.llm.retry_delay_seconds,
    backoff_multiplier=config.llm.retry_backoff_multiplier,
)


async def transcribe_audio(pcm_data: bytes, sample_rate: int = 16000) -> str:
    """
    Transcribe PCM audio with retry logic and circuit breaker protection.

    Args:
        pcm_data: Raw PCM audio bytes (16-bit)
        sample_rate: Sample rate in Hz (default 16000)

    Returns:
        Transcribed text or empty string on failure

    Raises:
        Exception: If all retries exhausted and circuit breaker open
    """
    if not pcm_data:
        return ""

    async def _transcribe():
        """Inner function for retry logic."""
        # Create in-memory WAV file
        wav_io = io.BytesIO()
        try:
            with wave.open(wav_io, "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)  # 16-bit
                wf.setframerate(sample_rate)
                wf.writeframes(pcm_data)
        except Exception as e:
            logger.error(f"Failed to create WAV file: {str(e)}")
            raise

        wav_io.seek(0)

        logger.debug(
            "Sending audio to Whisper API",
            audio_size=len(pcm_data),
            duration_seconds=len(pcm_data) / (sample_rate * 2),
        )

        # Call Groq Whisper API with timeout
        transcription = await with_timeout(
            client.audio.transcriptions.create(
                file=("audio.wav", wav_io.read()),
                model=config.llm.whisper_model,
                prompt="Specify context if needed.",
                response_format="text",
            ),
            timeout_seconds=config.llm.transcription_timeout_seconds,
            operation_name="whisper_transcription",
        )

        return str(transcription).strip()

    try:
        # Circuit breaker check
        if not groq_circuit_breaker.is_available:
            logger.error(
                "Groq circuit breaker is OPEN; rejecting transcription request"
            )
            return ""

        # Execute with retries
        result = await transcription_retry_policy.execute(
            _transcribe,
            operation_name="transcribe_audio",
        )

        logger.info("Transcription successful", text_length=len(result))
        return result

    except Exception as e:
        logger.error(f"Transcription failed after retries: {str(e)}")
        return ""


async def stream_llm_response(
    prompt: str,
    history: list = None,
    agent_context: str = "",
) -> AsyncGenerator[str, None]:
    """
    Stream LLM response with retry logic, timeout, and circuit breaker.

    Args:
        prompt: User's query
        history: Conversation history (list of {"role": str, "content": str})
        agent_context: Database insights from agent router

    Yields:
        Text chunks from LLM response

    Raises:
        Exception: On circuit breaker open or permanent failures
    """
    if history is None:
        history = []

    # Build system prompt (configurable)
    system_instruction = _build_system_prompt()

    # Build user content with agent context
    user_content = prompt
    if agent_context:
        user_content = (
            f"{prompt}\n\n"
            f"[Agent Ground-Truth Database Insights]:\n{agent_context}\n\n"
            f"[Task]: Speak a 1-2 sentence spoken summary of this ground-truth data for the user."
        )

    messages = [{"role": "system", "content": system_instruction}] + history + [
        {"role": "user", "content": user_content}
    ]

    async def _stream_response():
        """Inner function for retry logic."""
        logger.debug("Starting LLM stream", model=config.llm.llm_model)

        stream = await with_timeout(
            client.chat.completions.create(
                messages=messages,
                model=config.llm.llm_model,
                temperature=config.llm.llm_temperature,
                max_tokens=config.llm.llm_max_tokens,
                stream=True,
            ),
            timeout_seconds=config.llm.request_timeout_seconds,
            operation_name="llm_stream_create",
        )

        chunks_yielded = 0
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                content = chunk.choices[0].delta.content
                chunks_yielded += 1
                yield content

        logger.info("LLM stream completed", chunks_yielded=chunks_yielded)

    try:
        # Circuit breaker check
        if not groq_circuit_breaker.is_available:
            logger.error("Groq circuit breaker is OPEN; using fallback response")
            yield "Sir, I'm experiencing service issues. Please try again in a moment."
            return

        # Execute with retries
        async for chunk in llm_retry_policy.execute(
            _stream_response,
            operation_name="stream_llm_response",
        ):
            yield chunk

    except Exception as e:
        logger.error(f"LLM streaming failed: {str(e)}")
        # Fallback response
        yield "Sir, I encountered an issue retrieving the live agent data. "
        yield "Please check your connection and try again."


def _build_system_prompt() -> str:
    """
    Build system prompt from config (allows per-deployment customization).
    Supports multiple languages.
    """
    return (
        "You are Deva, a voice interaction assistant for Industrial AI Operations. "
        "CRITICAL RULES FOR VOICE OUTPUT:\n"
        "1. MUST respond in the EXACT same language the user spoke in (English or Hindi).\n"
        "2. If responding in Hindi, YOU MUST USE DEVANAGARI SCRIPT (e.g., नमस्ते सर, आज २ सुरक्षा नियम उल्लंघन हुए हैं). "
        "NEVER use Latin/English alphabets for Hindi.\n"
        "3. Keep answers EXTREMELY short and natural for speech (1 to 2 spoken sentences maximum).\n"
        "4. Summarize key figures, alerts, or status numbers clearly. "
        "DO NOT use markdown, tables, bullet points, asterisks (*), hashtags, or parentheses, "
        "as this text will be read aloud by Text-to-Speech.\n"
        "5. Address the user respectfully as 'sir' or appropriate term in their language."
    )


# Health check function for monitoring
async def check_groq_health() -> bool:
    """
    Perform a simple health check on Groq API.
    Useful for monitoring and circuit breaker status.
    """
    try:
        # Try a minimal completion to check API health
        await with_timeout(
            client.chat.completions.create(
                messages=[{"role": "user", "content": "ping"}],
                model=config.llm.llm_model,
                max_tokens=1,
            ),
            timeout_seconds=5.0,
            operation_name="groq_health_check",
        )
        logger.info("Groq API health check passed")
        return True
    except Exception as e:
        logger.error(f"Groq API health check failed: {str(e)}")
        return False
