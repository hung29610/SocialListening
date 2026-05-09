"""
AI Analysis Service
Provides pluggable AI provider interface for sentiment analysis and risk scoring
"""
from typing import Dict, Any, Optional
from app.core.config import settings
from app.models.mention import SentimentScore


class AIService:
    """Base AI service with pluggable providers"""
    
    def __init__(self, provider: str = None):
        self.provider = provider or settings.AI_PROVIDER
        
    async def analyze_mention(
        self,
        content: str,
        title: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Analyze a mention and return sentiment, risk score, and other metrics
        
        Returns:
            {
                "sentiment": SentimentScore,
                "risk_score": float (0-100),
                "crisis_level": int (1-5),
                "summary_vi": str,
                "suggested_action": str,
                "responsible_department": str,
                "confidence_score": float (0-100),
                "reasoning": str
            }
        """
        if self.provider == "openai":
            return await self._analyze_with_openai(content, title, metadata)
        elif self.provider == "gemini":
            return await self._analyze_with_gemini(content, title, metadata)
        elif self.provider == "anthropic":
            return await self._analyze_with_anthropic(content, title, metadata)
        elif self.provider == "deepseek":
            return await self._analyze_with_deepseek(content, title, metadata)
        else:
            # Fallback to mock analysis for development
            return await self._mock_analysis(content, title, metadata)
    
    async def _analyze_with_openai(
        self,
        content: str,
        title: Optional[str],
        metadata: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Analyze using OpenAI GPT"""
        if not settings.OPENAI_API_KEY:
            return await self._mock_analysis(content, title, metadata)
        
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            
            # Prepare prompt
            full_text = f"Tiêu đề: {title}\n\nNội dung: {content}" if title else content
            
            prompt = f"""Bạn là chuyên gia phân tích danh tiếng thương hiệu tại Việt Nam. Hãy phân tích nội dung sau và đánh giá mức độ rủi ro cho thương hiệu.

Nội dung cần phân tích:
{full_text[:3000]}

Hãy trả lời theo định dạng JSON với các trường sau:
{{
  "sentiment": "positive" hoặc "neutral" hoặc "negative_low" hoặc "negative_medium" hoặc "negative_high",
  "risk_score": số từ 0-100 (0 = không rủi ro, 100 = rủi ro cực cao),
  "crisis_level": số từ 1-5 (1 = bình thường, 5 = khủng hoảng nghiêm trọng),
  "summary_vi": "Tóm tắt ngắn gọn bằng tiếng Việt (tối đa 200 ký tự)",
  "suggested_action": "monitor" hoặc "respond" hoặc "escalate" hoặc "legal_review",
  "responsible_department": "customer_service" hoặc "PR" hoặc "legal" hoặc "executive",
  "alert_reason": "Lý do cảnh báo nếu có rủi ro",
  "confidence_score": số từ 0-100
}}

Tiêu chí đánh giá:
- Sentiment: Đánh giá cảm xúc tổng thể (tích cực, trung lập, tiêu cực với mức độ)
- Risk Score: Dựa trên mức độ ảnh hưởng đến danh tiếng (từ khóa tiêu cực, cáo buộc nghiêm trọng, lan truyền rộng)
- Crisis Level: Mức độ khẩn cấp cần xử lý
- Suggested Action: Hành động đề xuất phù hợp
- Responsible Department: Bộ phận chịu trách nhiệm xử lý

Chỉ trả về JSON, không thêm text khác."""

            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "Bạn là chuyên gia phân tích danh tiếng thương hiệu. Luôn trả lời bằng JSON hợp lệ."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=500
            )
            
            result_text = response.choices[0].message.content.strip()
            
            # Parse JSON response
            import json
            # Remove markdown code blocks if present
            if result_text.startswith("```"):
                result_text = result_text.split("```")[1]
                if result_text.startswith("json"):
                    result_text = result_text[4:]
            
            result = json.loads(result_text)
            
            # Validate and convert sentiment to enum
            sentiment_map = {
                "positive": SentimentScore.POSITIVE,
                "neutral": SentimentScore.NEUTRAL,
                "negative_low": SentimentScore.NEGATIVE_LOW,
                "negative_medium": SentimentScore.NEGATIVE_MEDIUM,
                "negative_high": SentimentScore.NEGATIVE_HIGH
            }
            
            return {
                "sentiment": sentiment_map.get(result.get("sentiment", "neutral"), SentimentScore.NEUTRAL),
                "risk_score": float(result.get("risk_score", 0)),
                "crisis_level": int(result.get("crisis_level", 1)),
                "summary_vi": result.get("summary_vi", "")[:200],
                "suggested_action": result.get("suggested_action", "monitor"),
                "responsible_department": result.get("responsible_department", "customer_service"),
                "confidence_score": float(result.get("confidence_score", 75)),
                "reasoning": result.get("alert_reason", "AI analysis completed")
            }
            
        except Exception as e:
            print(f"OpenAI analysis error: {str(e)}")
            # Fallback to mock
            return await self._mock_analysis(content, title, metadata)
    
    async def _analyze_with_gemini(
        self,
        content: str,
        title: Optional[str],
        metadata: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Analyze using Google Gemini"""
        if not settings.GEMINI_API_KEY:
            return await self._mock_analysis(content, title, metadata)
        
        try:
            import google.generativeai as genai
            
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel('gemini-pro')
            
            # Prepare prompt
            full_text = f"Tiêu đề: {title}\n\nNội dung: {content}" if title else content
            
            prompt = f"""Bạn là chuyên gia phân tích danh tiếng thương hiệu tại Việt Nam. Hãy phân tích nội dung sau và đánh giá mức độ rủi ro cho thương hiệu.

Nội dung cần phân tích:
{full_text[:3000]}

Hãy trả lời theo định dạng JSON với các trường sau:
{{
  "sentiment": "positive" hoặc "neutral" hoặc "negative_low" hoặc "negative_medium" hoặc "negative_high",
  "risk_score": số từ 0-100,
  "crisis_level": số từ 1-5,
  "summary_vi": "Tóm tắt ngắn gọn bằng tiếng Việt",
  "suggested_action": "monitor" hoặc "respond" hoặc "escalate" hoặc "legal_review",
  "responsible_department": "customer_service" hoặc "PR" hoặc "legal" hoặc "executive",
  "confidence_score": số từ 0-100
}}"""
            
            response = model.generate_content(prompt)
            
            # Parse JSON response
            import json
            result = json.loads(response.text.strip().replace("```json", "").replace("```", ""))
            
            result["reasoning"] = "Analyzed by Google Gemini"
            return result
            
        except Exception as e:
            print(f"Gemini analysis error: {e}")
            return await self._mock_analysis(content, title, metadata)
    
    async def _analyze_with_anthropic(
        self,
        content: str,
        title: Optional[str],
        metadata: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Analyze using Anthropic Claude"""
        if not settings.ANTHROPIC_API_KEY:
            return await self._mock_analysis(content, title, metadata)
        
        try:
            from anthropic import AsyncAnthropic
            
            client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
            
            # Prepare prompt
            full_text = f"Tiêu đề: {title}\n\nNội dung: {content}" if title else content
            
            prompt = f"""Bạn là chuyên gia phân tích danh tiếng thương hiệu tại Việt Nam. Hãy phân tích nội dung sau và đánh giá mức độ rủi ro cho thương hiệu.

Nội dung cần phân tích:
{full_text[:3000]}

Hãy trả lời theo định dạng JSON với các trường sau:
{{
  "sentiment": "positive" hoặc "neutral" hoặc "negative_low" hoặc "negative_medium" hoặc "negative_high",
  "risk_score": số từ 0-100,
  "crisis_level": số từ 1-5,
  "summary_vi": "Tóm tắt ngắn gọn bằng tiếng Việt",
  "suggested_action": "monitor" hoặc "respond" hoặc "escalate" hoặc "legal_review",
  "responsible_department": "customer_service" hoặc "PR" hoặc "legal" hoặc "executive",
  "confidence_score": số từ 0-100
}}"""
            
            message = await client.messages.create(
                model="claude-3-sonnet-20240229",
                max_tokens=1024,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            # Parse JSON response
            import json
            result = json.loads(message.content[0].text.strip().replace("```json", "").replace("```", ""))
            
            result["reasoning"] = "Analyzed by Anthropic Claude"
            return result
            
        except Exception as e:
            print(f"Anthropic analysis error: {e}")
            return await self._mock_analysis(content, title, metadata)
    
    async def _analyze_with_deepseek(
        self,
        content: str,
        title: Optional[str],
        metadata: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Analyze using DeepSeek"""
        if not settings.DEEPSEEK_API_KEY:
            return await self._mock_analysis(content, title, metadata)
        
        try:
            from openai import AsyncOpenAI
            
            # DeepSeek uses OpenAI-compatible API
            client = AsyncOpenAI(
                api_key=settings.DEEPSEEK_API_KEY,
                base_url="https://api.deepseek.com"
            )
            
            # Prepare prompt
            full_text = f"Tiêu đề: {title}\n\nNội dung: {content}" if title else content
            
            prompt = f"""Bạn là chuyên gia phân tích danh tiếng thương hiệu tại Việt Nam. Hãy phân tích nội dung sau và đánh giá mức độ rủi ro cho thương hiệu.

Nội dung cần phân tích:
{full_text[:3000]}

Hãy trả lời theo định dạng JSON với các trường sau:
{{
  "sentiment": "positive" hoặc "neutral" hoặc "negative_low" hoặc "negative_medium" hoặc "negative_high",
  "risk_score": số từ 0-100,
  "crisis_level": số từ 1-5,
  "summary_vi": "Tóm tắt ngắn gọn bằng tiếng Việt",
  "suggested_action": "monitor" hoặc "respond" hoặc "escalate" hoặc "legal_review",
  "responsible_department": "customer_service" hoặc "PR" hoặc "legal" hoặc "executive",
  "confidence_score": số từ 0-100
}}"""
            
            response = await client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": "You are a brand reputation analysis expert. Always respond in valid JSON format."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=1024
            )
            
            # Parse JSON response
            import json
            result = json.loads(response.choices[0].message.content.strip().replace("```json", "").replace("```", ""))
            
            result["reasoning"] = "Analyzed by DeepSeek"
            return result
            
        except Exception as e:
            print(f"DeepSeek analysis error: {e}")
            return await self._mock_analysis(content, title, metadata)
    
    async def _mock_analysis(
        self,
        content: str,
        title: Optional[str],
        metadata: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Mock analysis for development/testing"""
        # Simple keyword-based mock analysis
        content_lower = content.lower()
        negative_keywords = ["tệ", "xấu", "kém", "thất bại", "lừa đảo", "gian lận", "khủng khiếp"]
        positive_keywords = ["tốt", "hay", "xuất sắc", "tuyệt vời", "chất lượng", "uy tín"]
        
        negative_count = sum(1 for kw in negative_keywords if kw in content_lower)
        positive_count = sum(1 for kw in positive_keywords if kw in content_lower)
        
        # Determine sentiment
        if negative_count > positive_count:
            if negative_count >= 3:
                sentiment = SentimentScore.NEGATIVE_HIGH
                risk_score = 85.0
                crisis_level = 4
            elif negative_count >= 2:
                sentiment = SentimentScore.NEGATIVE_MEDIUM
                risk_score = 65.0
                crisis_level = 3
            else:
                sentiment = SentimentScore.NEGATIVE_LOW
                risk_score = 40.0
                crisis_level = 2
        elif positive_count > negative_count:
            sentiment = SentimentScore.POSITIVE
            risk_score = 10.0
            crisis_level = 1
        else:
            sentiment = SentimentScore.NEUTRAL
            risk_score = 25.0
            crisis_level = 1
        
        # Suggested action
        if risk_score >= 70:
            suggested_action = "legal_review"
            responsible_department = "legal"
        elif risk_score >= 50:
            suggested_action = "escalate"
            responsible_department = "PR"
        elif risk_score >= 30:
            suggested_action = "respond"
            responsible_department = "customer_service"
        else:
            suggested_action = "monitor"
            responsible_department = "customer_service"
        
        # Vietnamese summary
        summary_vi = f"Phát hiện {negative_count} từ khóa tiêu cực, {positive_count} từ khóa tích cực. "
        if sentiment == SentimentScore.NEGATIVE_HIGH:
            summary_vi += "Nội dung có tính chất tiêu cực cao, cần xử lý ngay."
        elif sentiment == SentimentScore.NEGATIVE_MEDIUM:
            summary_vi += "Nội dung có tính chất tiêu cực, cần theo dõi."
        elif sentiment == SentimentScore.POSITIVE:
            summary_vi += "Nội dung tích cực."
        else:
            summary_vi += "Nội dung trung lập."
        
        return {
            "sentiment": sentiment,
            "risk_score": risk_score,
            "crisis_level": crisis_level,
            "summary_vi": summary_vi[:200],
            "suggested_action": suggested_action,
            "responsible_department": responsible_department,
            "confidence_score": 75.0,
            "reasoning": "Mock analysis based on keyword matching"
        }


# Singleton instance
ai_service = AIService()
