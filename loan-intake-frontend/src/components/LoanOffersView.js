import React, { useState, useEffect, useCallback, useRef } from "react";
import { loansAPI } from "../services/api";

const FREQUENCY_LABEL_MAP = {
  monthly: "Monthly",
  month: "Monthly",
  annually: "Annual",
  annual: "Annual",
  yearly: "Annual",
  quarterly: "Quarterly",
  "quarter": "Quarterly",
  "bi-weekly": "Bi-Weekly",
  biweekly: "Bi-Weekly",
  "bi weekly": "Bi-Weekly",
  bi_weekly: "Bi-Weekly",
  "semi-monthly": "Semi-Monthly",
  semimonthly: "Semi-Monthly",
  "semi monthly": "Semi-Monthly",
  semi_monthly: "Semi-Monthly",
  "semi-annual": "Semi-Annual",
  semiannual: "Semi-Annual",
  "semi annual": "Semi-Annual",
  semi_annual: "Semi-Annual",
  bimonthly: "Bi-Monthly",
  "bi-monthly": "Bi-Monthly",
  bimonth: "Bi-Monthly",
  weekly: "Weekly",
  daily: "Daily",
  seasonal: "Seasonal",
};

const FREQUENCY_NUMBER_MAP = {
  52: "Weekly",
  26: "Bi-Weekly",
  24: "Semi-Monthly",
  12: "Monthly",
  6: "Bi-Monthly",
  4: "Quarterly",
  3: "Quarterly",
  2: "Semi-Annual",
  1: "Annual",
};

const FREQUENCY_FIELD_CANDIDATES = [
  "payment_frequency",
  "paymentFrequency",
  "payment_schedule",
  "paymentSchedule",
  "repayment_frequency",
  "repaymentFrequency",
  "frequency",
  "payment_interval",
  "paymentInterval",
  "installment_frequency",
  "installmentFrequency",
];

const FREQUENCY_OBJECT_KEYS = [
  "label",
  "value",
  "name",
  "frequency",
  "unit",
  "type",
  "code",
];

const PAYMENT_FALLBACK_KEYS = [
  "monthly",
  "semimonthly",
  "biweekly",
  "weekly",
  "bimonthly",
  "quarterly",
  "semiannual",
  "annually",
  "annual",
  "yearly",
  "seasonal",
];

const normalizeKey = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).toLowerCase().replace(/[\s_-]+/g, "");
};

const capitalizeHyphenatedWord = (word) => {
  return word
    .split("-")
    .map((segment) => {
      if (!segment) return segment;
      return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
    })
    .join("-");
};

const toTitleCase = (value) => {
  if (!value) return "";
  return value
    .replace(/_/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(capitalizeHyphenatedWord)
    .join(" ");
};

const extractFrequencyPrimitive = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" || typeof value === "number") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const extracted = extractFrequencyPrimitive(item);
      if (extracted !== null) {
        return extracted;
      }
    }
    return null;
  }
  if (typeof value === "object") {
    for (const key of FREQUENCY_OBJECT_KEYS) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const extracted = extractFrequencyPrimitive(value[key]);
        if (extracted !== null) {
          return extracted;
        }
      }
    }
  }
  return null;
};

const resolveFrequencyValueFromOffer = (offer) => {
  if (!offer || typeof offer !== "object") return null;
  for (const field of FREQUENCY_FIELD_CANDIDATES) {
    if (Object.prototype.hasOwnProperty.call(offer, field)) {
      const extracted = extractFrequencyPrimitive(offer[field]);
      if (extracted !== null) {
        return extracted;
      }
    }
  }

  const payments = offer.payments;
  if (payments && typeof payments === "object" && !Array.isArray(payments)) {
    const entries = Object.entries(payments).filter(([, val]) => val !== null && val !== undefined && val !== "");
    if (entries.length === 1) {
      const [key] = entries[0];
      return key;
    }
  }

  if (offer.monthly_payment !== null && offer.monthly_payment !== undefined) {
    return "monthly";
  }

  return null;
};

const resolveFrequencyKeyFromOffer = (offer) => {
  const value = resolveFrequencyValueFromOffer(offer);
  if (value === null) return null;
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string") {
    return normalizeKey(value);
  }
  return null;
};

const coerceNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const getPaymentFrequencyLabel = (offer) => {
  const value = resolveFrequencyValueFromOffer(offer);
  if (value === null) {
    return "—";
  }
  if (typeof value === "number") {
    return FREQUENCY_NUMBER_MAP[value] || `${value} payments/yr`;
  }
  const key = String(value).trim();
  if (!key) return "—";
  const mapped = FREQUENCY_LABEL_MAP[key.toLowerCase()];
  if (mapped) return mapped;
  return toTitleCase(key);
};

