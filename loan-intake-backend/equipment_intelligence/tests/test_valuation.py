from equipment_intelligence.modules.valuation_module import valuation_module


def test_valuation_module_reports_values():
    result = valuation_module("John Deere", "5075E", 2021, 400, "IA", "Excellent")
    assert "blended_value" in result
    assert result["confidence"] <= 1.0
