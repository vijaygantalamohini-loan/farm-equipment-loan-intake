from equipment_intelligence.modules.serial_number_module import serial_number_module


def test_serial_module_confidence():
    result = serial_number_module("1LV5075EXHN123456")
    assert result["confidence"] > 0
    assert result["manufacturer"] == "John Deere"


def test_serial_module_john_deere_8r410():
    serial = "1RW8410DKRD260717"
    result = serial_number_module(serial)

    assert result["manufacturer"] == "John Deere"
    assert result["model"] == "8R 410"
    assert result["valid_format"] is True
    assert result["decoded_year"] in {2024, 2025}
    assert result["confidence"] >= 0.6


def test_serial_module_case_ih():
    result = serial_number_module("JJC1822345")

    assert result["manufacturer"] == "Case IH"
    assert result["metadata"].get("top_manufacturer") is True
    assert result["metadata"].get("brand") == "Case IH"
    assert result["decoded_year"] == 2018
    assert result["model"].startswith("Series")


def test_serial_module_new_holland():
    result = serial_number_module("ZBJFH12345678")

    assert result["manufacturer"] == "New Holland"
    assert result["metadata"].get("top_manufacturer") is True
    assert result["metadata"].get("brand") == "New Holland"
    assert result["decoded_year"] == 2017


def test_serial_module_kubota():
    result = serial_number_module("L4330-12345")

    assert result["manufacturer"] == "Kubota"
    assert result["metadata"].get("top_manufacturer") is True
    assert result["metadata"].get("brand") == "Kubota"
    assert result["model"].startswith("L4330")


def test_serial_module_kubota_vin():
    result = serial_number_module("KBUL3CHCPS8F30189")

    assert result["manufacturer"] == "Kubota"
    assert result["decoded_year"] == 2025
    assert result["metadata"].get("vin_fallback", {}).get("year") == "2025"
    assert result["confidence"] >= 0.6


def test_serial_module_agco_vin():
    result = serial_number_module("AG3MGC250RKV05104")

    assert result["manufacturer"] == "AGCO"
    assert result["decoded_year"] == 2024
    assert result["metadata"].get("vin_fallback", {}).get("manufacturer") == "AGCO"


def test_serial_module_massey_ferguson():
    result = serial_number_module("MF7718-2023A001")

    assert result["manufacturer"] == "Massey Ferguson"
    assert result["metadata"].get("top_manufacturer") is True
    assert result["metadata"].get("brand") == "Massey Ferguson"
    assert result["decoded_year"] == 2023
    assert result["model"] == "7718"


def test_serial_module_claas():
    result = serial_number_module("CLAAS-LEXION770-2024")

    assert result["manufacturer"] == "Claas"
    assert result["metadata"].get("top_manufacturer") is None
    assert result["metadata"].get("brand") == "Claas"
    assert result["decoded_year"] == 2024
