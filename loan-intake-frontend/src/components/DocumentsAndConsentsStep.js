import React, { useState, useEffect } from "react";

function DocumentsAndConsentsStep({ onNext, nextStep, prevStep, initialData, onDraftChange = () => {} }) {
  const [documents, setDocuments] = useState(initialData?.documents || []);
  const [consents, setConsents] = useState({
    creditCheck: initialData?.consents?.creditCheck || false,
    shareWithLenders: initialData?.consents?.shareWithLenders || false
  });

  // Sync local state when initialData changes (resume prefill)
  useEffect(() => {
    setDocuments(initialData?.documents || []);
    setConsents({
      creditCheck: initialData?.consents?.creditCheck || false,
      shareWithLenders: initialData?.consents?.shareWithLenders || false
    });
  }, [initialData]);

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    const docs = files.map(file => ({
      type: "uploaded",
      fileUrl: URL.createObjectURL(file),
      name: file.name
    }));
    setDocuments(docs);
    // Persist as a single documents object to avoid state resets
    try { onDraftChange({ documents: { documents: docs, consents } }); } catch {}
  };

  const handleConsentChange = (field) => {
    setConsents(prev => {
      const updated = { ...prev, [field]: !prev[field] };
      // Persist as a single documents object to ensure initialData reflects consents
      try { onDraftChange({ documents: { documents, consents: updated } }); } catch {}
      console.debug('[DocumentsAndConsentsStep] Consent changed:', updated);
      return updated;
    });
  };

  const handleSubmit = () => {
    // Submit combined documents object for consistency with updateData normalization
    console.debug('[DocumentsAndConsentsStep] handleSubmit called. Consents:', consents, 'Documents:', documents);
    onNext({ documents: { documents, consents } });
    nextStep();
  };

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
      <h2>Documents & Consents</h2>
      <p style={{ color: "#666", marginBottom: "20px" }}>
        Upload supporting documents and provide required consents.
      </p>

      <h3 style={{ marginTop: "25px", marginBottom: "15px" }}>Upload Documents</h3>
      <div style={{ marginBottom: "15px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
          Supporting Documents (Tax returns, bank statements, etc.)
        </label>
        <input 
          type="file" 
          multiple 
          onChange={handleFileUpload}
          style={{ width: "100%", padding: "8px", fontSize: "14px" }}
        />
      </div>

      {documents.length > 0 && (
        <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#f9f9f9", border: "1px solid #ddd" }}>
          <p style={{ margin: "0 0 10px 0", fontWeight: "bold", fontSize: "14px" }}>Uploaded Files:</p>
          <ul style={{ margin: 0, paddingLeft: "20px" }}>
            {documents.map((doc, idx) => (
              <li key={idx} style={{ fontSize: "14px", marginBottom: "5px" }}>{doc.name}</li>
            ))}
          </ul>
        </div>
      )}

      <h3 style={{ marginTop: "25px", marginBottom: "15px" }}>Required Consents</h3>

      <div style={{ marginBottom: "15px", padding: "15px", backgroundColor: "#f9f9f9", border: "1px solid #ddd" }}>
        <div style={{ display: "flex", alignItems: "start", marginBottom: "15px" }}>
          <input
            id="consent-credit"
            type="checkbox"
            checked={consents.creditCheck}
            onChange={() => handleConsentChange("creditCheck")}
            style={{ marginRight: "10px", marginTop: "3px" }}
          />
          <label htmlFor="consent-credit" style={{ fontSize: "14px", cursor: "pointer" }}>
            <strong>Consent to Credit Check *</strong><br />
            <span style={{ color: "#666" }}>
              I authorize the lender to obtain my credit report for the purpose of evaluating this loan application.
            </span>
          </label>
        </div>

        <div style={{ display: "flex", alignItems: "start" }}>
          <input
            id="consent-share"
            type="checkbox"
            checked={consents.shareWithLenders}
            onChange={() => handleConsentChange("shareWithLenders")}
            style={{ marginRight: "10px", marginTop: "3px" }}
          />
          <label htmlFor="consent-share" style={{ fontSize: "14px", cursor: "pointer" }}>
            <strong>Consent to Share Application with Lenders *</strong><br />
            <span style={{ color: "#666" }}>
              I consent to sharing my application information with multiple lenders to find the best financing options.
            </span>
          </label>
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
          disabled={!consents.creditCheck || !consents.shareWithLenders}
          style={{ 
            padding: "10px 30px", 
            fontSize: "16px", 
            cursor: consents.creditCheck && consents.shareWithLenders ? "pointer" : "not-allowed", 
            backgroundColor: consents.creditCheck && consents.shareWithLenders ? "#007bff" : "#ccc", 
            color: "white", 
            border: "none" 
          }}
          data-debug-enabled={consents.creditCheck && consents.shareWithLenders}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default DocumentsAndConsentsStep;