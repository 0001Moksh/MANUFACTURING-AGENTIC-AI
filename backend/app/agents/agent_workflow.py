"""
Manufacturing Agentic AI — Intelligent Operations & Resources Report Generator (v3)
====================================================================================
Replaces the legacy notebook-based flow with the multi-source v3 Intelligent Report
Generator supporting:
  1. MES MSSQL Database
  2. PostgreSQL Video Analytics Database
  3. InfluxDB Real-Time IoT & Machine Telemetry (Flux Downsampling)

Core Features:
  - Deterministic time range extraction & Flux aggregateWindow downsampling
  - Safe SELECT SQL generation and schema matching
  - Token-efficient context generation with rich data quality profiling
  - Multi-tier LLM generation with graceful deterministic fallback
  - Publication-grade ReportLab PDF generation with embedded Matplotlib telemetry charts
"""

import asyncio
import logging
import os
import uuid
from typing import Any, Dict, List, Optional, TypedDict

from app.agents.report_generator_v3 import process_query_and_generate_full_dict

logger = logging.getLogger("agent_workflow")


class AgentState(TypedDict, total=False):
    prompt: str
    intent_output: Dict[str, Any]
    schema_context: Dict[str, Any]
    sql_query: str
    query_results: Dict[str, Any]
    full_df: Any
    processed_data: Dict[str, Any]
    insights_output: Dict[str, Any]
    charts_visuals: List[str]
    html_content: str
    pdf_path: str
    error: Optional[str]
    retry_count: int
    requires_hitl: bool
    is_approved: bool
    execution_steps: List[str]


async def run_agent_workflow(query: str, is_approved: bool = False) -> Dict[str, Any]:
    """
    Executes the v3 Manufacturing & Video-Analytics Intelligent Report Generator.
    Runs the multi-database pipeline asynchronously without blocking the event loop.
    """
    logger.info("Executing v3 Agentic Operations & Resources Report Generator for query: %s", query)
    os.makedirs("reports", exist_ok=True)
    pdf_filename = f"reports/report_{uuid.uuid4().hex[:8]}.pdf"
    pdf_target_path = os.path.abspath(pdf_filename)

    try:
        # Run the v3 pipeline in thread pool to ensure non-blocking async execution
        result = await asyncio.to_thread(
            process_query_and_generate_full_dict,
            user_query=query,
            pdf_path=pdf_target_path,
            is_approved=is_approved,
            limit_per_table=50
        )
        return result
    except Exception as e:
        logger.exception("Error executing v3 report generator workflow: %s", e)
        public_api_url = os.getenv("PUBLIC_API_URL", "http://localhost:8001").rstrip("/")
        return {
            "sql_query": "-- Error occurred during pipeline execution",
            "sql_result": [],
            "insights": f"### Report Generation Failed\n\nAn unexpected error occurred during report generation: `{str(e)}`",
            "execution_steps": [
                "Initialized operational report generator pipeline (v3)",
                f"Encountered error during execution: {str(e)}"
            ],
            "pdf_path": "",
            "pdf_url": "",
            "requires_hitl": False,
            "is_approved": is_approved,
            "error_message": str(e)
        }
