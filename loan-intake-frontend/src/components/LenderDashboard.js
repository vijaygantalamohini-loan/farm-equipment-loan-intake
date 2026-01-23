import React, { useEffect, useState } from "react";
import { loansAPI } from "../services/api";
import { getValidToken } from "../utils/auth";

/* -------------------- STYLES -------------------- */

const styles = {
  page: {
    maxWidth: 1280,
    margin: "0 auto",
    padding: "32px 24px",
  },
  title: {
    fontSize: 24,
    marginBottom: 6,
  },
  subtitle: {
    color: "#666",
    marginBottom: 24,
  },

  card: {
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 10px 30px rgba(0,0,0,0.04)",
  },

  tableWrap: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
  },

  th: {
    padding: "14px 12px",
    textAlign: "left",
    fontWeight: 600,
    borderBottom: "1px solid #e5e5e5",
    background: "#fafafa",
    whiteSpace: "nowrap",
  },

  td: {
    padding: "14px 12px",
    borderBottom: "1px solid #eee",
    verticalAlign: "top",
  },

  linkBtn: {
    background: "none",
    border: "none",
    color: "#111",
    fontWeight: 600,
    cursor: "pointer",
    padding: 0,
  },

  primaryBtn: {
    background: "#111",
    color: "#fff",
    border: "1px solid #111",
    borderRadius: 10,
    padding: "8px 16px",
    fontWeight: 600,
    cursor: "pointer",
  },

  dangerBtn: {
    background: "#fff",
    color: "#111",
    border: "1px solid #111",
    borderRadius: 10,
    padding: "8px 16px",
    fontWeight: 600,
    cursor: "pointer",
  },

  muted: {
    color: "#777",
    fontSize: 13,
  },

  badge: {
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    border: "1px solid #ddd",
    background: "#fafafa",
  },

  section: {
    marginTop: 32,
  },

  divider: {
    margin: "24px 0",
    border: "none",
    borderTop: "1px solid #eee",
  },

  textarea: {
    width: "100%",
    padding: 10,
    borderRadius: 10,
    border: "1px solid #ddd",
    fontSize: 14,
  },

  decisionRow: {
    display: "flex",
    gap: 12,
    marginBottom: 20,
  },

  statusApproved: { color: "#1a7f37", fontWeight: 600 },
  statusDeclined: { color: "#b42318", fontWeight: 600 },
  statusConditional: { color: "#8a6d1d", fontWeight: 600 },
};

/* -------------------- COMPONENT -------------------- */

function LenderDashboard() {
  const [applications, setApplications] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchApplications() {
      setLoading(true);
      setError(null);
      try {
        const token = getValidToken();
        if (!token) return;
        const data = await loansAPI.getDashboard(token);
        setApplications(Array.isArray(data.applications) ? data.applications : []);
      } catch {
        setError("Failed to load applications.");
        setApplications([]);
      } finally {
        setLoading(false);
      }
    }
    fetchApplications();
  }, []);

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Lender Dashboard</h1>
      <p style={styles.subtitle}>
        Review assigned applications and make lending decisions.
      </p>

      <div style={styles.card}>
        {loading && <p style={styles.muted}>Loading applications…</p>}
        {error && <p style={{ color: "#b42318" }}>{error}</p>}

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Application #</th>
                <th style={styles.th}>Borrower</th>
                <th style={styles.th}>Amount</th>
                <th style={styles.th}>Equipment</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Decision</th>
                <th style={styles.th}>Received</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app, idx) => (
                <tr key={app.id} style={{ background: idx % 2 ? "#fcfcfc" : "#fff" }}>
                  <td style={styles.td}>
                    <button style={styles.linkBtn} onClick={() => setSelected(app)}>
                      {app.id}
                    </button>
                  </td>
                  <td style={styles.td}>{app.borrower}</td>
                  <td style={styles.td}>
                    ${app.amount?.toLocaleString?.() ?? "—"}
                  </td>
                  <td style={styles.td}>{app.equipment}</td>
                  <td style={styles.td}>
                    <span style={styles.badge}>{app.status}</span>
                  </td>
                  <td style={styles.td}>{app.decision || "—"}</td>
                  <td style={styles.td}>{app.received}</td>
                  <td style={styles.td}>
                    <button
                      style={styles.primaryBtn}
                      onClick={() => setSelected(app)}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div style={{ ...styles.card, marginTop: 32 }}>
          <h2>Application #{selected.id}</h2>
          <p><strong>Borrower:</strong> {selected.borrower}</p>
          <p><strong>Amount:</strong> ${selected.amount?.toLocaleString?.() ?? "—"}</p>
          <p><strong>Equipment:</strong> {selected.equipment}</p>
          <p><strong>Status:</strong> {selected.status}</p>
          <p><strong>Decision:</strong> {selected.decision || "Pending"}</p>

          <hr style={styles.divider} />

          <DecisionPanel
            selected={selected}
            setSelected={setSelected}
            applications={applications}
            setApplications={setApplications}
          />
        </div>
      )}
    </div>
  );
}

/* -------------------- DECISION PANEL -------------------- */

function DecisionPanel({ selected, setSelected, applications, setApplications }) {
  const [decision, setDecision] = useState("");
  const [conditions, setConditions] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDecision = async (type) => {
    setLoading(true);
    setDecision(type);
    setTimeout(() => {
      setLoading(false);
      const label =
        type === "approved" ? "Approved" :
        type === "declined" ? "Declined" :
        "Conditional";

      setStatus(label);

      setApplications(applications.map(app =>
        app.id === selected.id
          ? { ...app, status: "Reviewed", decision: label }
          : app
      ));

      setSelected(sel =>
        sel ? { ...sel, status: "Reviewed", decision: label } : sel
      );
    }, 800);
  };

  return (
    <div>
      <h3>Make a Decision</h3>

      <div style={styles.decisionRow}>
        <button style={styles.primaryBtn} disabled={loading} onClick={() => handleDecision("approved")}>
          Approve
        </button>
        <button style={styles.dangerBtn} disabled={loading} onClick={() => handleDecision("declined")}>
          Decline
        </button>
        <button style={styles.dangerBtn} disabled={loading} onClick={() => handleDecision("conditional")}>
          Conditional
        </button>
      </div>

      {decision === "conditional" && (
        <>
          <label><strong>Conditions</strong></label>
          <textarea
            rows={3}
            value={conditions}
            onChange={e => setConditions(e.target.value)}
            style={styles.textarea}
          />
        </>
      )}

      <label style={{ marginTop: 12, display: "block" }}>
        <strong>Optional Note</strong>
      </label>
      <textarea
        rows={2}
        value={note}
        onChange={e => setNote(e.target.value)}
        style={styles.textarea}
      />

      {status && (
        <div style={{ marginTop: 12 }}>
          <strong>Decision:</strong>{" "}
          <span
            style={
              status === "Approved"
                ? styles.statusApproved
                : status === "Declined"
                ? styles.statusDeclined
                : styles.statusConditional
            }
          >
            {status}
          </span>
        </div>
      )}

      {loading && <p style={styles.muted}>Saving decision…</p>}
    </div>
  );
}

export default LenderDashboard;
