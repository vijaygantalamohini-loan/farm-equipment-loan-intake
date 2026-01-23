import React, { useState, useEffect } from 'react';
import './Login.css';
import { authAPI } from '../services/api';

function Login({ onLoginSuccess }) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasError = params.get('error');
    const message = params.get('message');
    if (hasError) {
      setErrorMessage(message ? decodeURIComponent(message) : 'Authentication error');
    }
  }, []);

  const handleAzureLogin = () => {
    setLoading(true);
    // Redirect to backend-auth login via configured API base
    // Using the API service keeps dev/prod ports in sync
    window.location.href = authAPI.getLoginUrl();
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>Loan Intake Portal</h1>
        <p className="subtitle">Secure Authentication via Azure AD</p>
        {errorMessage && (
          <div className="login-error" style={{
            background: '#ffe6e6',
            border: '1px solid #ffb3b3',
            color: '#a80000',
            padding: '0.75rem',
            borderRadius: '6px',
            marginBottom: '1rem'
          }}>
            {errorMessage}
          </div>
        )}
        
        <div className="azure-login-section">
          <button 
            onClick={handleAzureLogin} 
            disabled={loading} 
            className="azure-login-button"
          >
            <svg className="microsoft-icon" viewBox="0 0 23 23">
              <path fill="#f25022" d="M0 0h11v11H0z"/>
              <path fill="#00a4ef" d="M12 0h11v11H12z"/>
              <path fill="#7fba00" d="M0 12h11v11H0z"/>
              <path fill="#ffb900" d="M12 12h11v11H12z"/>
            </svg>
            {loading ? 'Redirecting to Microsoft...' : 'Sign in with Microsoft'}
          </button>
          
          <div className="security-info">
            <p>🔒 Secure enterprise authentication</p>
            <p>✓ Multi-factor authentication supported</p>
            <p>✓ Single sign-on across applications</p>
          </div>
        </div>

        <div className="help-text">
          <p><strong>Need access?</strong></p>
          <p>Contact your system administrator to set up your account.</p>
        </div>
      </div>
    </div>
  );
}

export default Login;
