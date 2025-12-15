import React, { useState } from "react";

function BorrowerInfoStep({ onNext, nextStep }) {
  const [borrower, setBorrower] = useState({
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

  const [mode, setMode] = useState("manual"); // "manual" or "scan"

  const handleChange = (field, value) => {
    setBorrower(prev => ({ ...prev, [field]: value }));
  };

  const handleAddressChange = (field, value) => {
    setBorrower(prev => ({
      ...prev,
      address: { ...prev.address, [field]: value }
    }));
  };

  // Handle ID image upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://localhost:8000/ocr/id", {
        method: "POST",
        body: formData
      });

      const text = await response.text();
      let data = null;
      try { data = JSON.parse(text); } catch (e) { /* non-json response */ }

      if (!response.ok) {
        // Try to extract an informative message from the backend/CV response
        const errMsg = data?.detail?.cv_error?.error?.message || data?.detail?.cv_error?.message || data?.detail?.cv_error || data?.detail || text || "OCR failed";
        console.error("OCR error:", errMsg);
        alert(`Could not read ID: ${errMsg}`);
        setMode("manual");
        return;
      }

      // If OCR returned but with empty text, inform user
      if (data && Array.isArray(data.rawText) && data.rawText.length === 0) {
        alert("Could not read ID from the uploaded image. Please try a clearer photo or enter details manually.");
        setMode("manual");
        return;
      }

      // Map OCR results into borrower fields
      setBorrower(prev => ({
        ...prev,
        firstName: data?.firstName || prev.firstName,
        lastName: data?.lastName || prev.lastName,
        dateOfBirth: data?.dateOfBirth || prev.dateOfBirth,
        address: {
          street: data?.street || prev.address.street,
          city: data?.city || prev.address.city,
          state: data?.state || prev.address.state,
          zip: data?.zip || prev.address.zip
        }
      }));
      // show manual entry form with populated values
      setMode("manual");
    } catch (err) {
      console.error("OCR failed", err);
      // network or unexpected error
      alert("Could not read ID due to a network error. Please enter manually.");
      setMode("manual");
    }
  };

  const handleSubmit = () => {
    onNext({ borrower });
    nextStep();
  };

  return (
    <div>
      <h2>Borrower Information</h2>

      <div style={{ marginBottom: "15px" }}>
        <button onClick={() => setMode("scan")}>Scan ID / Upload Image</button>
        <button onClick={() => setMode("manual")}>Enter Manually</button>
      </div>

      {mode === "scan" && (
        <div>
          <input type="file" accept="image/*" onChange={handleFileUpload} />
          <p>Upload or take a picture of your ID to auto‑fill fields.</p>
        </div>
      )}

      {mode === "manual" && (
        <div>
          <input placeholder="First Name" value={borrower.firstName} onChange={e => handleChange("firstName", e.target.value)} />
          <input placeholder="Last Name" value={borrower.lastName} onChange={e => handleChange("lastName", e.target.value)} />
          <input type="date" value={borrower.dateOfBirth} onChange={e => handleChange("dateOfBirth", e.target.value)} />
          <input placeholder="SSN" value={borrower.ssn} onChange={e => handleChange("ssn", e.target.value)} />
          <input placeholder="Email" value={borrower.email} onChange={e => handleChange("email", e.target.value)} />
          <input placeholder="Phone" value={borrower.phone} onChange={e => handleChange("phone", e.target.value)} />

          <h3>Address</h3>
          <input placeholder="Street" value={borrower.address.street} onChange={e => handleAddressChange("street", e.target.value)} />
          <input placeholder="City" value={borrower.address.city} onChange={e => handleAddressChange("city", e.target.value)} />
          <input placeholder="State" value={borrower.address.state} onChange={e => handleAddressChange("state", e.target.value)} />
          <input placeholder="Zip" value={borrower.address.zip} onChange={e => handleAddressChange("zip", e.target.value)} />

          <h3>Employment</h3>
          <input placeholder="Employer/Farm Name" value={borrower.employerName} onChange={e => handleChange("employerName", e.target.value)} />
          <input type="number" placeholder="Annual Income ($)" value={borrower.annualIncome} onChange={e => handleChange("annualIncome", e.target.value)} />
          <select value={borrower.status} onChange={e => handleChange("status", e.target.value)}>
            <option value="">Employment Status</option>
            <option value="employed">Employed</option>
            <option value="self-employed">Self-Employed</option>
            <option value="unemployed">Unemployed</option>
          </select>
        </div>
      )}

      <button style={{ marginTop: "20px" }} onClick={handleSubmit}>Next</button>
    </div>
  );
}

export default BorrowerInfoStep;