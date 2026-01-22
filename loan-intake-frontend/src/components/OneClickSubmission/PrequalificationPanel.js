import React from "react";

import PanelState from "./PanelState";
import WhyTooltip from "./WhyTooltip";

const STATUS_COLOR = {
  passed: "#28a745",
  failed: "#dc3545",
  pending: "#ffc107",
};

function PrequalificationPanel({
  score,
  status,
  actions,
  onRetry,
  tooltipMessage = "Prequalification reflects eligibility based on submitted data.",
  loading,
  error,
}) {
  return (
    <PanelState
      loading={loading}
      loadingLabel="Loading prequalification..."
      error={error}
    >
      <div>
        <h4 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: "8px" }}>
          Prequalification Status
          <WhyTooltip
            content={tooltipMessage}
            ariaLabel="Why prequalification is shown"
          />
        </h4>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ fontSize: "20px", fontWeight: 600 }}>{score}/100</div>
          <span style={{ color: STATUS_COLOR[status], fontWeight: 600 }}>
            {status.toUpperCase()}
          </span>
        </div>
        {status === "pending" && score === 0 && (
          <div style={{ marginTop: "8px", color: "#6c757d" }}>
            Prequalification is still pending. Retry to fetch the latest eligibility result.
            <WhyTooltip
              content="Prequalification is computed after OCR and risk signals are available."
              ariaLabel="Why prequalification is pending"
            />
          </div>
        )}
        <div style={{ marginTop: "12px" }}>
          <strong>Actions</strong>
          {actions.length === 0 ? (
            <div style={{ marginTop: "6px", color: "#6c757d" }}>No actions required.</div>
          ) : (
            <ul style={{ paddingLeft: "18px" }}>
              {actions.map((action) => (
                <li key={action.id} style={{ marginBottom: "6px" }}>
                  <span>{action.description}</span>
                  <span style={{ marginLeft: "8px", color: "#6c757d" }}>
                    {action.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {onRetry && (
          <button onClick={onRetry} style={{ marginTop: "12px" }}>
            Retry Prequalification
          </button>
        )}
      </div>
    </PanelState>
  );
}

export default PrequalificationPanel;
