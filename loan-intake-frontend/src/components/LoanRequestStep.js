import React, { useState, useEffect, useMemo, useRef } from "react";
import AssetForm from "./AssetForm";
import TradeInSection from "./TradeInSection";
import { prequalificationAPI, equipmentIntelligenceAPI } from "../services/api";
import { formatCurrency } from "../utils/format";
import { Plus, AlertCircle, TrendingUp, AlertTriangle } from "lucide-react";

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
    // Use borrower NAICS code (from Step 1) or loan NAICS code as fallback
    const naicsCode = initialData?.borrower?.naicsCode || loan.naicsCode || "";
    return {
      loan_amount: calculatedLoanAmount,
      equipment_list,
      borrower_income: borrowerIncome,
      credit_score: normalizedCreditScore,
      down_payment: parseFloat(loan.cashDown) || 0,
      naics_code: naicsCode,
      state: dealerState,
      trade_in_present: !!loan.hasTradeIn,
      loan_term_months: Number.isFinite(termMonths) ? Math.max(12, termMonths) : 60,
    };
  };

  const getProbabilityColor = (probability) => {
    if (probability >= 0.75) return "text-green-600";
    if (probability >= 0.4) return "text-yellow-600";
    return "text-red-600";
  };
  const getRiskColor = (tier) => {
    if (tier === "High") return "text-red-600";
    if (tier === "Medium") return "text-yellow-600";
    return "text-green-600";
  };

  useEffect(() => {
    const shouldCallPrequalification =
      totalEquipmentValue > 0 &&
      calculatedLoanAmount > 0 &&
      borrowerIncome > 0 &&
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

    console.log('[EquipmentIntelligence] useEffect triggered:', {
      shouldCallIntelligence,
      totalEquipmentValue,
      calculatedLoanAmount,
      dealerState,
      primaryAsset: primaryAsset ? {make: primaryAsset.asset.make, model: primaryAsset.asset.model} : null
    });

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

    console.log('[EquipmentIntelligence] Calling API with payload:', payload);
    equipmentIntelligenceAPI
      .getIntelligence(payload, controller.signal)
      .then((data) => {
        console.log('[EquipmentIntelligence] Success:', data);
        setEquipmentIntelligence(data);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        console.error('[EquipmentIntelligence] Error:', err);
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


  return (
    <div className="mx-auto px-4 py-6">
      <h2 className="text-3xl font-bold text-black mb-2">Loan Request</h2>
      <p className="text-gray-600 mb-6">
        Provide details about the loan and the equipment you're financing.
      </p>

      {/* Purchase Assets */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-black mb-4 flex items-center">
          Equipment to Purchase
          <span className="text-sm font-normal text-gray-600 ml-3">
            ({loan.purchaseAssets.length} asset{loan.purchaseAssets.length !== 1 ? 's' : ''})
          </span>
        </h3>

        {/* Asset tabs */}
        {loan.purchaseAssets.length > 1 && (
          <div className="flex gap-2 mb-6 flex-wrap">
            {loan.purchaseAssets.map((asset, idx) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => setCurrentAssetIndex(idx)}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition ${
                  currentAssetIndex === idx
                    ? "bg-black text-white border-black"
                    : "bg-gray-100 text-black border-gray-500 hover:bg-gray-200"
                }`}
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
          className="w-full mt-4 px-4 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          Add Another Asset
        </button>
      </div>

      {/* Trade-In Toggle */}
      <div className="mb-6">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={loan.hasTradeIn}
            onChange={e => handleTradeInToggle(e.target.checked)}
            className="w-5 h-5 text-black border-gray-500 rounded focus:ring-2 focus:ring-black cursor-pointer"
          />
          <span className="ml-3 text-base font-semibold text-black">I have equipment to trade in</span>
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
      <div className="mb-8 p-6 bg-gray-50 border-2 border-black rounded-lg">
        <h3 className="text-lg font-semibold text-black mb-4 flex items-center gap-2">
          💵 Cash Down Payment
        </h3>
        <div>
          <label className="block text-sm font-semibold text-black mb-2">
            Down Payment Amount ($)
          </label>
          <input
            type="number"
            placeholder="0"
            value={loan.cashDown}
            onChange={e => handleChange("cashDown", e.target.value)}
            className="w-full max-w-xs px-3 py-2 border border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-black transition"
          />
          <p className="text-xs text-gray-600 mt-2">
            Enter the amount you plan to pay as down payment (optional)
          </p>
        </div>
      </div>

      <div className="mt-8 p-6 rounded-lg border border-gray-500 bg-white shadow-sm">
        <h3 className="text-lg font-semibold text-black mb-4 flex items-center gap-2">
          <TrendingUp size={20} className="text-black" />
          AI Pre-Qualification
        </h3>
        {prequalificationStatus === "loading" && (
          <p className="text-gray-600">Analyzing the application...</p>
        )}
        {prequalificationError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex gap-2">
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <span>{prequalificationError}</span>
          </div>
        )}
        {prequalification ? (
          <div className="space-y-3">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="text-sm font-semibold text-gray-700">Approval Probability</p>
                <p className={`text-2xl font-bold ${getProbabilityColor(prequalification.approval_probability)}`}>
                  {Math.round((prequalification.approval_probability || 0) * 100)}%
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="text-sm font-semibold text-gray-700">Risk Score</p>
                <p className={`text-2xl font-bold ${getRiskColor(prequalification.risk_tier)}`}>
                  {prequalification.risk_score ?? "—"}
                </p>
                <p className="text-xs text-gray-600 mt-1">({prequalification.risk_tier || "N/A"})</p>
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-sm font-semibold text-gray-700 mb-2">Flags</p>
              {prequalification.flags && prequalification.flags.length > 0 ? (
                <p className="text-sm text-gray-700">{prequalification.flags.join(", ")}</p>
              ) : (
                <p className="text-sm text-gray-600">None</p>
              )}
            </div>
            <div className="p-4 rounded-lg bg-blue-50 border-2 border-dashed border-blue-200">
              <p className="font-semibold text-black mb-3">💡 Suggested Loan Structure</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700">Down Payment:</span>
                  <span className="font-semibold text-black">
                    {formatCurrency(
                      prequalification.optimal_structure?.recommended_down_payment || 0
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Term:</span>
                  <span className="font-semibold text-black">
                    {(prequalification.optimal_structure?.recommended_term || 0)} months
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Est. Monthly Payment:</span>
                  <span className="font-semibold text-black">
                    {formatCurrency(
                      prequalification.optimal_structure?.expected_monthly_payment || 0
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          prequalificationStatus === "ready" &&
          !prequalificationError && (
            <p className="text-gray-600 text-sm">
              Complete the form to unlock AI-driven guidance.
            </p>
          )
        )}
      </div>

      <div className="mt-8 p-6 rounded-lg border border-gray-500 bg-white shadow-sm">
        <h3 className="text-lg font-semibold text-black mb-4 flex items-center gap-2">
          <AlertTriangle size={20} className="text-black" />
          Equipment Intelligence
        </h3>
        {equipmentIntelligenceStatus === "loading" && (
          <p className="text-gray-600">Gathering equipment context...</p>
        )}
        {equipmentIntelligenceError && (
          <div className="mb-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm flex gap-2">
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <span>{equipmentIntelligenceError}</span>
          </div>
        )}
        {equipmentIntelligence ? (
          <div className="space-y-3">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="text-sm font-semibold text-gray-700">Estimated Value</p>
                <p className="text-2xl font-bold text-black">
                  {formatCurrency(equipmentIntelligence.valuation?.blended_value || 0)}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="text-sm font-semibold text-gray-700">Confidence Level</p>
                <p className="text-2xl font-bold text-black">
                  {Math.round((equipmentIntelligence.overall_confidence || 0) * 100)}%
                </p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="text-sm font-semibold text-gray-700 mb-2">Serial Validity</p>
                <p className="text-sm font-semibold text-black">
                  {equipmentIntelligence.serial_number?.confidence >= 0.8 ? "✓ High" : "⚠ Medium"}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="text-sm font-semibold text-gray-700 mb-2">History Status</p>
                <p className="text-sm font-semibold text-black">
                  {equipmentIntelligence.history?.hour_consistency === "inconsistent"
                    ? "⚠ Inconsistent Hours"
                    : "✓ Normal"}
                </p>
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-sm font-semibold text-gray-700 mb-2">Predicted Resale (36 months)</p>
              <p className="text-xl font-bold text-black">
                {formatCurrency(equipmentIntelligence.predictive_resale?.predicted_resale || 0)}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-sm font-semibold text-gray-700 mb-2">Risk Flags</p>
              <p className="text-sm text-gray-700">
                {equipmentIntelligence.risk_flags.length > 0
                  ? equipmentIntelligence.risk_flags.join(", ")
                  : "✓ None"}
              </p>
            </div>
          </div>
        ) : (
          equipmentIntelligenceStatus === "ready" &&
          !equipmentIntelligenceError && (
            <p className="text-gray-600 text-sm">Awaiting equipment intelligence...</p>
          )
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between gap-4 mt-8">
        <button 
          onClick={prevStep}
          className="px-6 py-3 font-semibold text-black bg-gray-200 hover:bg-gray-300 rounded-lg transition"
        >
          Back
        </button>
        <button 
          onClick={handleSubmit}
          className="px-6 py-3 font-semibold text-white bg-black hover:bg-gray-800 rounded-lg transition"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default LoanRequestStep;
