import React, { useState } from "react";

function DataReviewPanel({ fields, onSave, onValidate, error }) {
  const [drafts, setDrafts] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});

  const handleChange = (name, value) => {
    setDrafts((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSave = (name) => {
    const nextValue = drafts[name] ?? "";
    if (!nextValue.trim()) {
      setFieldErrors((prev) => ({
        ...prev,
        [name]: "Please enter a valid value before saving.",
      }));
      return;
    }
    onSave(name, nextValue);
  };

  return (
    <div>
      <h4 style={{ marginTop: 0 }}>Review Low-Confidence Fields</h4>
      {error && <div style={{ color: "#b00020", marginBottom: "8px" }}>{error}</div>}
      {fields.map((field) => (
        <div
          key={field.name}
          style={{
            border: "1px solid #f1f3f5",
            borderRadius: "8px",
            padding: "12px",
            marginBottom: "10px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>{field.name}</strong>
            <span style={{ color: "#856404" }}>{Math.round(field.confidence * 100)}%</span>
          </div>
          <input
            value={drafts[field.name] ?? field.value ?? ""}
            onChange={(event) => handleChange(field.name, event.target.value)}
            style={{ width: "100%", marginTop: "8px", padding: "6px" }}
          />
          {fieldErrors[field.name] && (
            <div style={{ marginTop: "6px", color: "#b00020", fontSize: "12px" }}>
              {fieldErrors[field.name]}
            </div>
          )}
          <button onClick={() => handleSave(field.name)} style={{ marginTop: "8px" }}>
            Save
          </button>
        </div>
      ))}
      {onValidate && (
        <button onClick={onValidate} style={{ marginTop: "10px" }}>
          Validate & Continue
        </button>
      )}
    </div>
  );
}

export default DataReviewPanel;
