import React, { useMemo, useState } from "react";
import { formatCurrency } from "../utils/format";
import { routeApplication } from "../utils/routingEngine";

const initialPrefs = {
  minAmount: 25000,
  maxAmount: 100000,
  minDownPaymentPercent: 10,
  equipmentTypes: ["Tractor", "Combine Harvester"],
  states: ["CA", "TX"],
  naicsCodes: ["1111", "1122"],
};

const allEquipment = ["Tractor", "Combine Harvester", "Baler", "Sprayer", "Planter"];
const allStates = ["CA", "TX", "IA", "IL", "NE", "KS", "MN", "MO", "SD", "ND"];
const allNAICS = ["1111", "1122", "1151", "1152", "4842"];

const SAMPLE_LENDERS = [
  {
    lenderId: "AgCredit",
    displayName: "AgCredit Financial",
    minLoanAmount: 20000,
    maxLoanAmount: 150000,
    allowedEquipmentTypes: ["Tractor", "Combine Harvester", "Planter"],
    allowedStates: ["CA", "TX", "IA"],
    allowedNaicsCodes: ["1111", "1122"],
    minCreditScore: 660,
    minIncome: 60000,
    maxLTV: 0.8,
    minDownPaymentPercent: 0.1,
    allowedLoanTerms: [60, 72, 84],
    allowUsedEquipment: true,
    requireSerialNumber: true,
    excludeTradeIns: false,
  },
  {
    lenderId: "GreenValley",
    displayName: "Green Valley Capital",
    minLoanAmount: 30000,
    maxLoanAmount: 200000,
    allowedEquipmentTypes: ["Baler", "Sprayer", "Planter"],
    allowedStates: ["TX", "IA", "NE"],
    allowedNaicsCodes: ["1111", "1151"],
    minCreditScore: 680,
    minIncome: 70000,
    maxLTV: 0.85,
    minDownPaymentPercent: 0.15,
    allowedLoanTerms: [48, 60, 72],
    allowUsedEquipment: false,
    requireSerialNumber: false,
    excludeTradeIns: true,
  },
  {
    lenderId: "PrairieBank",
    displayName: "Prairie State Bank",
    minLoanAmount: 10000,
    maxLoanAmount: 120000,
    allowedEquipmentTypes: ["Tractor", "Baler", "Sprayer"],
    allowedStates: ["IA", "MN", "ND"],
    allowedNaicsCodes: ["1111", "4842"],
    minCreditScore: 640,
    minIncome: 50000,
    maxLTV: 0.9,
    minDownPaymentPercent: 0.05,
    allowedLoanTerms: [36, 48, 60],
    allowUsedEquipment: true,
    requireSerialNumber: true,
    excludeTradeIns: false,
  },
];

