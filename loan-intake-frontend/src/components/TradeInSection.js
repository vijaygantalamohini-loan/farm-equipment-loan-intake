import React from "react";
import AssetForm from "./AssetForm";

function TradeInSection({ tradeIns, onChange }) {
  const addTradeIn = () => {
    onChange([
      ...tradeIns,
      {
        id: Date.now(),
        make: "",
        model: "",
        year: "",
        serialNumber: "",
        hoursOrMiles: "",
        condition: "",
        valueEstimate: ""
      }
    ]);
  };

  const removeTradeIn = (index) => {
    if (tradeIns.length === 1) {
      alert("You must have at least one trade-in or uncheck 'I have a trade-in'");
      return;
    }
    onChange(tradeIns.filter((_, idx) => idx !== index));
  };

  const updateTradeIn = (index, field, value) => {
    onChange(
      tradeIns.map((tradeIn, idx) =>
        idx === index ? { ...tradeIn, [field]: value } : tradeIn
      )
    );
  };

  const totalTradeInValue = tradeIns.reduce(
    (sum, t) => sum + (parseFloat(t.valueEstimate) || 0),
    0
  );

  return (
    <div style={{ marginTop: "20px", marginBottom: "20px" }}>
      <h3 style={{ marginBottom: "15px", color: "#007bff" }}>
        Trade-In Equipment
        <span style={{ fontSize: "14px", fontWeight: "normal", color: "#666", marginLeft: "10px" }}>
          ({tradeIns.length} item{tradeIns.length !== 1 ? 's' : ''})
        </span>
      </h3>

      {tradeIns.map((tradeIn, index) => (
        <div key={tradeIn.id}>
          <h4 style={{ marginBottom: "10px", color: "#555" }}>
            Trade-In {index + 1}
          </h4>
          <AssetForm
            asset={tradeIn}
            assetIndex={index}
            type="trade-in"
            showSerialScanning={true}
            canRemove={tradeIns.length > 1}
            onChange={(field, value) => updateTradeIn(index, field, value)}
            onRemove={() => removeTradeIn(index)}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={addTradeIn}
        style={{
          padding: "10px 20px",
          fontSize: "15px",
          backgroundColor: "#17a2b8",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          width: "100%",
          marginBottom: "15px"
        }}
      >
        ➕ Add Another Trade-In
      </button>

      {tradeIns.length > 0 && (
        <div style={{
          padding: "15px",
          backgroundColor: "#e7f3ff",
          border: "1px solid #007bff",
          borderRadius: "4px",
          textAlign: "right"
        }}>
          <strong style={{ fontSize: "16px" }}>
            Total Trade-In Value: ${totalTradeInValue.toLocaleString()}
          </strong>
        </div>
      )}
    </div>
  );
}

export default TradeInSection;
