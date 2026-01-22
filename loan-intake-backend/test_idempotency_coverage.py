import uuid
import datetime

from database import SessionLocal, IdempotencyKey
from services.loans.idempotency import check_and_store


def test_idempotency_empty_key_returns_true_and_does_not_store():
    db = SessionLocal()
    try:
        before = db.query(IdempotencyKey).count()
        assert check_and_store(db, "") is True
        after = db.query(IdempotencyKey).count()
        assert after == before
    finally:
        db.close()


def test_idempotency_new_key_stores_and_sets_expires():
    db = SessionLocal()
    try:
        key = f"test-{uuid.uuid4()}"
        assert check_and_store(db, key) is True
        row = db.query(IdempotencyKey).filter(IdempotencyKey.key == key).first()
        assert row is not None
        assert row.expires_at is not None
        exp = row.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=datetime.UTC)
        assert exp > datetime.datetime.now(datetime.UTC)
    finally:
        db.close()


def test_idempotency_duplicate_key_before_expiry_returns_false():
    db = SessionLocal()
    try:
        key = f"dup-{uuid.uuid4()}"
        assert check_and_store(db, key) is True
        # Second call should be considered duplicate while not expired
        assert check_and_store(db, key) is False
    finally:
        db.close()


def test_idempotency_expired_key_allows_reuse_and_updates_expiry():
    db = SessionLocal()
    try:
        key = f"expired-{uuid.uuid4()}"
        past = datetime.datetime.now(datetime.UTC) - datetime.timedelta(hours=1)
        row = IdempotencyKey(key=key, expires_at=past)
        db.add(row)
        db.commit()

        assert check_and_store(db, key) is True
        refreshed = db.query(IdempotencyKey).filter(IdempotencyKey.key == key).first()
        assert refreshed.expires_at is not None
        exp2 = refreshed.expires_at
        if exp2.tzinfo is None:
            exp2 = exp2.replace(tzinfo=datetime.UTC)
        assert exp2 > datetime.datetime.now(datetime.UTC)
    finally:
        db.close()


def test_idempotency_none_expiry_is_treated_as_duplicate():
    db = SessionLocal()
    try:
        key = f"none-expiry-{uuid.uuid4()}"
        row = IdempotencyKey(key=key, expires_at=None)
        db.add(row)
        db.commit()

        assert check_and_store(db, key) is False
    finally:
        db.close()
