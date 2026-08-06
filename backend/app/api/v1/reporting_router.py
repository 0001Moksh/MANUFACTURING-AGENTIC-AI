from typing import Any, Dict, Optional

from fastapi import APIRouter, Header, HTTPException, status

from app.schemas.reporting_schemas import (
    ManualTriggerRequest,
    ReportApprovalPayload,
    ReportConfigurationPayload,
    build_agent_metadata,
)

router = APIRouter(prefix="/api/v1/reporting", tags=["Agentic Reporting Engine"])


@router.get("/work-orders", status_code=status.HTTP_200_OK)
async def get_work_orders(x_tenant_id: str = Header(...)):
    metadata = build_agent_metadata(
        "get_work_orders",
        "Returns active work orders for AI-driven production monitoring and scheduling.",
        agent_accessible=True,
        auto_register=True,
    )
    return {"metadata": metadata, "data": []}


@router.get("/execution/{execution_id}", status_code=status.HTTP_200_OK)
async def get_pipeline_execution_status(execution_id: str, x_tenant_id: str = Header(...)):
    metadata = build_agent_metadata(
        "get_pipeline_execution_status",
        "Returns state and running phase logs for a specific graph execution run.",
        agent_accessible=True,
        auto_register=True,
    )
    return {"metadata": metadata, "execution_id": execution_id, "current_phase": "RUNNING"}


@router.get("/audit-ledger", status_code=status.HTTP_200_OK)
async def get_audit_ledger(x_tenant_id: str = Header(...)):
    metadata = build_agent_metadata(
        "get_audit_ledger",
        "Retrieves token usage and cost tracking metrics for reporting workflows.",
        agent_accessible=True,
        auto_register=True,
    )
    return {"metadata": metadata, "audit_logs": []}


@router.post("/trigger", status_code=status.HTTP_202_ACCEPTED)
async def trigger_pipeline(payload: ManualTriggerRequest, x_tenant_id: str = Header(...)):
    metadata = build_agent_metadata(
        "trigger_pipeline",
        "Spawns a new autonomous graph execution run to aggregate reporting datasets.",
        agent_accessible=False,
        auto_register=False,
    )
    return {"metadata": metadata, "status": "EXECUTION_PROCESSING_COMPLETE", "execution_id": "demo"}


@router.put("/execution/{execution_id}/approve", status_code=status.HTTP_200_OK)
async def process_human_approval(
    execution_id: str,
    payload: ReportApprovalPayload,
    x_tenant_id: str = Header(...),
):
    metadata = build_agent_metadata(
        "process_human_approval",
        "Approve or reject reports stuck at approval gates.",
        agent_accessible=False,
        auto_register=False,
    )
    return {"metadata": metadata, "execution_id": execution_id, "action_processed": payload.approved}


@router.patch("/execution/{execution_id}/config", status_code=status.HTTP_200_OK)
async def modify_pipeline_configuration(
    execution_id: str,
    payload: ReportConfigurationPayload,
    x_tenant_id: str = Header(...),
):
    metadata = build_agent_metadata(
        "modify_pipeline_configuration",
        "Updates report parameters and notification lists for active tracking pipelines.",
        agent_accessible=False,
        auto_register=False,
    )
    return {"metadata": metadata, "status": "CONFIGURATION_UPDATED", "execution_id": execution_id}


@router.delete("/execution/{execution_id}/cancel", status_code=status.HTTP_200_OK)
async def terminate_pipeline_execution(execution_id: str, x_tenant_id: str = Header(...)):
    metadata = build_agent_metadata(
        "terminate_pipeline_execution",
        "Terminates active graph execution paths and wipes uncommitted states.",
        agent_accessible=False,
        auto_register=False,
    )
    return {"metadata": metadata, "status": "ABORTED_CLEANLY", "execution_id": execution_id}
