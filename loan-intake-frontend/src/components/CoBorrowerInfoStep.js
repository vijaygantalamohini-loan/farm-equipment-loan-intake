import React, { useState, useEffect } from "react";
import { autoValidateAddress, createAddressChangeHandler } from "../utils/addressUtils";

function CoBorrowerInfoStep({ onNext, nextStep, prevStep, initialData, onDraftChange = () => {} }) {
  const [coBorrower, setCoBorrower] = useState({
    firstName: initialData?.firstName || "",
    lastName: initialData?.lastName || "",
    dateOfBirth: initialData?.dateOfBirth || "",
    ssn: initialData?.ssn || "",
    email: initialData?.email || "",
    phone: initialData?.phone || "",
    address: { 
      street: initialData?.address?.street || "", 
      city: initialData?.address?.city || "", 
      state: initialData?.address?.state || "", 
      zip: initialData?.address?.zip || "" 
    },
    employerName: initialData?.employerName || "",
    annualIncome: initialData?.annualIncome || "",
    status: initialData?.status || ""
  });

  // Sync local state when initialData changes (resume prefill)
  useEffect(() => {
    setCoBorrower({
      firstName: initialData?.firstName || "",
      lastName: initialData?.lastName || "",
      dateOfBirth: initialData?.dateOfBirth || "",
      ssn: initialData?.ssn || "",
      email: initialData?.email || "",
      phone: initialData?.phone || "",
      address: { 
        street: initialData?.address?.street || "", 
        city: initialData?.address?.city || "", 
        state: initialData?.address?.state || "", 
        zip: initialData?.address?.zip || "" 
      },
      employerName: initialData?.employerName || "",
      annualIncome: initialData?.annualIncome || "",
      status: initialData?.status || ""
    });
  }, [initialData]);

  const handleChange = (field, value) => {
    setCoBorrower(prev => {
      const updated = { ...prev, [field]: value };
      try { onDraftChange({ coBorrower: updated }); } catch {}
      return updated;
    });
  };

  const handleAddressChange = createAddressChangeHandler((updater) => {
    setCoBorrower(prev => {
      const updated = updater(prev);
      try { onDraftChange({ coBorrower: updated }); } catch {}
      return updated;
    });
  });

  const validateAddress = () => {
    autoValidateAddress(coBorrower.address, (newAddress) => {
      setCoBorrower(prev => ({ ...prev, address: newAddress }));
    });
  };

  const handleSubmit = () => {
    onNext({ coBorrower });
    nextStep();
  };

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
      <h2>Co-Borrower Information</h2>
      <p style={{ color: "#666", marginBottom: "20px" }}>
        Please provide information about the co-borrower (if applicable).
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
        <div>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            First Name *
          </label>
          <input 
            placeholder="First Name" 
            value={coBorrower.firstName}
            onChange={e => handleChange("firstName", e.target.value)}

            style={{ width: "100%", padding: "8px", fontSize: "14px" }}
          />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            Last Name *
          </label>
          <input 
            placeholder="Last Name" 
            value={coBorrower.lastName}
            onChange={e => handleChange("lastName", e.target.value)}

            style={{ width: "100%", padding: "8px", fontSize: "14px" }}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
        <div>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            Date of Birth *
          </label>
          <input 
            type="date" 
            value={coBorrower.dateOfBirth}
            onChange={e => handleChange("dateOfBirth", e.target.value)}

            style={{ width: "100%", padding: "8px", fontSize: "14px" }}
          />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            SSN *
          </label>
          <input 
            placeholder="123-45-6789" 
            value={coBorrower.ssn}
            onChange={e => handleChange("ssn", e.target.value)}

            style={{ width: "100%", padding: "8px", fontSize: "14px" }}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
        <div>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            Email *
          </label>
          <input 
            placeholder="email@example.com" 
            value={coBorrower.email}
            onChange={e => handleChange("email", e.target.value)}

            style={{ width: "100%", padding: "8px", fontSize: "14px" }}
          />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            Phone *
          </label>
          <input 
            placeholder="(555) 123-4567" 
            value={coBorrower.phone}
            onChange={e => handleChange("phone", e.target.value)}

            style={{ width: "100%", padding: "8px", fontSize: "14px" }}
          />
        </div>
      </div>

      <h3 style={{ marginTop: "25px", marginBottom: "15px" }}>Address</h3>

      <div style={{ marginBottom: "15px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
          Street Address *
        </label>
        <input 
          placeholder="123 Main Street" 
          value={coBorrower.address.street}
          onChange={e => handleAddressChange("street", e.target.value)}

          style={{ width: "100%", padding: "8px", fontSize: "14px" }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "15px", marginBottom: "15px" }}>
        <div>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            City *
          </label>
          <input 
            placeholder="City" 
            value={coBorrower.address.city}
            onChange={e => handleAddressChange("city", e.target.value)}

            style={{ width: "100%", padding: "8px", fontSize: "14px" }}
          />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            State *
          </label>
          <input 
            placeholder="ST" 
            value={coBorrower.address.state}
            onChange={e => handleAddressChange("state", e.target.value)}
            onBlur={validateAddress}
            maxLength="2"

            style={{ width: "100%", padding: "8px", fontSize: "14px", textTransform: "uppercase" }}
          />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            ZIP Code *
          </label>
          <input 
            placeholder="12345" 
            value={coBorrower.address.zip}
            onChange={e => handleAddressChange("zip", e.target.value)}
            onBlur={validateAddress}
            maxLength="10"

            style={{ width: "100%", padding: "8px", fontSize: "14px" }}
          />
        </div>
      </div>

      <h3 style={{ marginTop: "25px", marginBottom: "15px" }}>Employment</h3>

      <div style={{ marginBottom: "15px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
          Employer/Farm Name *
        </label>
        <input 
          placeholder="Employer/Farm Name" 
          value={coBorrower.employerName}
          onChange={e => handleChange("employerName", e.target.value)}

          style={{ width: "100%", padding: "8px", fontSize: "14px" }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
        <div>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            Annual Income ($) *
          </label>
          <input 
            type="number" 
            placeholder="50000" 
            value={coBorrower.annualIncome}
            onChange={e => handleChange("annualIncome", e.target.value)}

            style={{ width: "100%", padding: "8px", fontSize: "14px" }}
          />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            Employment Status *
          </label>
          <select 
            value={coBorrower.status}
            onChange={e => handleChange("status", e.target.value)}

            style={{ width: "100%", padding: "8px", fontSize: "14px" }}
          >
            <option value="">Select Status</option>
            <option value="employed">Employed</option>
            <option value="self-employed">Self-Employed</option>
            <option value="unemployed">Unemployed</option>
          </select>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "30px" }}>
        <button 
          onClick={prevStep}
          style={{ padding: "10px 30px", fontSize: "16px", cursor: "pointer" }}
        >
          Back
        </button>
        <button 
          onClick={handleSubmit}
          style={{ padding: "10px 30px", fontSize: "16px", cursor: "pointer", backgroundColor: "#007bff", color: "white", border: "none" }}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default CoBorrowerInfoStep;
