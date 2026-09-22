import os
import logging
from typing import List, Dict, Any
from dotenv import load_dotenv
import litellm

# Configure litellm logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("llm_gateway")

load_dotenv()

DEFAULT_GEMINI_MODEL = "gemini/gemini-3.8-flash"
DEFAULT_GROQ_MODEL = "groq/openai/gpt-oss-20b"


def _resolve_model_names() -> tuple[str, str]:
    """Refresh model names from the live environment and fall back to supported defaults."""
    load_dotenv()
    gemini_model = (os.getenv("GEMINI_MODEL") or DEFAULT_GEMINI_MODEL).strip()
    groq_model = (os.getenv("GROQ_MODEL") or DEFAULT_GROQ_MODEL).strip()

    if "gemini" not in gemini_model.lower():
        gemini_model = DEFAULT_GEMINI_MODEL
    if "groq" not in groq_model.lower():
        groq_model = DEFAULT_GROQ_MODEL

    return gemini_model, groq_model


GEMINI_MODEL, GROQ_MODEL = _resolve_model_names()

# Provider cost dictionary for usage tracking
MODEL_COSTS = {
    "gemini/gemini-3.8-flash": {"input": 0.0000003, "output": 0.0000025},
    "groq/openai/gpt-oss-20b": {"input": 0.00000005, "output": 0.00000008},
}

# Audit log in memory for tracking costs during runtime
usage_audit_log: List[Dict[str, Any]] = []


def _json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    model_dump = getattr(value, "model_dump", None)
    if callable(model_dump):
        return _json_safe(model_dump())
    to_dict = getattr(value, "to_dict", None)
    if callable(to_dict):
        return _json_safe(to_dict())
    return str(value)

async def execute_completion(
    messages: List[Dict[str, str]],
    model: str = "auto",
    temperature: float = 0.2,
    response_format: Any = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Executes completion using litellm with automated fallbacks and cost tracking.
    Models supported:
    - Gemini and Groq only. OpenAI is not required.
    """
    has_gemini = bool(os.getenv("GEMINI_API_KEY", "").strip())
    has_groq = bool(os.getenv("GROQ_API_KEY", "").strip())

    if not (has_gemini or has_groq):
        message = "No LLM provider API key is configured. No generated response is available."
        logger.error(message)
        return {"text": "", "model_used": None, "usage": {}, "cost_usd": 0.0, "error": message, "llm_trace": {"request": {"model": model, "messages": _json_safe(messages), "parameters": {"temperature": temperature, "response_format": response_format, **kwargs}}, "response": {"text": "", "error": message}}}

    current_gemini_model, current_groq_model = _resolve_model_names()

    # Normalize model names to correct litellm provider strings
    model_lower = model.lower().strip()
    if model_lower in {"", "auto"}:
        model = current_gemini_model if has_gemini else current_groq_model
    elif "gemini" in model_lower:
        model = current_gemini_model
    elif "llama" in model_lower or "groq" in model_lower:
        model = current_groq_model
    else:
        model = current_gemini_model if has_gemini else current_groq_model

    # Build fallback list — always cross-provider
    fallbacks = []
    if model == current_gemini_model and has_groq:
        fallbacks = [current_groq_model]
    elif model == current_groq_model and has_gemini:
        fallbacks = [current_gemini_model]

    litellm.success_callback = []
    litellm.failure_callback = []

    logger.info(f"Calling LLM: model={model}, fallbacks={fallbacks}")

    try:
        models_to_try = [model] + fallbacks
        response = None
        last_err = None
        request_parameters = {
            "temperature": temperature,
            "timeout": float(os.getenv("LLM_TIMEOUT", "30")),
            **kwargs,
        }
        if response_format is not None:
            request_parameters["response_format"] = response_format
        
        for current_model in models_to_try:
            try:
                response = await litellm.acompletion(
                    model=current_model,
                    messages=messages,
                    **request_parameters,
                )
                break
            except Exception as e:
                last_err = e
                # Suppress the stack trace; just log a clean warning
                logger.warning("LLM model %s failed; attempting configured fallback", current_model)
                continue
                
        if not response:
            logger.error("All fallback models failed.")
            raise last_err

        model_used = response.get("model", model)
        usage = response.get("usage", {})
        prompt_tokens = usage.get("prompt_tokens", 0)
        completion_tokens = usage.get("completion_tokens", 0)

        cost_rates = MODEL_COSTS.get(model_used, {"input": 0.0, "output": 0.0})
        total_cost = (prompt_tokens * cost_rates["input"]) + (completion_tokens * cost_rates["output"])

        audit_entry = {
            "model": model_used,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "estimated_cost_usd": total_cost,
            "status": "success"
        }
        usage_audit_log.append(audit_entry)
        logger.info(f"LLM call succeeded: model={model_used}, tokens={prompt_tokens}+{completion_tokens}, cost=${total_cost:.6f}")

        return {
            "text": response.choices[0].message.content,
            "model_used": model_used,
            "usage": usage,
            "cost_usd": total_cost,
            "llm_trace": {
                "request": {"model": model_used, "messages": _json_safe(messages), "parameters": _json_safe(request_parameters)},
                "response": _json_safe(response),
            },
        }

    except Exception as e:
        logger.error("No LLM response generated after configured Gemini/Groq attempts: %s", e)
        usage_audit_log.append({
            "model": model,
            "error": str(e),
            "status": "failed",
            "estimated_cost_usd": 0.0
        })
        return {"text": "", "model_used": None, "usage": {}, "cost_usd": 0.0, "error": str(e), "llm_trace": {"request": {"model": model, "messages": _json_safe(messages), "parameters": _json_safe(locals().get("request_parameters", {"temperature": temperature, "timeout": float(os.getenv("LLM_TIMEOUT", "30")), **kwargs, **({"response_format": response_format} if response_format is not None else {})}))}, "response": {"text": "", "error": str(e)}}}

def get_usage_audit() -> List[Dict[str, Any]]:
    """Returns log of LLM usage for ROI tracking."""
    return usage_audit_log