const getPaymentFrequencyKey = (offer) => {
  return resolveFrequencyKeyFromOffer(offer);
};

const getPaymentAmount = (offer) => {
  if (!offer || typeof offer !== "object") return null;

  const directFields = [
    offer.payment_amount,
    offer.paymentAmount,
    offer.payment,
    offer.scheduled_payment,
    offer.scheduledPayment,
    offer.monthly_payment,
  ];

  for (const field of directFields) {
    const numeric = coerceNumber(field);
    if (numeric !== null) {
      return numeric;
    }
  }

  const payments = offer.payments;
  if (payments && typeof payments === "object" && !Array.isArray(payments)) {
    const normalizedEntries = Object.entries(payments).map(([key, value]) => [normalizeKey(key), value]);
    const entriesMap = new Map(normalizedEntries);
    const freqKey = getPaymentFrequencyKey(offer);

    if (freqKey && entriesMap.has(freqKey)) {
      const numeric = coerceNumber(entriesMap.get(freqKey));
      if (numeric !== null) {
        return numeric;
      }
    }

    for (const fallback of PAYMENT_FALLBACK_KEYS) {
      if (entriesMap.has(fallback)) {
        const numeric = coerceNumber(entriesMap.get(fallback));
        if (numeric !== null) {
          return numeric;
        }
      }
    }

    for (const [, value] of normalizedEntries) {
      const numeric = coerceNumber(value);
      if (numeric !== null) {
        return numeric;
      }
    }
  }

  return null;
};

