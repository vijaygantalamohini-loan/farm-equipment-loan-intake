import React, { useState } from "react";

function CoBorrowerInfoStep({ onNext, nextStep, prevStep }) {
  const [coBorrower, setCoBorrower] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    ssn: "",
    email: "",
    phone: "",
    address: { street: "", city: "", state: "", zip: "" },
    employerName: "",
    annualIncome: "",
    status: ""
  });

  const handleChange = (field, value) => {
    setCoBorrower(prev => ({ ...prev, [field]: value }));
  };

  const handleAddressChange = (field, value) => {
    setCoBorrower(prev => ({
      ...prev,
      address: { ...prev.address, [field]: value }
    }));
  };

  const handleSubmit = () => {
    onNext({ coBorrower });
    nextStep();
  };

  return (
    <div>
      <h2>Co-Borrower Information</h2>
      <input placeholder="First Name" onChange={e => handleChange("firstName", e.target.value)} />
      <input placeholder="Last Name" onChange={e => handleChange("lastName", e.target.value)} />
      <input type="date" onChange={e => handleChange("dateOfBirth", e.target.value)} />
      <input placeholder="SSN" onChange={e => handleChange("ssn", e.target.value)} />
      <input placeholder="Email" onChange={e => handleChange("email", e.target.value)} />
      <input placeholder="Phone" onChange={e => handleChange("phone", e.target.value)} />

      <h3>Address</h3>
      <input placeholder="Street" onChange={e => handleAddressChange("street", e.target.value)} />
      <input placeholder="City" onChange={e => handleAddressChange("city", e.target.value)} />
      <input placeholder="State" onChange={e => handleAddressChange("state", e.target.value)} />
      <input placeholder="Zip" onChange={e => handleAddressChange("zip", e.target.value)} />

      <h3>Employment</h3>
      <input placeholder="Employer/Farm Name" onChange={e => handleChange("employerName", e.target.value)} />
      <input type="number" placeholder="Annual Income ($)" onChange={e => handleChange("annualIncome", e.target.value)} />
      <select onChange={e => handleChange("status", e.target.value)}>
        <option value="">Employment Status</option>
        <option value="employed">Employed</option>
        <option value="self-employed">Self-Employed</option>
        <option value="unemployed">Unemployed</option>
      </select>

      <div style={{ marginTop: "20px" }}>
        <button onClick={prevStep}>Back</button>
        <button onClick={handleSubmit}>Next</button>
      </div>
    </div>
  );
}

export default CoBorrowerInfoStep;