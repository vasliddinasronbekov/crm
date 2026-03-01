"""
Email Sending Service with SendGrid Integration
"""

import os
from typing import List, Dict, Any
from django.conf import settings
from django.template import Template, Context
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content
import logging

logger = logging.getLogger(__name__)


class EmailService:
    """
    Email sending service with SendGrid integration
    Falls back to console email backend if SendGrid is not configured
    """

    def __init__(self):
        self.sendgrid_api_key = getattr(settings, 'SENDGRID_API_KEY', None)
        self.from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@eduvoice.com')
        self.from_name = getattr(settings, 'DEFAULT_FROM_NAME', 'EduVoice')
        self.use_sendgrid = bool(self.sendgrid_api_key)

        if self.use_sendgrid:
            self.client = SendGridAPIClient(self.sendgrid_api_key)
            logger.info("Email service initialized with SendGrid")
        else:
            logger.warning("SendGrid API key not found - emails will be printed to console")

    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: str = '',
        from_email: str = None,
        from_name: str = None,
        reply_to: str = None,
        variables: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Send a single email

        Args:
            to_email: Recipient email address
            subject: Email subject
            html_content: HTML email body
            text_content: Plain text email body
            from_email: Sender email (optional, uses default if not provided)
            from_name: Sender name (optional)
            reply_to: Reply-to email (optional)
            variables: Template variables to replace (optional)

        Returns:
            Dict with status and message_id
        """
        try:
            # Replace variables in content
            if variables:
                subject = self._replace_variables(subject, variables)
                html_content = self._replace_variables(html_content, variables)
                if text_content:
                    text_content = self._replace_variables(text_content, variables)

            # Use defaults if not provided
            sender_email = from_email or self.from_email
            sender_name = from_name or self.from_name

            if self.use_sendgrid:
                return self._send_with_sendgrid(
                    to_email, subject, html_content, text_content,
                    sender_email, sender_name, reply_to
                )
            else:
                return self._send_console_email(
                    to_email, subject, html_content, text_content,
                    sender_email, sender_name
                )

        except Exception as e:
            logger.error(f"Error sending email to {to_email}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def send_bulk_email(
        self,
        recipients: List[str],
        subject: str,
        html_content: str,
        text_content: str = '',
        from_email: str = None,
        from_name: str = None,
        personalization_data: Dict[str, Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Send bulk emails with optional personalization

        Args:
            recipients: List of recipient email addresses
            subject: Email subject
            html_content: HTML email body
            text_content: Plain text email body
            from_email: Sender email
            from_name: Sender name
            personalization_data: Dict mapping email -> variables for that recipient

        Returns:
            Dict with success count and failed emails
        """
        results = {
            'total': len(recipients),
            'sent': 0,
            'failed': 0,
            'failed_emails': []
        }

        for email in recipients:
            # Get personalization variables for this recipient
            variables = personalization_data.get(email, {}) if personalization_data else {}

            result = self.send_email(
                to_email=email,
                subject=subject,
                html_content=html_content,
                text_content=text_content,
                from_email=from_email,
                from_name=from_name,
                variables=variables
            )

            if result.get('success'):
                results['sent'] += 1
            else:
                results['failed'] += 1
                results['failed_emails'].append({
                    'email': email,
                    'error': result.get('error', 'Unknown error')
                })

        return results

    def _send_with_sendgrid(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: str,
        from_email: str,
        from_name: str,
        reply_to: str = None
    ) -> Dict[str, Any]:
        """Send email using SendGrid API"""
        try:
            message = Mail(
                from_email=Email(from_email, from_name),
                to_emails=To(to_email),
                subject=subject,
                html_content=Content("text/html", html_content)
            )

            # Add plain text version if provided
            if text_content:
                message.content = [
                    Content("text/plain", text_content),
                    Content("text/html", html_content)
                ]

            # Add reply-to if provided
            if reply_to:
                message.reply_to = Email(reply_to)

            # Send email
            response = self.client.send(message)

            logger.info(f"Email sent to {to_email} - Status: {response.status_code}")

            return {
                'success': True,
                'status_code': response.status_code,
                'message_id': response.headers.get('X-Message-Id')
            }

        except Exception as e:
            logger.error(f"SendGrid error: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def _send_console_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: str,
        from_email: str,
        from_name: str
    ) -> Dict[str, Any]:
        """Print email to console (for development/testing)"""
        print("\n" + "="*80)
        print("📧 EMAIL SENT (Console Mode)")
        print("="*80)
        print(f"From: {from_name} <{from_email}>")
        print(f"To: {to_email}")
        print(f"Subject: {subject}")
        print("-"*80)
        print("Plain Text:")
        print(text_content or "(No plain text version)")
        print("-"*80)
        print("HTML:")
        print(html_content[:500] + "..." if len(html_content) > 500 else html_content)
        print("="*80 + "\n")

        return {
            'success': True,
            'message_id': f'console-{to_email}-{subject[:20]}',
            'note': 'Email printed to console (SendGrid not configured)'
        }

    def _replace_variables(self, content: str, variables: Dict[str, Any]) -> str:
        """Replace {{variable}} placeholders with actual values"""
        for key, value in variables.items():
            placeholder = f"{{{{{key}}}}}"
            content = content.replace(placeholder, str(value))
        return content

    def send_template_email(
        self,
        to_email: str,
        template_id: int,
        variables: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Send email using a saved EmailTemplate

        Args:
            to_email: Recipient email
            template_id: ID of EmailTemplate
            variables: Variables to replace in template

        Returns:
            Dict with send result
        """
        from messaging.email_models import EmailTemplate

        try:
            template = EmailTemplate.objects.get(id=template_id, is_active=True)

            return self.send_email(
                to_email=to_email,
                subject=template.subject,
                html_content=template.html_content,
                text_content=template.text_content,
                from_email=template.from_email,
                from_name=template.from_name,
                variables=variables
            )

        except EmailTemplate.DoesNotExist:
            return {
                'success': False,
                'error': f'Template {template_id} not found or inactive'
            }


# Global instance
email_service = EmailService()


def send_email(*args, **kwargs):
    """Convenience function to send email"""
    return email_service.send_email(*args, **kwargs)


def send_bulk_email(*args, **kwargs):
    """Convenience function to send bulk emails"""
    return email_service.send_bulk_email(*args, **kwargs)
