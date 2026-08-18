"""
Text-to-Speech streaming via Microsoft Edge TTS.
Voice names and timeouts are driven by voice_config.
TTS calls are wrapped with the edge_tts circuit breaker.
"""

import re
from typing import AsyncGenerator

import edge_tts

from app.voice.config import voice_config
from app.voice.logging_config import get_logger
from app.voice.resilience import edge_tts_circuit_breaker

logger = get_logger(__name__)


def is_hindi(text: str) -> bool:
    """Detect Devanagari script to auto-switch to the Hindi TTS voice."""
    return bool(re.search(r"[\u0900-\u097F]", text))


async def stream_tts(text: str) -> AsyncGenerator[bytes, None]:
    """
    Stream text to MP3 audio chunks via Edge TTS.
    Automatically selects English or Hindi voice based on script detection.
    Wrapped with circuit breaker to fail fast if Edge TTS is down.

    Args:
        text: The text to synthesize (plain text, no markdown).

    Yields:
        Raw audio bytes (MP3 chunks).
    """
    if not text.strip():
        return

    voice = voice_config.tts.hi_voice if is_hindi(text) else voice_config.tts.en_voice

    async def _tts_call():
        communicate = edge_tts.Communicate(text, voice)
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                yield chunk["data"]

    try:
        if not edge_tts_circuit_breaker.is_available:
            logger.error(
                "Edge TTS circuit breaker OPEN — skipping TTS",
                text_preview=text[:40],
            )
            return

        logger.debug(
            "Starting TTS synthesis",
            voice=voice,
            text_length=len(text),
        )

        async for audio_chunk in _tts_call():
            yield audio_chunk

    except Exception as e:
        logger.error("TTS streaming error", error=str(e), text_preview=text[:40])
