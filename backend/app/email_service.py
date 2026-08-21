import os
import smtplib
from email.message import EmailMessage
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("email_service")

MAIL_HOST = os.getenv("MAIL_HOST", "smtp.gmail.com")
MAIL_PORT = int(os.getenv("MAIL_PORT", 587))
MAIL_USERNAME = os.getenv("MAIL_USERNAME", "")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", "")
MAIL_FROM = os.getenv("MAIL_FROM", MAIL_USERNAME)

# Strip quotes if they exist in env vars
if MAIL_USERNAME.startswith('"') and MAIL_USERNAME.endswith('"'):
    MAIL_USERNAME = MAIL_USERNAME[1:-1]
if MAIL_PASSWORD.startswith('"') and MAIL_PASSWORD.endswith('"'):
    MAIL_PASSWORD = MAIL_PASSWORD[1:-1]
if MAIL_FROM.startswith('"') and MAIL_FROM.endswith('"'):
    MAIL_FROM = MAIL_FROM[1:-1]

def send_pdf_report_email(to_email: str, subject: str, body: str, pdf_path: str):
    """
    Sends an email with a PDF attachment using SMTP.
    """
    if not MAIL_USERNAME or not MAIL_PASSWORD:
        logger.error("Mail credentials missing. Cannot send email.")
        return False
        
    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = MAIL_FROM
    msg['To'] = to_email
    msg.set_content(body)

    # Attach the PDF
    if pdf_path and os.path.exists(pdf_path):
        try:
            with open(pdf_path, 'rb') as f:
                pdf_data = f.read()
            msg.add_attachment(pdf_data, maintype='application', subtype='pdf', filename=os.path.basename(pdf_path))
        except Exception as e:
            logger.error(f"Failed to read PDF for attachment: {e}")
            return False
    else:
        logger.warning("PDF path is invalid or file doesn't exist. Sending without attachment.")

    # Send the email
    try:
        with smtplib.SMTP(MAIL_HOST, MAIL_PORT) as server:
            server.starttls()
            server.login(MAIL_USERNAME, MAIL_PASSWORD)
            server.send_message(msg)
            logger.info(f"Successfully sent report email to {to_email}")
            return True
    except Exception as e:
        logger.error(f"Error sending email via SMTP: {e}")
        return False


def send_text_email(to_email: str, subject: str, body: str) -> bool:
    """Send a plain-text transactional email using the configured SMTP transport."""
    if not MAIL_USERNAME or not MAIL_PASSWORD:
        logger.error("Mail credentials missing. Cannot send transactional email.")
        return False

    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = MAIL_FROM
    msg['To'] = to_email
    msg.set_content(body)

    try:
        with smtplib.SMTP(MAIL_HOST, MAIL_PORT) as server:
            server.starttls()
            server.login(MAIL_USERNAME, MAIL_PASSWORD)
            server.send_message(msg)
        logger.info("Transactional email sent to %s", to_email)
        return True
    except Exception as exc:
        logger.error("Transactional email delivery failed: %s", exc)
        return False


def send_html_email(to_email: str, subject: str, text_body: str, html_body: str) -> bool:
    """Send a transactional email with an accessible text fallback and HTML action controls."""
    if not MAIL_USERNAME or not MAIL_PASSWORD:
        logger.error("Mail credentials missing. Cannot send HTML transactional email.")
        return False
    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = MAIL_FROM
    msg['To'] = to_email
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")
    try:
        with smtplib.SMTP(MAIL_HOST, MAIL_PORT) as server:
            server.starttls()
            server.login(MAIL_USERNAME, MAIL_PASSWORD)
            server.send_message(msg)
        logger.info("HTML transactional email sent to %s", to_email)
        return True
    except Exception as exc:
        logger.error("HTML transactional email delivery failed: %s", exc)
        return False
