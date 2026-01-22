import React, { useState, useEffect, useCallback } from 'react';
import { loansAPI, API_BASE } from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import './Dashboard.css';

function Dashboard({ user, token, onStartNewApplication, onEditApplication, onViewOffers }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const getAiScoreColor = (tier) => {
    if (tier === "High") return "#dc3545";
    if (tier === "Medium") return "#ffc107";
    if (tier === "Low") return "#28a745";
    return "#6c757d";
  };

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await loansAPI.getDashboard(token);
      setDashboardData(data && data.data ? data.data : data);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const renderApplicationCard = (app) => {
    return (
      <div key={app.id} className="application-card">
        <div className="app-header">
          <div className="app-title">#{app.application_number} • {app.borrower_name}</div>
          <div className={`status-badge status-${app.status}`}>{app.status}</div>
        </div>
        <div className="app-details">
          <div className="app-detail-row">
            <strong>Amount:</strong> {formatCurrency(app.loan_amount)}
          </div>
          <div className="app-detail-row">
            <strong>Equipment:</strong> {app.equipment}
          </div>
          <div className="app-detail-row">
            <strong>Serial:</strong> {app.serial_number || 'N/A'}
          </div>
          {Array.isArray(app.trade_in_serials) && app.trade_in_serials.length > 0 && (
            <div className="app-detail-row">
              <strong>Trade-In Serials:</strong> {app.trade_in_serials.join(', ')}
            </div>
          )}
          {app.ai_score && (
            <div className="app-detail-row">
              <strong>AI Score:</strong>
              <span
                style={{
                  marginLeft: "6px",
                  fontWeight: "bold",
                  color: getAiScoreColor(app.ai_score.risk_tier),
                }}
              >
                {Math.round((app.ai_score.approval_probability || 0) * 100)}% approval ·{" "}
                {app.ai_score.risk_score} ({app.ai_score.risk_tier})
              </span>
            </div>
          )}
          {app.submitted_at && (
            <div className="app-detail-row">
              <strong>Date:</strong> {formatDate(app.submitted_at)}
            </div>
          )}
        </div>

        {(app.status === 'draft' || app.status === 'in_progress') && onEditApplication && (
          <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
            <button
              onClick={() => onEditApplication(app.id)}
              style={{
                flex: 1,
                padding: '8px 16px',
                background: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              📝 Resume
            </button>
          </div>
        )}

        {app.status === 'submitted' && onViewOffers && (
          <div style={{ marginTop: '10px', display: 'flex' }}>
            <button
              onClick={() => onViewOffers(app.id)}
              style={{
                width: '100%',
                padding: '8px 16px',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              🎯 Get Loan Offers
            </button>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div style={{
          background: '#fff3cd',
          border: '1px solid #ffeeba',
          color: '#856404',
          padding: '12px',
          borderRadius: '6px',
          marginBottom: '12px',
        }}>
          <strong>Debug:</strong> API base {API_BASE}
        </div>
        <div className="error-message">
          <p>Error loading dashboard: {error.message}</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={fetchDashboard}>Retry</button>
          </div>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return null;
  }

  const salespersonName = (dashboardData?.salesperson?.name) || (user && (user.name || user.givenName)) || 'there';
  const summary = dashboardData?.summary || { total: 0, in_progress: 0, submitted: 0, funded: 0 };
  const inProgress = dashboardData?.applications?.in_progress || [];
  const submitted = dashboardData?.applications?.submitted || [];
  const funded = dashboardData?.applications?.funded || [];

  return (
    <div className="dashboard-container">
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          background: '#e8f4fd',
          border: '1px solid #b6e0fe',
          color: '#0b69a3',
          padding: '8px',
          borderRadius: '6px',
          marginBottom: '12px',
          fontSize: '0.9rem',
        }}>
          Dev Info: API base {API_BASE}
        </div>
      )}

      <div className="dashboard-header">
        <div>
          <h1>My Dashboard</h1>
          <p className="welcome-text">Welcome back, {salespersonName}</p>
        </div>
        <button className="btn-primary" onClick={onStartNewApplication}>+ New Application</button>
      </div>

      <div className="summary-cards">
        <div className="summary-card total">
          <h3>{summary.total}</h3>
          <p>Total Applications</p>
        </div>
        <div className="summary-card in-progress">
          <h3>{summary.in_progress}</h3>
          <p>In Progress</p>
        </div>
        <div className="summary-card submitted">
          <h3>{summary.submitted}</h3>
          <p>Submitted</p>
        </div>
        <div className="summary-card funded">
          <h3>{summary.funded}</h3>
          <p>Funded</p>
        </div>
      </div>

      <div className="applications-section">
        <div className="section-column">
          <h2 className="section-title in-progress-title">In Progress ({summary.in_progress})</h2>
          <div className="applications-list">
            {inProgress.length === 0 ? (
              <p className="empty-message">No applications in progress</p>
            ) : (
              inProgress.map(renderApplicationCard)
            )}
          </div>
        </div>

        <div className="section-column">
          <h2 className="section-title submitted-title">Submitted ({summary.submitted})</h2>
          <div className="applications-list">
            {submitted.length === 0 ? (
              <p className="empty-message">No submitted applications</p>
            ) : (
              submitted.map(renderApplicationCard)
            )}
          </div>
        </div>

        <div className="section-column">
          <h2 className="section-title funded-title">Funded ({summary.funded})</h2>
          <div className="applications-list">
            {funded.length === 0 ? (
              <p className="empty-message">No funded applications</p>
            ) : (
              funded.map(renderApplicationCard)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
