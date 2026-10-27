"""Shared input prompt-injection guardrail for portfolio agent runners."""

import logging
import math
import os
import re
import threading
from typing import Any

logger = logging.getLogger(__name__)

LANGKIT_INJECTION_THRESHOLD = float(
    os.getenv(
        "OPERATIONS_LANGKIT_INJECTION_THRESHOLD",
        os.getenv("LANGKIT_INJECTION_THRESHOLD", "0.70"),
    )
)
LANGKIT_JAILBREAK_THRESHOLD = float(
    os.getenv(
        "OPERATIONS_LANGKIT_JAILBREAK_THRESHOLD",
        os.getenv("LANGKIT_JAILBREAK_THRESHOLD", "0.65"),
    )
)

_PROMPT_INJECTION_PATTERNS = (
    re.compile(
        r"\bignore\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions|rules|prompts?)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:reveal|show|print|repeat|dump)\s+(?:the\s+)?(?:system|developer)\s+(?:prompt|message|instructions?)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:bypass|override|disable)\s+(?:the\s+)?(?:guardrails?|safety|security|restrictions?)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:act|behave)\s+as\s+(?:an?\s+)?(?:unrestricted|unfiltered|jailbroken)\b",
        re.IGNORECASE,
    ),
)

_load_lock = threading.Lock()
_load_attempted = False
_langkit_extract: Any = None
_langkit_injections: Any = None


def _ensure_langkit_loaded() -> bool:
    """Load LangKit lazily so agent startup and non-LangKit installs still work."""
    global _load_attempted, _langkit_extract, _langkit_injections
    if _load_attempted:
        return _langkit_extract is not None

    with _load_lock:
        if _load_attempted:
            return _langkit_extract is not None
        _load_attempted = True
        try:
            from langkit import extract, injections

            _langkit_extract = extract
            _langkit_injections = injections
            return True
        except Exception as exc:
            logger.warning("LangKit prompt-injection scoring is unavailable: %s", exc)
            return False


def _score_value(result: Any, *keys: str) -> float | None:
    for key in keys:
        try:
            getter = getattr(result, "get", None)
            value = getter(key) if callable(getter) else None
            if value is None:
                continue
            if hasattr(value, "iloc"):
                value = value.iloc[0]
            elif isinstance(value, (list, tuple)):
                value = value[0]
            score = float(value)
            return score if math.isfinite(score) else None
        except (TypeError, ValueError, IndexError, KeyError):
            continue
    return None


def check_prompt_injection(message: str) -> tuple[bool, str, dict[str, Any]]:
    """Return ``(blocked, reason, details)`` for one user-supplied prompt.

    Deterministic lexical patterns always run first and remain available if
    LangKit or its models cannot load. LangKit injection/jailbreak similarity
    scores are interpreted as risk scores: a score at or above the configured
    threshold blocks. If scoring is unavailable or errors, the lexical fallback
    remains active and otherwise fails open, matching the Operations Agent.
    """
    if any(pattern.search(message) for pattern in _PROMPT_INJECTION_PATTERNS):
        return True, "deterministic_prompt_injection", {}

    if not _ensure_langkit_loaded() or _langkit_extract is None:
        return False, "", {"langkit_scores": {"injection": None, "jailbreak": None}}

    try:
        result = _langkit_extract({"prompt": message})
        injection = _score_value(result, "prompt.injection", "injection")
        jailbreak = _score_value(
            result,
            "prompt.jailbreak_similarity",
            "jailbreak_similarity",
        )
    except Exception as exc:
        logger.warning("LangKit prompt-injection scoring failed: %s", exc)
        injection = jailbreak = None

    details = {
        "langkit_scores": {
            "injection": round(injection, 4) if injection is not None else None,
            "jailbreak": round(jailbreak, 4) if jailbreak is not None else None,
        }
    }
    if injection is not None and injection >= LANGKIT_INJECTION_THRESHOLD:
        return True, "langkit_prompt_injection", details
    if jailbreak is not None and jailbreak >= LANGKIT_JAILBREAK_THRESHOLD:
        return True, "langkit_jailbreak", details
    return False, "", details


def blocked_prompt_response(
    agent_name: str,
    reason: str,
    details: dict[str, Any] | None = None,
    thread_id: str | None = None,
) -> dict[str, Any]:
    """Build a consistent blocked response without marking it successful."""
    response: dict[str, Any] = {
        "status": "blocked",
        "reason": reason,
        "reply": (
            f"Your message was blocked by the {agent_name} security guardrail "
            "because it appears to contain a prompt-injection or jailbreak attempt. "
            "Ask a normal question relevant to this agent instead."
        ),
        "guardrail": {"stage": "input", "reason": reason, **(details or {})},
    }
    if thread_id:
        response["thread_id"] = thread_id
    return response
