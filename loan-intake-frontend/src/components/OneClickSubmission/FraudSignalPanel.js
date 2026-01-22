import React from "react";

import PanelState from "./PanelState";
import WhyTooltip from "./WhyTooltip";

const SEVERITY_COLOR = {
  low: "#28a745",
  medium: "#ffc107",
  high: "#dc3545",
};

function FraudSignalPanel({
  riskScore,
  riskLevel,
  triggeredRules,
  onAcknowledge,
  onRequestReview,
  onRetry,
  tooltipMessage = "Fraud signals combine behavioral and document checks.",
  loading,
  error,
}) {
  const showEmptyGuidance = triggeredRules.length === 0 && riskScore === 0;

  return (
    <PanelState
      loading={loading}
      loadingLabel="Loading fraud signals..."
      error={error}
      onErrorAction={onRetry}
      errorActionLabel="Retry Fraud Signals"
    >
      <div>
        <h4 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: "8px" }}>
          Fraud Signals
          <WhyTooltip
            content={tooltipMessage}
            ariaLabel="Why fraud signals matter"
          />
        </h4>
        <div style={{ fontSize: "16px", fontWeight: 600 }}>
          Risk Score: {riskScore} ({riskLevel})
        </div>
        {triggeredRules.length === 0 ? (
          <div style={{ marginTop: "12px", color: "#6c757d" }}>
            {showEmptyGuidance
              ? "Fraud signals are not loaded yet. Retry to fetch the latest risk checks."
              : "No fraud flags triggered."}
            {showEmptyGuidance && (
              <WhyTooltip
                content="Fraud signals are generated after submission and device checks."
                ariaLabel="Why fraud signals are not available"
              />
            )}
            {showEmptyGuidance && onRetry && (
              <div style={{ marginTop: "8px" }}>
                <button onClick={onRetry}>Retry Fraud Signals</button>
              </div>
            )}
          </div>
        ) : (
          <ul style={{ marginTop: "12px", paddingLeft: "18px" }}>
            {triggeredRules.map((rule) => (
              <li key={rule.id} style={{ marginBottom: "8px" }}>
                <span>{rule.description}</span>
                <span
                  style={{
                    marginLeft: "8px",
                    color: SEVERITY_COLOR[rule.severity],
                    fontWeight: 600,
                  }}
                >
                  {rule.severity}
                </span>
              </li>
            ))}
          </ul>
        )}
        {(onAcknowledge || onRequestReview) && (
          <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
            {onAcknowledge && (
              <button onClick={onAcknowledge}>Acknowledge Risk</button>
            )}
            {onRequestReview && (
              <button onClick={onRequestReview}>Request Manual Review</button>
            )}
          </div>
        )}
      </div>
    </PanelState>
  );
}

export default FraudSignalPanel;
