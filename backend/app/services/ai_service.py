"""
Dummy AI Service for Social Listening MVP
This is a simple rule-based AI that simulates sentiment analysis and risk scoring
"""
import random
import time
from typing import Dict


def analyze_mention_with_dummy_ai(content: str, title: str = None) -> Dict:
    """
    Dummy AI analysis that uses simple keyword matching
    In production, this would call OpenAI, Gemini, or other AI providers
    """
    start_time = time.time()
    
    content_lower = (content or "").lower()
    title_lower = (title or "").lower()
    full_text = f"{title_lower} {content_lower}"
    
    # Negative keywords (Vietnamese + English)
    negative_keywords = [
        'tệ', 'kém', 'dở', 'tồi', 'lừa đảo', 'scam', 'fake', 'giả mạo',
        'bad', 'terrible', 'awful', 'worst', 'fraud', 'cheat',
        'không tốt', 'thất vọng', 'disappointed', 'angry', 'tức giận',
        'lỗi', 'error', 'bug', 'broken', 'hỏng', 'sai', 'wrong',
        'chậm', 'slow', 'delay', 'trễ', 'không phản hồi', 'no response',
        'rác', 'trash', 'garbage', 'useless', 'vô dụng'
    ]
    
    # Positive keywords
    positive_keywords = [
        'tốt', 'good', 'great', 'excellent', 'xuất sắc', 'tuyệt vời',
        'hài lòng', 'satisfied', 'happy', 'vui', 'thích', 'like', 'love',
        'chất lượng', 'quality', 'nhanh', 'fast', 'quick', 'tốc độ',
        'recommend', 'khuyên dùng', 'đáng tin', 'trust', 'reliable'
    ]
    
    # Crisis keywords (high risk)
    crisis_keywords = [
        'chết', 'death', 'die', 'tử vong', 'nguy hiểm', 'danger',
        'bệnh viện', 'hospital', 'cấp cứu', 'emergency', 'khẩn cấp',
        'kiện', 'lawsuit', 'sue', 'court', 'tòa án', 'pháp luật',
        'scandal', 'bê bối', 'rò rỉ', 'leak', 'hack', 'breach',
        'virus', 'nhiễm độc', 'poison', 'toxic', 'độc hại',
        'cháy', 'fire', 'nổ', 'explosion', 'tai nạn', 'accident'
    ]
    
    # Count matches
    negative_count = sum(1 for kw in negative_keywords if kw in full_text)
    positive_count = sum(1 for kw in positive_keywords if kw in full_text)
    crisis_count = sum(1 for kw in crisis_keywords if kw in full_text)
    
    # Calculate sentiment
    if crisis_count > 0:
        sentiment = "negative_high"
    elif negative_count > positive_count + 2:
        sentiment = "negative_high"
    elif negative_count > positive_count:
        sentiment = "negative_medium"
    elif negative_count > 0:
        sentiment = "negative_low"
    elif positive_count > 0:
        sentiment = "positive"
    else:
        sentiment = "neutral"
    
    # Calculate risk score (0-100)
    base_risk = 30
    risk_score = base_risk + (negative_count * 10) + (crisis_count * 20)
    risk_score = min(risk_score, 100)
    
    # Calculate crisis level (1-5)
    if crisis_count > 0:
        crisis_level = 5
    elif risk_score >= 80:
        crisis_level = 4
    elif risk_score >= 60:
        crisis_level = 3
    elif risk_score >= 40:
        crisis_level = 2
    else:
        crisis_level = 1
    
    # Generate summary
    if sentiment == "negative_high":
        summary_vi = "Phát hiện nội dung tiêu cực nghiêm trọng. Cần xem xét và xử lý ngay."
    elif sentiment == "negative_medium":
        summary_vi = "Nội dung có xu hướng tiêu cực. Nên theo dõi và phản hồi."
    elif sentiment == "negative_low":
        summary_vi = "Nội dung có một số ý kiến tiêu cực nhẹ."
    elif sentiment == "positive":
        summary_vi = "Nội dung tích cực, phản hồi tốt từ người dùng."
    else:
        summary_vi = "Nội dung trung lập, không có ý kiến rõ ràng."
    
    # Suggested action
    if crisis_level >= 4:
        suggested_action = "legal_review"
        responsible_department = "legal"
    elif crisis_level >= 3:
        suggested_action = "escalate"
        responsible_department = "executive"
    elif risk_score >= 50:
        suggested_action = "respond"
        responsible_department = "PR"
    elif risk_score >= 30:
        suggested_action = "monitor"
        responsible_department = "customer_service"
    else:
        suggested_action = "monitor"
        responsible_department = "customer_service"
    
    # Confidence score (simulated)
    confidence_score = random.uniform(75, 95)
    
    processing_time_ms = int((time.time() - start_time) * 1000)
    
    return {
        "sentiment": sentiment,
        "risk_score": risk_score,
        "crisis_level": crisis_level,
        "summary_vi": summary_vi,
        "suggested_action": suggested_action,
        "responsible_department": responsible_department,
        "confidence_score": round(confidence_score, 2),
        "processing_time_ms": processing_time_ms
    }
