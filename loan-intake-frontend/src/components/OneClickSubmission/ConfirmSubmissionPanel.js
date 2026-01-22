import React from "react";

function ConfirmSubmissionPanel({
  summaryItems,
  onConfirm,
  onBack,
  loading,
  error,
  submissionNumber,
  buttonLabel,
}) {
  return (
    <div>
      <h4 style={{ marginTop: 0 }}>Confirm Submission</h4>
      {error && <div style={{ color: "#b00020", marginBottom: "8px" }}>{error}</div>}
      {submissionNumber && (
        <div style={{ marginBottom: "8px", color: "#0f5132", background: "#d1e7dd", padding: "8px", borderRadius: "4px" }}>
          Submission saved as <strong>{submissionNumber}</strong>.
        </div>
      )}
      <ul style={{ paddingLeft: "18px" }}>
        {summaryItems.map((item) => (
          <li key={item.label} style={{ marginBottom: "6px" }}>
            <strong>{item.label}:</strong> {item.value ?? "N/A"}
          </li>
        ))}
      </ul>
      <div style={{ marginTop: "12px", display: "flex", gap: "12px" }}>
        {onBack && (
          <button onClick={onBack} disabled={loading}>
            Back
          </button>
        )}
        <button onClick={onConfirm} disabled={loading}>
          {loading ? "Submitting..." : buttonLabel || "Submit"}
        </button>
      </div>
    </div>
  );
}

export default ConfirmSubmissionPanel;
