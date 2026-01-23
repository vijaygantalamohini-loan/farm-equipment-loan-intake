import React, { useState, useEffect, useRef } from "react";
import { API_BASE } from "../services/api";

function LoanCalculator({ purchaseAssets, tradeIns, cashDown, purpose, onPurposeChange, onNaicsChange }) {
  const [naicsCode, setNaicsCode] = useState(null);
  const [naicsLoading, setNaicsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showPaymentEstimator, setShowPaymentEstimator] = useState(false);
  const [paymentFrequency, setPaymentFrequency] = useState("monthly");
  const [loanYears, setLoanYears] = useState(5);
  const [interestRate, setInterestRate] = useState(6.5);
  const purposeTimeoutRef = useRef(null);
  const suggestionsRef = useRef(null);
  
  // Common loan purposes for autocomplete
  const commonPurposes = [
    "Purchase tractor for farming operations",
    "Purchase combine harvester for crop production",
    "Purchase farm equipment for agricultural use",
    "Cattle ranching and livestock equipment",
    "Dairy farm equipment and operations",
    "Construction equipment and machinery",
    "Excavator for construction business",
    "Transportation and trucking equipment",
    "Forestry and logging equipment",
    "Purchase skid steer loader",
    "Purchase grain handling equipment",
    "Purchase irrigation system",
    "Purchase hay baling equipment"
  ];

  const totalEquipmentValue = purchaseAssets.reduce(
    (sum, asset) => sum + (parseFloat(asset.valueEstimate) || 0),
    0
  );

  const totalTradeInValue = tradeIns.reduce(
    (sum, tradeIn) => sum + (parseFloat(tradeIn.valueEstimate) || 0),
    0
  );

  const cashDownAmount = parseFloat(cashDown) || 0;

  const calculatedLoanAmount = Math.max(
    0,
    totalEquipmentValue - totalTradeInValue - cashDownAmount
  );

  // Calculate payment based on frequency
  const calculatePayment = () => {
    if (calculatedLoanAmount <= 0) return 0;
    
    const principal = calculatedLoanAmount;
    const annualRate = interestRate / 100;
    let paymentsPerYear;
    
    switch (paymentFrequency) {
      case "monthly": paymentsPerYear = 12; break;
      case "quarterly": paymentsPerYear = 4; break;
      case "bi-annual": paymentsPerYear = 2; break;
      case "annual": paymentsPerYear = 1; break;
      case "seasonal": paymentsPerYear = 4; break; // Assume 4 seasons
      default: paymentsPerYear = 12;
    }
    
    const totalPayments = loanYears * paymentsPerYear;
    const ratePerPeriod = annualRate / paymentsPerYear;
    
    if (ratePerPeriod === 0) {
      return principal / totalPayments;
    }
    
    // Standard loan payment formula: P * [r(1+r)^n] / [(1+r)^n - 1]
    const payment = principal * (ratePerPeriod * Math.pow(1 + ratePerPeriod, totalPayments)) / 
                    (Math.pow(1 + ratePerPeriod, totalPayments) - 1);
    
    return payment;
  };

  const estimatedPayment = calculatePayment();
  const frequencyLabel = {
    "monthly": "Monthly",
    "quarterly": "Quarterly",
    "bi-annual": "Bi-Annual",
    "annual": "Annual",
    "seasonal": "Seasonal"
  }[paymentFrequency] || "Monthly";

  // Lookup NAICS code when purpose changes
  useEffect(() => {
    if (!purpose || purpose.length < 3) {
      setNaicsCode(null);
      return;
    }

    // Debounce NAICS lookup
    if (purposeTimeoutRef.current) clearTimeout(purposeTimeoutRef.current);
    
    purposeTimeoutRef.current = setTimeout(async () => {
      setNaicsLoading(true);
      try {
        const url = API_BASE ? `${API_BASE}/lookup/naics?keyword=${encodeURIComponent(purpose)}` : `/lookup/naics?keyword=${encodeURIComponent(purpose)}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.found) {
          setNaicsCode(data);
          if (onNaicsChange) {
            // Pass only the NAICS code upstream; backend expects a scalar
            onNaicsChange(data.naics_code);
          }
        } else {
          setNaicsCode(null);
        }
      } catch (err) {
        console.error("NAICS lookup error:", err);
        setNaicsCode(null);
      } finally {
        setNaicsLoading(false);
      }
    }, 800);

    return () => {
      if (purposeTimeoutRef.current) clearTimeout(purposeTimeoutRef.current);
    };
  }, [purpose, onNaicsChange]);

  return (
    <div style={{
      backgroundColor: "#f8f9fa",
      border: "2px solid #007bff",
      borderRadius: "8px",
      padding: "20px",
      marginTop: "30px",
      marginBottom: "30px"
    }}>
      <h3 style={{ marginTop: 0, marginBottom: "20px", color: "#007bff" }}>
        💰 Loan Summary
      </h3>

      {/* Loan Details Inputs */}
      <div style={{ 
        backgroundColor: "#fff", 
        padding: "15px", 
        borderRadius: "4px", 
        marginBottom: "20px",
        border: "1px solid #ddd"
      }}>
        {/* Purpose and NAICS Code Row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
          {/* Purpose Field */}
          <div style={{ position: "relative" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "14px" }}>
              Purpose *
            </label>
            <input
              placeholder="e.g., Purchase tractor for farming operations"
              value={purpose}
              onChange={e => {
                onPurposeChange(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              required
              style={{ width: "100%", padding: "8px", fontSize: "14px" }}
            />
            
            {/* Autocomplete Suggestions */}
            {showSuggestions && purpose.length > 0 && (
              <div 
                ref={suggestionsRef}
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  backgroundColor: "white",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  marginTop: "2px",
                  maxHeight: "200px",
                  overflowY: "auto",
                  zIndex: 1000,
                  boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
                }}
              >
                {commonPurposes
                  .filter(p => p.toLowerCase().includes(purpose.toLowerCase()))
                  .slice(0, 6)
                  .map((suggestion, idx) => (
                    <div
                      key={idx}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onPurposeChange(suggestion);
                        setShowSuggestions(false);
                      }}
                      style={{
                        padding: "10px",
                        cursor: "pointer",
                        borderBottom: "1px solid #eee",
                        fontSize: "13px",
                        backgroundColor: "white"
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = "#f0f0f0"}
                      onMouseLeave={(e) => e.target.style.backgroundColor = "white"}
                    >
                      {suggestion}
                    </div>
                  ))}
              </div>
            )}
            
            {naicsLoading && (
              <small style={{ display: "block", marginTop: "3px", color: "#007bff", fontSize: "12px" }}>
                🔍 Looking up NAICS code...
              </small>
            )}
            {naicsCode && (
              <small style={{ display: "block", marginTop: "3px", color: "#28a745", fontSize: "12px", fontWeight: "500" }}>
                ✓ {naicsCode.description}
                <span style={{ marginLeft: "8px", color: "#666" }}>({naicsCode.sector})</span>
              </small>
            )}
          </div>

          {/* NAICS Code Field - Non-editable */}
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "14px" }}>
              NAICS Code <span style={{ fontWeight: "normal", fontSize: "12px", color: "#666" }}>(auto-detected)</span>
            </label>
            <input
              type="text"
              value={naicsCode ? `${naicsCode.naics_code} - ${naicsCode.description}` : ""}
              placeholder={naicsLoading ? "Looking up..." : "Enter purpose to auto-detect"}
              readOnly
              title={naicsCode ? `${naicsCode.naics_code} - ${naicsCode.description} (${naicsCode.sector})` : ""}
              style={{ 
                width: "100%", 
                padding: "8px", 
                fontSize: "14px",
                backgroundColor: naicsCode ? "#e9ecef" : "#f8f9fa",
                border: "1px solid #ced4da",
                color: naicsCode ? "#495057" : "#999",
                cursor: "not-allowed",
                fontWeight: naicsCode ? "500" : "normal"
              }}
            />
          </div>
        </div>
      </div>

      {/* Calculation */}
      <div style={{ fontSize: "15px", lineHeight: "2" }}>
        <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "8px" }}>
          <span>Total Equipment Value ({purchaseAssets.length} asset{purchaseAssets.length !== 1 ? 's' : ''}):</span>
          <strong style={{ fontSize: "16px" }}>${totalEquipmentValue.toLocaleString()}</strong>
        </div>

        {totalTradeInValue > 0 && (
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            paddingBottom: "8px",
            color: "#28a745"
          }}>
            <span>Less: Trade-In Allowance ({tradeIns.length} item{tradeIns.length !== 1 ? 's' : ''}):</span>
            <strong style={{ fontSize: "16px" }}>-${totalTradeInValue.toLocaleString()}</strong>
          </div>
        )}

        {cashDownAmount > 0 && (
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            paddingBottom: "8px",
            color: "#28a745"
          }}>
            <span>Less: Cash Down Payment:</span>
            <strong style={{ fontSize: "16px" }}>-${cashDownAmount.toLocaleString()}</strong>
          </div>
        )}

        <hr style={{ margin: "15px 0", border: "none", borderTop: "2px solid #007bff" }} />

        <div style={{ 
          display: "flex", 
          justifyContent: "space-between",
          fontSize: "18px",
          fontWeight: "bold",
          color: "#007bff"
        }}>
          <span>Loan Amount Requested:</span>
          <span>${calculatedLoanAmount.toLocaleString()}</span>
        </div>
      </div>

      {/* Payment Estimator Button */}
      {calculatedLoanAmount > 0 && (
        <div style={{ marginTop: "20px" }}>
          <button
            type="button"
            onClick={() => setShowPaymentEstimator(!showPaymentEstimator)}
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: "#17a2b8",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontSize: "15px",
              fontWeight: "bold",
              cursor: "pointer",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={e => e.target.style.backgroundColor = "#138496"}
            onMouseLeave={e => e.target.style.backgroundColor = "#17a2b8"}
          >
            📊 {showPaymentEstimator ? "Hide" : "Show"} Payment Estimator
          </button>

          {/* Payment Estimator Form */}
          {showPaymentEstimator && (
            <div style={{
              marginTop: "15px",
              padding: "20px",
              backgroundColor: "#fff",
              border: "2px solid #17a2b8",
              borderRadius: "8px"
            }}>
              <h4 style={{ marginTop: 0, color: "#17a2b8" }}>Payment Estimator</h4>
              
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "14px" }}>
                  Payment Frequency
                </label>
                <select
                  value={paymentFrequency}
                  onChange={e => setPaymentFrequency(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px",
                    fontSize: "14px",
                    borderRadius: "4px",
                    border: "1px solid #ced4da"
                  }}
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="bi-annual">Bi-Annual (Semi-Annual)</option>
                  <option value="annual">Annual</option>
                  <option value="seasonal">Seasonal (4 payments/year)</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "14px" }}>
                    Number of Years
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={loanYears}
                    onChange={e => setLoanYears(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
                    style={{
                      width: "100%",
                      padding: "8px",
                      fontSize: "14px",
                      borderRadius: "4px",
                      border: "1px solid #ced4da"
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "14px" }}>
                    Interest Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="25"
                    value={interestRate}
                    onChange={e => setInterestRate(Math.max(0, Math.min(25, parseFloat(e.target.value) || 0)))}
                    style={{
                      width: "100%",
                      padding: "8px",
                      fontSize: "14px",
                      borderRadius: "4px",
                      border: "1px solid #ced4da"
                    }}
                  />
                </div>
              </div>

              {/* Payment Quote Display */}
              <div style={{
                backgroundColor: "#e7f7f8",
                padding: "15px",
                borderRadius: "4px",
                border: "1px solid #17a2b8"
              }}>
                <div style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>
                  Estimated Payment:
                </div>
                <div style={{ 
                  fontSize: "28px", 
                  fontWeight: "bold", 
                  color: "#17a2b8",
                  marginBottom: "8px"
                }}>
                  ${estimatedPayment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: "13px", color: "#666" }}>
                  per {frequencyLabel.toLowerCase()} payment for {loanYears} year{loanYears !== 1 ? 's' : ''} at {interestRate}% APR
                </div>
                <div style={{ fontSize: "13px", color: "#666", marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #ccc" }}>
                  Total of {(loanYears * (paymentFrequency === "monthly" ? 12 : paymentFrequency === "quarterly" || paymentFrequency === "seasonal" ? 4 : paymentFrequency === "bi-annual" ? 2 : 1))} payments
                </div>
              </div>

              <div style={{
                marginTop: "12px",
                padding: "10px",
                backgroundColor: "#fff3cd",
                borderRadius: "4px",
                fontSize: "12px",
                color: "#856404"
              }}>
                ⓘ This is an estimate only. Actual payment amounts may vary based on final loan terms and conditions.
              </div>
            </div>
          )}
        </div>
      )}

      {calculatedLoanAmount === 0 && totalEquipmentValue > 0 && (
        <div style={{
          marginTop: "15px",
          padding: "10px",
          backgroundColor: "#fff3cd",
          border: "1px solid #ffc107",
          borderRadius: "4px",
          fontSize: "13px",
          color: "#856404"
        }}>
          ⚠️ Note: Your trade-in and cash down cover the full equipment value. No loan is needed.
        </div>
      )}

      {calculatedLoanAmount < 0 && (
        <div style={{
          marginTop: "15px",
          padding: "10px",
          backgroundColor: "#f8d7da",
          border: "1px solid #dc3545",
          borderRadius: "4px",
          fontSize: "13px",
          color: "#721c24"
        }}>
          ⚠️ Error: Trade-in and cash down exceed equipment value. Please review your entries.
        </div>
      )}
    </div>
  );
}

export default LoanCalculator;
