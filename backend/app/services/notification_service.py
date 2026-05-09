"""
Notification Service - Send alerts via multiple channels
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Dict, Any
import httpx
from app.core.config import settings


class NotificationService:
    """Service for sending notifications via multiple channels"""
    
    async def send_email(
        self,
        to_emails: List[str],
        subject: str,
        body_html: str,
        body_text: str = None
    ) -> Dict[str, Any]:
        """Send email notification"""
        if not settings.SMTP_HOST or not settings.SMTP_USER:
            return {"success": False, "error": "Email not configured"}
        
        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = settings.SMTP_FROM or settings.SMTP_USER
            msg['To'] = ', '.join(to_emails)
            
            # Add text version
            if body_text:
                part1 = MIMEText(body_text, 'plain', 'utf-8')
                msg.attach(part1)
            
            # Add HTML version
            part2 = MIMEText(body_html, 'html', 'utf-8')
            msg.attach(part2)
            
            # Send email
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)
            
            return {
                "success": True,
                "channel": "email",
                "recipients": to_emails
            }
            
        except Exception as e:
            return {
                "success": False,
                "channel": "email",
                "error": str(e)
            }
    
    async def send_telegram(
        self,
        message: str,
        chat_id: str = None,
        parse_mode: str = "HTML"
    ) -> Dict[str, Any]:
        """Send Telegram notification"""
        if not settings.TELEGRAM_BOT_TOKEN:
            return {"success": False, "error": "Telegram not configured"}
        
        chat_id = chat_id or settings.TELEGRAM_CHAT_ID
        if not chat_id:
            return {"success": False, "error": "Telegram chat ID not configured"}
        
        try:
            url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    json={
                        "chat_id": chat_id,
                        "text": message,
                        "parse_mode": parse_mode
                    }
                )
                response.raise_for_status()
            
            return {
                "success": True,
                "channel": "telegram",
                "chat_id": chat_id
            }
            
        except Exception as e:
            return {
                "success": False,
                "channel": "telegram",
                "error": str(e)
            }
    
    async def send_sms(
        self,
        phone_number: str,
        message: str
    ) -> Dict[str, Any]:
        """Send SMS notification via Twilio"""
        if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
            return {"success": False, "error": "Twilio not configured"}
        
        try:
            from twilio.rest import Client
            
            client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            
            message = client.messages.create(
                body=message,
                from_=settings.TWILIO_PHONE_NUMBER,
                to=phone_number
            )
            
            return {
                "success": True,
                "channel": "sms",
                "phone_number": phone_number,
                "message_sid": message.sid
            }
            
        except Exception as e:
            return {
                "success": False,
                "channel": "sms",
                "error": str(e)
            }
    
    async def send_zalo(
        self,
        message: str,
        user_id: str = None
    ) -> Dict[str, Any]:
        """Send Zalo OA notification"""
        if not settings.ZALO_OA_ID or not settings.ZALO_ACCESS_TOKEN:
            return {"success": False, "error": "Zalo not configured"}
        
        try:
            url = "https://openapi.zalo.me/v2.0/oa/message"
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    headers={
                        "access_token": settings.ZALO_ACCESS_TOKEN
                    },
                    json={
                        "recipient": {
                            "user_id": user_id
                        },
                        "message": {
                            "text": message
                        }
                    }
                )
                response.raise_for_status()
            
            return {
                "success": True,
                "channel": "zalo",
                "user_id": user_id
            }
            
        except Exception as e:
            return {
                "success": False,
                "channel": "zalo",
                "error": str(e)
            }
    
    def format_alert_email(
        self,
        alert_title: str,
        alert_message: str,
        mention_url: str,
        risk_score: float,
        crisis_level: int,
        sentiment: str
    ) -> str:
        """Format alert as HTML email"""
        severity_color = {
            "critical": "#dc2626",
            "high": "#ea580c",
            "medium": "#f59e0b",
            "low": "#3b82f6"
        }
        
        color = severity_color.get("high", "#3b82f6")
        
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: {color}; color: white; padding: 20px; border-radius: 5px 5px 0 0; }}
                .content {{ background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }}
                .metrics {{ display: flex; gap: 20px; margin: 20px 0; }}
                .metric {{ flex: 1; background: white; padding: 15px; border-radius: 5px; text-align: center; }}
                .metric-value {{ font-size: 24px; font-weight: bold; color: {color}; }}
                .metric-label {{ font-size: 12px; color: #6b7280; margin-top: 5px; }}
                .button {{ display: inline-block; background-color: {color}; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 5px; margin-top: 20px; }}
                .footer {{ text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>🚨 Cảnh Báo Rủi Ro Danh Tiếng</h2>
                </div>
                <div class="content">
                    <h3>{alert_title}</h3>
                    <p>{alert_message}</p>
                    
                    <div class="metrics">
                        <div class="metric">
                            <div class="metric-value">{risk_score:.0f}</div>
                            <div class="metric-label">Risk Score</div>
                        </div>
                        <div class="metric">
                            <div class="metric-value">{crisis_level}</div>
                            <div class="metric-label">Crisis Level</div>
                        </div>
                        <div class="metric">
                            <div class="metric-value">{sentiment}</div>
                            <div class="metric-label">Sentiment</div>
                        </div>
                    </div>
                    
                    <a href="{mention_url}" class="button">Xem Chi Tiết</a>
                </div>
                <div class="footer">
                    <p>Social Listening Platform - Powered by AI</p>
                    <p>Email này được gửi tự động, vui lòng không trả lời.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return html
    
    def format_alert_telegram(
        self,
        alert_title: str,
        alert_message: str,
        mention_url: str,
        risk_score: float,
        crisis_level: int,
        sentiment: str
    ) -> str:
        """Format alert as Telegram message"""
        emoji = "🚨" if crisis_level >= 4 else "⚠️" if crisis_level >= 3 else "ℹ️"
        
        message = f"""
{emoji} <b>CẢNH BÁO RỦI RO DANH TIẾNG</b>

<b>{alert_title}</b>

{alert_message}

📊 <b>Chỉ Số:</b>
• Risk Score: {risk_score:.0f}/100
• Crisis Level: {crisis_level}/5
• Sentiment: {sentiment}

🔗 <a href="{mention_url}">Xem chi tiết</a>
        """
        
        return message.strip()


# Singleton instance
notification_service = NotificationService()
