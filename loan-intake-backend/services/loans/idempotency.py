"""
Simple in-memory idempotency tracker for draft/submit operations.
In production, replace with a shared store (Redis/DB) with TTL.
"""

import datetime
from sqlalchemy.orm import Session

from core.settings import get_settings
from database import IdempotencyKey
from logging_config import get_struct_logger

settings = get_settings()
log = get_struct_logger("idempotency")


def check_and_store(db: Session, key: str) -> bool:
    """
    Returns True if key is new and stores it; False if duplicate (still valid).
    """
    if not key:
        return True

    now = datetime.datetime.now(datetime.UTC)
    ttl = datetime.timedelta(seconds=settings.idempotency_ttl_seconds)
    expires_at = now + ttl

    existing = db.query(IdempotencyKey).filter(IdempotencyKey.key == key).first()
    if existing:
        if existing.expires_at is None:
            log.info("idempotency_duplicate", key=key)
            return False
        exp = existing.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=datetime.UTC)
        if exp > now:
            log.info("idempotency_duplicate", key=key)
            return False

    # Upsert-like behavior
    if not existing:
        existing = IdempotencyKey(key=key)
        db.add(existing)

    existing.expires_at = expires_at
    db.commit()
    log.info("idempotency_stored", key=key, expires_at=expires_at.isoformat())
    return True
