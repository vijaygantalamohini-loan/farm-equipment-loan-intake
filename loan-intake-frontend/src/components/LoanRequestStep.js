import React, { useState } from "react";

function LoanRequestStep({ onNext, nextStep, prevStep }) {
  const [loan, setLoan] = useState({
    amount: "",
    termMonths: "",
    purpose: "",
    asset: {
      type: "",
      make: "",
      model: "",
      year: "",
      serialNumber: "",
      valueEstimate: ""
    }
  });

  const handleChange = (field, value) => {
    setLoan(prev => ({ ...prev, [field]: value }));
  };

  const handleAssetChange = (field, value) => {
    setLoan(prev => ({
      ...prev,
      asset: { ...prev.asset, [field]: value }
    }));
  };

  const handleSubmit = () => {
    onNext({ loan });
    nextStep();
  };

  return (
    <div>
      <h2>Loan Request</h2>

      <input
        type="number"
        placeholder="Loan Amount ($)"
        onChange={e => handleChange("amount", e.target.value)}
      />

      <select onChange={e => handleChange("termMonths", e.target.value)}>
        <option value="">Select Term</option>
        <option value="12">12 months</option>
        <option value="24">24 months</option>
        <option value="36">36 months</option>
        <option value="48">48 months</option>
        <option value="60">60 months</option>
      </select>

      <input
        placeholder="Purpose (e.g., Tractor Purchase)"
        onChange={e => handleChange("purpose", e.target.value)}
      />

      <h3>Asset Information</h3>
      <input placeholder="Type (e.g., Tractor)" onChange={e => handleAssetChange("type", e.target.value)} />
      <input placeholder="Make" onChange={e => handleAssetChange("make", e.target.value)} />
      <input placeholder="Model" onChange={e => handleAssetChange("model", e.target.value)} />
      <input type="number" placeholder="Year" onChange={e => handleAssetChange("year", e.target.value)} />
      <input placeholder="Serial Number" onChange={e => handleAssetChange("serialNumber", e.target.value)} />
      <input type="number" placeholder="Estimated Value ($)" onChange={e => handleAssetChange("valueEstimate", e.target.value)} />

      <div style={{ marginTop: "20px" }}>
        <button onClick={prevStep}>Back</button>
        <button onClick={handleSubmit}>Next</button>
      </div>
    </div>
  );
}

export default LoanRequestStep;