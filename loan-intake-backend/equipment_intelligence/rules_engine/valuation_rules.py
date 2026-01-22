from datetime import datetime

BASE_RULES = {
    ("John Deere", "5075E"): 92000,
    ("John Deere", "6155R"): 168000,
    ("Case IH", "Puma 165"): 175000,
    ("Caterpillar", "320"): 185000,
}

DEFAULT_BASE_PRICE = 72000

REGION_ADJUSTMENTS = {
    "TX": 1.05,
    "NE": 1.02,
    "IA": 0.98,
    "IL": 1.0,
    "MN": 1.01,
    "WI": 1.0,
    "KS": 0.99,
}

CONDITION_FACTORS = {
    "excellent": 1.08,
    "very good": 1.04,
    "good": 1.0,
    "fair": 0.92,
    "poor": 0.82,
}


def rule_based_price(make, model):
    key = (make, model)
    if key in BASE_RULES:
        return BASE_RULES[key]
    return None


def estimate_price_from_model(model: str | None):
    if not model:
        return None
    digits = "".join(ch for ch in model if ch.isdigit())
    if not digits:
        return None
    hp_guess = int(digits[-3:]) if len(digits) >= 3 else int(digits)
    if hp_guess <= 80:
        return 65000 + (hp_guess * 220)
    if hp_guess <= 130:
        return 90000 + (hp_guess - 80) * 320
    return 120000 + (hp_guess - 130) * 360


def apply_condition_factor(price, condition: str | None):
    if not condition:
        return price
    factor = CONDITION_FACTORS.get(condition.lower(), 1.0)
    return price * factor


def apply_age_adjustment(price, year: int | None):
    if not year:
        return price
    current_year = datetime.utcnow().year
    age = max(0, current_year - year)
    if age == 0:
        return price * 1.03
    if age <= 3:
        return price * (1 - (age * 0.02))
    if age <= 7:
        return price * (0.94 - ((age - 3) * 0.025))
    return price * 0.78


def apply_hours_adjustment(price, hours: int | float | None):
    if hours is None:
        return price
    if hours <= 500:
        return price * 1.04
    if hours <= 1500:
        return price * 0.97
    if hours <= 3000:
        return price * 0.9
    return price * 0.82


def apply_region_adjustment(price, region):
    if not region:
        return price
    factor = REGION_ADJUSTMENTS.get(region.upper(), 1.0)
    return price * factor


def seasonal_adjustment(price):
    month = datetime.utcnow().month
    if 3 <= month <= 5:
        return price * 1.04
    if 9 <= month <= 11:
        return price * 0.96
    return price
