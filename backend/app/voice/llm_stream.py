"""
Production-grade LLM & Transcription module for the Voice AI layer.

Uses LiteLLM for streaming (matching the rest of the backend — Gemini primary,
Groq fallback) instead of a raw Groq client. This gives:
- Consistent model routing with llm_gateway.py
- Automatic cross-provider fallback (Gemini → Groq)
- Retry + circuit breaker on stream creation
- Hard timeouts on transcription
- Structured JSON logging replacing print() statements
- Health check endpoint for monitoring
"""

import io
import os
import wave
from typing import AsyncGenerator

import litellm
from dotenv import load_dotenv
from groq import AsyncGroq

from app.voice.config import voice_config
from app.voice.logging_config import get_logger
from app.voice.resilience import RetryPolicy, groq_circuit_breaker, with_timeout

load_dotenv()

logger = get_logger(__name__)

# ── Model configuration ─────────────────────────────────────────────────────
# Primary: Gemini (fast, cheap, no rate issues)
# Fallback: Groq llama-3.3-70b-versatile (widely available on all Groq tiers)
_GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
_GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

_PRIMARY_MODEL = "gemini/gemini-3.5-flash-lite" if _GEMINI_API_KEY else "groq/llama-3.3-70b-versatile"
_FALLBACK_MODEL = "groq/llama-3.3-70b-versatile" if _GROQ_API_KEY and _GEMINI_API_KEY else None

# Groq client for Whisper transcription (audio-specific, Gemini doesn't do STT)
_groq_client = AsyncGroq(api_key=_GROQ_API_KEY) if _GROQ_API_KEY else None

# Shared retry policy for stream creation
_stream_retry = RetryPolicy(
    max_retries=voice_config.llm.max_retries,
    initial_delay=voice_config.llm.retry_delay_seconds,
    backoff_multiplier=voice_config.llm.retry_backoff_multiplier,
)


