from equipment_intelligence.modules.predictive_resale_module import predictive_resale_module


def test_resale_module_prediction():
    result = predictive_resale_module("John Deere", "5075E", 2020, 200, "IA", "Excellent")
    assert "predicted_resale" in result
    assert result["depreciated"] >= 0
