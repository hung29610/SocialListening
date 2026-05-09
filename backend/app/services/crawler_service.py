"""
Crawler Service - Fetch and parse content from URLs
"""
import httpx
import hashlib
from bs4 import BeautifulSoup
from typing import Dict, Any, Optional, List
from datetime import datetime
import re
from urllib.parse import urlparse
import feedparser


class CrawlerService:
    """Service for crawling web content"""
    
    def __init__(self, user_agent: str = "Mozilla/5.0 (compatible; SocialListeningBot/1.0)"):
        self.user_agent = user_agent
        self.timeout = 30
    
    async def crawl_url(self, url: str) -> Dict[str, Any]:
        """
        Crawl a single URL and extract content
        
        Args:
            url: The URL to crawl
            
        Returns:
            Dict with title, content, metadata
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    url,
                    headers={"User-Agent": self.user_agent},
                    follow_redirects=True
                )
                response.raise_for_status()
                
                content_type = response.headers.get("content-type", "").lower()
                
                if "text/html" in content_type:
                    return await self._parse_html(url, response.text)
                elif "application/rss+xml" in content_type or "application/xml" in content_type:
                    return await self._parse_rss(url, response.text)
                else:
                    # Try to parse as HTML anyway
                    return await self._parse_html(url, response.text)
                    
        except httpx.HTTPError as e:
            return {
                "success": False,
                "error": f"HTTP error: {str(e)}",
                "url": url
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Crawl error: {str(e)}",
                "url": url
            }
    
    async def _parse_html(self, url: str, html: str) -> Dict[str, Any]:
        """Parse HTML content"""
        soup = BeautifulSoup(html, 'lxml')
        
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()
        
        # Extract title
        title = ""
        if soup.title:
            title = soup.title.string.strip() if soup.title.string else ""
        
        if not title:
            # Try og:title
            og_title = soup.find("meta", property="og:title")
            if og_title and og_title.get("content"):
                title = og_title["content"].strip()
        
        # Extract main content
        content = ""
        
        # Try to find main content area
        main_content = soup.find("article") or soup.find("main") or soup.find("div", class_=re.compile(r"content|article|post"))
        
        if main_content:
            content = main_content.get_text(separator="\n", strip=True)
        else:
            # Fallback to body
            body = soup.find("body")
            if body:
                content = body.get_text(separator="\n", strip=True)
        
        # Clean up content
        content = self._clean_text(content)
        
        # Extract metadata
        metadata = {
            "url": url,
            "domain": urlparse(url).netloc,
            "title": title,
            "content_length": len(content),
            "crawled_at": datetime.utcnow().isoformat()
        }
        
        # Try to extract published date
        published_date = self._extract_published_date(soup)
        if published_date:
            metadata["published_at"] = published_date
        
        # Try to extract author
        author = self._extract_author(soup)
        if author:
            metadata["author"] = author
        
        return {
            "success": True,
            "title": title,
            "content": content,
            "url": url,
            "metadata": metadata
        }
    
    async def _parse_rss(self, url: str, xml: str) -> Dict[str, Any]:
        """Parse RSS feed"""
        feed = feedparser.parse(xml)
        
        items = []
        for entry in feed.entries[:10]:  # Limit to 10 most recent
            title = entry.get("title", "")
            content = entry.get("summary", "") or entry.get("description", "")
            link = entry.get("link", url)
            
            # Clean HTML from content
            content = BeautifulSoup(content, 'lxml').get_text(separator="\n", strip=True)
            content = self._clean_text(content)
            
            published_at = None
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                published_at = datetime(*entry.published_parsed[:6]).isoformat()
            
            items.append({
                "title": title,
                "content": content,
                "url": link,
                "published_at": published_at,
                "author": entry.get("author", "")
            })
        
        return {
            "success": True,
            "feed_title": feed.feed.get("title", ""),
            "items": items,
            "url": url,
            "metadata": {
                "feed_url": url,
                "item_count": len(items),
                "crawled_at": datetime.utcnow().isoformat()
            }
        }
    
    def _clean_text(self, text: str) -> str:
        """Clean and normalize text"""
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        # Remove leading/trailing whitespace
        text = text.strip()
        return text
    
    def _extract_published_date(self, soup: BeautifulSoup) -> Optional[str]:
        """Try to extract published date from HTML"""
        # Try meta tags
        date_meta = soup.find("meta", property="article:published_time")
        if date_meta and date_meta.get("content"):
            return date_meta["content"]
        
        # Try time tag
        time_tag = soup.find("time")
        if time_tag and time_tag.get("datetime"):
            return time_tag["datetime"]
        
        return None
    
    def _extract_author(self, soup: BeautifulSoup) -> Optional[str]:
        """Try to extract author from HTML"""
        # Try meta tags
        author_meta = soup.find("meta", property="article:author") or soup.find("meta", attrs={"name": "author"})
        if author_meta and author_meta.get("content"):
            return author_meta["content"]
        
        # Try author class
        author_div = soup.find(class_=re.compile(r"author|byline"))
        if author_div:
            return author_div.get_text(strip=True)
        
        return None
    
    def match_keywords(
        self,
        content: str,
        keywords: List[str],
        excluded_keywords: List[str] = None
    ) -> Dict[str, Any]:
        """
        Match keywords in content
        
        Args:
            content: Text content to search
            keywords: List of keywords to match
            excluded_keywords: List of keywords that exclude the content
            
        Returns:
            Dict with matched keywords and positions
        """
        content_lower = content.lower()
        
        # Check excluded keywords first
        if excluded_keywords:
            for excluded in excluded_keywords:
                if excluded.lower() in content_lower:
                    return {
                        "matched": False,
                        "reason": f"Excluded keyword found: {excluded}"
                    }
        
        # Match keywords
        matched_keywords = []
        for keyword in keywords:
            keyword_lower = keyword.lower()
            if keyword_lower in content_lower:
                # Find all positions
                positions = []
                start = 0
                while True:
                    pos = content_lower.find(keyword_lower, start)
                    if pos == -1:
                        break
                    positions.append(pos)
                    start = pos + 1
                
                matched_keywords.append({
                    "keyword": keyword,
                    "count": len(positions),
                    "positions": positions[:5]  # Limit to first 5 positions
                })
        
        if matched_keywords:
            return {
                "matched": True,
                "keywords": matched_keywords,
                "total_matches": sum(k["count"] for k in matched_keywords)
            }
        else:
            return {
                "matched": False,
                "reason": "No keywords matched"
            }
    
    def calculate_content_hash(self, content: str) -> str:
        """Calculate SHA-256 hash of content for deduplication"""
        return hashlib.sha256(content.encode('utf-8')).hexdigest()


# Singleton instance
crawler_service = CrawlerService()