async def transcribe_audio(pcm_data: bytes, sample_rate: int = 16000) -> str:
    """
    Transcribe raw PCM audio via Groq Whisper with retry & circuit breaker.

    Args:
        pcm_data: Raw 16-bit PCM audio bytes.
        sample_rate: Sample rate in Hz (default 16000).

    Returns:
        Transcribed text or empty string on failure.
    """
    if not pcm_data or not _groq_client:
        return ""

    async def _transcribe():
        wav_io = io.BytesIO()
        try:
            with wave.open(wav_io, "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)  # 16-bit
                wf.setframerate(sample_rate)
                wf.writeframes(pcm_data)
        except Exception as e:
            logger.error("Failed to create in-memory WAV", error=str(e))
            raise

        wav_io.seek(0)

        logger.debug(
            "Sending audio to Whisper API",
            audio_bytes=len(pcm_data),
            duration_seconds=round(len(pcm_data) / (sample_rate * 2), 2),
        )

        transcription = await with_timeout(
            _groq_client.audio.transcriptions.create(
                file=("audio.wav", wav_io.read()),
                model=voice_config.llm.whisper_model,
                prompt="Industrial operations query in English or Hindi.",
                response_format="text",
            ),
            timeout_seconds=voice_config.llm.transcription_timeout_seconds,
            operation_name="whisper_transcription",
        )
        return str(transcription).strip()

    try:
        if not groq_circuit_breaker.is_available:
            logger.error("Groq circuit breaker OPEN — skipping transcription")
            return ""

        result = await _stream_retry.execute(
            _transcribe,
            operation_name="transcribe_audio",
        )
        logger.info("Transcription successful", text_length=len(result))
        return result

    except Exception as e:
        logger.error("Transcription failed after all retries", error=str(e))
        return ""


async def stream_llm_response(
    prompt: str,
    history: list = None,
    agent_context: str = "",
) -> AsyncGenerator[str, None]:
    """
    Stream an LLM response via LiteLLM (Gemini primary, Groq fallback).

    Uses the same model routing as llm_gateway.py for consistency.
    Separates stream *creation* (retryable coroutine) from stream *iteration*
    (async generator) so RetryPolicy works correctly.

    Args:
        prompt: The user's spoken query.
        history: Recent conversation history.
        agent_context: Ground-truth data returned by the agent router.

    Yields:
        Text chunks from the LLM response stream.
    """
    if history is None:
        history = []

    system_instruction = _build_system_prompt()

    user_content = prompt
    if agent_context:
        user_content = (
            f"{prompt}\n\n"
            f"[Agent Ground-Truth Database Insights]:\n{agent_context}\n\n"
            f"[Task]: Speak a 1-2 sentence spoken summary of this ground-truth data for the user."
        )

    messages = (
        [{"role": "system", "content": system_instruction}]
        + history
        + [{"role": "user", "content": user_content}]
    )

    # ── IMPORTANT: RetryPolicy.execute() only works on regular coroutines ──
    # ── NOT async generators. We retry only stream creation (a coroutine), ──
    # ── then iterate the returned stream object directly.                  ──

    async def _create_stream():
        """Coroutine: creates and returns the LiteLLM streaming response object."""
        logger.debug("Creating LLM stream", model=_PRIMARY_MODEL)

        # Temperature=1.0 for Gemini 3 (avoids infinite loop warning)
        # and is also fine for Groq LLaMA models
        return await litellm.acompletion(
            model=_PRIMARY_MODEL,
            messages=messages,
            temperature=1.0,
            max_tokens=voice_config.llm.llm_max_tokens,
            stream=True,
            timeout=voice_config.llm.request_timeout_seconds,
        )

    try:
        # Retry only the stream creation (safe — it's a regular coroutine)
        stream = await _stream_retry.execute(
            _create_stream,
            operation_name="llm_stream_create",
        )

        # If primary failed and we have a fallback, try it
        if stream is None and _FALLBACK_MODEL:
            logger.warning("Primary model failed, trying fallback", fallback=_FALLBACK_MODEL)

            async def _create_fallback_stream():
                return await litellm.acompletion(
                    model=_FALLBACK_MODEL,
                    messages=messages,
                    temperature=1.0,
                    max_tokens=voice_config.llm.llm_max_tokens,
                    stream=True,
                    timeout=voice_config.llm.request_timeout_seconds,
                )

            stream = await _stream_retry.execute(
                _create_fallback_stream,
                operation_name="llm_stream_fallback",
            )

        # Iterate the stream directly — no retry wrapping (streaming has started)
        chunks = 0
        async for chunk in stream:
            delta = chunk.choices[0].delta if chunk.choices else None
            if delta and delta.content:
                chunks += 1
                yield delta.content

        logger.info("LLM stream completed", chunks_yielded=chunks, model=_PRIMARY_MODEL)

    except Exception as e:
        logger.error("LLM streaming failed", error=str(e), model=_PRIMARY_MODEL)
        yield "Sir, I encountered an issue retrieving the live agent data. "
        yield "Please check your connection and try again."


def _build_system_prompt() -> str:
    """
    Build the voice assistant system prompt.
    Kept as a function so it can easily be overridden per deployment.
    """
    return (
        "You are Deva, the voice interaction layer for Industrial AI Agents "
        "(created by Moksh Bhardwaj). "
        "Your job is to speak operational answers directly to the user, "
        "addressing them respectfully as 'sir'.\n"
        "CRITICAL RULES FOR VOICE OUTPUT:\n"
        "1. MUST respond in the EXACT same language the user spoke in (English or Hindi).\n"
        "2. If responding in Hindi, YOU MUST USE DEVANAGARI SCRIPT "
        "(e.g., नमस्ते सर, आज २ सुरक्षा नियम उल्लंघन हुए हैं). "
        "NEVER use Latin/English alphabets for Hindi.\n"
        "3. Keep answers EXTREMELY short and natural for speech (1 to 2 spoken sentences maximum).\n"
        "4. Summarize key figures, alerts, or status numbers clearly. "
        "DO NOT use markdown, tables, bullet points, asterisks (*), hashtags, or parentheses, "
        "as this text will be read aloud by Text-to-Speech.\n"
        "5. Address the user respectfully as 'sir' or appropriate term in their language."
    )


async def check_groq_health() -> bool:
    """
    Lightweight health check for Groq API (used by monitoring endpoints).
    """
    if not _groq_client:
        return False
    try:
        await with_timeout(
            _groq_client.chat.completions.create(
                messages=[{"role": "user", "content": "ping"}],
                model="llama-3.3-70b-versatile",
                max_tokens=1,
            ),
            timeout_seconds=5.0,
            operation_name="groq_health_check",
        )
        logger.info("Groq API health check passed")
        return True
    except Exception as e:
        logger.error("Groq API health check failed", error=str(e))
        return False
