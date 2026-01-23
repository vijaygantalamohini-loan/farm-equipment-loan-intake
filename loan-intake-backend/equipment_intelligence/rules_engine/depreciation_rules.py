CATEGORY_CURVES = {
    "tractor": 0.16,
    "combine": 0.14,
    "construction": 0.2,
}


def apply_fixed_curve(price, category="tractor"):
    factor = CATEGORY_CURVES.get(category, 0.16)
    return price * (1 - factor)


def age_based_adjustment(price, age_years: int | None):
    if age_years is None:
        return price
    if age_years <= 2:
        return price * 0.9
    if age_years <= 5:
        return price * (0.88 - 0.03 * (age_years - 2))
    if age_years <= 9:
        return price * (0.76 - 0.025 * (age_years - 5))
    return price * 0.6


def hour_based_adjustment(price, hours):
    if hours is None:
        return price
    if hours > 3500:
        return price * 0.78
    if hours > 2500:
        return price * 0.83
    if hours > 1500:
        return price * 0.88
    if hours > 750:
        return price * 0.93
    return price * 0.97
