import React from "react";

function ErrorNotification({ message, onDismiss }) {
  return (
    <div
      style={{
        background: "#f8d7da",
        border: "1px solid #f5c6cb",
        color: "#721c24",
        padding: "12px 16px",
        borderRadius: "6px",
      }}
    >
      <strong>Error:</strong> {message}
      {onDismiss && (
        <button onClick={onDismiss} style={{ marginLeft: "12px" }}>
          Dismiss
        </button>
      )}
    </div>
  );
}

export default ErrorNotification;
