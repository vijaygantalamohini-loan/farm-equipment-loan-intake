import React, { useState, useEffect } from "react";
import LoanApplicationWizard from "./LoanApplicationWizard";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import LoanOffersView from "./components/LoanOffersView";
import LenderDashboard from "./components/LenderDashboard";
import LenderPreferences from "./components/LenderPreferences";
import { authStorage, getUserDisplayName } from "./utils/auth";
import { authAPI } from "./services/api";
import GlobalErrorToast from "./components/GlobalErrorToast";
import { OneClickSubmissionProvider } from "./components/OneClickSubmission/hooks/OneClickSubmissionContext";
import OneClickSubmissionWizard from "./components/OneClickSubmission/OneClickSubmissionWizard";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'application', 'offers', 'lender', 'lenderPrefs', 'oneClick'
    const handleLenderDashboard = () => {
      setCurrentView('lender');
    };
    const handleLenderPreferences = () => {
      setCurrentView('lenderPrefs');
    };
  const [selectedApplicationId, setSelectedApplicationId] = useState(null);
  const [editingApplicationId, setEditingApplicationId] = useState(null);
  const [notice, setNotice] = useState(null);

  // Check URL for token (from Azure AD callback) or load from localStorage
  useEffect(() => {
    // First, check URL for OAuth callback
    console.log('[App] Mount at URL:', window.location.href);
    const urlAuth = authStorage.getAuthFromUrl();
    console.log('[App] URL auth present:', !!urlAuth);
    
    if (urlAuth) {
      // Save and set authentication
      setNotice('Auth callback detected - signing you in...');
      authStorage.saveAuth(urlAuth.token, urlAuth.user);
      console.log('[App] Auth saved from URL, token length:', urlAuth.token?.length || 0);
      setToken(urlAuth.token);
      setUser(urlAuth.user);
      setIsAuthenticated(true);
      
      // Clean up URL
      authStorage.cleanUrlParams();
      console.log('[App] URL params cleaned, navigating to root');
      setTimeout(() => setNotice(null), 4000);
    } else {
      // Try loading from localStorage
      const savedAuth = authStorage.loadAuth();
      console.log('[App] Loaded auth from storage:', !!savedAuth);
      
      if (savedAuth) {
        setToken(savedAuth.token);
        setUser(savedAuth.user);
        setIsAuthenticated(true);
        console.log('[App] Auth state set from storage');
        try {
          const params = new URLSearchParams(window.location.search);
          const desiredView = params.get('view');
          if (desiredView === 'application') {
            setCurrentView('application');
          } else if (desiredView === 'offers') {
            setCurrentView('offers');
          } else if (desiredView === 'dashboard') {
            setCurrentView('dashboard');
          }
        } catch {}
      }
    }
  }, []);

  // Load full user profile (vendor/location) after auth is established
  useEffect(() => {
    if (!isAuthenticated || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const profile = await authAPI.getProfile(token);
        if (!cancelled && profile && typeof profile === 'object') {
          setUser(prev => ({ ...(prev || {}), ...profile }));
        }
      } catch (e) {
        console.error('[App] Failed to load user profile', e);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, token]);

  const handleLoginSuccess = (authToken, userData) => {
    authStorage.saveAuth(authToken, userData);
    setToken(authToken);
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    authStorage.clearAuth();
    setIsAuthenticated(false);
    setToken(null);
    setUser(null);
    setCurrentView('dashboard');
  };

  const handleStartNewApplication = () => {
    setEditingApplicationId(null); // Clear any editing state
    setCurrentView('application');
  };

  const handleOneClickSubmission = () => {
    setEditingApplicationId(null);
    setCurrentView('oneClick');
  };

  const handleEditApplication = (applicationId) => {
    setEditingApplicationId(applicationId);
    setCurrentView('application');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setSelectedApplicationId(null);
    setEditingApplicationId(null);
  };

  const handleOneClickComplete = (result) => {
    const submission = result?.submission;
    const submissionData = submission?.data || submission;
    const applicationId = submissionData?.id;
    if (applicationId) {
      setSelectedApplicationId(applicationId);
      setCurrentView('offers');
    } else {
      setCurrentView('dashboard');
    }
  };

  const handleViewOffers = (applicationId) => {
    setSelectedApplicationId(applicationId);
    setCurrentView('offers');
  };

  if (!isAuthenticated) {
    return (
      <>
        {notice && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
            background: '#e8f4ff', color: '#035388', borderBottom: '1px solid #b3e6ff',
            padding: '0.5rem 1rem', textAlign: 'center', fontWeight: 600
          }}>
            {notice}
          </div>
        )}
        <Login onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  return (
    <div className="App">
      <GlobalErrorToast />
      {notice && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
          background: '#e8f4ff', color: '#035388', borderBottom: '1px solid #b3e6ff',
          padding: '0.5rem 1rem', textAlign: 'center', fontWeight: 600
        }}>
          {notice}
        </div>
      )}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '1rem 2rem',
        background: '#f5f5f5',
        borderBottom: '2px solid #ddd'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <h1 style={{ margin: 0 }}>Farm Equipment Loan Intake</h1>
          <nav style={{ display: 'flex', gap: '1rem' }}>
            <button 
              onClick={handleBackToDashboard}
              style={{
                padding: '0.5rem 1rem',
                background: currentView === 'dashboard' ? '#4CAF50' : 'transparent',
                color: currentView === 'dashboard' ? 'white' : '#333',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: currentView === 'dashboard' ? '600' : 'normal'
              }}
            >
              Dashboard
            </button>
            <button 
              onClick={handleStartNewApplication}
              style={{
                padding: '0.5rem 1rem',
                background: currentView === 'application' ? '#4CAF50' : 'transparent',
                color: currentView === 'application' ? 'white' : '#333',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: currentView === 'application' ? '600' : 'normal'
              }}
            >
              New Application
            </button>
            <button
              onClick={handleOneClickSubmission}
              style={{
                padding: '0.5rem 1rem',
                background: currentView === 'oneClick' ? '#4CAF50' : 'transparent',
                color: currentView === 'oneClick' ? 'white' : '#333',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: currentView === 'oneClick' ? '600' : 'normal'
              }}
            >
              Fast App
            </button>
            <button 
              onClick={handleLenderDashboard}
              style={{
                padding: '0.5rem 1rem',
                background: currentView === 'lender' ? '#007bff' : 'transparent',
                color: currentView === 'lender' ? 'white' : '#333',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: currentView === 'lender' ? '600' : 'normal'
              }}
            >
              Lender Dashboard
            </button>
            <button 
              onClick={handleLenderPreferences}
              style={{
                padding: '0.5rem 1rem',
                background: currentView === 'lenderPrefs' ? '#007bff' : 'transparent',
                color: currentView === 'lenderPrefs' ? 'white' : '#333',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: currentView === 'lenderPrefs' ? '600' : 'normal'
              }}
            >
              Lender Preferences
            </button>
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span>Welcome, <strong>{getUserDisplayName(user)}</strong></span>
          <button 
            onClick={handleLogout}
            style={{
              padding: '0.5rem 1rem',
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>
      </div>
      
      {currentView === 'dashboard' ? (
        <Dashboard 
          user={user} 
          token={token} 
          onStartNewApplication={handleStartNewApplication}
          onEditApplication={handleEditApplication}
          onViewOffers={handleViewOffers}
        />
      ) : currentView === 'offers' ? (
        <LoanOffersView 
          applicationId={selectedApplicationId}
          token={token}
          onBack={handleBackToDashboard}
          onEdit={handleEditApplication}
        />
      ) : currentView === 'lender' ? (
        <LenderDashboard />
      ) : currentView === 'lenderPrefs' ? (
        <LenderPreferences />
      ) : currentView === 'oneClick' ? (
        <OneClickSubmissionProvider>
          <OneClickSubmissionWizard
            initialData={token ? { token } : undefined}
            onSubmit={handleOneClickComplete}
            onCancel={handleBackToDashboard}
          />
        </OneClickSubmissionProvider>
      ) : (
        <LoanApplicationWizard 
          user={user} 
          token={token}
          editingApplicationId={editingApplicationId}
          onBack={handleBackToDashboard}
          onViewOffers={handleViewOffers}
        />
      )}
    </div>
  );
}

export default App;
