# fetch.py
import aiohttp
import asyncio
import random
import time
import sqlite3
from typing import Optional, Tuple
from urllib.parse import urlparse, urljoin, urlunparse
import urllib.robotparser

CACHE_DB = 'fetch_cache.sqlite'
MAX_CONCURRENCY = 3
MIN_DELAY = 1.0
MAX_DELAY = 3.0

class Fetcher:
    def __init__(self):
        self.sem = asyncio.Semaphore(MAX_CONCURRENCY)
        self.session = None
        self.robot_parsers = {}
        self.conn = sqlite3.connect(CACHE_DB, check_same_thread=False)
        self._init_db()
        self.last_request_time = {}
        self.default_headers = {
            "User-Agent": self._random_user_agent(),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "Upgrade-Insecure-Requests": "1",
            "DNT": "1",
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Dest": "document",
            "sec-ch-ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
        }

    def _init_db(self):
        c = self.conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS cache (
                        url TEXT PRIMARY KEY,
                        etag TEXT,
                        last_modified TEXT,
                        content BLOB
                    )''')
        self.conn.commit()

    def _random_user_agent(self) -> str:
        candidates = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36",
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
        ]
        return random.choice(candidates)

    async def __aenter__(self):
        self.session = aiohttp.ClientSession(headers=self.default_headers)
        return self

    async def __aexit__(self, exc_type, exc, tb):
        await self.session.close()
        self.conn.close()

    async def obey_robots(self, url: str) -> bool:
        parsed = urlparse(url)
        base = urlunparse((parsed.scheme, parsed.netloc, '', '', '', ''))
        if base not in self.robot_parsers:
            rp = urllib.robotparser.RobotFileParser()
            robots_url = urljoin(base, '/robots.txt')
            try:
                async with self.session.get(robots_url) as resp:
                    if resp.status == 200:
                        robots_text = await resp.text()
                        rp.parse(robots_text.splitlines())
                    else:
                        rp = None
            except Exception:
                rp = None
            self.robot_parsers[base] = rp

        rp = self.robot_parsers.get(base)
        if rp is None:
            return True
        return rp.can_fetch("*", url)

    async def get(self, url: str) -> Optional[str]:
        if not await self.obey_robots(url):
            print(f"Blocked by robots.txt: {url}")
            return None

        await self._rate_limit(url)
        async with self.sem:
            c = self.conn.cursor()
            c.execute('SELECT etag, last_modified, content FROM cache WHERE url=?', (url,))
            row = c.fetchone()
            headers = dict(self.default_headers)
            if "Referer" not in headers:
                headers["Referer"] = "https://www.tractorhouse.com/"
            if row:
                etag, last_modified, content = row
                if etag:
                    headers['If-None-Match'] = etag
                if last_modified:
                    headers['If-Modified-Since'] = last_modified

            try:
                async with self.session.get(url, headers=headers) as resp:
                    if resp.status == 304:
                        # Use cached content
                        return content.decode('utf-8')
                    if resp.status == 200:
                        etag = resp.headers.get('ETag')
                        last_modified = resp.headers.get('Last-Modified')
                        text = await resp.text()
                        # cache response
                        c.execute('REPLACE INTO cache (url, etag, last_modified, content) VALUES (?, ?, ?, ?)',
                                  (url, etag, last_modified, text.encode('utf-8')))
                        self.conn.commit()
                        return text
                    else:
                        print(f"Failed to fetch {url} status={resp.status}")
                        return None
            except Exception as e:
                print(f"Exception fetching {url}: {e}")
                return None

    async def _rate_limit(self, url):
        parsed = urlparse(url)
        domain = parsed.netloc
        now = time.time()
        last = self.last_request_time.get(domain, 0)
        delay = random.uniform(MIN_DELAY, MAX_DELAY)
        to_wait = last + delay - now
        if to_wait > 0:
            await asyncio.sleep(to_wait)
        self.last_request_time[domain] = time.time()