function LenderPreferences() {
  const [prefs, setPrefs] = useState(initialPrefs);

  const handleChange = (field, value) => {
    setPrefs(prev => ({ ...prev, [field]: value }));
  };

  const handleMultiChange = (field, value) => {
    setPrefs(prev => {
      const arr = prev[field];
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value],
      };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: Save preferences to backend
    alert("Preferences saved! (not yet wired to backend)");
  };

  const previewLoanAmount = useMemo(() => {
    const min = prefs.minAmount || 40000;
    const max = prefs.maxAmount || Math.max(min, 150000);
    const midpoint = Math.round((min + max) / 2);
    return Math.min(Math.max(midpoint, min), max);
  }, [prefs.minAmount, prefs.maxAmount]);

  const previewApplication = useMemo(() => {
    const equipmentTypes = prefs.equipmentTypes.length ? prefs.equipmentTypes : ["Tractor"];
    const perEquipmentValue = Math.max(15000, Math.round(previewLoanAmount / Math.max(1, equipmentTypes.length)));
    const equipmentList = equipmentTypes.map((type, index) => ({
      type,
      year: 2022,
      isNew: !type.toLowerCase().includes("used"),
      serialNumber: `PREVIEW-${index + 1}`,
      value: perEquipmentValue,
    }));
    const downPaymentPercent = (prefs.minDownPaymentPercent ?? 10) / 100;
    const downPayment = Math.max(5000, Math.min(previewLoanAmount * downPaymentPercent, previewLoanAmount * 0.25));
    return {
      loanAmount: previewLoanAmount,
      equipmentList,
      borrower: { creditScore: 720, annualIncome: 90000 },
      dealer: { state: (prefs.states[0] || "IA") },
      loanTermMonths: 72,
      downPayment,
      naicsCode: prefs.naicsCodes[0] || "1111",
      tradeInPresent: false,
    };
  }, [prefs, previewLoanAmount]);

  const eligibleLenders = useMemo(() => {
    const matched = routeApplication(previewApplication, SAMPLE_LENDERS);
    return SAMPLE_LENDERS.filter((lender) => matched.includes(lender.lenderId));
  }, [previewApplication]);

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px #eee", padding: 30 }}>
      <h2>Lender Application Preferences</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 18 }}>
          <label style={label}>Loan Amount Range ($):</label><br />
          <input type="number" value={prefs.minAmount} min={0} max={prefs.maxAmount} onChange={e => handleChange("minAmount", Number(e.target.value))} style={input} />
          <span style={{ margin: "0 10px" }}>to</span>
          <input type="number" value={prefs.maxAmount} min={prefs.minAmount} max={500000} onChange={e => handleChange("maxAmount", Number(e.target.value))} style={input} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={label}>Equipment Types:</label><br />
          {allEquipment.map(eq => (
            <label key={eq} style={checkLabel}>
              <input type="checkbox" checked={prefs.equipmentTypes.includes(eq)} onChange={() => handleMultiChange("equipmentTypes", eq)} /> {eq}
            </label>
          ))}
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={label}>States:</label><br />
          {allStates.map(st => (
            <label key={st} style={checkLabel}>
              <input type="checkbox" checked={prefs.states.includes(st)} onChange={() => handleMultiChange("states", st)} /> {st}
            </label>
          ))}
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={label}>NAICS Codes:</label><br />
          {allNAICS.map(code => (
            <label key={code} style={checkLabel}>
              <input type="checkbox" checked={prefs.naicsCodes.includes(code)} onChange={() => handleMultiChange("naicsCodes", code)} /> {code}
            </label>
          ))}
        </div>
        <button type="submit" style={saveBtn}>Save Preferences</button>
      </form>
      <div style={previewBox}>
        <h3 style={{ marginTop: 0 }}>Routing Preview</h3>
        <p style={{ margin: "8px 0" }}>Sample loan amount: {formatCurrency(previewApplication.loanAmount)}</p>
        <p style={{ margin: "8px 0" }}>Dealer state: {previewApplication.dealer.state}</p>
        <p style={{ margin: "8px 0" }}>NAICS code: {previewApplication.naicsCode}</p>
        <p style={{ margin: "8px 0" }}>Equipment: {previewApplication.equipmentList.map((eq) => eq.type).join(", ")}</p>
        <div style={{ marginTop: 12 }}>
          <strong>Eligible lenders:</strong>
          {eligibleLenders.length > 0 ? (
            <ul style={{ margin: "8px 0 0 16px" }}>
              {eligibleLenders.map((lender) => (
                <li key={lender.lenderId}>{lender.displayName || lender.lenderId}</li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: "8px 0 0" }}>No lenders currently match this preview.</p>
          )}
        </div>
      </div>
    </div>
  );
}

const label = { fontWeight: 600, fontSize: 15 };
const input = { width: 90, padding: 6, fontSize: 15, borderRadius: 4, border: "1px solid #ccc" };
const checkLabel = { marginRight: 18, fontSize: 15 };
const previewBox = { marginTop: 30, padding: 20, background: "#f7fbff", borderRadius: 8, border: "1px solid #d5e4ff" };
const saveBtn = { background: "#007bff", color: "white", border: "none", borderRadius: 4, padding: "10px 28px", fontSize: 16, cursor: "pointer", marginTop: 10 };

export default LenderPreferences;
