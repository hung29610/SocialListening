"""
Scheduler Service for calculating next crawl times
"""
from datetime import datetime, time, timedelta
from typing import Optional
from app.models.source import CrawlFrequency
import calendar


def calculate_next_crawl_time(
    frequency: CrawlFrequency,
    crawl_time: Optional[time] = None,
    crawl_day_of_week: Optional[int] = None,
    crawl_day_of_month: Optional[int] = None,
    crawl_month: Optional[int] = None,
    from_datetime: Optional[datetime] = None
) -> Optional[datetime]:
    """
    Calculate the next crawl time based on frequency and schedule parameters
    
    Args:
        frequency: Crawl frequency (daily, weekly, monthly, yearly, manual)
        crawl_time: Time of day for daily crawls (e.g., 09:00)
        crawl_day_of_week: Day of week for weekly crawls (0=Monday, 6=Sunday)
        crawl_day_of_month: Day of month for monthly crawls (1-31)
        crawl_month: Month for yearly crawls (1-12)
        from_datetime: Calculate from this datetime (default: now)
    
    Returns:
        Next crawl datetime or None for manual frequency
    """
    if frequency == CrawlFrequency.MANUAL:
        return None
    
    if from_datetime is None:
        from_datetime = datetime.utcnow()
    
    # Default crawl time is 9:00 AM if not specified
    if crawl_time is None:
        crawl_time = time(9, 0)
    
    if frequency == CrawlFrequency.DAILY:
        # Next day at specified time
        next_date = from_datetime.date() + timedelta(days=1)
        return datetime.combine(next_date, crawl_time)
    
    elif frequency == CrawlFrequency.WEEKLY:
        if crawl_day_of_week is None:
            crawl_day_of_week = 0  # Default to Monday
        
        # Find next occurrence of the specified day of week
        current_weekday = from_datetime.weekday()
        days_ahead = crawl_day_of_week - current_weekday
        
        if days_ahead <= 0:  # Target day already happened this week
            days_ahead += 7
        
        next_date = from_datetime.date() + timedelta(days=days_ahead)
        return datetime.combine(next_date, crawl_time)
    
    elif frequency == CrawlFrequency.MONTHLY:
        if crawl_day_of_month is None:
            crawl_day_of_month = 1  # Default to 1st of month
        
        # Find next occurrence of the specified day of month
        current_year = from_datetime.year
        current_month = from_datetime.month
        
        # Try current month first
        try:
            next_date = datetime(current_year, current_month, crawl_day_of_month).date()
            if next_date > from_datetime.date():
                return datetime.combine(next_date, crawl_time)
        except ValueError:
            # Day doesn't exist in current month (e.g., Feb 30)
            pass
        
        # Try next month
        next_month = current_month + 1
        next_year = current_year
        if next_month > 12:
            next_month = 1
            next_year += 1
        
        # Handle cases where day doesn't exist in target month
        max_day = calendar.monthrange(next_year, next_month)[1]
        target_day = min(crawl_day_of_month, max_day)
        
        next_date = datetime(next_year, next_month, target_day).date()
        return datetime.combine(next_date, crawl_time)
    
    elif frequency == CrawlFrequency.YEARLY:
        if crawl_month is None:
            crawl_month = 1  # Default to January
        if crawl_day_of_month is None:
            crawl_day_of_month = 1  # Default to 1st
        
        # Find next occurrence of the specified month and day
        current_year = from_datetime.year
        
        # Try current year first
        try:
            next_date = datetime(current_year, crawl_month, crawl_day_of_month).date()
            if next_date > from_datetime.date():
                return datetime.combine(next_date, crawl_time)
        except ValueError:
            # Day doesn't exist in target month (e.g., Feb 30)
            pass
        
        # Try next year
        next_year = current_year + 1
        
        # Handle cases where day doesn't exist in target month
        max_day = calendar.monthrange(next_year, crawl_month)[1]
        target_day = min(crawl_day_of_month, max_day)
        
        next_date = datetime(next_year, crawl_month, target_day).date()
        return datetime.combine(next_date, crawl_time)
    
    return None


def get_frequency_display_text(frequency: CrawlFrequency) -> str:
    """Get display text for frequency"""
    display_map = {
        CrawlFrequency.MANUAL: "Thủ công",
        CrawlFrequency.DAILY: "Hằng ngày",
        CrawlFrequency.WEEKLY: "Hằng tuần", 
        CrawlFrequency.MONTHLY: "Hằng tháng",
        CrawlFrequency.YEARLY: "Hằng năm"
    }
    return display_map.get(frequency, "Không xác định")


def get_schedule_description(
    frequency: CrawlFrequency,
    crawl_time: Optional[time] = None,
    crawl_day_of_week: Optional[int] = None,
    crawl_day_of_month: Optional[int] = None,
    crawl_month: Optional[int] = None
) -> str:
    """Get human-readable schedule description"""
    if frequency == CrawlFrequency.MANUAL:
        return "Quét thủ công"
    
    time_str = crawl_time.strftime("%H:%M") if crawl_time else "09:00"
    
    if frequency == CrawlFrequency.DAILY:
        return f"Hằng ngày lúc {time_str}"
    
    elif frequency == CrawlFrequency.WEEKLY:
        days = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"]
        day_name = days[crawl_day_of_week] if crawl_day_of_week is not None else "Thứ 2"
        return f"Hằng tuần vào {day_name} lúc {time_str}"
    
    elif frequency == CrawlFrequency.MONTHLY:
        day = crawl_day_of_month if crawl_day_of_month is not None else 1
        return f"Hằng tháng ngày {day} lúc {time_str}"
    
    elif frequency == CrawlFrequency.YEARLY:
        months = [
            "", "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
            "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
        ]
        month_name = months[crawl_month] if crawl_month is not None else "Tháng 1"
        day = crawl_day_of_month if crawl_day_of_month is not None else 1
        return f"Hằng năm {month_name} ngày {day} lúc {time_str}"
    
    return "Không xác định"