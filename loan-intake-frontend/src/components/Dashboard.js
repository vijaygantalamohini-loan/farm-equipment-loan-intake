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
      <div key={app.id} style={{
        background: '#ffffff',
        border: '1px solid #e5e5e5',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '12px',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        ':hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)'
        }
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '16px',
          paddingBottom: '16px',
          borderBottom: '1px solid #f0f0f0'
        }}>
          <div style={{
            fontSize: '15px',
            fontWeight: '600',
            color: '#000000',
            letterSpacing: '-0.01em'
          }}>
            {app.application_number} • {app.borrower_name}
          </div>
          <div style={{
            padding: '4px 12px',
            background: app.status === 'funded' ? '#000000' : 
                       app.status === 'submitted' ? '#f5f5f5' : 
                       '#fafafa',
            color: app.status === 'funded' ? '#ffffff' : '#000000',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            border: app.status === 'funded' ? 'none' : '1px solid #e5e5e5'
          }}>
            {app.status.replace('_', ' ')}
          </div>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#666666', fontWeight: '500' }}>Amount</span>
            <span style={{ fontSize: '15px', fontWeight: '700', color: '#000000' }}>{formatCurrency(app.loan_amount)}</span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#666666', fontWeight: '500' }}>Equipment</span>
            <span style={{ fontSize: '14px', color: '#000000', fontWeight: '500' }}>{app.equipment}</span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#666666', fontWeight: '500' }}>Serial</span>
            <span style={{ fontSize: '13px', color: '#000000', fontFamily: 'monospace' }}>{app.serial_number || 'N/A'}</span>
          </div>
          
          {Array.isArray(app.trade_in_serials) && app.trade_in_serials.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#666666', fontWeight: '500' }}>Trade-In</span>
              <span style={{ fontSize: '13px', color: '#000000', fontFamily: 'monospace' }}>{app.trade_in_serials.join(', ')}</span>
            </div>
          )}
          
          {app.ai_score && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginTop: '4px',
              padding: '12px',
              background: '#fafafa',
              borderRadius: '8px',
              border: '1px solid #f0f0f0'
            }}>
              <span style={{ fontSize: '13px', color: '#666666', fontWeight: '500' }}>AI Score</span>
              <span style={{
                fontSize: '13px',
                fontWeight: '700',
                color: getAiScoreColor(app.ai_score.risk_tier),
              }}>
                {Math.round((app.ai_score.approval_probability || 0) * 100)}% · {app.ai_score.risk_score} ({app.ai_score.risk_tier})
              </span>
            </div>
          )}
          
          {app.submitted_at && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <span style={{ fontSize: '13px', color: '#666666', fontWeight: '500' }}>Date</span>
              <span style={{ fontSize: '13px', color: '#000000' }}>{formatDate(app.submitted_at)}</span>
            </div>
          )}
        </div>

        {(app.status === 'draft' || app.status === 'in_progress') && onEditApplication && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f0f0f0' }}>
            <button
              onClick={() => onEditApplication(app.id)}
              style={{
                width: '100%',
                padding: '12px 20px',
                background: '#000000',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                letterSpacing: '0.3px',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => e.target.style.background = '#333333'}
              onMouseOut={(e) => e.target.style.background = '#000000'}
            >
              📝 Resume Application
            </button>
          </div>
        )}

        {app.status === 'submitted' && onViewOffers && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f0f0f0' }}>
            <button
              onClick={() => onViewOffers(app.id)}
              style={{
                width: '100%',
                padding: '12px 20px',
                background: '#000000',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                letterSpacing: '0.3px',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => e.target.style.background = '#333333'}
              onMouseOut={(e) => e.target.style.background = '#000000'}
            >
              Get Loan Offers
            </button>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '40px 24px',
        minHeight: '100vh',
        background: '#fafafa'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '400px',
          fontSize: '16px',
          color: '#666666',
          fontWeight: '500'
        }}>
          Loading dashboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '40px 24px',
        minHeight: '100vh',
        background: '#fafafa'
      }}>
        <div style={{
          background: '#ffffff',
          border: '1px solid #e5e5e5',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '16px',
        }}>
          <strong style={{ color: '#000000' }}>Debug:</strong> <span style={{ color: '#666666' }}>API base {API_BASE}</span>
        </div>
        <div style={{
          background: '#ffffff',
          border: '1px solid #e5e5e5',
          padding: '24px',
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <p style={{ color: '#000000', marginBottom: '20px', fontSize: '15px' }}>Error loading dashboard: {error.message}</p>
          <button 
            onClick={fetchDashboard}
            style={{
              padding: '12px 24px',
              background: '#000000',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px'
            }}
          >
            Retry
          </button>
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
