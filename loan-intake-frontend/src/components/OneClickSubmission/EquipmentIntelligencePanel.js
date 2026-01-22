import React from "react";

import PanelState from "./PanelState";
import WhyTooltip from "./WhyTooltip";

const SEVERITY_COLOR = {
  info: "#17a2b8",
  warning: "#ffc107",
  critical: "#dc3545",
};

function EquipmentIntelligencePanel({
  equipmentId,
  issues,
  recommendations,
  onIssueResolve,
  onRetry,
  tooltipMessage = "Equipment intelligence combines valuation and fraud checks.",
  loading,
  error,
}) {
  const isMissingEquipment = equipmentId === "N/A" || equipmentId === "Unknown";

  return (
    <PanelState
      loading={loading}
      loadingLabel="Loading equipment intelligence..."
      error={error}
      onErrorAction={onRetry}
      errorActionLabel="Retry Equipment Intelligence"
    >
      <div>
        <h4 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: "8px" }}>
          Equipment Intelligence
          <WhyTooltip
            content={tooltipMessage}
            ariaLabel="Why equipment intelligence is shown"
          />
        </h4>
        <div style={{ marginBottom: "10px" }}>
          Equipment ID: <strong>{equipmentId}</strong>
        </div>
        {isMissingEquipment && (
          <div style={{ marginBottom: "12px", color: "#6c757d" }}>
            Equipment data has not loaded yet. Retry to fetch equipment intelligence signals.
            <WhyTooltip
              content="Equipment intelligence is generated after invoice and valuation checks."
              ariaLabel="Why equipment intelligence is not available"
            />
            {onRetry && (
              <div style={{ marginTop: "8px" }}>
                <button onClick={onRetry}>Retry Equipment Intelligence</button>
              </div>
            )}
          </div>
        )}
        <div>
          <strong>Issues</strong>
          {issues.length === 0 ? (
            <div style={{ marginTop: "6px", color: "#6c757d" }}>No issues detected.</div>
          ) : (
            <ul style={{ paddingLeft: "18px" }}>
              {issues.map((issue) => (
                <li key={issue.id} style={{ marginBottom: "6px" }}>
                  <span>{issue.description}</span>
                  <span style={{ marginLeft: "8px", color: SEVERITY_COLOR[issue.severity] }}>
                    {issue.severity}
                  </span>
                  {!issue.resolved && onIssueResolve && (
                    <button
                      onClick={() => onIssueResolve(issue.id)}
                      style={{ marginLeft: "12px" }}
                    >
                      Mark Resolved
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <strong>Recommendations</strong>
          {recommendations.length === 0 ? (
            <div style={{ marginTop: "6px", color: "#6c757d" }}>No recommendations yet.</div>
          ) : (
            <ul style={{ paddingLeft: "18px" }}>
              {recommendations.map((rec, idx) => (
                <li key={`${rec}-${idx}`}>{rec}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PanelState>
  );
}

export default EquipmentIntelligencePanel;
