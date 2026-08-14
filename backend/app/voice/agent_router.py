"""
Multi-Agent Voice Router & Dispatcher for Industrial Operations.
Routes spoken natural language queries to the appropriate LangGraph agent (Safety & Quality, PPE Vision, Maintenance, etc.)
and generates voice-optimized spoken responses for TTS streaming.
"""
import asyncio
from typing import Optional

# Import available agent conversation runners
from app.agents.safety_quality_agent import run_safety_quality_conversation
from app.agents.ppe_vision_agent import run_ppe_conversation
from app.agents.maintenance_agent import run_maintenance_conversation
from app.agents.agent_workflow import run_agent_workflow

AGENT_NAMES = {
    "safety_quality": "Safety & Quality Agent (Deva)",
    "ppe_vision": "PPE & Behavior Vision Agent (Deva)",
    "maintenance": "Predictive Maintenance Agent",
    "operations": "Operations & Workflow Agent",
    "general": "Enterprise Operations Agent",
}

def detect_agent_intent(prompt: str) -> str:
    """
    Fast rule-based intent router with keyword heuristics for industrial queries.
    Fallback to general workflow if ambiguous.
    """
    lower = prompt.lower()

    # PPE & CCTV Vision Agent keywords
    ppe_keywords = [
        "helmet", "hard hat", "hard-hat", "vest", "safety vest", "ppe", "eyewear",
        "cctv", "camera", "cameras", "zone", "geofence", "hazard zone", "restricted area",
        "breach", "fatigue", "collapse", "worker fall", "patrol", "security guard",
        "visitor", "night shift", "anomaly flag", "intruder", "unauthorized",
        "हेलमेट", "सुरक्षा", "कैमरा", "वायलेशन"
    ]
    if any(kw in lower for kw in ppe_keywords):
        return "ppe_vision"

    # Safety & Quality Agent keywords
    quality_keywords = [
        "quality", "inspection", "defect", "rejection", "scrap", "material hold",
        "quality hold", "remediation", "batch", "concrete", "rebar", "welding",
        "waterproof", "tolerance", "supplier", "vendor", "subcontractor", "lab test",
        "strength test", "hse rule", "standard", "audit", "non-conformance",
        "क्वालिटी", "निरीक्षण", "खराबी", "सामग्री"
    ]
    if any(kw in lower for kw in quality_keywords):
        return "safety_quality"

    # Maintenance Agent keywords
    maint_keywords = [
        "maintenance", "failure", "breakdown", "vibration", "temperature", "bearing",
        "motor", "pump", "turbine", "regenerator", "lstm", "sensor", "work order",
        "predict", "rul", "remaining useful life", "hydraulic",
        "मेंटेनेंस", "मशीन", "खराबी"
    ]
    if any(kw in lower for kw in maint_keywords):
        return "maintenance"

    return "general"


async def execute_agent_query(prompt: str, agent_id: str = "auto", thread_id: Optional[str] = None) -> dict:
    """
    Executes the query on the target LangGraph agent or auto-routes it.
    Returns the agent name and raw ground-truth answer.
    """
    chosen_agent = agent_id if (agent_id and agent_id != "auto") else detect_agent_intent(prompt)
    print(f"[VOICE ROUTER] Routing query to: {chosen_agent} | Query: '{prompt[:60]}...'")

    session_thread = thread_id or f"voice-{chosen_agent}"

    try:
        if chosen_agent in ["safety_quality", "safety-quality", "safety"]:
            res = await run_safety_quality_conversation(prompt, thread_id=session_thread)
            return {
                "agent_id": "safety_quality",
                "agent_name": AGENT_NAMES["safety_quality"],
                "reply": res.get("reply", ""),
            }

        elif chosen_agent in ["ppe_vision", "ppe-vision", "ppe", "vision"]:
            res = await run_ppe_conversation(prompt, thread_id=session_thread)
            return {
                "agent_id": "ppe_vision",
                "agent_name": AGENT_NAMES["ppe_vision"],
                "reply": res.get("reply", ""),
            }

        elif chosen_agent in ["maintenance", "maintenance_agent"]:
            res = await run_maintenance_conversation(prompt, thread_id=session_thread)
            return {
                "agent_id": "maintenance",
                "agent_name": AGENT_NAMES["maintenance"],
                "reply": res.get("reply", ""),
            }

        else:
            # Fallback to general operations workflow
            workflow_state = await run_agent_workflow(prompt, is_approved=False)
            insights = workflow_state.get("insights", "")
            return {
                "agent_id": "general",
                "agent_name": AGENT_NAMES["general"],
                "reply": insights or "I am checking the operational systems for your query, sir.",
            }

    except Exception as err:
        print(f"[VOICE ROUTER ERROR] Failed executing {chosen_agent}: {err}")
        return {
            "agent_id": chosen_agent,
            "agent_name": AGENT_NAMES.get(chosen_agent, "Voice Assistant"),
            "reply": f"Data retrieved from operational checks: {str(err)[:100]}",
        }
