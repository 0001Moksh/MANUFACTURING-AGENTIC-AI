import os
import logging
from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select

from app.db import (
    AsyncSessionLocal, AgentReportingSettings, GlobalGovernanceSettings,
    UseCaseGovernanceSettings, ReportApproval, PlatformNotification,
)
from app.agents.agent_workflow import run_agent_workflow
from app.email_service import send_pdf_report_email
import secrets

logger = logging.getLogger("scheduler")

scheduler = AsyncIOScheduler()

async def check_and_run_daily_report():
    """Scheduled job to check if it's time to run the daily report"""
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(AgentReportingSettings))
            settings = result.scalars().first()

        if not settings or not settings.is_enabled or not settings.schedule_time:
            return

        # The configured time is the user's delivery time. Begin generation exactly one
        # minute earlier so report creation does not make the delivered report late.
        now = datetime.now()
        scheduled_time = datetime.strptime(settings.schedule_time, "%H:%M").time()
        # At the trigger minute, the requested delivery is exactly one minute ahead.
        # This remains correct for a configured 00:00 delivery (trigger: previous day 23:59).
        delivery_at = (now + timedelta(minutes=1)).replace(second=0, microsecond=0)
        delivery_at = delivery_at.replace(hour=scheduled_time.hour, minute=scheduled_time.minute)
        generation_at = delivery_at - timedelta(minutes=1)
        last_delivery_date = settings.last_run_date.date() if settings.last_run_date else None

        if now.strftime("%H:%M") == generation_at.strftime("%H:%M") and last_delivery_date != delivery_at.date():
            logger.info("Starting scheduled daily report one minute before configured delivery time %s for %s", settings.schedule_time, settings.email)
            
            # Generate the report. Approval is evaluated after the immutable PDF has been written.
            workflow_result = await run_agent_workflow(settings.prompt, is_approved=False)
            
            # workflow_result["pdf_url"] is like "http://localhost:8000/reports/filename.pdf"
            # We need the local file path to attach it.
            pdf_filename = ""
            if workflow_result.get("pdf_url"):
                pdf_filename = workflow_result["pdf_url"].split("/")[-1]
            
            local_pdf_path = workflow_result.get("pdf_path") or os.path.abspath(os.path.join("reports", pdf_filename))
            
            # Verify that the query returned real data before sending
            has_data = False
            if workflow_result.get("sql_result"):
                # sql_result is a list of dicts with 'rows' key
                has_data = any(res.get("rows", 0) > 0 for res in workflow_result["sql_result"])
                
            if not has_data:
                logger.warning(f"Automated report yielded no data or query failed. Aborting email send for {settings.email} to avoid empty PDF.")
                return

            # Mark the job complete only after a usable PDF exists. A generation error must
            # never suppress the next valid scheduled run as though the report was delivered.
            async with AsyncSessionLocal() as session2:
                settings_to_update = (await session2.execute(select(AgentReportingSettings))).scalars().first()
                if settings_to_update:
                    settings_to_update.last_run_date = delivery_at
                    await session2.commit()
                 
            async with AsyncSessionLocal() as approval_session:
                global_hitl = (await approval_session.execute(
                    select(GlobalGovernanceSettings).where(GlobalGovernanceSettings.setting_key == "hitl_approval")
                )).scalars().first()
                local_hitl = (await approval_session.execute(
                    select(UseCaseGovernanceSettings).where(UseCaseGovernanceSettings.use_case_key == "daily_operations_reporting")
                )).scalars().first()
                requires_approval = bool(global_hitl and global_hitl.is_enabled and local_hitl and local_hitl.hitl_enabled)

                if requires_approval:
                    if not settings.email:
                        logger.error("HITL is enabled but no report recipient email is configured; report will not be dispatched.")
                        approval_session.add(PlatformNotification(
                            recipient_user_id=None, category="alert", title="Daily report dispatch blocked",
                            message="HITL is enabled but UC01 has no recipient email configured.", source_type="daily_reporting",
                        ))
                        await approval_session.commit()
                        return
                    approval_key = secrets.token_urlsafe(24)
                    approval_session.add(ReportApproval(
                        approval_key=approval_key, status="PENDING_APPROVAL", use_case_key="daily_operations_reporting",
                        recipient_email=settings.email, report_path=local_pdf_path,
                        report_url=workflow_result.get("pdf_url", ""), query=settings.prompt or "Scheduled daily report",
                    ))
                    approval_session.add(PlatformNotification(
                        recipient_user_id=None, category="human_intervention", title="Daily Operations report requires approval",
                        message=f"PDF generated for scheduled delivery at {settings.schedule_time}. Review before dispatch.",
                        source_type="report_approval", source_id=approval_key,
                    ))
                    await approval_session.commit()
                    logger.info("Scheduled report generated and held for HITL approval; approval_key=%s", approval_key)
                    return

            if not settings.email:
                logger.warning("Automated report generated but no recipient email configured.")
                return
            delivered = send_pdf_report_email(
                settings.email, "Daily MES Manufacturing Executive Summary Report",
                "Please find attached your automated daily production and resources report generated by MAI.", local_pdf_path,
            )
            async with AsyncSessionLocal() as notification_session:
                notification_session.add(PlatformNotification(
                    recipient_user_id=None,
                    category="system" if delivered else "alert",
                    title="Daily report sent" if delivered else "Daily report delivery failed",
                    message=(f"Scheduled report was sent to {settings.email}." if delivered else f"The report was generated, but SMTP delivery to {settings.email} failed."),
                    source_type="daily_reporting",
                ))
                await notification_session.commit()
            logger.info("Scheduled report autonomous dispatch %s for %s", "succeeded" if delivered else "failed", settings.email)

    except Exception as e:
        import traceback
        traceback.print_exc()
        logger.error(f"Error in daily report scheduled job: {e}")

def start_scheduler():
    # Run check_and_run_daily_report every minute to see if time matches
    scheduler.add_job(check_and_run_daily_report, "interval", minutes=1, id="daily_report_job", replace_existing=True)
    scheduler.start()
    logger.info("APScheduler started for automated daily reporting.")

def stop_scheduler():
    scheduler.shutdown()
