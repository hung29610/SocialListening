"""
Takedown Service - Tools for removing harmful content from platforms
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
import httpx
from enum import Enum

from app.core.config import settings


class TakedownPlatform(str, Enum):
    """Supported platforms for takedown"""
    FACEBOOK = "facebook"
    YOUTUBE = "youtube"
    GOOGLE = "google"
    TIKTOK = "tiktok"
    ZALO = "zalo"
    CUSTOM = "custom"


class TakedownReason(str, Enum):
    """Reasons for takedown request"""
    DEFAMATION = "defamation"  # Phỉ báng
    MISINFORMATION = "misinformation"  # Thông tin sai lệch
    COPYRIGHT = "copyright"  # Vi phạm bản quyền
    TRADEMARK = "trademark"  # Vi phạm thương hiệu
    PRIVACY = "privacy"  # Vi phạm quyền riêng tư
    HATE_SPEECH = "hate_speech"  # Ngôn từ thù địch
    SPAM = "spam"  # Spam
    IMPERSONATION = "impersonation"  # Mạo danh
    OTHER = "other"


class TakedownService:
    """Service for content takedown and removal"""
    
    def __init__(self):
        self.timeout = 30
    
    async def submit_facebook_report(
        self,
        post_url: str,
        reason: TakedownReason,
        description: str,
        evidence_urls: List[str] = None
    ) -> Dict[str, Any]:
        """
        Submit content report to Facebook
        
        Note: Facebook doesn't have a public API for content reporting.
        This method provides guidance and automation where possible.
        """
        if not settings.FACEBOOK_ACCESS_TOKEN:
            return {
                "success": False,
                "platform": "facebook",
                "error": "Facebook access token not configured",
                "manual_steps": self._get_facebook_manual_steps(reason)
            }
        
        # Extract post ID from URL
        post_id = self._extract_facebook_post_id(post_url)
        
        if not post_id:
            return {
                "success": False,
                "platform": "facebook",
                "error": "Invalid Facebook post URL"
            }
        
        # For now, provide manual reporting instructions
        # Facebook Graph API doesn't support automated content reporting
        return {
            "success": False,
            "platform": "facebook",
            "post_id": post_id,
            "reason": reason.value,
            "note": "Facebook requires manual reporting through their interface",
            "manual_steps": self._get_facebook_manual_steps(reason),
            "report_url": f"https://www.facebook.com/{post_id}",
            "automated": False
        }
    
    async def submit_youtube_report(
        self,
        video_url: str,
        reason: TakedownReason,
        description: str,
        timestamp: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Submit content report to YouTube
        
        YouTube provides reporting through their UI, not API
        """
        video_id = self._extract_youtube_video_id(video_url)
        
        if not video_id:
            return {
                "success": False,
                "platform": "youtube",
                "error": "Invalid YouTube video URL"
            }
        
        return {
            "success": False,
            "platform": "youtube",
            "video_id": video_id,
            "reason": reason.value,
            "note": "YouTube requires manual reporting through their interface",
            "manual_steps": self._get_youtube_manual_steps(reason),
            "report_url": f"https://www.youtube.com/watch?v={video_id}",
            "automated": False
        }
    
    async def submit_google_dmca(
        self,
        infringing_url: str,
        original_url: str,
        description: str,
        contact_info: Dict[str, str]
    ) -> Dict[str, Any]:
        """
        Submit DMCA takedown to Google
        
        Google provides a web form for DMCA requests
        """
        return {
            "success": False,
            "platform": "google",
            "note": "Google DMCA requires manual submission through web form",
            "manual_steps": [
                "1. Truy cập: https://support.google.com/legal/troubleshooter/1114905",
                "2. Chọn loại nội dung vi phạm (Search, YouTube, Blogger, etc.)",
                "3. Điền form với thông tin:",
                f"   - URL vi phạm: {infringing_url}",
                f"   - URL gốc: {original_url}",
                f"   - Mô tả: {description}",
                "4. Cung cấp thông tin liên hệ và chữ ký điện tử",
                "5. Submit form và chờ xử lý (thường 24-48 giờ)"
            ],
            "form_url": "https://support.google.com/legal/troubleshooter/1114905",
            "automated": False
        }
    
    async def submit_legal_request(
        self,
        platform: str,
        content_url: str,
        reason: TakedownReason,
        legal_basis: str,
        evidence: List[str],
        lawyer_info: Dict[str, str]
    ) -> Dict[str, Any]:
        """
        Prepare legal takedown request package
        
        This generates a formal legal request document
        """
        request_package = {
            "platform": platform,
            "content_url": content_url,
            "reason": reason.value,
            "legal_basis": legal_basis,
            "evidence_urls": evidence,
            "lawyer_info": lawyer_info,
            "request_date": datetime.utcnow().isoformat(),
            "status": "prepared"
        }
        
        # Generate formal request letter
        letter = self._generate_legal_letter(request_package)
        
        return {
            "success": True,
            "platform": platform,
            "request_package": request_package,
            "formal_letter": letter,
            "next_steps": [
                "1. Review và ký tên vào văn bản yêu cầu",
                "2. Đính kèm bằng chứng (screenshots, documents)",
                "3. Gửi qua email chính thức của platform",
                "4. CC luật sư và lưu trữ hồ sơ",
                "5. Follow up sau 7-14 ngày nếu không có phản hồi"
            ],
            "automated": False
        }
    
    async def mass_report_content(
        self,
        content_url: str,
        platform: TakedownPlatform,
        reason: TakedownReason,
        reporter_accounts: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """
        Coordinate mass reporting from multiple accounts
        
        WARNING: This should be used carefully and only for legitimate violations
        Mass reporting can be considered abuse if misused
        """
        if len(reporter_accounts) < 1:
            return {
                "success": False,
                "error": "No reporter accounts provided"
            }
        
        results = []
        
        for account in reporter_accounts:
            # Simulate report submission
            # In practice, this would use platform-specific APIs or automation
            result = {
                "account": account.get("username", "unknown"),
                "status": "queued",
                "timestamp": datetime.utcnow().isoformat()
            }
            results.append(result)
        
        return {
            "success": True,
            "platform": platform.value,
            "content_url": content_url,
            "reason": reason.value,
            "total_reports": len(reporter_accounts),
            "reports": results,
            "warning": "Mass reporting should only be used for legitimate violations",
            "note": "Actual submission requires manual action or platform-specific automation"
        }
    
    async def monitor_takedown_status(
        self,
        platform: TakedownPlatform,
        content_url: str,
        request_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Check if content has been taken down
        
        This checks if the URL is still accessible
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    content_url,
                    follow_redirects=True,
                    headers={"User-Agent": "Mozilla/5.0"}
                )
                
                # Check if content is still accessible
                if response.status_code == 404:
                    return {
                        "success": True,
                        "platform": platform.value,
                        "status": "removed",
                        "content_url": content_url,
                        "checked_at": datetime.utcnow().isoformat()
                    }
                elif response.status_code == 200:
                    return {
                        "success": True,
                        "platform": platform.value,
                        "status": "still_active",
                        "content_url": content_url,
                        "checked_at": datetime.utcnow().isoformat()
                    }
                else:
                    return {
                        "success": True,
                        "platform": platform.value,
                        "status": "unknown",
                        "status_code": response.status_code,
                        "content_url": content_url,
                        "checked_at": datetime.utcnow().isoformat()
                    }
                    
        except Exception as e:
            return {
                "success": False,
                "platform": platform.value,
                "error": str(e),
                "content_url": content_url
            }
    
    def _extract_facebook_post_id(self, url: str) -> Optional[str]:
        """Extract Facebook post ID from URL"""
        import re
        
        patterns = [
            r'facebook\.com/.*?/posts/(\d+)',
            r'facebook\.com/.*?/photos/.*?/(\d+)',
            r'facebook\.com/permalink\.php\?story_fbid=(\d+)',
            r'facebook\.com/.*?/videos/(\d+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        
        return None
    
    def _extract_youtube_video_id(self, url: str) -> Optional[str]:
        """Extract YouTube video ID from URL"""
        import re
        
        patterns = [
            r'youtube\.com/watch\?v=([a-zA-Z0-9_-]+)',
            r'youtu\.be/([a-zA-Z0-9_-]+)',
            r'youtube\.com/embed/([a-zA-Z0-9_-]+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        
        return None
    
    def _get_facebook_manual_steps(self, reason: TakedownReason) -> List[str]:
        """Get manual reporting steps for Facebook"""
        base_steps = [
            "1. Truy cập bài viết vi phạm trên Facebook",
            "2. Click vào dấu 3 chấm (...) ở góc phải bài viết",
            "3. Chọn 'Báo cáo bài viết' (Report post)"
        ]
        
        reason_steps = {
            TakedownReason.DEFAMATION: [
                "4. Chọn 'Quấy rối hoặc bắt nạt' (Harassment or bullying)",
                "5. Chọn 'Tôi' (Me) nếu về bạn, hoặc 'Người khác' (Someone else)",
                "6. Chọn 'Phỉ báng' (Defamation)",
                "7. Cung cấp thông tin chi tiết và bằng chứng"
            ],
            TakedownReason.MISINFORMATION: [
                "4. Chọn 'Thông tin sai lệch' (False information)",
                "5. Chọn loại thông tin sai lệch",
                "6. Cung cấp nguồn thông tin chính xác"
            ],
            TakedownReason.COPYRIGHT: [
                "4. Chọn 'Vi phạm quyền sở hữu trí tuệ' (Intellectual property violation)",
                "5. Chọn 'Bản quyền' (Copyright)",
                "6. Điền form với thông tin bản quyền của bạn"
            ]
        }
        
        steps = base_steps + reason_steps.get(reason, [
            "4. Chọn lý do phù hợp nhất",
            "5. Làm theo hướng dẫn của Facebook"
        ])
        
        steps.append("8. Submit báo cáo và chờ Facebook xem xét (thường 24-48 giờ)")
        
        return steps
    
    def _get_youtube_manual_steps(self, reason: TakedownReason) -> List[str]:
        """Get manual reporting steps for YouTube"""
        return [
            "1. Truy cập video vi phạm trên YouTube",
            "2. Click vào dấu 3 chấm (...) dưới video",
            "3. Chọn 'Report' (Báo cáo)",
            "4. Chọn lý do phù hợp:",
            "   - Spam or misleading (Spam hoặc gây hiểu lầm)",
            "   - Hateful or abusive content (Nội dung thù địch)",
            "   - Infringes my rights (Vi phạm quyền của tôi)",
            "5. Cung cấp thông tin chi tiết",
            "6. Submit báo cáo",
            "7. Nếu vi phạm bản quyền, sử dụng form DMCA:",
            "   https://www.youtube.com/copyright_complaint_form"
        ]
    
    def _generate_legal_letter(self, request_package: Dict[str, Any]) -> str:
        """Generate formal legal request letter"""
        letter = f"""
CÔNG VĂN YÊU CẦU GỠ BỎ NỘI DUNG VI PHẠM

Kính gửi: Ban Quản Trị {request_package['platform'].upper()}

Ngày: {datetime.utcnow().strftime('%d/%m/%Y')}

Chúng tôi là đại diện pháp lý của [TÊN CÔNG TY/CÁ NHÂN], xin gửi đến Quý công ty yêu cầu gỡ bỏ nội dung vi phạm sau:

1. THÔNG TIN NỘI DUNG VI PHẠM:
   - URL: {request_package['content_url']}
   - Lý do: {request_package['reason']}
   - Cơ sở pháp lý: {request_package['legal_basis']}

2. MÔ TẢ VI PHẠM:
   Nội dung tại URL trên đã vi phạm quyền và lợi ích hợp pháp của thân chủ chúng tôi.

3. BẰNG CHỨNG:
   Chúng tôi đính kèm các bằng chứng sau:
"""
        
        for i, evidence in enumerate(request_package.get('evidence_urls', []), 1):
            letter += f"   {i}. {evidence}\n"
        
        letter += f"""

4. YÊU CẦU:
   Chúng tôi yêu cầu Quý công ty:
   - Gỡ bỏ hoàn toàn nội dung vi phạm trong vòng 24 giờ
   - Cung cấp thông tin người đăng tải (nếu cần thiết cho việc khởi kiện)
   - Xác nhận việc gỡ bỏ bằng văn bản

5. THÔNG TIN LIÊN HỆ:
   Luật sư: {request_package.get('lawyer_info', {}).get('name', '[TÊN LUẬT SƯ]')}
   Email: {request_package.get('lawyer_info', {}).get('email', '[EMAIL]')}
   Điện thoại: {request_package.get('lawyer_info', {}).get('phone', '[SỐ ĐIỆN THOẠI]')}

Chúng tôi mong nhận được phản hồi sớm nhất từ Quý công ty.

Trân trọng,
[CHỮ KÝ VÀ CON DẤU]
"""
        
        return letter


# Singleton instance
takedown_service = TakedownService()
