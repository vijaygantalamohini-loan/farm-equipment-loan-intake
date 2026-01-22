def high_ltv_flag(ltv):
    if ltv is None:
        return False
    return ltv > 0.9


def old_equipment_flag(year):
    if year is None:
        return False
    return year < 2015


def missing_serial_flag(serial):
    return not bool(serial)


def inconsistent_hours_flag(hours):
    if hours is None:
        return False
    return hours > 3000
