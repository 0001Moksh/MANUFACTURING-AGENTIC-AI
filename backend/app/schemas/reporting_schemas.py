from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class ManualTriggerRequest(BaseModel):
    shift_id: str = Field(..., description="Manufacturing shift identifier")
    approval_mode: Optional[str] = Field(default="AUTONOMOUS")


class ReportApprovalPayload(BaseModel):
    approved: bool = Field(..., description="Approval decision for the report")
    comments: Optional[str] = Field(default=None, description="Optional reviewer comments")


class ReportConfigurationPayload(BaseModel):
    report_frequency: str = Field(..., description="How often the report should be generated")
    target_distribution_list: list[str] = Field(..., description="Notification recipients")


def build_agent_metadata(
    tool_name: str,
    description: str,
    *,
    agent_accessible: bool,
    auto_register: bool,
) -> Dict[str, Any]:
    """Create standardized agent metadata for reporting endpoints."""
    return {
        "tool_name": tool_name,
        "description": description,
        "agent_accessible": agent_accessible,
        "auto_register": auto_register,
    }
