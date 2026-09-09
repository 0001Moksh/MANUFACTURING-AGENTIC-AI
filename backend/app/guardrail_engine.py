import logging
from typing import Dict, Any, List, Tuple
from sqlalchemy import select
from app.db import AsyncSessionLocal, GuardrailPolicy, GlobalGovernanceSettings

logger = logging.getLogger("guardrail_engine")

class GuardrailEngine:
    """
    Central Decoupled Policy Evaluation Engine.
    Evaluates dynamic guardrail policies against execution context payloads:
    context = {
        'use_case': 'daily_operations_reporting',
        'workflow': 'daily_report_generation',
        'agent': 'Reporting Agent',
        'step': 'execute_sql',
        'action': 'dispatch_report',
        'user_role': 'Super Admin',
        'input_data': {'query': '...', 'risk_score': 0.8}
    }
    """
    
    @staticmethod
    async def evaluate_context(context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluates active guardrail policies matching scope and conditions.
        Returns evaluation result dictionary:
        {
            'allowed': bool,
            'action': 'Allow' | 'Require HITL' | 'Block' | 'Redact' | 'Escalate',
            'matched_policies': List[Dict],
            'reason': str,
            'fail_mode': 'Fail Closed' | 'Fail Open'
        }
        """
        async with AsyncSessionLocal() as session:
            # 1. Check Global Master Switch override
            global_hitl = (await session.execute(
                select(GlobalGovernanceSettings).where(GlobalGovernanceSettings.setting_key == "hitl_approval")
            )).scalars().first()
            global_kill = (await session.execute(
                select(GlobalGovernanceSettings).where(GlobalGovernanceSettings.setting_key == "global_kill_switch")
            )).scalars().first()

            if global_kill and not global_kill.is_enabled:
                return {
                    "allowed": False,
                    "action": "Block",
                    "matched_policies": [],
                    "reason": "Global Kill Switch is OFF. All agent operations are suspended.",
                    "fail_mode": "Fail Closed"
                }

            # 2. Query active enabled guardrail policies ordered by priority
            policies = (await session.execute(
                select(GuardrailPolicy)
                .where(GuardrailPolicy.is_enabled == True)
                .where(GuardrailPolicy.status == "Active")
            )).scalars().all()

            # Define priority weight
            priority_order = {"Critical": 4, "High": 3, "Medium": 2, "Low": 1}
            sorted_policies = sorted(
                policies, 
                key=lambda p: priority_order.get(p.priority, 0), 
                reverse=True
            )

            matched_policies = []
            final_action = "Allow"
            reasons = []

            for policy in sorted_policies:
                if GuardrailEngine._matches_scope(policy, context):
                    if GuardrailEngine._matches_conditions(policy, context):
                        matched_policies.append({
                            "id": policy.id,
                            "name": policy.name,
                            "type": policy.type,
                            "priority": policy.priority,
                            "version": policy.version
                        })

                        behavior = policy.execution_behavior or {}
                        policy_action = behavior.get("action", "Allow")
                        
                        # Priority action escalation
                        if policy_action == "Block":
                            final_action = "Block"
                            reasons.append(f"Blocked by policy '{policy.name}'")
                            break # Critical block terminates immediately
                        elif policy_action == "Require HITL" and final_action != "Block":
                            # Check if global HITL master switch enables local HITL enforcement
                            if global_hitl and global_hitl.is_enabled:
                                final_action = "Require HITL"
                                reasons.append(f"HITL required by policy '{policy.name}'")
                            else:
                                reasons.append(f"Policy '{policy.name}' requested HITL but Global HITL master switch is OFF")
                        elif policy_action == "Redact" and final_action not in ["Block", "Require HITL"]:
                            final_action = "Redact"
                            reasons.append(f"Data redaction triggered by policy '{policy.name}'")

            is_allowed = final_action in ["Allow", "Redact"]
            
            return {
                "allowed": is_allowed,
                "action": final_action,
                "matched_policies": matched_policies,
                "reason": " | ".join(reasons) if reasons else "All guardrail policy checks passed.",
                "global_hitl_enabled": bool(global_hitl and global_hitl.is_enabled)
            }

    @staticmethod
    def _matches_scope(policy: GuardrailPolicy, context: Dict[str, Any]) -> bool:
        """Determines if context matches the policy scope criteria."""
        scope_type = policy.scope_type
        target = (policy.scope_target or "*").strip()

        if scope_type == "Global" or target == "*":
            return True
        elif scope_type == "UseCase":
            return context.get("use_case") == target
        elif scope_type == "Workflow":
            return context.get("workflow") == target
        elif scope_type == "Agent":
            return context.get("agent") == target
        elif scope_type == "Action":
            return context.get("action") == target
        elif scope_type == "Role":
            return context.get("user_role") == target
        return False

    @staticmethod
    def _matches_conditions(policy: GuardrailPolicy, context: Dict[str, Any]) -> bool:
        """Evaluates dynamic triggers and conditions against context payload."""
        trig_cond = policy.triggers_conditions or {}
        conditions = trig_cond.get("conditions", [])
        if not conditions:
            return True # Trigger fires on scope match if no extra conditions specified

        input_data = context.get("input_data", {})
        
        # All conditions must pass (AND combination)
        for cond in conditions:
            field = cond.get("field")
            operator = cond.get("operator", "==")
            target_val = str(cond.get("value", "")).lower()

            val = str(input_data.get(field, context.get(field, ""))).lower()

            if operator in ["==", "equals"]:
                if val != target_val: return False
            elif operator in ["!=", "not_equals"]:
                if val == target_val: return False
            elif operator in ["contains"]:
                keywords = [k.strip() for k in target_val.split(",") if k.strip()]
                if not any(k in val for k in keywords): return False
            elif operator in [">=", ">", "<=", "<"]:
                try:
                    num_val = float(val)
                    num_target = float(target_val)
                    if operator == ">=" and not (num_val >= num_target): return False
                    if operator == ">" and not (num_val > num_target): return False
                    if operator == "<=" and not (num_val <= num_target): return False
                    if operator == "<" and not (num_val < num_target): return False
                except ValueError:
                    return False
        return True
