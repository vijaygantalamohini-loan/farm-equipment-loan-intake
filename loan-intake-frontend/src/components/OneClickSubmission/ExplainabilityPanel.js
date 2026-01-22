import React from "react";

import PanelState from "./PanelState";
import Tooltip from "./Tooltip";
import WhyTooltip from "./WhyTooltip";

function ExplainabilityPanel({ explanations, onToggleExpand, onRetry, loading, error }) {
  const hasExplanations = explanations.length > 0;

  return (
    <PanelState
      loading={loading}
      loadingLabel="Loading explainability..."
      error={error}
      onErrorAction={onRetry}
      errorActionLabel="Retry Explainability"
    >
      <div>
        <h4 style={{ marginTop: 0 }}>Explainability</h4>
        {!hasExplanations && (
          <div style={{ color: "#6c757d" }}>
            No explainability insights yet. Complete OCR to generate explanations for extracted fields.
            <WhyTooltip
              content="Explainability depends on OCR results and confidence signals."
              ariaLabel="Why explainability is not available"
            />
          </div>
        )}
        {!hasExplanations && onRetry && (
          <button onClick={onRetry} style={{ marginTop: "8px" }}>
            Retry Explainability
          </button>
        )}
        {hasExplanations &&
          explanations.map((item) => (
            <div
              key={item.fieldName}
              style={{
                border: "1px solid #e9ecef",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "12px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{item.fieldName}</strong>
                {onToggleExpand && (
                  <button onClick={() => onToggleExpand(item.fieldName)}>
                    {item.expanded ? "Collapse" : "Expand"}
                  </button>
                )}
              </div>
              <div style={{ marginTop: "8px" }}>
                {Object.entries(item.scores).map(([feature, score]) => (
                  <div key={feature} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{feature}</span>
                    <Tooltip content={`Influence: ${Math.round(score * 100)}%`}>
                      <span>{Math.round(score * 100)}%</span>
                    </Tooltip>
                  </div>
                ))}
              </div>
              {item.expanded && (
                <p style={{ marginTop: "10px", color: "#6c757d" }}>{item.textualExplanation}</p>
              )}
            </div>
          ))}
      </div>
    </PanelState>
  );
}

export default ExplainabilityPanel;
