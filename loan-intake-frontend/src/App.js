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
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState("dashboard");
  const [selectedApplicationId, setSelectedApplicationId] = useState(null);
  const [editingApplicationId, setEditingApplicationId] = useState(null);
  const [notice, setNotice] = useState(null);

  const handleLenderDashboard = () => setCurrentView("lender");
  const handleLenderPreferences = () => setCurrentView("lenderPrefs");

  useEffect(() => {
    const urlAuth = authStorage.getAuthFromUrl();

    if (urlAuth) {
      setNotice("Signing you in…");
      authStorage.saveAuth(urlAuth.token, urlAuth.user);
      setToken(urlAuth.token);
      setUser(urlAuth.user);
      setIsAuthenticated(true);
      authStorage.cleanUrlParams();
      setTimeout(() => setNotice(null), 3000);
    } else {
      const savedAuth = authStorage.loadAuth();
      if (savedAuth) {
        setToken(savedAuth.token);
        setUser(savedAuth.user);
        setIsAuthenticated(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !token) return;
    let cancelled = false;

    (async () => {
      try {
        const profile = await authAPI.getProfile(token);
        if (!cancelled && profile) {
          setUser(prev => ({ ...(prev || {}), ...profile }));
        }
      } catch {}
    })();

    return () => (cancelled = true);
  }, [isAuthenticated, token]);

  const handleLogout = () => {
    authStorage.clearAuth();
    setIsAuthenticated(false);
    setToken(null);
    setUser(null);
    setCurrentView("dashboard");
  };

  const handleStartNewApplication = () => {
    setEditingApplicationId(null);
    setCurrentView("application");
  };

  const handleOneClickSubmission = () => {
    setEditingApplicationId(null);
    setCurrentView("oneClick");
  };

  const handleEditApplication = id => {
    setEditingApplicationId(id);
    setCurrentView("application");
  };

  const handleBackToDashboard = () => {
    setCurrentView("dashboard");
    setSelectedApplicationId(null);
    setEditingApplicationId(null);
  };

  const handleOneClickComplete = result => {
    const applicationId = result?.submission?.data?.id;
    if (applicationId) {
      setSelectedApplicationId(applicationId);
      setCurrentView("offers");
    } else {
      setCurrentView("dashboard");
    }
  };

  const handleViewOffers = id => {
    setSelectedApplicationId(id);
    setCurrentView("offers");
  };

  const navButton = view => ({
    padding: "10px 16px",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    border: "1px solid #e5e5e5",
    background: currentView === view ? "#111" : "#fff",
    color: currentView === view ? "#fff" : "#111",
    transition: "all 0.2s ease"
  });

  return (
    <div style={{ minHeight: "100vh", background: "#fafafa", color: "#111" }}>
      <GlobalErrorToast />

      {notice && (
        <div
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#111",
            color: "#fff",
            padding: "10px 18px",
            borderRadius: "12px",
            zIndex: 1000,
            fontSize: "14px",
            boxShadow: "0 12px 30px rgba(0,0,0,0.25)"
          }}
        >
          {notice}
        </div>
      )}

      {/* Header */}
      <header
        style={{
          background: "#fff",
          borderBottom: "1px solid #e5e5e5",
          boxShadow: "0 6px 20px rgba(0,0,0,0.05)"
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "0 24px",
            height: 72,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
              Farm Equipment Loan Intake
            </h1>

            <nav style={{ display: "flex", gap: 10 }}>
              <button onClick={handleBackToDashboard} style={navButton("dashboard")}>
                Dashboard
              </button>
              <button onClick={handleStartNewApplication} style={navButton("application")}>
                New Application
              </button>
              <button onClick={handleOneClickSubmission} style={navButton("oneClick")}>
                Fast App
              </button>
              <button onClick={handleLenderDashboard} style={navButton("lender")}>
                Lender Dashboard
              </button>
              <button onClick={handleLenderPreferences} style={navButton("lenderPrefs")}>
                Preferences
              </button>
            </nav>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 14, color: "#555" }}>
              Welcome, <strong>{getUserDisplayName(user)}</strong>
            </span>
            <button
              onClick={handleLogout}
              style={{
                padding: "10px 16px",
                borderRadius: "10px",
                border: "1px solid #111",
                background: "#111",
                color: "#fff",
                cursor: "pointer"
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        {currentView === "dashboard" ? (
          <Dashboard
            user={user}
            token={token}
            onStartNewApplication={handleStartNewApplication}
            onEditApplication={handleEditApplication}
            onViewOffers={handleViewOffers}
          />
        ) : currentView === "offers" ? (
          <LoanOffersView
            applicationId={selectedApplicationId}
            token={token}
            onBack={handleBackToDashboard}
            onEdit={handleEditApplication}
          />
        ) : currentView === "lender" ? (
          <LenderDashboard />
        ) : currentView === "lenderPrefs" ? (
          <LenderPreferences />
        ) : currentView === "oneClick" ? (
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
      </main>
    </div>
  );
}

export default App;
