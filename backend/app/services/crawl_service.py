"""
Crawl Service for Social Listening Platform
Handles web scraping and content collection from sources
"""
import hashlib
import requests
from datetime import datetime
from typing import Dict, List
from bs4 import BeautifulSoup
import feedparser
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.source import Source
from app.models.keyword import Keyword
from app.models.mention import Mention


def generate_content_hash(content: str) -> str:
    """Generate SHA-256 hash of content for deduplication"""
    return hashlib.sha256(content.encode('utf-8')).hexdigest()


def check_keyword_match(content: str, keywords: List[Keyword]) -> List[int]:
    """
    Check if content matches any keywords
    
    Args:
        content: Content to check
        keywords: List of Keyword objects
        
    Returns:
        List of matched keyword IDs
    """
    content_lower = content.lower()
    matched = []
    
    for kw in keywords:
        if not kw.is_active:
            continue
        
        keyword_lower = kw.keyword.lower()
        if keyword_lower in content_lower:
            matched.append(kw.id)
    
    return matched


def crawl_rss_feed(url: str) -> List[Dict]:
    """
    Crawl RSS/Atom feed
    
    Args:
        url: RSS feed URL
        
    Returns:
        List of articles
    """
    try:
        feed = feedparser.parse(url)
        articles = []
        
        for entry in feed.entries[:20]:  # Limit to 20 latest entries
            articles.append({
                'title': entry.get('title', ''),
                'content': entry.get('summary', '') or entry.get('description', ''),
                'url': entry.get('link', ''),
                'author': entry.get('author', ''),
                'published_at': datetime(*entry.published_parsed[:6]) if hasattr(entry, 'published_parsed') else None
            })
        
        return articles
        
    except Exception as e:
        print(f"Error crawling RSS feed {url}: {e}")
        return []


def crawl_html_page(url: str) -> List[Dict]:
    """
    Crawl HTML page using BeautifulSoup
    
    Args:
        url: Page URL
        
    Returns:
        List of articles (usually just one for HTML pages)
    """
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Try to extract title
        title = ''
        if soup.title:
            title = soup.title.string
        elif soup.find('h1'):
            title = soup.find('h1').get_text()
        
        # Try to extract main content
        content = ''
        
        # Try common content containers
        for selector in ['article', 'main', '.content', '#content', '.post-content']:
            container = soup.select_one(selector)
            if container:
                content = container.get_text(separator=' ', strip=True)
                break
        
        # Fallback to body
        if not content and soup.body:
            content = soup.body.get_text(separator=' ', strip=True)
        
        # Clean up content
        content = ' '.join(content.split())[:5000]  # Limit to 5000 chars
        
        return [{
            'title': title,
            'content': content,
            'url': url,
            'author': '',
            'published_at': None
        }]
        
    except Exception as e:
        print(f"Error crawling HTML page {url}: {e}")
        return []


def crawl_source(db: Session, source_id: int, job_id: int = None) -> Dict:
    """
    Crawl a source and save mentions
    
    Args:
        db: Database session
        source_id: Source ID to crawl
        job_id: Optional crawl job ID for tracking
        
    Returns:
        dict with crawl results
    """
    # Get source
    source = db.execute(
        select(Source).where(Source.id == source_id)
    ).scalar_one_or_none()
    
    if not source:
        raise ValueError(f"Source {source_id} not found")
    
    if not source.is_active:
        raise ValueError(f"Source {source_id} is not active")
    
    # Get active keywords for this source's group
    keywords = []
    if source.keyword_group_id:
        from app.models.keyword import KeywordGroup
        group = db.execute(
            select(KeywordGroup).where(KeywordGroup.id == source.keyword_group_id)
        ).scalar_one_or_none()
        
        if group:
            keywords = db.execute(
                select(Keyword).where(
                    Keyword.group_id == group.id,
                    Keyword.is_active == True
                )
            ).scalars().all()
    
    # Crawl based on source type
    articles = []
    
    if source.source_type == 'rss':
        articles = crawl_rss_feed(source.url)
    elif source.source_type in ['website', 'news']:
        articles = crawl_html_page(source.url)
    else:
        # For social media, return empty for now (requires API integration)
        print(f"Source type {source.source_type} not yet supported for automated crawling")
        return {
            'mentions_found': 0,
            'mentions_new': 0,
            'mentions_duplicate': 0
        }
    
    # Process articles
    mentions_found = len(articles)
    mentions_new = 0
    mentions_duplicate = 0
    
    for article in articles:
        # Generate content hash
        content_hash = generate_content_hash(article['content'])
        
        # Check if already exists
        existing = db.execute(
            select(Mention).where(Mention.content_hash == content_hash)
        ).scalar_one_or_none()
        
        if existing:
            mentions_duplicate += 1
            continue
        
        # Check keyword match
        matched_keywords = check_keyword_match(
            f"{article['title']} {article['content']}",
            keywords
        )
        
        # Only save if keywords match (or no keywords configured)
        if matched_keywords or not keywords:
            mention = Mention(
                source_id=source_id,
                title=article['title'][:500] if article['title'] else None,
                content=article['content'],
                content_hash=content_hash,
                url=article['url'],
                author=article['author'][:500] if article['author'] else None,
                published_at=article['published_at'],
                collected_at=datetime.utcnow(),
                matched_keywords=matched_keywords if matched_keywords else None
            )
            
            db.add(mention)
            mentions_new += 1
    
    # Commit all mentions
    if mentions_new > 0:
        db.commit()
    
    return {
        'mentions_found': mentions_found,
        'mentions_new': mentions_new,
        'mentions_duplicate': mentions_duplicate
    }
