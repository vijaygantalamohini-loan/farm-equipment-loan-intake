from equipment_intelligence.modules.equipment_history_module import equipment_history_module


def test_history_module_returns_events():
    result = equipment_history_module("SN1234", 400)
    assert "history" in result
    assert result["hour_consistency"] == "consistent"
