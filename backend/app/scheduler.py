import os
import logging
from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select
import jwt

from app.db import (
    AsyncSessionLocal, AgentReportingSettings, GlobalGovernanceSettings,
    UseCaseGovernanceSettings, ReportApproval, PlatformNotification, User, UserProfile,
)
from app.agents.agent_workflow import run_agent_workflow
from app.email_service import send_pdf_report_email, send_html_email
import secrets

logger = logging.getLogger("scheduler")

scheduler = AsyncIOScheduler()
REPORT_APPROVAL_EMAIL_SECRET = os.getenv("REPORT_APPROVAL_EMAIL_SECRET", "IIOT_MANUFACTURING_SECRET_KEY_JWT")
PUBLIC_API_URL = os.getenv("PUBLIC_API_URL", "http://127.0.0.1:8000").rstrip("/")


async def _notify_verified_super_admins(approval_key: str, report_url: str, delivery_time: str) -> int:
    """Email all verified Super Admin profiles; addresses are never hardcoded."""
    async with AsyncSessionLocal() as session:
        profiles = (await session.execute(
            select(UserProfile).join(User, User.id == UserProfile.user_id).where(
                User.role == "Super Admin", UserProfile.email_verified.is_(True)
            )
        )).scalars().all()
    subject = "Approval required: Daily Operations report"
    body = (
        "A Daily Operations PDF has been generated and is waiting for Human-in-the-Loop approval.\n\n"
        f"Scheduled delivery time: {delivery_time}\n"
        f"Report reference: {approval_key}\n"
        f"Review PDF: {report_url or 'Available in the MAI Admin Console'}\n\n"
        "Open MAI Platform > Admin Console > Notifications to approve and send, or reject the report. "
        "The PDF will not be emailed to the recipient until a Super Admin approves it."
    )
    delivered = 0
    for profile in profiles:
        expires = datetime.utcnow() + timedelta(hours=24)
        approve_token = jwt.encode({"scope": "report_approval_email", "approval_key": approval_key, "decision": "approve", "user_id": profile.user_id, "exp": expires}, REPORT_APPROVAL_EMAIL_SECRET, algorithm="HS256")
        reject_token = jwt.encode({"scope": "report_approval_email", "approval_key": approval_key, "decision": "reject", "user_id": profile.user_id, "exp": expires}, REPORT_APPROVAL_EMAIL_SECRET, algorithm="HS256")
        approve_url = f"{PUBLIC_API_URL}/api/report-approvals/email-action?token={approve_token}"
        reject_url = f"{PUBLIC_API_URL}/api/report-approvals/email-action?token={reject_token}"
        text_body = f"{body}\n\nApprove: {approve_url}\nReject: {reject_url}\n\nThese signed links expire in 24 hours and can be used only once."
        html_body = f"""<div style='font-family:Arial,sans-serif;color:#17324d;max-width:600px'><h2>Daily Operations report approval required</h2><p>A PDF has been generated and is waiting for your Human-in-the-Loop decision.</p><p><b>Scheduled delivery:</b> {delivery_time}<br><b>Report reference:</b> {approval_key}<br><a href='{report_url}'>Review PDF</a></p><p><a href='{approve_url}' style='display:inline-block;background:#0e6b52;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:bold'>Approve &amp; Send Report</a>&nbsp;<a href='{reject_url}' style='display:inline-block;background:#fff;color:#a12b2b;padding:12px 18px;border:1px solid #d39a9a;border-radius:6px;text-decoration:none;font-weight:bold'>Reject Report</a></p><p style='font-size:12px;color:#667'>These signed links expire in 24 hours and the decision can be applied only once.</p></div>"""
        if send_html_email(profile.email, subject, text_body, html_body):
            delivered += 1
    return delivered

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
                    emailed_admins = await _notify_verified_super_admins(
                        approval_key, workflow_result.get("pdf_url", ""), settings.schedule_time
                    )
                    if not emailed_admins:
                        logger.warning("Scheduled report %s is pending, but no verified Super Admin email received the approval request.", approval_key)
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
