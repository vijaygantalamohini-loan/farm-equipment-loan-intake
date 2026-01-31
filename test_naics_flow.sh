#!/bin/bash
# Test NAICS lookup functionality

echo "=== Testing NAICS Lookup API ==="
echo ""

echo "Test 1: Lookup 'cattle'"
curl -s http://localhost:8000/lookup/naics?keyword=cattle | jq -r 'if .found then "✓ Found: \(.naics_code) - \(.description)" else "✗ Not found" end'
echo ""

echo "Test 2: Lookup 'dairy'"
curl -s http://localhost:8000/lookup/naics?keyword=dairy | jq -r 'if .found then "✓ Found: \(.naics_code) - \(.description)" else "✗ Not found" end'
echo ""

echo "Test 3: Lookup 'farm equipment'"
curl -s http://localhost:8000/lookup/naics?keyword=farm%20equipment | jq -r 'if .found then "✓ Found: \(.naics_code) - \(.description)" else "✗ Not found" end'
echo ""

echo "Test 4: Lookup 'tractor'"
curl -s http://localhost:8000/lookup/naics?keyword=tractor | jq -r 'if .found then "✓ Found: \(.naics_code) - \(.description)" else "✗ Not found" end'
echo ""

echo "=== Checking Frontend Implementation ==="
echo ""

if grep -q "handleChange(\"naicsCode\", data.naics_code" /workspaces/farm-equipment-loan-intake/loan-intake-frontend/src/components/BorrowerInfoStep.js; then
    echo "✓ NAICS handleChange found in BorrowerInfoStep.js"
else
    echo "✗ NAICS handleChange NOT found"
fi

if grep -q "const naicsCode = initialData?.borrower?.naicsCode" /workspaces/farm-equipment-loan-intake/loan-intake-frontend/src/components/LoanRequestStep.js; then
    echo "✓ NAICS reading from borrower in LoanRequestStep.js"
else
    echo "✗ NAICS NOT reading from borrower"
fi

echo ""
echo "=== Service Status ==="
echo ""

if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "✓ Backend running on port 8000"
else
    echo "✗ Backend NOT responding"
fi

if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✓ Frontend running on port 3000"
else
    echo "✗ Frontend NOT responding"
fi

if curl -s http://localhost:3005/health > /dev/null 2>&1; then
    echo "✓ Workflow Engine running on port 3005"
else
    echo "✗ Workflow Engine NOT responding"
fi

echo ""
echo "=== Test Instructions ==="
echo ""
echo "To test NAICS auto-population in the browser:"
echo "1. Open http://localhost:3000"
echo "2. Navigate to Step 1 (Borrower Information)"
echo "3. In the 'Purpose' field, type: cattle"
echo "4. Wait 1 second (800ms debounce)"
echo "5. The NAICS Code field should auto-populate with: 112111"
echo "6. Check browser DevTools Console for any errors"
echo ""
echo "The NAICS code should also appear in Step 4 AI Pre-qualification"
