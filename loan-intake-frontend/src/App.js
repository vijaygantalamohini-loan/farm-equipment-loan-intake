import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  FilePlus,
  Zap,
  Landmark,
  SlidersHorizontal,
  TestTube2,
  LogOut
} from "lucide-react";

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

/* ---------- UI Helper ---------- */
const NavButton = ({ active, icon, label, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border transition
      ${
        active
          ? "bg-emerald-600 text-white border-emerald-600 shadow"
          : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
      }`}
  >
    {icon}
    {label}
  </button>
);

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState("dashboard");
  const [selectedApplicationId, setSelectedApplicationId] = useState(null);
  const [editingApplicationId, setEditingApplicationId] = useState(null);
  const [notice, setNotice] = useState(null);

  const handleLenderDashboard = () => setCurrentView("lender");
  const handleLenderPreferences = () => setCurrentView("lenderPrefs");

  /* ---------- Auth bootstrap ---------- */
  useEffect(() => {
    const urlAuth = authStorage.getAuthFromUrl();

    if (urlAuth) {
      setNotice("Signing you in...");
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

  /* ---------- Load profile ---------- */
  useEffect(() => {
    if (!isAuthenticated || !token) return;
    let cancelled = false;

    (async () => {
      try {
        const profile = await authAPI.getProfile(token);
        if (!cancelled && profile) {
          setUser(prev => ({ ...(prev || {}), ...profile }));
        }
      } catch (e) {
        console.error("Profile load failed", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, token]);

  /* ---------- Handlers ---------- */
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

  const handleViewOffers = id => {
    setSelectedApplicationId(id);
    setCurrentView("offers");
  };

  const handleOneClickComplete = result => {
    const appId = result?.submission?.data?.id;
    if (appId) {
      setSelectedApplicationId(appId);
      setCurrentView("offers");
    } else {
      setCurrentView("dashboard");
    }
  };

  const handleTestRoute = () => setCurrentView("test");


  if (!isAuthenticated) {
    return (
      <>
        {notice && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
            background: '#e8f4ff', color: '#035388', borderBottom: '1px solid #b3e6ff',
            padding: '0.4rem 0.6rem', textAlign: 'center', fontWeight: 600
          }}>
            {notice}
          </div>
        )}
        <Login onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-gray-50">
      <GlobalErrorToast />

      {notice && (
        <div className="fixed top-0 inset-x-0 z-50 bg-blue-50 border-b border-blue-200 text-blue-800 text-sm font-semibold text-center py-2">
          {notice}
        </div>
      )}

      {/* ---------- Header ---------- */}
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
            <h1 className="text-xl font-bold text-gray-900">
              Farm Equipment Loan Intake
            </h1>

            <nav className="flex flex-wrap gap-2">
              <NavButton
                active={currentView === "dashboard"}
                onClick={handleBackToDashboard}
                icon={<LayoutDashboard size={16} />}
                label="Dashboard"
              />
              <NavButton
                active={currentView === "application"}
                onClick={handleStartNewApplication}
                icon={<FilePlus size={16} />}
                label="New App"
              />
              <NavButton
                active={currentView === "oneClick"}
                onClick={handleOneClickSubmission}
                icon={<Zap size={16} />}
                label="Fast App"
              />
              <NavButton
                active={currentView === "lender"}
                onClick={handleLenderDashboard}
                icon={<Landmark size={16} />}
                label="Lenders"
              />
              <NavButton
                active={currentView === "lenderPrefs"}
                onClick={handleLenderPreferences}
                icon={<SlidersHorizontal size={16} />}
                label="Preferences"
              />
              {/* <NavButton
                active={currentView === "test"}
                onClick={handleTestRoute}
                icon={<TestTube2 size={16} />}
                label="Test"
              /> */}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-700">
              Welcome,{" "}
              <strong className="font-semibold">
                {getUserDisplayName(user)}
              </strong>
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 transition"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* ---------- Main ---------- */}
      <main className="max-w-7xl mx-auto px-4 py-6">
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
        ) : currentView === "test" ? (
          <></>
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
