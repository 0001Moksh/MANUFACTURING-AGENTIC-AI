import os
import logging
from typing import List, Dict, Any
import litellm

# Configure litellm logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("llm_gateway")

# Ensure API keys are loaded
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# Provider cost dictionary for usage tracking
MODEL_COSTS = {
    "gemini/gemini-3.5-flash-lite": {"input": 0.000000075, "output": 0.0000003},
    "groq/llama-3.3-70b-versatile": {"input": 0.00000059, "output": 0.00000079},
}

# Audit log in memory for tracking costs during runtime
usage_audit_log: List[Dict[str, Any]] = []

async def execute_completion(
    messages: List[Dict[str, str]],
    model: str = "gemini/gemini-3.5-flash-lite",
    temperature: float = 0.2,
    response_format: Any = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Executes completion using litellm with automated fallbacks and cost tracking.
    Models supported:
      - gemini-3.5-flash-lite / gemini/gemini-3.5-flash-lite  -> gemini/gemini-3.5-flash-lite
      - groq/llama-3.3-70b-versatile                -> groq/llama-3.3-70b-versatile
    """
    has_gemini = bool(os.getenv("GEMINI_API_KEY", "").strip())
    has_groq = bool(os.getenv("GROQ_API_KEY", "").strip())

    if not (has_gemini or has_groq):
        message = "No LLM provider API key is configured. No generated response is available."
        logger.error(message)
        return {"text": "", "model_used": None, "usage": {}, "cost_usd": 0.0, "error": message}

    # Normalize model names to correct litellm provider strings
    model_lower = model.lower().strip()
    if "gemini" in model_lower:
        model = "gemini/gemini-3.5-flash-lite"
    elif "llama-3.3-70b" in model_lower or model_lower == "groq/llama-3.3-70b-versatile":
        model = "groq/llama-3.3-70b-versatile"
    else:
        # Default to gemini if key available, otherwise groq
        model = "gemini/gemini-3.5-flash-lite" if has_gemini else "groq/llama-3.3-70b-versatile"

    # Build fallback list — always cross-provider
    fallbacks = []
    if model == "gemini/gemini-3.5-flash-lite" and has_groq:
        fallbacks = ["groq/llama-3.3-70b-versatile"]
    elif model == "groq/llama-3.3-70b-versatile" and has_gemini:
        fallbacks = ["gemini/gemini-3.5-flash-lite"]

    litellm.success_callback = []
    litellm.failure_callback = []

    logger.info(f"Calling LLM: model={model}, fallbacks={fallbacks}")

    try:
        models_to_try = [model] + fallbacks
        response = None
        last_err = None
        
        for current_model in models_to_try:
            try:
                response = await litellm.acompletion(
                    model=current_model,
                    messages=messages,
                    temperature=temperature,
                    timeout=5.0,
                    **kwargs
                )
                break
            except Exception as e:
                last_err = e
                # Suppress the stack trace; just log a clean warning
                logger.warning(f"Model {current_model} failed (e.g. Rate Limit). Attempting fallback if available...")
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
            "cost_usd": total_cost
        }

    except Exception as e:
        logger.error(f"LiteLLM completion failed for model {model} and all fallbacks: {e}")
        usage_audit_log.append({
            "model": model,
            "error": str(e),
            "status": "failed",
            "estimated_cost_usd": 0.0
        })
        return {"text": "", "model_used": None, "usage": {}, "cost_usd": 0.0, "error": str(e)}

def get_usage_audit() -> List[Dict[str, Any]]:
    """Returns log of LLM usage for ROI tracking."""
    return usage_audit_log
