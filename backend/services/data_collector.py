import requests
import time
from typing import List, Dict
from bs4 import BeautifulSoup
import feedparser

class RedditCollector:
    def __init__(self):
        self.base_url = "https://www.reddit.com"
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }

    def search_subreddit(self, subreddit: str, query: str, limit: int = 50) -> List[Dict]:
        posts = []
        url = f"{self.base_url}/r/{subreddit}/search.json"

        params = {
            'q': query,
            'restrict_sr': 'on',
            'sort': 'relevance',
            'limit': min(limit, 100),
            't': 'month'
        }

        try:
            response = requests.get(url, headers=self.headers, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()

            for child in data.get('data', {}).get('children', []):
                post = child.get('data', {})
                posts.append({
                    'title': post.get('title', ''),
                    'text': post.get('selftext', ''),
                    'full_text': f"{post.get('title', '')} {post.get('selftext', '')}",
                    'url': f"https://reddit.com{post.get('permalink', '')}",
                    'platform': 'reddit'
                })

            time.sleep(2)

        except Exception as e:
            print(f"Reddit error: {e}")

        return posts

    def collect_policy_data(self, max_total: int = 100) -> List[Dict]:
        """Collect with DIVERSE location-specific queries"""
        
        # Location-specific queries for diverse data
        location_queries = [
            'Koramangala traffic',
            'Whitefield metro',
            'Indiranagar park',
            'HSR water',
            'Jayanagar garbage',
            'Silk Board junction',
            'Electronic City commute',
            'Marathahalli infrastructure',
            'Bellandur lake',
            'BTM road',
            'Malleshwaram waste',
            'Yelahanka development',
            'Hebbal flyover',
            'MG Road parking',
            'Banashankari planning',
        ]
        
        # General policy queries
        general_queries = [
            'BBMP corruption',
            'Bangalore metro delay',
            'lake restoration success',
            'tree planting drive',
            'smart city project',
        ]
        
        all_queries = location_queries + general_queries
        
        all_posts = []
        posts_per_query = max(3, max_total // len(all_queries))

        for q in all_queries:
            if len(all_posts) >= max_total:
                break
            posts = self.search_subreddit('bangalore', q, posts_per_query)
            all_posts.extend(posts)
            print(f"  ✓ '{q}': {len(posts)} posts")

        # Remove duplicates
        unique = {p['url']: p for p in all_posts if p.get('url')}
        result = list(unique.values())[:max_total]
        
        print(f"✓ Collected {len(result)} unique Reddit posts with diverse locations")
        return result


class NewsCollector:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }

        self.rss_feeds = [
            'https://www.thehindu.com/news/cities/bangalore/?service=rss',
            'https://www.deccanherald.com/bengaluru/rss',
            'https://bangaloremirror.indiatimes.com/rssfeedstopstories.cms',
            'https://www.ndtv.com/rss/cities/bengaluru',
            'https://indianexpress.com/section/cities/bangalore/feed/',
            'https://www.hindustantimes.com/rss/cities/bengaluru/rssfeed.xml',
            'https://timesofindia.indiatimes.com/rssfeeds/-2128833038.cms'
        ]

        self.keywords = [
            'bbmp', 'metro', 'water', 'lake', 'traffic',
            'infrastructure', 'garbage', 'bwssb',
            'pollution', 'development', 'planning',
            # Location keywords
            'koramangala', 'whitefield', 'hsr', 'btm',
            'indiranagar', 'jayanagar', 'marathahalli'
        ]

        self.junk_phrases = [
            'newsletter', 'e-paper', 'first day first show',
            'subscribe', 'today\'s edition', 'sign up',
            'download the app'
        ]

    def fetch_from_rss(self, feed_url: str, max_articles: int = 20) -> List[Dict]:
        articles = []

        try:
            feed = feedparser.parse(feed_url)
            for entry in feed.entries[:max_articles]:
                articles.append({
                    'title': entry.get('title', ''),
                    'text': entry.get('summary', ''),
                    'full_text': f"{entry.get('title','')} {entry.get('summary','')}",
                    'url': entry.get('link', ''),
                    'platform': 'news'
                })
            time.sleep(1)
        except Exception as e:
            print(f"RSS error {feed_url}: {e}")

        return articles

    def scrape_article_content(self, url: str) -> str:
        try:
            r = requests.get(url, headers=self.headers, timeout=10)
            r.raise_for_status()
            soup = BeautifulSoup(r.content, 'html.parser')
            return ' '.join(p.get_text() for p in soup.find_all('p'))
        except Exception:
            return ""

    def is_junk(self, text: str) -> bool:
        t = text.lower()
        return any(j in t for j in self.junk_phrases)

    def collect_news_articles(self, max_total: int = 50) -> List[Dict]:
        all_articles = []
        per_feed = max(20, max_total // len(self.rss_feeds))

        for feed in self.rss_feeds:
            raw = self.fetch_from_rss(feed, per_feed)
            for article in raw:
                full = self.scrape_article_content(article['url'])
                if not full:
                    continue

                article['full_text'] = full

                if self.is_junk(full):
                    continue

                # Only include if mentions keywords
                if any(k in full.lower() for k in self.keywords):
                    all_articles.append(article)

        unique = {a['url']: a for a in all_articles if a.get('url')}
        result = list(unique.values())[:max_total]
        
        print(f"Collected {len(result)} unique news articles")
        return result


class DataCollector:
    def __init__(self):
        self.reddit = RedditCollector()
        self.news = NewsCollector()

    def collect_all(self, reddit_max=100, news_max=100) -> List[Dict]:
        print("collecting data from Reddit and News sources...")
        
        data = []
        data.extend(self.reddit.collect_policy_data(reddit_max))
        data.extend(self.news.collect_news_articles(news_max))
        
        print(f"total collected: {len(data)} items")
        print(f"  Reddit: {sum(1 for d in data if d.get('platform') == 'reddit')}")
        print(f"  News: {sum(1 for d in data if d.get('platform') == 'news')}")
        
        return data