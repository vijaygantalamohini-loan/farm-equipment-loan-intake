from equipment_intelligence.orchestrator.intelligence_orchestrator import intelligence_orchestrator


def test_orchestrator_collates_results():
    result = intelligence_orchestrator(
        "John Deere",
        "5075E",
        2021,
        400,
        "1LV5075EXHN123456",
        "IA",
        "Excellent",
        loan_amount=120000,
        ltv=0.8,
    )
    assert "valuation" in result
    assert "serial_number" in result
    assert isinstance(result["risk_flags"], list)
