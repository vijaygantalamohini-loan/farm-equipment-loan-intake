import React, { useState } from "react";

function DocumentsAndConsentsStep({ onNext, nextStep, prevStep }) {
  const [documents, setDocuments] = useState([]);
  const [consents, setConsents] = useState({
    creditCheck: false,
    shareWithLenders: false
  });

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    const docs = files.map(file => ({
      type: "uploaded",
      fileUrl: URL.createObjectURL(file),
      name: file.name
    }));
    setDocuments(docs);
  };

  const handleConsentChange = (field) => {
    setConsents(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSubmit = () => {
    onNext({ documents, consents });
    nextStep();
  };

  return (
    <div>
      <h2>Documents & Consents</h2>

      <h3>Upload Documents</h3>
      <input type="file" multiple onChange={handleFileUpload} />
      <ul>
        {documents.map((doc, idx) => (
          <li key={idx}>{doc.name}</li>
        ))}
      </ul>

      <h3>Consents</h3>
      <label>
        <input
          type="checkbox"
          checked={consents.creditCheck}
          onChange={() => handleConsentChange("creditCheck")}
        />
        Consent to Credit Check
      </label>
      <br />
      <label>
        <input
          type="checkbox"
          checked={consents.shareWithLenders}
          onChange={() => handleConsentChange("shareWithLenders")}
        />
        Consent to Share Application with Lenders
      </label>

      <div style={{ marginTop: "20px" }}>
        <button onClick={prevStep}>Back</button>
        <button onClick={handleSubmit}>Next</button>
      </div>
    </div>
  );
}

export default DocumentsAndConsentsStep;