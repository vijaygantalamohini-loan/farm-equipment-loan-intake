import React from "react";

function SubmissionSummary({ title = "Submission Summary", items, helperText }) {
  return (
    <div style={{ border: "1px solid #e6e6e6", borderRadius: "10px", padding: "16px" }}>
      <h4 style={{ marginTop: 0 }}>{title}</h4>
      <dl style={{ margin: 0 }}>
        {items.map((item) => (
          <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
            <dt style={{ color: "#6c757d" }}>{item.label}</dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>
              {item.value ?? "N/A"}
            </dd>
          </div>
        ))}
      </dl>
      {helperText && (
        <p style={{ marginTop: "12px", color: "#6c757d", fontSize: "13px" }}>{helperText}</p>
      )}
    </div>
  );
}

export default SubmissionSummary;
