"""
Unit tests for loan-intake-backend OCR parsing heuristics.
Run: pytest test_main.py -v
"""

import pytest
import re
from main import find_name, find_dob, find_address


class TestNameExtraction:
    def test_name_comma_separated(self):
        """Test LAST, FIRST format."""
        lines = ["SMITH, JOHN"]
        first, last = find_name(lines)
        assert first == "John"
        assert last == "Smith"

    def test_name_capitalized(self):
        """Test Capitalized First Last format."""
        lines = ["John Smith"]
        first, last = find_name(lines)
        assert first == "John"
        assert last == "Smith"

    def test_name_all_caps(self):
        """Test ALL CAPS format."""
        lines = ["JOHN SMITH"]
        first, last = find_name(lines)
        assert first == "John"
        assert last == "Smith"

    def test_name_labeled(self):
        """Test 'Name: First Last' format."""
        lines = ["Name: Alice Johnson"]
        first, last = find_name(lines)
        assert first == "Alice"
        assert last == "Johnson"

    def test_name_not_found(self):
        """Test no name found (single word or too short)."""
        lines = ["123", "456"]  # numeric only - no letters
        first, last = find_name(lines)
        assert first is None
        assert last is None


class TestDateOfBirthExtraction:
    def test_dob_mmddyyyy(self):
        """Test MM/DD/YYYY format."""
        lines = ["DOB: 01/15/1990"]
        dob = find_dob(lines)
        assert dob == "01/15/1990"

    def test_dob_iso(self):
        """Test YYYY-MM-DD format."""
        lines = ["1990-01-15"]
        dob = find_dob(lines)
        assert dob == "1990-01-15"

    def test_dob_not_found(self):
        """Test no DOB found."""
        lines = ["123 Main St", "City, State 12345"]
        dob = find_dob(lines)
        assert dob is None


class TestAddressExtraction:
    def test_address_city_state_zip(self):
        """Test City, ST ZIP format."""
        lines = ["123 Main Street", "Springfield, IL 62701"]
        street, city, state, zip_code = find_address(lines)
        assert city == "Springfield"
        assert state == "IL"
        assert zip_code == "62701"

    def test_address_city_state_zip_no_comma(self):
        """Test City ST ZIP format (no comma)."""
        lines = ["123 Oak Ave", "Denver CO 80202"]
        street, city, state, zip_code = find_address(lines)
        assert city == "Denver"
        assert state == "CO"
        assert zip_code == "80202"

    def test_address_zip_only(self):
        """Test fallback when only zip found."""
        lines = ["456 Elm St", "Somewhere 12345"]
        street, city, state, zip_code = find_address(lines)
        assert zip_code == "12345"

    def test_address_not_found(self):
        """Test no address found."""
        lines = ["John Smith", "01/15/1990"]
        street, city, state, zip_code = find_address(lines)
        assert street is None
        assert city is None
        assert state is None
        assert zip_code is None


class TestIntegration:
    def test_full_id_parsing(self):
        """Test parsing a realistic ID OCR result."""
        lines = [
            "SMITH, JOHN MICHAEL",
            "DOB: 06/22/1985",
            "456 Maple Drive",
            "Chicago, IL 60601",
        ]
        first, last = find_name(lines)
        dob = find_dob(lines)
        street, city, state, zip_code = find_address(lines)

        assert first == "John"
        assert last == "Smith"
        assert dob == "06/22/1985"
        assert city == "Chicago"
        assert state == "IL"
        assert zip_code == "60601"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
