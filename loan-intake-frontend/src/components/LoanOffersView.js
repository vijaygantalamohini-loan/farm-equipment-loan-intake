import React, { useState, useEffect, useCallback, useRef } from "react";
import { loansAPI } from "../services/api";

/* -------------------- EXISTING HELPERS (UNCHANGED) -------------------- */
/* 🔒 ALL LOGIC BELOW IS IDENTICAL – DO NOT MODIFY */

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

const normalizeKey = (v) =>
  String(v ?? "").toLowerCase().replace(/[\s_-]+/g, "");

const toTitleCase = (v) =>
  v
    ?.replace(/_/g, " ")
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ") || "";

const getPaymentFrequencyLabel = (offer) => {
  const value =
    offer?.payment_frequency ??
    offer?.paymentFrequency ??
    offer?.frequency ??
    offer?.payment_schedule ??
    offer?.paymentSchedule;

  if (typeof value === "number")
    return FREQUENCY_NUMBER_MAP[value] || `${value}/yr`;

  if (!value) return "—";
  return FREQUENCY_LABEL_MAP[value.toLowerCase()] || toTitleCase(value);
};

const getPaymentAmount = (offer) =>
  Number(
    offer?.payment_amount ??
      offer?.payment ??
      offer?.monthly_payment ??
      null
  );

const formatCurrency = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n || 0);

const formatRate = (r) =>
  r !== null && r !== undefined ? `${Number(r).toFixed(2)}%` : "—";

/* -------------------- COMPONENT -------------------- */

function LoanOffersView({ applicationId, token, onBack, onEdit }) {
  const [loading, setLoading] = useState(false);
  const [offers, setOffers] = useState(null);
  const [error, setError] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const pollRef = useRef(null);

  const fetchOffers = useCallback(async () => {
    if (!applicationId || !token) return;
    setLoading(true);
    try {
      const res = await loansAPI.getOffers(applicationId, token);
      setOffers(res?.data || res);
    } catch (e) {
      setError(e.message || "Failed to load offers");
    } finally {
      setLoading(false);
    }
  }, [applicationId, token]);

  useEffect(() => {
    fetchOffers();
    pollRef.current = setInterval(fetchOffers, 30000);
    return () => clearInterval(pollRef.current);
  }, [fetchOffers]);

  const acceptOffer = async (offerId) => {
    if (!window.confirm("Accept this loan offer?")) return;
    setAccepting(true);
    try {
      await loansAPI.acceptOffer(applicationId, offerId, token);
      alert("Offer accepted");
      onBack();
    } catch (e) {
      setError(e.message || "Failed to accept offer");
    } finally {
      setAccepting(false);
    }
  };

  /* -------------------- UI -------------------- */

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Loan Offers</h1>
          <p style={styles.subtitle}>
            Compare lender terms and select the best option
          </p>
        </div>
        <button onClick={onBack} style={styles.secondaryBtn}>
          ← Back
        </button>
      </div>

      {/* Actions */}
      <div style={styles.actions}>
        <button onClick={fetchOffers} style={styles.outlineBtn}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
        <button onClick={() => window.print()} style={styles.outlineBtn}>
          Print
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {/* Summary */}
      {offers && (
        <div style={styles.summary}>
          <SummaryItem label="Total Lenders" value={offers.total_lenders} />
          <SummaryItem label="Approved" value={offers.approved_offers} />
          <SummaryItem label="Conditional" value={offers.conditional_offers} />
          <SummaryItem label="Declined" value={offers.declined_offers} />
        </div>
      )}

      {/* Table */}
      {offers?.offers?.length > 0 && (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <Th>Lender</Th>
                <Th>Decision</Th>
                <Th>Amount</Th>
                <Th>Rate</Th>
                <Th>Frequency</Th>
                <Th>Term</Th>
                <Th>Payment</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody>
              {offers.offers.map((offer, i) => (
                <tr key={offer.offer_id} style={i % 2 ? styles.rowAlt : null}>
                  <Td>
                    <strong>{offer.lender_name}</strong>
                    <div style={styles.muted}>Offer #{offer.offer_id}</div>
                  </Td>
                  <Td>
                    <span style={styles.badge}>
                      {toTitleCase(offer.decision)}
                    </span>
                  </Td>
                  <Td>{formatCurrency(offer.approved_amount)}</Td>
                  <Td>{formatRate(offer.interest_rate)}</Td>
                  <Td>{getPaymentFrequencyLabel(offer)}</Td>
                  <Td>{offer.term_months} mo</Td>
                  <Td>
                    {getPaymentAmount(offer)
                      ? formatCurrency(getPaymentAmount(offer))
                      : "—"}
                  </Td>
                  <Td>
                    {(offer.decision === "approved" ||
                      offer.decision === "conditional") && (
                      <button
                        onClick={() => acceptOffer(offer.offer_id)}
                        disabled={accepting}
                        style={styles.primaryBtn}
                      >
                        Accept
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* -------------------- UI HELPERS -------------------- */

const SummaryItem = ({ label, value }) => (
  <div style={styles.summaryCard}>
    <div style={styles.summaryValue}>{value ?? 0}</div>
    <div style={styles.muted}>{label}</div>
  </div>
);

const Th = ({ children }) => <th style={styles.th}>{children}</th>;
const Td = ({ children }) => <td style={styles.td}>{children}</td>;

/* -------------------- STYLES -------------------- */

const styles = {
  page: {
    maxWidth: 1280,
    margin: "0 auto",
    padding: "32px 24px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  title: { margin: 0, fontSize: 24 },
  subtitle: { margin: "6px 0 0", color: "#666" },

  actions: {
    display: "flex",
    gap: 12,
    marginBottom: 24,
  },

  summary: {
    display: "grid",
    gridTemplateColumns: "repeat(4,1fr)",
    gap: 16,
    marginBottom: 32,
  },
  summaryCard: {
    border: "1px solid #e5e5e5",
    borderRadius: 14,
    padding: 20,
    background: "#fff",
  },
  summaryValue: { fontSize: 28, fontWeight: 700 },

  tableWrap: {
    border: "1px solid #e5e5e5",
    borderRadius: 16,
    overflow: "hidden",
    background: "#fff",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
  },
  th: {
    padding: 14,
    textAlign: "left",
    background: "#fafafa",
    borderBottom: "1px solid #e5e5e5",
    fontWeight: 600,
  },
  td: {
    padding: 14,
    borderTop: "1px solid #eee",
    verticalAlign: "top",
  },
  rowAlt: {
    background: "#fcfcfc",
  },

  badge: {
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid #ddd",
    fontSize: 12,
    fontWeight: 600,
  },

  primaryBtn: {
    padding: "8px 14px",
    borderRadius: 10,
    background: "#111",
    color: "#fff",
    border: "1px solid #111",
    cursor: "pointer",
  },
  secondaryBtn: {
    padding: "8px 14px",
    borderRadius: 10,
    background: "#fff",
    border: "1px solid #ddd",
    cursor: "pointer",
  },
  outlineBtn: {
    padding: "8px 14px",
    borderRadius: 10,
    background: "#fff",
    border: "1px solid #ddd",
    cursor: "pointer",
  },

  muted: { color: "#777", fontSize: 12 },
  error: {
    padding: 16,
    borderRadius: 12,
    background: "#fff",
    border: "1px solid #f0c2c2",
    color: "#900",
    marginBottom: 20,
  },
};

export default LoanOffersView;
