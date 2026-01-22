import React, { useState, useEffect, useMemo, useRef } from "react";
import AssetForm from "./AssetForm";
import TradeInSection from "./TradeInSection";
import LoanCalculator from "./LoanCalculator";
import { prequalificationAPI, equipmentIntelligenceAPI, API_BASE } from "../services/api";
import { formatCurrency } from "../utils/format";
import { getValidToken } from "../utils/auth";

const detectAssetType = (asset = {}) => asset.equipmentType || asset.make || "Equipment";

const clampYear = (year, currentYear) => {
  const minYear = 1990;
  const maxYear = currentYear + 1;
  if (!Number.isFinite(year)) {
    return currentYear;
  }
  return Math.min(Math.max(year, minYear), maxYear);
};

const determineAssetYear = (asset = {}, currentYear) => {
  const parsed = parseInt(asset.year, 10);
  return clampYear(parsed, currentYear);
};

const isAssetNew = (asset = {}, currentYear) => {
  const condition = (asset.condition || "").toLowerCase();
  if (condition.includes("new") || condition.includes("unused")) {
    return true;
  }
  const assetYear = determineAssetYear(asset, currentYear);
  return assetYear >= currentYear - 1;
};
function LoanRequestStep({
  onNextValidate,
  nextStep,
  prevStep,
  initialData,
  missingFields = [],
  onDraftChange = () => {},
  onOcrResults = () => {},
}) {
  const [loan, setLoan] = useState({
    purpose: initialData?.loan?.purpose || "",
    cashDown: initialData?.loan?.cashDown || "",
    termMonths: initialData?.loan?.termMonths || "60",
    condition: initialData?.loan?.condition || "",
    naicsCode: initialData?.loan?.naicsCode || null,
    hasTradeIn: initialData?.loan?.hasTradeIn || false,
    purchaseAssets: initialData?.loan?.purchaseAssets || [{
      id: Date.now(),
      make: "",
      model: "",
      year: "",
      serialNumber: "",
      condition: "",
      valueEstimate: ""
    }],
    tradeIns: initialData?.loan?.tradeIns || []
  });

  const [currentAssetIndex, setCurrentAssetIndex] = useState(0);
  const [prequalification, setPrequalification] = useState(null);
  const [prequalificationStatus, setPrequalificationStatus] = useState("idle");
  const [prequalificationError, setPrequalificationError] = useState(null);
  const prequalAbortRef = useRef(null);
  const [equipmentIntelligence, setEquipmentIntelligence] = useState(null);
  const [equipmentIntelligenceStatus, setEquipmentIntelligenceStatus] = useState("idle");
  const [equipmentIntelligenceError, setEquipmentIntelligenceError] = useState(null);
  const equipmentIntelligenceAbortRef = useRef(null);
  const [oneClickIdFile, setOneClickIdFile] = useState(null);
  const [oneClickInvoiceFile, setOneClickInvoiceFile] = useState(null);
  const [oneClickStatus, setOneClickStatus] = useState("idle");
  const [oneClickError, setOneClickError] = useState(null);
  const [oneClickResult, setOneClickResult] = useState(null);

  // Sync local loan state when initialData changes (resume prefill)
  const getFriendlyError = (error, fallback = "Unable to compute AI prequalification.") => {
    if (!error) return fallback;
    if (typeof error === "string") return error;

    const coerceDetailList = (value) => {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      return [value];
    };

    const renderDetailItem = (item) => {
      if (!item) return null;
      if (typeof item === "string") return item;
      if (item instanceof Error && item.message) return item.message;
      if (typeof item === "object") {
        const msg = item.msg || item.message || item.detail || item.error;
        const loc = Array.isArray(item.loc)
          ? item.loc.filter((part) => part && part !== "body").join(".")
          : undefined;
        if (msg) {
          return loc ? `${msg} (${loc})` : msg;
        }
        try {
          return JSON.stringify(item);
        } catch {}
      }
      return String(item);
    };

    const { message, detail, data } = error;

    if (Array.isArray(message)) {
      const rendered = message.map(renderDetailItem).filter(Boolean);
      if (rendered.length > 0) return rendered.join(" | ");
    }

    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }

    if (message && typeof message === "object") {
      if (typeof message.detail === "string") return message.detail;
      if (Array.isArray(message.detail)) {
        const rendered = message.detail.map(renderDetailItem).filter(Boolean);
        if (rendered.length > 0) return rendered.join(" | ");
      }
    }

    if (Array.isArray(detail)) {
      const rendered = detail.map(renderDetailItem).filter(Boolean);
      if (rendered.length > 0) return rendered.join(" | ");
    }

    if (typeof detail === "string" && detail.trim().length > 0) return detail;

    if (data) {
      if (Array.isArray(data.detail)) {
        const rendered = coerceDetailList(data.detail).map(renderDetailItem).filter(Boolean);
        if (rendered.length > 0) return rendered.join(" | ");
      }
      if (typeof data.detail === "string" && data.detail.trim().length > 0) return data.detail;
      try {
        return JSON.stringify(data);
      } catch {}
    }

    try {
      return JSON.stringify(error);
    } catch {}
    return fallback;
  };

  useEffect(() => {
    setLoan({
      purpose: initialData?.loan?.purpose || "",
      cashDown: initialData?.loan?.cashDown || "",
      termMonths: initialData?.loan?.termMonths || "60",
      condition: initialData?.loan?.condition || "",
      naicsCode: initialData?.loan?.naicsCode || null,
      hasTradeIn: initialData?.loan?.hasTradeIn || false,
      purchaseAssets: initialData?.loan?.purchaseAssets || [{
        id: Date.now(),
        make: "",
        model: "",
        year: "",
        serialNumber: "",
        condition: "",
        valueEstimate: ""
      }],
      tradeIns: initialData?.loan?.tradeIns || []
    });
    setCurrentAssetIndex(0);
  }, [initialData]);

  const handleChange = (field, value) => {
    setLoan(prev => {
      const updated = { ...prev, [field]: value };
      onDraftChange({ loan: updated });
      return updated;
    });
  };

  const updatePurchaseAsset = (assetIndex, field, value) => {
    setLoan(prev => {
      const updated = {
        ...prev,
        purchaseAssets: prev.purchaseAssets.map((asset, idx) => 
          idx === assetIndex ? { ...asset, [field]: value } : asset
        )
      };
      onDraftChange({ loan: updated });
      return updated;
    });
  };

  const addPurchaseAsset = () => {
    setLoan(prev => {
      const updated = {
        ...prev,
        purchaseAssets: [...prev.purchaseAssets, {
          id: Date.now(),
          make: "",
          model: "",
          year: "",
          serialNumber: "",
          condition: "",
          valueEstimate: ""
        }]
      };
      onDraftChange({ loan: updated });
      return updated;
    });
    setCurrentAssetIndex(loan.purchaseAssets.length);
  };

  const removePurchaseAsset = (assetIndex) => {
    if (loan.purchaseAssets.length === 1) {
      alert("You must have at least one equipment to purchase.");
      return;
    }
    
    setLoan(prev => {
      const updated = {
        ...prev,
        purchaseAssets: prev.purchaseAssets.filter((_, idx) => idx !== assetIndex)
      };
      onDraftChange({ loan: updated });
      return updated;
    });
    
    if (currentAssetIndex >= assetIndex && currentAssetIndex > 0) {
      setCurrentAssetIndex(currentAssetIndex - 1);
    }
  };

  const handleTradeInToggle = (checked) => {
    setLoan(prev => {
      const updated = {
        ...prev,
        hasTradeIn: checked,
        tradeIns: checked ? [{
          id: Date.now(),
          make: "",
          model: "",
          year: "",
          serialNumber: "",
          hoursOrMiles: "",
          condition: "",
          valueEstimate: ""
        }] : []
      };
      onDraftChange({ loan: updated });
      return updated;
    });
  };

  const handleTradeInsChange = (tradeIns) => {
    setLoan(prev => {
      const updated = { ...prev, tradeIns };
      onDraftChange({ loan: updated });
      return updated;
    });
  };

  // Calculate loan amount
  const totalEquipmentValue = loan.purchaseAssets.reduce(
    (sum, asset) => sum + (parseFloat(asset.valueEstimate) || 0),
    0
  );

    const totalTradeInValue = loan.tradeIns.reduce(
      (sum, tradeIn) => sum + (parseFloat(tradeIn.valueEstimate) || 0),
      0
    );

  const cashDownAmount = parseFloat(loan.cashDown) || 0;

  const calculatedLoanAmount = Math.max(
    0,
    totalEquipmentValue - totalTradeInValue - cashDownAmount
  );

  const assetSignature = useMemo(
    () => JSON.stringify(loan.purchaseAssets),
    [loan.purchaseAssets]
  );
  const dealerState = (
    initialData?.dealer?.address?.state ||
    initialData?.dealer?.state ||
    initialData?.borrower?.address?.state ||
    initialData?.borrower?.state ||
    ""
  ).toUpperCase();
  const borrowerIncome = parseFloat(initialData?.borrower?.annualIncome) || 0;
  const borrowerCreditScore = parseFloat(initialData?.borrower?.creditScore);
  const normalizedCreditScore = Number.isFinite(borrowerCreditScore)
    ? borrowerCreditScore
    : 680;
  const currentYear = new Date().getFullYear();
  const sanitizedEquipmentList = useMemo(() => {
    return loan.purchaseAssets.reduce((acc, asset) => {
      const value = parseFloat(asset.valueEstimate);
      if (!Number.isFinite(value) || value <= 0) {
        return acc;
      }

      acc.push({
        type: detectAssetType(asset),
        year: determineAssetYear(asset, currentYear),
        value,
        isNew: isAssetNew(asset, currentYear),
        serialNumber: asset.serialNumber || "",
      });

      return acc;
    }, []);
  }, [loan.purchaseAssets, currentYear]);
  const buildPrequalificationPayload = () => {
    if (sanitizedEquipmentList.length === 0) {
      return null;
    }

    const equipment_list = sanitizedEquipmentList;
    const termMonths = parseInt(loan.termMonths, 10);
    return {
      loan_amount: calculatedLoanAmount,
      equipment_list,
      borrower_income: borrowerIncome,
      credit_score: normalizedCreditScore,
      down_payment: parseFloat(loan.cashDown) || 0,
      naics_code: loan.naicsCode || "",
      state: dealerState,
      trade_in_present: !!loan.hasTradeIn,
      loan_term_months: Number.isFinite(termMonths) ? Math.max(12, termMonths) : 60,
    };
  };

  const getProbabilityColor = (probability) => {
    if (probability >= 0.75) return "#28a745";
    if (probability >= 0.4) return "#ffc107";
    return "#dc3545";
  };
  const getRiskColor = (tier) => {
    if (tier === "High") return "#dc3545";
    if (tier === "Medium") return "#ffc107";
    return "#28a745";
  };

  useEffect(() => {
    const shouldCallPrequalification =
      totalEquipmentValue > 0 &&
      calculatedLoanAmount > 0 &&
      borrowerIncome > 0 &&
      Boolean(loan.naicsCode) &&
      Boolean(dealerState) &&
      sanitizedEquipmentList.length > 0;

    if (!shouldCallPrequalification) {
      if (prequalAbortRef.current) {
        prequalAbortRef.current.abort();
        prequalAbortRef.current = null;
      }
      setPrequalificationStatus("idle");
      setPrequalification(null);
      setPrequalificationError(null);
      return;
    }

    const controller = new AbortController();
    if (prequalAbortRef.current) {
      prequalAbortRef.current.abort();
    }
    prequalAbortRef.current = controller;

    setPrequalificationStatus("loading");
    setPrequalificationError(null);

    const payload = buildPrequalificationPayload();
    if (!payload) {
      prequalAbortRef.current = null;
      setPrequalificationStatus("idle");
      setPrequalification(null);
      return () => controller.abort();
    }

    prequalificationAPI
      .prequalify(payload, controller.signal)
      .then((data) => {
        setPrequalification(data);
      })
      .catch((err) => {
        if (err && err.name === "AbortError") return;
        console.error("AI prequalification failed", err);
        setPrequalificationError(getFriendlyError(err));
      })
      .finally(() => {
        setPrequalificationStatus("ready");
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    assetSignature,
    totalEquipmentValue,
    calculatedLoanAmount,
    loan.cashDown,
    loan.termMonths,
    loan.naicsCode,
    loan.hasTradeIn,
    borrowerIncome,
    normalizedCreditScore,
    dealerState,
    sanitizedEquipmentList,
  ]);

  useEffect(() => {
    const primaryAsset = loan.purchaseAssets.reduce(
      (best, asset, idx) => {
        const value = parseFloat(asset.valueEstimate);
        if (!Number.isFinite(value) || value <= 0) {
          return best;
        }
        if (!best || value > best.value) {
          return { asset, index: idx, value };
        }
        return best;
      },
      null
    );

    const shouldCallIntelligence =
      totalEquipmentValue > 0 &&
      calculatedLoanAmount > 0 &&
      Boolean(dealerState) &&
      primaryAsset;

    if (!shouldCallIntelligence) {
      if (equipmentIntelligenceAbortRef.current) {
        equipmentIntelligenceAbortRef.current.abort();
        equipmentIntelligenceAbortRef.current = null;
      }
      setEquipmentIntelligenceStatus("idle");
      setEquipmentIntelligence(null);
      setEquipmentIntelligenceError(null);
      return;
    }

    const controller = new AbortController();
    if (equipmentIntelligenceAbortRef.current) {
      equipmentIntelligenceAbortRef.current.abort();
    }
    equipmentIntelligenceAbortRef.current = controller;

    setEquipmentIntelligenceStatus("loading");
    setEquipmentIntelligenceError(null);
    const selectedAsset = primaryAsset?.asset || {};
    const ltv = totalEquipmentValue ? calculatedLoanAmount / totalEquipmentValue : 0;

    const payload = {
      make: selectedAsset.make || loan.purpose || "Equipment",
      model: selectedAsset.model || "Equipment",
      year: parseInt(selectedAsset.year, 10) || new Date().getFullYear(),
      hours: parseInt(selectedAsset.hoursOrMiles || selectedAsset.hours || 0, 10) || 0,
      serial_number: selectedAsset.serialNumber || "",
      region: dealerState,
      condition: selectedAsset.condition || loan.condition || "Good",
      loan_amount: calculatedLoanAmount,
      ltv,
    };

    equipmentIntelligenceAPI
      .getIntelligence(payload, controller.signal)
      .then((data) => {
        setEquipmentIntelligence(data);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setEquipmentIntelligenceError(
          err?.message || "Unable to fetch equipment intelligence."
        );
      })
      .finally(() => {
        setEquipmentIntelligenceStatus("ready");
      });

    return () => controller.abort();
  }, [
    totalEquipmentValue,
    calculatedLoanAmount,
    loan.purchaseAssets,
    loan.condition,
    loan.purpose,
    dealerState,
  ]);

  const handleSubmit = async () => {
    console.debug('[LoanRequestStep] handleSubmit called. Loan:', loan);
    // Submit current step data and validate; advance only if no missing fields for this section
    await onNextValidate({ 
      loan: {
        ...loan,
        equipmentType: loan.purchaseAssets?.[0]?.equipmentType || loan.purpose || "Equipment",
        make: loan.purchaseAssets?.[0]?.make,
        model: loan.purchaseAssets?.[0]?.model,
        year: loan.purchaseAssets?.[0]?.year,
        // Include serial number at the top level so backend persists and UI can display it
        serialNumber: loan.purchaseAssets?.[0]?.serialNumber,
        condition: loan.purchaseAssets?.[0]?.condition || loan.condition,
        purchasePrice: totalEquipmentValue.toString(),
        cashDown: loan.cashDown,
        termMonths: loan.termMonths,
        amount: calculatedLoanAmount.toString()
      }
    }, 'loan');
  };

  const handleOneClickSubmit = async () => {
    if (!oneClickIdFile || !oneClickInvoiceFile) {
      setOneClickError("Please upload both ID and invoice images.");
      return;
    }

    setOneClickStatus("loading");
    setOneClickError(null);
    setOneClickResult(null);

    const formData = new FormData();
    formData.append("id_image", oneClickIdFile);
    formData.append("invoice_image", oneClickInvoiceFile);

    const base = API_BASE || "";
    const url = base ? `${base}/loans/one-click-submit` : "/loans/one-click-submit";
    const headers = {};
    const token = getValidToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: formData,
      });

      const text = await response.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = { detail: text };
      }

      if (!response.ok) {
        const message = data?.detail || "One-click submission failed.";
        setOneClickError(message);
        setOneClickStatus("error");
        return;
      }

      setOneClickResult(data);
      setOneClickStatus("ready");
    } catch (err) {
      setOneClickError(err?.message || "One-click submission failed.");
      setOneClickStatus("error");
    }
  };


  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      <h2>Loan Request</h2>
      <p style={{ color: "#666", marginBottom: "20px" }}>
        Provide details about the loan and the equipment you're financing.
      </p>

      {/* Purchase Assets */}
      <div style={{ marginBottom: "30px" }}>
        <h3 style={{ marginBottom: "15px" }}>
          Equipment to Purchase
          <span style={{ fontSize: "14px", fontWeight: "normal", color: "#666", marginLeft: "10px" }}>
            ({loan.purchaseAssets.length} asset{loan.purchaseAssets.length !== 1 ? 's' : ''})
          </span>
        </h3>

        {/* Asset tabs */}
        {loan.purchaseAssets.length > 1 && (
          <div style={{ display: "flex", gap: "5px", marginBottom: "20px", flexWrap: "wrap" }}>
            {loan.purchaseAssets.map((asset, idx) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => setCurrentAssetIndex(idx)}
                style={{
                  padding: "8px 16px",
                  fontSize: "14px",
                  cursor: "pointer",
                  backgroundColor: currentAssetIndex === idx ? "#007bff" : "#f0f0f0",
                  color: currentAssetIndex === idx ? "white" : "black",
                  border: "1px solid #ccc",
                  borderRadius: "4px"
                }}
              >
                Asset {idx + 1}
                {asset.make && ` - ${asset.make}`}
              </button>
            ))}
          </div>
        )}

        {/* Render current purchase asset */}
        {loan.purchaseAssets.map((asset, assetIndex) => {
          if (assetIndex !== currentAssetIndex) return null;
          
          return (
            <div key={asset.id}>
              {loan.purchaseAssets.length > 1 && (
                <h4 style={{ marginBottom: "15px" }}>Asset {assetIndex + 1}</h4>
              )}
              <AssetForm
                asset={asset}
                assetIndex={assetIndex}
                type="purchase"
                showSerialScanning={true}
                canRemove={loan.purchaseAssets.length > 1}
                onChange={(field, value) => updatePurchaseAsset(assetIndex, field, value)}
                onOcrResults={onOcrResults}
                onRemove={() => removePurchaseAsset(assetIndex)}
              />
            </div>
          );
        })}

        <button
          type="button"
          onClick={addPurchaseAsset}
          style={{
            padding: "10px 20px",
            fontSize: "15px",
            backgroundColor: "#28a745",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            width: "100%",
            marginTop: "10px"
          }}
        >
          ➕ Add Another Asset
        </button>
      </div>

      {/* Trade-In Toggle */}
      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "flex", alignItems: "center", fontSize: "16px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={loan.hasTradeIn}
            onChange={e => handleTradeInToggle(e.target.checked)}
            style={{ marginRight: "10px", width: "18px", height: "18px", cursor: "pointer" }}
          />
          <strong>I have equipment to trade in</strong>
        </label>
      </div>

      {/* Trade-In Section */}
      {loan.hasTradeIn && (
        <TradeInSection
          tradeIns={loan.tradeIns}
          onChange={handleTradeInsChange}
        />
      )}

      {/* Cash Down Payment */}
      <div style={{ 
        marginBottom: "30px",
        backgroundColor: "#f8f9fa",
        border: "2px solid #28a745",
        borderRadius: "8px",
        padding: "20px"
      }}>
        <h3 style={{ marginTop: 0, marginBottom: "15px", color: "#28a745" }}>
          💵 Cash Down Payment
        </h3>
        <div>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "14px" }}>
            Down Payment Amount ($)
          </label>
          <input
            type="number"
            placeholder="0"
            value={loan.cashDown}
            onChange={e => handleChange("cashDown", e.target.value)}
            style={{ width: "100%", padding: "10px", fontSize: "16px", maxWidth: "300px" }}
          />
          <small style={{ display: "block", marginTop: "5px", color: "#666" }}>
            Enter the amount you plan to pay as down payment (optional)
          </small>
        </div>
      </div>

      {/* Loan Calculator */}
      <LoanCalculator
        purchaseAssets={loan.purchaseAssets}
        tradeIns={loan.tradeIns}
        cashDown={loan.cashDown}
        purpose={loan.purpose}
        onPurposeChange={(value) => handleChange("purpose", value)}
        onNaicsChange={(naics) => handleChange("naicsCode", naics)}
      />

      <div
        style={{
          marginTop: "30px",
          padding: "20px",
          borderRadius: "10px",
          border: "1px solid #e3e3e3",
          backgroundColor: "#ffffff",
          boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
        }}
      >
        <h3 style={{ marginTop: 0 }}>AI Pre-Qualification</h3>
        {prequalificationStatus === "loading" && (
          <p style={{ color: "#6c757d" }}>Analyzing the application...</p>
        )}
        {prequalificationError && (
          <div
            style={{
              marginBottom: "12px",
              padding: "10px",
              borderRadius: "6px",
              background: "#f8d7da",
              color: "#721c24",
              border: "1px solid #f5c6cb",
            }}
          >
            {prequalificationError}
          </div>
        )}
        {prequalification ? (
          <div style={{ display: "grid", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <strong>Approval Probability:</strong>
                <span
                  style={{
                    marginLeft: "6px",
                    fontWeight: "bold",
                    color: getProbabilityColor(prequalification.approval_probability),
                  }}
                >
                  {Math.round((prequalification.approval_probability || 0) * 100)}%
                </span>
              </div>
              <div>
                <strong>Risk Score:</strong>
                <span
                  style={{
                    marginLeft: "6px",
                    fontWeight: "bold",
                    color: getRiskColor(prequalification.risk_tier),
                  }}
                >
                  {prequalification.risk_score ?? "—"} ({prequalification.risk_tier || "N/A"})
                </span>
              </div>
            </div>
            <div>
              <strong>Flags:</strong>{" "}
              {prequalification.flags && prequalification.flags.length > 0 ? (
                <span style={{ color: "#555" }}>
                  {prequalification.flags.join(", ")}
                </span>
              ) : (
                <span style={{ color: "#6c757d" }}>None</span>
              )}
            </div>
            <div
              style={{
                padding: "12px",
                borderRadius: "8px",
                background: "#f8f9fa",
                border: "1px dashed #dcdcdc",
              }}
            >
              <strong>Suggested Structure</strong>
              <div style={{ marginTop: "8px", display: "grid", gap: "4px" }}>
                <div>
                  Down Payment:{" "}
                  {formatCurrency(
                    prequalification.optimal_structure?.recommended_down_payment || 0
                  )}
                </div>
                <div>
                  Term:{" "}
                  {(prequalification.optimal_structure?.recommended_term || 0)} months
                </div>
                <div>
                  Est. Payment:{" "}
                  {formatCurrency(
                    prequalification.optimal_structure?.expected_monthly_payment || 0
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          prequalificationStatus === "ready" &&
          !prequalificationError && (
            <p style={{ color: "#6c757d" }}>
              Complete the form to unlock AI-driven guidance.
            </p>
          )
        )}
      </div>

      <div
        style={{
          marginTop: "24px",
          padding: "20px",
          borderRadius: "10px",
          border: "1px solid #e3e3e3",
          backgroundColor: "#f4f7fb",
          boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Equipment Intelligence</h3>
        {equipmentIntelligenceStatus === "loading" && (
          <p style={{ color: "#6c757d" }}>Gathering equipment context...</p>
        )}
        {equipmentIntelligenceError && (
          <div
            style={{
              marginBottom: "12px",
              padding: "10px",
              borderRadius: "6px",
              background: "#fff3cd",
              color: "#856404",
              border: "1px solid #ffeeba",
            }}
          >
            {equipmentIntelligenceError}
          </div>
        )}
        {equipmentIntelligence ? (
          <div style={{ display: "grid", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <strong>Estimated Value:</strong>{" "}
                {formatCurrency(equipmentIntelligence.valuation?.blended_value || 0)}
              </div>
              <div>
                <strong>Confidence:</strong>{" "}
                <span style={{ fontWeight: "bold" }}>
                  {Math.round((equipmentIntelligence.overall_confidence || 0) * 100)}%
                </span>
              </div>
            </div>
            <div>
              <strong>Serial Validity:</strong>{" "}
              <span>
                {equipmentIntelligence.serial_number?.confidence >= 0.8 ? "High" : "Medium"}
              </span>
            </div>
            <div>
              <strong>History Flags:</strong>{" "}
              {equipmentIntelligence.history?.hour_consistency === "inconsistent"
                ? "Inconsistent Hours"
                : "None"}
            </div>
            <div>
              <strong>Predicted Resale (36 months):</strong>{" "}
              {formatCurrency(equipmentIntelligence.predictive_resale?.predicted_resale || 0)}
            </div>
            <div>
              <strong>Risk Flags:</strong>{" "}
              {equipmentIntelligence.risk_flags.length > 0
                ? equipmentIntelligence.risk_flags.join(", ")
                : "None"}
            </div>
          </div>
        ) : (
          equipmentIntelligenceStatus === "ready" &&
          !equipmentIntelligenceError && (
            <p style={{ color: "#6c757d" }}>Awaiting equipment intelligence...</p>
          )
        )}
      </div>

      <div
        style={{
          marginTop: "24px",
          padding: "20px",
          borderRadius: "10px",
          border: "1px solid #e3e3e3",
          backgroundColor: "#ffffff",
          boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
        }}
      >
        <h3 style={{ marginTop: 0 }}>One-Click Submit</h3>
        <p style={{ color: "#666", marginTop: 0 }}>
          Upload ID + invoice images to auto-fill, prequalify, and match lenders.
        </p>

        <div style={{ display: "grid", gap: "12px" }}>
          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontWeight: "600" }}>ID Image</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setOneClickIdFile(e.target.files?.[0] || null)}
            />
          </label>
          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontWeight: "600" }}>Invoice Image</span>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setOneClickInvoiceFile(e.target.files?.[0] || null)}
            />
          </label>
          <button
            type="button"
            onClick={handleOneClickSubmit}
            disabled={oneClickStatus === "loading"}
            style={{
              padding: "10px 16px",
              fontSize: "15px",
              backgroundColor: "#111827",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: oneClickStatus === "loading" ? "wait" : "pointer",
              maxWidth: "240px",
            }}
          >
            {oneClickStatus === "loading" ? "Submitting..." : "One-Click Submit"}
          </button>
        </div>

        {oneClickError && (
          <div
            style={{
              marginTop: "12px",
              padding: "10px",
              borderRadius: "6px",
              background: "#f8d7da",
              color: "#721c24",
              border: "1px solid #f5c6cb",
            }}
          >
            {oneClickError}
          </div>
        )}

        {oneClickResult && (
          <div style={{ marginTop: "16px", display: "grid", gap: "12px" }}>
            <div>
              <strong>AI Score:</strong>{" "}
              {Math.round((oneClickResult.ai_prequal?.approval_probability || 0) * 100)}%{" "}
              ({oneClickResult.ai_prequal?.risk_tier || "N/A"})
            </div>
            <div>
              <strong>Valuation:</strong>{" "}
              {formatCurrency(oneClickResult.equipment_intelligence?.valuation?.blended_value || 0)}
            </div>
            <div>
              <strong>Fraud Flags:</strong>{" "}
              {oneClickResult.fraud_flags && oneClickResult.fraud_flags.length > 0
                ? oneClickResult.fraud_flags.map((flag) => flag.code || flag.message).join(", ")
                : "None"}
            </div>
            <div>
              <strong>Matched Lenders:</strong>{" "}
              {oneClickResult.matched_lenders && oneClickResult.matched_lenders.length > 0
                ? oneClickResult.matched_lenders
                    .map((lender) => `${lender.lender_name} (${lender.match_score})`)
                    .join(", ")
                : "None"}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "30px" }}>
        <button 
          onClick={prevStep}
          style={{ padding: "10px 30px", fontSize: "16px", cursor: "pointer" }}
        >
          Back
        </button>
        <button 
          onClick={handleSubmit}
          style={{ padding: "10px 30px", fontSize: "16px", cursor: "pointer", backgroundColor: "#007bff", color: "white", border: "none" }}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default LoanRequestStep;
