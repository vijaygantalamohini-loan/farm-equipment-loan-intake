import React from "react";

const STATUS_COLOR = {
  idle: "#ced4da",
  loading: "#17a2b8",
  success: "#28a745",
  error: "#dc3545",
};

function ProgressStepper({ steps, currentStep, stepStatus, onStepClick }) {
  return (
    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
      {steps.map((step, index) => {
        const status = stepStatus[step.id];
        const isActive = step.id === currentStep;
        const content = (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "999px",
                background: STATUS_COLOR[status],
                border: isActive ? "2px solid #007bff" : "2px solid transparent",
              }}
            />
            <span style={{ fontWeight: isActive ? 600 : 500 }}>{step.label}</span>
          </div>
        );
        return (
          <div key={step.id} style={{ minWidth: "120px" }}>
            {onStepClick ? (
              <button
                type="button"
                onClick={() => onStepClick(step.id)}
                aria-current={isActive ? "step" : undefined}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {content}
              </button>
            ) : (
              content
            )}
            {index < steps.length - 1 && (
              <div
                style={{
                  marginLeft: "6px",
                  marginTop: "6px",
                  height: "24px",
                  borderLeft: "2px solid #e9ecef",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ProgressStepper;
