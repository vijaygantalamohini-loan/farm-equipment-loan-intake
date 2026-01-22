import React, { useState, useEffect } from 'react';
import './ApplicationHistory.css';

function ApplicationHistory() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('my'); // 'my' or 'location'
  const [salesperson, setSalesperson] = useState(null);

  useEffect(() => {
    // Get salesperson info from localStorage
    const savedSalesperson = localStorage.getItem('salesperson');
    if (savedSalesperson) {
      setSalesperson(JSON.parse(savedSalesperson));
    }
    
    loadApplications();
  }, [view]);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const endpoint = view === 'my' 
        ? 'http://localhost:8000/loans/my-applications'
        : 'http://localhost:8000/loans/location-applications';

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load applications');
      }

      const data = await response.json();
      setApplications(data);
    } catch (err) {
      console.error('Error loading applications:', err);
      alert('Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusClasses = {
      'submitted': 'status-submitted',
      'reviewing': 'status-reviewing',
      'approved': 'status-approved',
      'denied': 'status-denied'
    };
    
    return (
      <span className={`status-badge ${statusClasses[status] || ''}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="history-container">
        <div className="loading">Loading applications...</div>
      </div>
    );
  }

  return (
    <div className="history-container">
      <div className="history-header">
        <div>
          <h1>Loan Applications</h1>
          {salesperson && (
            <p className="user-info">
              {salesperson.first_name} {salesperson.last_name} - {salesperson.location_name}
            </p>
          )}
        </div>
        
        <div className="view-toggle">
          <button
            className={view === 'my' ? 'active' : ''}
            onClick={() => setView('my')}
          >
            My Applications
          </button>
          <button
            className={view === 'location' ? 'active' : ''}
            onClick={() => setView('location')}
          >
            Location Applications
          </button>
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="no-applications">
          <p>No applications found</p>
        </div>
      ) : (
        <div className="applications-grid">
          {applications.map(app => (
            <div key={app.id} className="application-card">
              <div className="card-header">
                <h3>{app.application_number}</h3>
                {getStatusBadge(app.status)}
              </div>
              
              <div className="card-body">
                <div className="info-row">
                  <span className="label">Salesperson:</span>
                  <span className="value">{app.salesperson_name}</span>
                </div>
                <div className="info-row">
                  <span className="label">Location:</span>
                  <span className="value">{app.location_name}</span>
                </div>
                <div className="info-row">
                  <span className="label">Submitted:</span>
                  <span className="value">{formatDate(app.submitted_at)}</span>
                </div>
              </div>
              
              <div className="card-footer">
                <button className="view-details-btn">
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ApplicationHistory;
