import React from "react";

function LoadingIndicator({ label = "Loading..." }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div
        style={{
          width: "16px",
          height: "16px",
          borderRadius: "50%",
          border: "2px solid #dee2e6",
          borderTopColor: "#007bff",
          animation: "spin 1s linear infinite",
        }}
      />
      <span>{label}</span>
    </div>
  );
}

export default LoadingIndicator;
