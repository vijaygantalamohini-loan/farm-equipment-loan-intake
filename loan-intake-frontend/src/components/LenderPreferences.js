import React, { useMemo, useState } from "react";
import { formatCurrency } from "../utils/format";
import { routeApplication } from "../utils/routingEngine";

/* -------------------- DATA (UNCHANGED) -------------------- */

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

/* -------------------- COMPONENT -------------------- */

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
        [field]: arr.includes(value)
          ? arr.filter(v => v !== value)
          : [...arr, value],
      };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    alert("Preferences saved! (not yet wired to backend)");
  };

  const previewLoanAmount = useMemo(() => {
    const min = prefs.minAmount || 40000;
    const max = prefs.maxAmount || Math.max(min, 150000);
    return Math.round((min + max) / 2);
  }, [prefs.minAmount, prefs.maxAmount]);

  const previewApplication = useMemo(() => {
    const equipmentTypes = prefs.equipmentTypes.length ? prefs.equipmentTypes : ["Tractor"];
    const perEquipmentValue = Math.max(
      15000,
      Math.round(previewLoanAmount / equipmentTypes.length)
    );

    return {
      loanAmount: previewLoanAmount,
      equipmentList: equipmentTypes.map((type, i) => ({
        type,
        year: 2022,
        isNew: true,
        serialNumber: `PREVIEW-${i + 1}`,
        value: perEquipmentValue,
      })),
      borrower: { creditScore: 720, annualIncome: 90000 },
      dealer: { state: prefs.states[0] || "IA" },
      loanTermMonths: 72,
      downPayment: previewLoanAmount * (prefs.minDownPaymentPercent / 100),
      naicsCode: prefs.naicsCodes[0] || "1111",
      tradeInPresent: false,
    };
  }, [prefs, previewLoanAmount]);

  const eligibleLenders = useMemo(() => {
    const matched = routeApplication(previewApplication, SAMPLE_LENDERS);
    return SAMPLE_LENDERS.filter(l => matched.includes(l.lenderId));
  }, [previewApplication]);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Lender Preferences</h1>
        <p style={styles.subtitle}>
          Control which applications are routed to you based on loan criteria.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Loan Amount */}
          <Section title="Loan Amount Range">
            <div style={styles.inline}>
              <input
                type="number"
                value={prefs.minAmount}
                onChange={e => handleChange("minAmount", Number(e.target.value))}
                style={styles.input}
              />
              <span style={styles.muted}>to</span>
              <input
                type="number"
                value={prefs.maxAmount}
                onChange={e => handleChange("maxAmount", Number(e.target.value))}
                style={styles.input}
              />
            </div>
          </Section>

          {/* Equipment */}
          <Section title="Equipment Types">
            <CheckboxGrid
              options={allEquipment}
              selected={prefs.equipmentTypes}
              onToggle={v => handleMultiChange("equipmentTypes", v)}
            />
          </Section>

          {/* States */}
          <Section title="States">
            <CheckboxGrid
              options={allStates}
              selected={prefs.states}
              onToggle={v => handleMultiChange("states", v)}
            />
          </Section>

          {/* NAICS */}
          <Section title="NAICS Codes">
            <CheckboxGrid
              options={allNAICS}
              selected={prefs.naicsCodes}
              onToggle={v => handleMultiChange("naicsCodes", v)}
            />
          </Section>

          <button type="submit" style={styles.primaryBtn}>
            Save Preferences
          </button>
        </form>
      </div>

      {/* Preview */}
      <div style={styles.preview}>
        <h3>Routing Preview</h3>
        <p>Sample loan amount: <strong>{formatCurrency(previewApplication.loanAmount)}</strong></p>
        <p>Dealer state: <strong>{previewApplication.dealer.state}</strong></p>
        <p>NAICS code: <strong>{previewApplication.naicsCode}</strong></p>
        <p>Equipment: <strong>{previewApplication.equipmentList.map(e => e.type).join(", ")}</strong></p>

        <div style={{ marginTop: 16 }}>
          <strong>Eligible lenders</strong>
          {eligibleLenders.length > 0 ? (
            <ul style={styles.list}>
              {eligibleLenders.map(l => (
                <li key={l.lenderId}>{l.displayName}</li>
              ))}
            </ul>
          ) : (
            <p style={styles.muted}>No lenders match this configuration.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------- UI HELPERS -------------------- */

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <label style={styles.label}>{title}</label>
      {children}
    </div>
  );
}

function CheckboxGrid({ options, selected, onToggle }) {
  return (
    <div style={styles.grid}>
      {options.map(opt => (
        <label key={opt} style={styles.check}>
          <input
            type="checkbox"
            checked={selected.includes(opt)}
            onChange={() => onToggle(opt)}
          />
          {opt}
        </label>
      ))}
    </div>
  );
}

/* -------------------- STYLES -------------------- */

const styles = {
  page: {
    maxWidth: 960,
    margin: "40px auto",
    padding: "0 24px",
  },

  card: {
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 20,
    padding: 32,
    boxShadow: "0 20px 50px rgba(0,0,0,0.05)",
  },

  title: { margin: 0, fontSize: 24 },
  subtitle: { margin: "6px 0 28px", color: "#666" },

  label: {
    fontWeight: 600,
    fontSize: 15,
    display: "block",
    marginBottom: 10,
  },

  inline: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  input: {
    width: 140,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #ddd",
    fontSize: 14,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: 12,
  },

  check: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
  },

  primaryBtn: {
    marginTop: 10,
    padding: "12px 28px",
    borderRadius: 12,
    background: "#111",
    color: "#fff",
    border: "1px solid #111",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },

  preview: {
    marginTop: 32,
    padding: 24,
    borderRadius: 16,
    border: "1px solid #e5e5e5",
    background: "#fafafa",
  },

  list: {
    marginTop: 8,
    paddingLeft: 18,
  },

  muted: {
    color: "#777",
    fontSize: 14,
  },
};

export default LenderPreferences;
