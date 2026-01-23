import React, { useState, useEffect, useCallback } from 'react';
import { loansAPI, API_BASE } from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import './Dashboard.css';

function Dashboard({ user, token, onStartNewApplication, onEditApplication, onViewOffers }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const getAiScoreColor = (tier) => {
    if (tier === "High") return "#000000";
    if (tier === "Medium") return "#555555";
    if (tier === "Low") return "#999999";
    return "#777777";
  };

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await loansAPI.getDashboard(token);
      setDashboardData(data?.data || data);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const renderApplicationCard = (app) => (
    <div key={app.id} className="application-card">
      <div className="card-header">
        <div className="card-title">
          {app.application_number}
          <span className="card-subtitle">{app.borrower_name}</span>
        </div>

        <span className={`status-pill status-${app.status}`}>
          {app.status.replace('_', ' ')}
        </span>
      </div>

      <div className="card-details">
        <Detail label="Amount" value={formatCurrency(app.loan_amount)} bold />
        <Detail label="Equipment" value={app.equipment} />
        <Detail label="Serial" value={app.serial_number || 'N/A'} mono />

        {app.trade_in_serials?.length > 0 && (
          <Detail label="Trade-In" value={app.trade_in_serials.join(', ')} mono />
        )}

        {app.ai_score && (
          <div className="ai-score">
            <span>AI Score</span>
            <span style={{ color: getAiScoreColor(app.ai_score.risk_tier) }}>
              {Math.round(app.ai_score.approval_probability * 100)}% · {app.ai_score.risk_score} ({app.ai_score.risk_tier})
            </span>
          </div>
        )}

        {app.submitted_at && (
          <Detail label="Date" value={formatDate(app.submitted_at)} />
        )}
      </div>

      {(app.status === 'draft' || app.status === 'in_progress') && (
        <ActionButton label="Resume Application" onClick={() => onEditApplication(app.id)} />
      )}

      {app.status === 'submitted' && (
        <ActionButton label="View Loan Offers" onClick={() => onViewOffers(app.id)} />
      )}
    </div>
  );

  if (loading) {
    return <CenteredMessage>Loading dashboard…</CenteredMessage>;
  }

  if (error) {
    return (
      <CenteredMessage>
        <p>Error loading dashboard: {error.message}</p>
        <button className="primary-btn" onClick={fetchDashboard}>Retry</button>
      </CenteredMessage>
    );
  }

  if (!dashboardData) return null;

  const salespersonName =
    dashboardData?.salesperson?.name || user?.name || user?.givenName || 'there';

  const summary = dashboardData.summary || {};
  const { in_progress = [], submitted = [], funded = [] } = dashboardData.applications || {};

  return (
    <div className="dashboard-container">
      <header className="dashboard-top">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back, {salespersonName}</p>
        </div>
        <button className="primary-btn" onClick={onStartNewApplication}>
          + New Application
        </button>
      </header>

      <section className="summary-grid">
        <SummaryCard label="Total" value={summary.total} />
        <SummaryCard label="In Progress" value={summary.in_progress} />
        <SummaryCard label="Submitted" value={summary.submitted} />
        <SummaryCard label="Funded" value={summary.funded} />
      </section>

      <section className="applications-grid">
        <Column title={`In Progress (${summary.in_progress})`} items={in_progress} />
        <Column title={`Submitted (${summary.submitted})`} items={submitted} />
        <Column title={`Funded (${summary.funded})`} items={funded} />
      </section>
    </div>
  );

  function Column({ title, items }) {
    return (
      <div className="column">
        <h2>{title}</h2>
        {items.length === 0 ? (
          <p className="empty">No applications</p>
        ) : (
          items.map(renderApplicationCard)
        )}
      </div>
    );
  }
}

export default Dashboard;

/* ---------- Small UI Helpers ---------- */

function Detail({ label, value, bold, mono }) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <span className={`${bold ? 'bold' : ''} ${mono ? 'mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}

function ActionButton({ label, onClick }) {
  return (
    <button className="card-action" onClick={onClick}>
      {label}
    </button>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="summary-card">
      <h3>{value || 0}</h3>
      <p>{label}</p>
    </div>
  );
}

function CenteredMessage({ children }) {
  return (
    <div className="centered-message">
      {children}
    </div>
  );
}
