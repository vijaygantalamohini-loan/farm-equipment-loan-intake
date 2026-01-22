"""Ritchie Bros auction scraper utilities.

This module scrapes Ritchie Bros public auction listing pages and extracts
basic information (make, model, year, hours, price, location) for each lot.
It uses BeautifulSoup for HTML parsing and applies polite throttling between
requests. Results are returned as a list of normalized dictionaries.
"""

from __future__ import annotations

import asyncio
import random
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional

import httpx
from bs4 import BeautifulSoup

_DEFAULT_TIMEOUT = 15.0
_THROTTLE_SECONDS = (0.75, 1.5)
_USER_AGENT = "FarmEquipmentLoanIntake/1.0 (+https://github.com/)"


class RitchieBrosError(RuntimeError):
    """Raised when scraping fails."""


@dataclass
class Lot:
    title: str
    make: Optional[str]
    model: Optional[str]
    year: Optional[int]
    hours: Optional[float]
    price: Optional[float]
    currency: Optional[str]
    location: Optional[str]
    url: Optional[str]

    def as_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "make": self.make,
            "model": self.model,
            "year": self.year,
            "hours": self.hours,
            "price": self.price,
            "currency": self.currency,
            "location": self.location,
            "url": self.url,
            "source": "ritchie_bros",
        }


async def _fetch_html(url: str) -> str:
    headers = {"User-Agent": _USER_AGENT, "Accept": "text/html"}
    async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT, headers=headers) as client:
        response = await client.get(url)
    if response.status_code >= 400:
        raise RitchieBrosError(f"Request failed ({response.status_code}) for {url}")
    return response.text


def _parse_float(value: Optional[str]) -> Optional[float]:
    if not value:
        return None
    value = value.replace(",", "").strip()
    try:
        return float(value)
    except ValueError:
        return None


def _parse_int(value: Optional[str]) -> Optional[int]:
    if not value:
        return None
    value = value.strip()
    if not value or not value[0].isdigit():
        return None
    try:
        return int(value)
    except ValueError:
        return None


def _extract_text(node) -> Optional[str]:
    if not node:
        return None
    text = node.get_text(strip=True)
    return text or None


def _extract_lot(card) -> Optional[Lot]:
    title_node = card.select_one(".rb-lot-card__title-link")
    title = _extract_text(title_node) or "Auction lot"
    year = _parse_int(card.get("data-year") or card.get("data-lot-year"))
    make = card.get("data-manufacturer")
    model = card.get("data-model")
    details = card.select_one(".rb-lot-card__listing-details")
    hours = None
    location = None
    if details:
        for item in details.select("li"):
            label = _extract_text(item.select_one(".rb-lot-card__listing-label"))
            value = _extract_text(item.select_one(".rb-lot-card__listing-value"))
            if not label or not value:
                continue
            label_lower = label.lower()
            if "hours" in label_lower:
                hours = _parse_float(value)
            elif "location" in label_lower:
                location = value
    price_node = card.select_one(".rb-lot-card__price")
    price = None
    currency = None
    if price_node:
        amount = _extract_text(price_node.select_one(".rb-lot-card__price-value"))
        currency = _extract_text(price_node.select_one(".rb-lot-card__price-currency"))
        price = _parse_float(amount)
    url = None
    if title_node and title_node.has_attr("href"):
        url = title_node["href"]
    return Lot(
        title=title,
        make=make,
        model=model,
        year=year,
        hours=hours,
        price=price,
        currency=currency,
        location=location,
        url=url,
    )


def _parse_results(html: str) -> List[Dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    cards = soup.select(".rb-lot-card")
    lots: List[Dict[str, Any]] = []
    for card in cards:
        lot = _extract_lot(card)
        if lot:
            lots.append(lot.as_dict())
    return lots


def _throttle_delay() -> float:
    return random.uniform(*_THROTTLE_SECONDS)


async def fetch_auction_page(url: str) -> List[Dict[str, Any]]:
    """Fetch and parse a single Ritchie Bros auction page."""

    await asyncio.sleep(_throttle_delay())
    html = await _fetch_html(url)
    return _parse_results(html)


async def fetch_multiple(pages: Iterable[str]) -> List[Dict[str, Any]]:
    """Fetch multiple auction pages sequentially with throttling."""

    results: List[Dict[str, Any]] = []
    for page in pages:
        try:
            lots = await fetch_auction_page(page)
            results.extend(lots)
        except Exception as exc:
            raise RitchieBrosError(f"Failed to scrape {page}: {exc}") from exc
    return results