function LoanOffersView({ applicationId, token, onBack, onEdit }) {
  const [loading, setLoading] = useState(false);
  const [offers, setOffers] = useState(null);
  const [error, setError] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [applicationDetails, setApplicationDetails] = useState(null);
  const pollRef = useRef(null);
  const inflightRef = useRef(false);

  const clearPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const fetchOffers = useCallback(async () => {
    if (!applicationId || !token) return;
    if (inflightRef.current) return; // prevent overlapping requests
    inflightRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const raw = await loansAPI.getOffers(applicationId, token);
      const data = raw && raw.data ? raw.data : raw;
      setOffers(data);
      const pending = Number(data?.pending_lenders ?? data?.pending ?? 0);
      const finalized = data?.status === 'finalized' || data?.status === 'complete' || !!data?.accepted_offer_id;
      if (finalized || pending === 0) {
        clearPoll();
      }
    } catch (err) {
      setError(err.message || "Failed to fetch loan offers");
    } finally {
      setLoading(false);
      inflightRef.current = false;
    }
  }, [applicationId, token]);

  const acceptOffer = async (offerId) => {
    if (!window.confirm("Are you sure you want to accept this loan offer?")) {
      return;
    }

    setAccepting(true);
    setError(null);

    try {
      await loansAPI.acceptOffer(applicationId, offerId, token);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      alert("Loan offer accepted successfully!");
      if (onBack) onBack();
    } catch (err) {
      setError(err.message || "Failed to accept offer");
    } finally {
      setAccepting(false);
    }
  };

  useEffect(() => {
    if (!applicationId || !token) {
      setApplicationDetails(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const details = await loansAPI.getApplicationDetails(applicationId, token);
        if (!cancelled) {
          setApplicationDetails(details);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load application details", err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applicationId, token]);

  const handleReopen = async () => {
    if (!applicationId || !token || reopening) return;
    const reasonInput = window.prompt(
      "Provide an optional note before reopening this application:",
      ""
    );
    if (reasonInput === null) {
      return; // user cancelled prompt
    }
    setReopening(true);
    setError(null);
    try {
      const result = await loansAPI.reopenApplication(applicationId, token, reasonInput);
      clearPoll();
      const message = (result && result.message) || "Application reopened for edits.";
      window.alert(`${message} Redirecting you to the application wizard.`);
      if (typeof onEdit === "function") {
        onEdit(applicationId);
      } else if (typeof onBack === "function") {
        onBack();
      }
    } catch (err) {
      setError(err.message || "Failed to reopen application");
    } finally {
      setReopening(false);
    }
  };

  // Auto-fetch offers when the view loads and set a single stable polling interval
  useEffect(() => {
    // Clear any previous interval
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (applicationId && token) {
      // Initial fetch
      fetchOffers();
      // Poll at configured or default interval
      const ms = (typeof window !== 'undefined' && window.__offersPollIntervalMs) ? Number(window.__offersPollIntervalMs) : 30000;
      pollRef.current = setInterval(() => {
        fetchOffers();
      }, isNaN(ms) || ms < 5000 ? 30000 : ms);
    }
    return () => clearPoll();
  }, [applicationId, token, fetchOffers]);

  const formatCurrency = (amount) => {
    if (!amount) return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(amount);
  };

  const formatRate = (rate) => {
    if (rate === null || rate === undefined || rate === "") return "N/A";
    const numeric = Number(rate);
    if (Number.isNaN(numeric)) return "N/A";
    return `${numeric.toFixed(2)}%`;
  };

  const getDecisionColor = (decision) => {
    switch (decision) {
      case "approved":
        return "#28a745";
      case "conditional":
        return "#ffc107";
      case "declined":
        return "#dc3545";
      default:
        return "#6c757d";
    }
  };

  const getDecisionLabel = (decision) => {
    return decision.charAt(0).toUpperCase() + decision.slice(1);
  };

  const shouldShowApprovalWarning =
    Boolean(offers?.prequalification?.approval_probability) &&
    offers.prequalification.approval_probability < 0.4;

  const offerColumns = offers?.offers || [];
  const applicationStatus = applicationDetails?.status || null;
  const applicationStatusLabel = applicationStatus ? toTitleCase(applicationStatus) : null;
  const totalLenders = offers?.total_lenders ?? 0;
  const allDeclined = totalLenders > 0 && offers?.declined_offers === totalLenders;
  const approvedCount = Number(offers?.approved_offers ?? 0);
  const hasAcceptedOffer = Boolean(
    offers?.accepted_offer_id ||
    (applicationDetails?.loan_data && applicationDetails.loan_data.accepted_offer)
  );
  const allowedStatuses = new Set(["submitted", "reviewing", "denied"]);
  const showReopenButton = Boolean(
    applicationId &&
    applicationStatus &&
    allowedStatuses.has(applicationStatus) &&
    !hasAcceptedOffer &&
    (allDeclined || approvedCount === 0)
  );

  const comparisonColumns = offerColumns.length === 0 ? [] : [
    {
      key: "decision",
      label: "Decision",
      render: (offer) => {
        return (
          <span
            style={{
              display: "inline-block",
              padding: "4px 10px",
              borderRadius: "12px",
              fontSize: "13px",
              fontWeight: "bold",
              background: getDecisionColor(offer.decision),
              color: "white",
            }}
          >
            {getDecisionLabel(offer.decision)}
          </span>
        );
      },
    },
    {
      key: "approved_amount",
      label: "Loan Amount",
      render: (offer) => {
        return (
          <div style={{ fontWeight: "bold", color: "#007bff", fontSize: "16px" }}>
            {formatCurrency(offer.approved_amount)}
          </div>
        );
      },
    },
    {
      key: "interest_rate",
      label: "Interest Rate",
      render: (offer) => {
        return (
          <div style={{ fontWeight: "bold", color: "#007bff", fontSize: "16px" }}>
            {formatRate(offer.interest_rate)}
          </div>
        );
      },
    },
    {
      key: "payment_frequency",
      label: "Frequency",
      render: (offer) => {
        const label = getPaymentFrequencyLabel(offer);
        const hasValue = label !== "—";
        return (
          <span style={{ fontWeight: 600, fontSize: "14px", color: hasValue ? "#495057" : "#6c757d" }}>
            {label}
          </span>
        );
      },
    },
    {
      key: "term_months",
      label: "Term",
      render: (offer) => {
        return (
          <div style={{ fontWeight: "bold", color: "#007bff", fontSize: "16px" }}>
            {offer.term_months ? `${offer.term_months} months` : "—"}
          </div>
        );
      },
    },
    {
      key: "payment_amount",
      label: "Payment",
      allowWrap: true,
      render: (offer) => {
        const amount = getPaymentAmount(offer);
        if (amount === null) {
          return <span style={{ color: "#6c757d" }}>—</span>;
        }
        const frequencyLabel = getPaymentFrequencyLabel(offer);
        return (
          <div style={{ fontWeight: "bold", color: "#28a745", fontSize: "16px" }}>
            {formatCurrency(amount)}
            <div style={{ fontSize: "12px", fontWeight: 500, color: "#6c757d" }}>
              {frequencyLabel === "—" ? "per period" : `per ${frequencyLabel.toLowerCase()}`}
            </div>
          </div>
        );
      },
    },
    {
      key: "conditions",
      label: "Conditions / Notes",
      allowWrap: true,
      width: "32%",
      minWidth: 260,
      render: (offer) => {
        if (offer.decision === "declined") {
          return (
            <div
              style={{
                background: "#f8d7da",
                borderRadius: "4px",
                padding: "10px",
                fontSize: "13px",
              }}
            >
              <strong style={{ display: "block", marginBottom: "4px" }}>Decline Reason</strong>
              <span>{offer.decline_reason || "Not provided"}</span>
            </div>
          );
        }

        const hasConditions = Array.isArray(offer.conditions) && offer.conditions.length > 0;
        return (
          <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "13px" }}>
            {hasConditions ? (
              offer.conditions.map((condition, idx) => (
                <li key={idx} style={{ marginBottom: "4px" }}>
                  {condition}
                </li>
              ))
            ) : (
              <li>No additional conditions</li>
            )}
          </ul>
        );
      },
    },
    {
      key: "action",
      label: "Action",
      render: (offer) => {
        const canAccept = offer.decision === "approved" || offer.decision === "conditional";
        if (canAccept) {
          return (
            <button
              onClick={() => acceptOffer(offer.offer_id)}
              disabled={accepting}
              style={{
                padding: "8px 16px",
                background: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: accepting ? "not-allowed" : "pointer",
                fontWeight: "bold",
                opacity: accepting ? 0.6 : 1,
              }}
            >
              {accepting ? "Processing..." : "Accept Offer"}
            </button>
          );
        }

        return <span style={{ color: "#6c757d", fontSize: "12px" }}>No action available</span>;
      },
    },
  ];

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px" }}>
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        marginBottom: "30px" 
      }}>
        <h2>Loan Offers</h2>
        <button 
          onClick={onBack}
          style={{
            padding: "10px 20px",
            background: "#6c757d",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          ← Back
        </button>
      </div>

      <div style={{ display: "flex", gap: "10px", marginBottom: "15px", flexWrap: "wrap" }}>
        <button
          onClick={fetchOffers}
          disabled={loading}
          style={{ padding: "8px 16px", background: "#17a2b8", color: "white", border: "none", borderRadius: "4px", cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? "Refreshing…" : "Refresh Offers"}
        </button>
        <button
          onClick={() => window.print()}
          style={{ padding: "8px 16px", background: "#343a40", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
        >
          Print Summary
        </button>
        {showReopenButton && (
          <button
            onClick={handleReopen}
            disabled={reopening}
            style={{
              padding: "8px 16px",
              background: "#ff9800",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: reopening ? "not-allowed" : "pointer",
              fontWeight: 600,
              opacity: reopening ? 0.6 : 1,
            }}
          >
            {reopening ? "Preparing…" : "Edit & Resubmit"}
          </button>
        )}
      </div>

      {!offers && (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <p style={{ marginBottom: "20px", fontSize: "16px", color: "#666" }}>
            Get instant loan offers from multiple lenders
          </p>
          <button
            onClick={fetchOffers}
            disabled={loading}
            style={{
              padding: "15px 40px",
              fontSize: "18px",
              background: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? "Fetching Offers..." : "Get Loan Offers"}
          </button>
        </div>
      )}

      {error && (
        <div style={{
          padding: "15px",
          background: "#f8d7da",
          border: "1px solid #f5c6cb",
          borderRadius: "4px",
          color: "#721c24",
          marginBottom: "20px"
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {offers && (
        <>
          <div style={{
            padding: "20px",
            background: "#f8f9fa",
            borderRadius: "4px",
            marginBottom: "30px"
          }}>
            <h3 style={{ marginTop: 0 }}>Application #{offers.application_number}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "20px" }}>
              {applicationStatusLabel && (
                <div>
                  <div style={{ fontSize: "14px", color: "#666" }}>Status</div>
                  <div style={{ fontSize: "24px", fontWeight: "bold" }}>{applicationStatusLabel}</div>
                </div>
              )}
              <div>
                <div style={{ fontSize: "14px", color: "#666" }}>Total Lenders</div>
                <div style={{ fontSize: "24px", fontWeight: "bold" }}>{offers.total_lenders}</div>
              </div>
              <div>
                <div style={{ fontSize: "14px", color: "#666" }}>Approved</div>
                <div style={{ fontSize: "24px", fontWeight: "bold", color: "#28a745" }}>
                  {offers.approved_offers}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "14px", color: "#666" }}>Conditional</div>
                <div style={{ fontSize: "24px", fontWeight: "bold", color: "#ffc107" }}>
                  {offers.conditional_offers}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "14px", color: "#666" }}>Declined</div>
                <div style={{ fontSize: "24px", fontWeight: "bold", color: "#dc3545" }}>
                  {offers.declined_offers}
                </div>
              </div>
              {typeof offers.acknowledged_lenders === 'number' && (
                <div>
                  <div style={{ fontSize: "14px", color: "#666" }}>Acknowledged</div>
                  <div style={{ fontSize: "24px", fontWeight: "bold", color: "#17a2b8" }}>
                    {offers.acknowledged_lenders}
                  </div>
                </div>
              )}
              {typeof offers.pending_lenders === 'number' && (
                <div>
                  <div style={{ fontSize: "14px", color: "#666" }}>Pending</div>
                  <div style={{ fontSize: "24px", fontWeight: "bold", color: "#6c757d" }}>
                    {offers.pending_lenders}
                  </div>
                </div>
              )}
          </div>
          <div style={{ marginTop: "12px", fontSize: "12px", color: "#6c757d" }}>
            Rates and terms shown are estimates from lenders and may change upon verification. Please review lender conditions.
          </div>
          {showReopenButton && (
            <div
              style={{
                marginTop: "16px",
                padding: "12px 16px",
                borderRadius: "6px",
                background: "#fff3cd",
                border: "1px solid #ffeeba",
                color: "#856404",
                fontSize: "14px",
              }}
            >
              All lenders declined this application. Adjust the loan details and resubmit to try again.
            </div>
          )}
        </div>

        {shouldShowApprovalWarning && (
          <div
            style={{
              marginBottom: "20px",
              padding: "15px",
              borderRadius: "8px",
              background: "#fff3cd",
              border: "1px solid #ffeeba",
              color: "#856404",
            }}
          >
            <strong>Warning:</strong> This application is unlikely to be approved. Consider adjusting down payment or term.
          </div>
        )}

          {comparisonColumns.length > 0 && (
            <div style={{ marginBottom: "30px" }}>
              <h3 style={{ marginBottom: "12px" }}>Side-by-Side Comparison</h3>
              <div style={{
                overflowX: "auto",
                border: "1px solid #dee2e6",
                borderRadius: "8px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                background: "white"
              }}>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                  <thead>
                    <tr>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "14px",
                          background: "#f8f9fa",
                          borderBottom: "1px solid #dee2e6",
                          fontSize: "14px",
                          fontWeight: 600,
                          minWidth: "180px"
                        }}
                      >
                        Lender
                      </th>
                      {comparisonColumns.map((column) => (
                        <th
                          key={`head-${column.key}`}
                          style={{
                            textAlign: "left",
                            padding: "12px",
                            background: "#f8f9fa",
                            borderBottom: "1px solid #dee2e6",
                            borderLeft: "1px solid #dee2e6",
                            fontSize: "14px",
                            fontWeight: 600,
                            minWidth: column.minWidth ? `${column.minWidth}px` : undefined,
                            width: column.width || undefined,
                            whiteSpace: column.allowWrap || column.width ? "normal" : "nowrap"
                          }}
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {offerColumns.map((offer, rowIdx) => (
                      <tr key={`row-${offer.offer_id}`} style={{ background: rowIdx % 2 === 0 ? "#ffffff" : "#fcfcfc" }}>
                        <td
                          style={{
                            padding: "16px",
                            borderTop: "1px solid #dee2e6",
                            fontSize: "13px",
                            verticalAlign: "top"
                          }}
                        >
                          <div style={{ fontWeight: 600, marginBottom: "6px" }}>{offer.lender_name}</div>
                          <div style={{ fontSize: "12px", color: "#6c757d" }}>Offer #{offer.offer_id}</div>
                        </td>
                        {comparisonColumns.map((column) => (
                          <td
                            key={`${offer.offer_id}-${column.key}`}
                            style={{
                              padding: "14px",
                              borderTop: "1px solid #dee2e6",
                              borderLeft: "1px solid #dee2e6",
                              fontSize: "13px",
                              verticalAlign: "top",
                              minWidth: column.minWidth ? `${column.minWidth}px` : undefined,
                              width: column.width || undefined,
                              whiteSpace: column.allowWrap || column.width ? "normal" : "nowrap"
                            }}
                          >
                            {column.render(offer)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default LoanOffersView;
