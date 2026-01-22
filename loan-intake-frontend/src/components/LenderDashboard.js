import React, { useEffect, useState } from "react";
import { loansAPI } from '../services/api';
import { getValidToken } from '../utils/auth';

const th = { padding: "12px 10px", textAlign: "left", fontWeight: 600, fontSize: 15, borderBottom: "2px solid #eee" };
const td = { padding: "10px 8px", fontSize: 15 };
const linkBtn = { background: "none", border: "none", color: "#007bff", textDecoration: "underline", cursor: "pointer", fontSize: 15 };
const actionBtn = { background: "#007bff", color: "white", border: "none", borderRadius: 4, padding: "8px 18px", fontSize: 15, cursor: "pointer", marginRight: 8 };

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
      } catch (err) {
        setError('Failed to load applications.');
        setApplications([]);
      } finally {
        setLoading(false);
      }
    }
    fetchApplications();
  }, []);

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "30px" }}>
      <h2>Lender Dashboard</h2>
      {loading && <div>Loading applications...</div>}
      {error && <div style={{ color: 'red', marginBottom: 16 }}>{error}</div>}
      <p style={{ color: "#666", marginBottom: "20px" }}>
        Applications routed to you. Click an Application # to view and make a decision.
      </p>
      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px #eee", padding: 20 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8f9fa" }}>
              <th style={th}>Application #</th>
              <th style={th}>Borrower</th>
              <th style={th}>Amount</th>
              <th style={th}>Equipment</th>
              <th style={th}>Status</th>
              <th style={th}>Decision</th>
              <th style={th}>Received</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(applications) ? applications : []).map(app => (
              <tr key={app.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={td}>
                  <button style={linkBtn} onClick={() => setSelected(app)}>{app.id}</button>
                </td>
                <td style={td}>{app.borrower}</td>
                <td style={td}>${app.amount?.toLocaleString?.() ?? ''}</td>
                <td style={td}>{app.equipment}</td>
                <td style={td}>{app.status}</td>
                <td style={td}>{app.decision}</td>
                <td style={td}>{app.received}</td>
                <td style={td}>
                  <button style={actionBtn}>View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && (
        <div style={{ marginTop: 30, background: "#f8f9fa", borderRadius: 8, padding: 24, boxShadow: "0 2px 8px #eee" }}>
          <h3>Application Detail: {selected.id}</h3>
          <p><strong>Borrower:</strong> {selected.borrower}</p>
          <p><strong>Amount:</strong> ${selected.amount?.toLocaleString?.() ?? ''}</p>
          <p><strong>Equipment:</strong> {selected.equipment}</p>
          <p><strong>Status:</strong> {selected.status}</p>
          <p><strong>Decision:</strong> {selected.decision}</p>
          <p><strong>Date Received:</strong> {selected.received}</p>
          <div style={{ marginTop: 20 }}>
            <button style={actionBtn} onClick={() => setSelected(null)}>Close</button>
          </div>
          <hr style={{ margin: '24px 0' }} />
          <DecisionPanel selected={selected} setSelected={setSelected} applications={applications} setApplications={setApplications} />
        </div>
      )}
    </div>
  );
}

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
      setStatus(type === "approved" ? "Approved" : type === "declined" ? "Declined" : "Conditional");
      setApplications(applications.map(app =>
        app.id === selected.id ? { ...app, status: "Reviewed", decision: type === "approved" ? "Approved" : type === "declined" ? "Declined" : "Conditional" } : app
      ));
      setSelected(sel => sel ? { ...sel, status: "Reviewed", decision: type === "approved" ? "Approved" : type === "declined" ? "Declined" : "Conditional" } : sel);
    }, 800);
  };

  return (
    <div>
      <h4>Make a Decision</h4>
      <div style={{ display: 'flex', gap: 16, marginBottom: 18 }}>
        <button style={actionBtn} disabled={loading} onClick={() => handleDecision("approved")}>Approve</button>
        <button style={{ ...actionBtn, background: '#dc3545' }} disabled={loading} onClick={() => handleDecision("declined")}>Decline</button>
        <button style={{ ...actionBtn, background: '#ffc107', color: '#333' }} disabled={loading} onClick={() => handleDecision("conditional")}>Add Conditions</button>
      </div>
      {decision === "conditional" && (
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontWeight: 600 }}>Conditions:</label><br />
          <textarea value={conditions} onChange={e => setConditions(e.target.value)} rows={3} style={{ width: '100%', fontSize: 15, borderRadius: 4, border: '1px solid #ccc', padding: 8 }} />
        </div>
      )}
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontWeight: 600 }}>Optional Note:</label><br />
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} style={{ width: '100%', fontSize: 15, borderRadius: 4, border: '1px solid #ccc', padding: 8 }} />
      </div>
      {status && (
        <div style={{ color: status === "Approved" ? '#28a745' : status === "Declined" ? '#dc3545' : '#ffc107', fontWeight: 600, marginTop: 10 }}>
          Decision: {status}
        </div>
      )}
      {loading && <div style={{ color: '#007bff', marginTop: 10 }}>Saving decision...</div>}
    </div>
  );
}

export default LenderDashboard;
