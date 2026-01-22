import React, { useMemo, useState } from "react";

import PanelState from "./PanelState";
import Tooltip from "./Tooltip";
import WhyTooltip from "./WhyTooltip";

function OCRResultPanel({
  fields,
  confidenceThreshold,
  onFieldEdit,
  onFlagToggle,
  onRetry,
  loading,
  error,
}) {
  const [editingField, setEditingField] = useState(null);
  const [editingValue, setEditingValue] = useState("");

  const rows = useMemo(() => fields || [], [fields]);

  const handleEditStart = (field) => {
    setEditingField(field.name);
    setEditingValue(field.value || "");
  };

  const handleEditSave = () => {
    if (!editingField) return;
    onFieldEdit(editingField, editingValue);
    setEditingField(null);
    setEditingValue("");
  };

  return (
    <PanelState
      loading={loading}
      loadingLabel="Loading OCR results..."
      error={error}
      onErrorAction={onRetry}
      errorActionLabel="Retry OCR"
    >
      {rows.length === 0 ? (
        <div>
          <h4 style={{ marginTop: 0 }}>OCR Results</h4>
          <div style={{ color: "#6c757d" }}>
            No OCR fields available yet. Upload ID and invoice files, then run OCR to populate fields and confidence scores.
            <WhyTooltip
              content="OCR runs after both ID and invoice files are provided."
              ariaLabel="Why OCR is not available"
            />
          </div>
          {onRetry && <button onClick={onRetry}>Retry OCR</button>}
        </div>
      ) : (
        <div>
          <h4 style={{ marginTop: 0 }}>OCR Results</h4>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e9ecef" }}>
                <th style={{ padding: "8px 6px" }}>Field</th>
                <th style={{ padding: "8px 6px" }}>Value</th>
                <th style={{ padding: "8px 6px" }}>Confidence</th>
                <th style={{ padding: "8px 6px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((field) => {
                const isLow = field.confidence < confidenceThreshold;
                return (
                  <tr key={field.name} style={{ borderBottom: "1px solid #f1f3f5" }}>
                    <td style={{ padding: "8px 6px", fontWeight: 600 }}>{field.name}</td>
                    <td style={{ padding: "8px 6px" }}>
                      {editingField === field.name ? (
                        <input
                          value={editingValue}
                          onChange={(event) => setEditingValue(event.target.value)}
                          style={{ width: "100%", padding: "6px" }}
                        />
                      ) : (
                        field.value
                      )}
                    </td>
                    <td style={{ padding: "8px 6px" }}>
                      <Tooltip content={`Confidence: ${(field.confidence * 100).toFixed(0)}%`}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: "999px",
                            background: isLow ? "#fff3cd" : "#e6f4ea",
                            color: isLow ? "#856404" : "#1b5e20",
                            fontSize: "12px",
                          }}
                        >
                          {(field.confidence * 100).toFixed(0)}%
                        </span>
                      </Tooltip>
                      {field.flagged && (
                        <span style={{ marginLeft: "8px", color: "#dc3545", fontSize: "12px" }}>
                          Flagged
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "8px 6px", textAlign: "right" }}>
                      {editingField === field.name ? (
                        <button onClick={handleEditSave}>Save</button>
                      ) : (
                        <button onClick={() => handleEditStart(field)}>Edit</button>
                      )}
                      {onFlagToggle && (
                        <button
                          onClick={() => onFlagToggle(field.name, !field.flagged)}
                          style={{ marginLeft: "8px" }}
                        >
                          {field.flagged ? "Unflag" : "Flag"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PanelState>
  );
}

export default OCRResultPanel;
