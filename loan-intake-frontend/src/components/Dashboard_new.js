import React, { useState, useEffect, useCallback } from 'react';
import { Plus, TrendingUp, Clock, CheckCircle, FileText, ArrowRight } from 'lucide-react';
import { loansAPI, API_BASE } from '../services/api';


const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

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

  const getStatusColor = (status) => {
    if (status === 'draft' || status === 'in_progress') return 'bg-yellow-100 text-yellow-900 border-yellow-300';
    if (status === 'submitted') return 'bg-orange-100 text-orange-900 border-orange-300';
    if (status === 'funded' || status === 'approved') return 'bg-green-100 text-green-900 border-green-300';
    return 'bg-gray-100 text-gray-900 border-gray-300';
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

  const ApplicationCard = ({ app, columnType }) => (
    <div className="group relative bg-white border-2 border-black rounded-2xl p-5 hover:shadow-xl hover:shadow-black/5 transition-all duration-300 hover:-translate-y-0.5">
      <div className="absolute top-0 right-0 w-16 h-16 bg-black rounded-bl-full opacity-5"></div>
      
      <div className="relative">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-sm font-bold text-black tracking-tight">{app.application_number}</h3>
            {app.borrower_name && <p className="text-xs text-gray-500 font-medium mt-0.5">{app.borrower_name}</p>}
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide border-2 ${getStatusColor(app.status)}`}>
            {app.status.replace('_', ' ')}
          </span>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-xs font-medium text-gray-500">Amount</span>
            <span className="font-bold text-black text-sm">{formatCurrency(app.loan_amount)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-xs font-medium text-gray-500">Equipment</span>
            <span className="font-bold text-black text-sm">{app.equipment || 'N/A'}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-xs font-medium text-gray-500">Serial</span>
            <span className="font-mono font-bold text-black text-xs">{app.serial_number || 'N/A'}</span>
          </div>
          {app.trade_in_serials?.length > 0 && (
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-xs font-medium text-gray-500">Trade-In</span>
              <span className="font-mono font-bold text-black text-xs">{app.trade_in_serials.join(', ')}</span>
            </div>
          )}
          {app.ai_score && (
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-xs font-medium text-gray-500">AI Score</span>
              <span className="font-bold text-xs" style={{ color: getAiScoreColor(app.ai_score.risk_tier) }}>
                {Math.round(app.ai_score.approval_probability * 100)}% · {app.ai_score.risk_score} ({app.ai_score.risk_tier})
              </span>
            </div>
          )}
          {app.submitted_at && (
            <div className="flex justify-between items-center py-2">
              <span className="text-xs font-medium text-gray-500">Date</span>
              <span className="font-bold text-black text-sm">{formatDate(app.submitted_at)}</span>
            </div>
          )}
        </div>

        {(app.status === 'draft' || app.status === 'in_progress') && (
          <button 
            onClick={() => onEditApplication?.(app.id)}
            className="w-full bg-black hover:bg-gray-900 text-white py-2.5 rounded-xl font-bold text-xs transition-all duration-200 flex items-center justify-center gap-2"
          >
            📝 Resume Application
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        )}

        {app.status === 'submitted' && (
          <button 
            onClick={() => onViewOffers?.(app.id)}
            className="w-full bg-black hover:bg-gray-900 text-white py-2.5 rounded-xl font-bold text-xs transition-all duration-200 flex items-center justify-center gap-2"
          >
            💰 View Loan Offers
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        )}

        {(app.status === 'funded' || app.status === 'approved') && (
          <button className="w-full bg-black hover:bg-gray-900 text-white py-2.5 rounded-xl font-bold text-xs transition-all duration-200 flex items-center justify-center gap-2">
            📄 View Details
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-bold text-black">Loading dashboard…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading dashboard: {error.message}</p>
          <button 
            className="bg-black hover:bg-gray-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-xl"
            onClick={fetchDashboard}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) return null;

  const salespersonName =
    dashboardData?.salesperson?.name || user?.name || user?.givenName || 'there';

  const summary = dashboardData.summary || {};
  const { in_progress = [], submitted = [], funded = [] } = dashboardData.applications || {};

  const stats = [
    { value: summary.total || 0, label: 'Total Applications', color: 'bg-white', textColor: 'text-black', icon: FileText },
    { value: summary.in_progress || 0, label: 'In Progress', color: 'bg-white', textColor: 'text-black', icon: Clock },
    { value: summary.submitted || 0, label: 'Submitted', color: 'bg-white', textColor: 'text-black', icon: TrendingUp },
    { value: summary.funded || 0, label: 'Funded', color: 'bg-white', textColor: 'text-black', icon: CheckCircle },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-4xl font-black text-black tracking-tight">Dashboard</h1>
            </div>
            <p className="text-sm text-gray-600">Welcome back, <span className="font-bold text-black">{salespersonName}</span></p>
          </div>
          <button 
            onClick={() => onStartNewApplication?.()}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-xl shadow-black/10 hover:shadow-black/20 transition-all duration-200 flex items-center gap-2"
          >
            <Plus size={18} />
            <span>New Application</span>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className={`relative overflow-hidden ${stat.color} rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 border-2 ${stat.color === 'bg-white' ? 'border-black' : 'border-transparent'}`}>
                <div className="flex flex-col">
                  <Icon className={`${stat.textColor} mb-2`} size={24} strokeWidth={2.5} />
                  <p className={`${stat.textColor} text-xs font-bold uppercase tracking-wider mb-1 opacity-70`}>{stat.label}</p>
                  <p className={`${stat.textColor} text-4xl font-black tracking-tighter`}>{stat.value}</p>
                </div>
                <div className={`absolute -bottom-3 -right-3 w-16 h-16 ${stat.color === 'bg-white' ? 'bg-black' : 'bg-white'} rounded-full opacity-5`}></div>
              </div>
            );
          })}
        </div>

        {/* Three Column Layout - Using Inline Style to Force Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
          {/* In Progress Column */}
          <div className="bg-yellow-400 rounded-2xl p-6 space-y-4">
            <div className="pb-2">
              <h2 className="text-lg font-black text-yellow-950 flex items-center gap-2">
                <Clock size={20} />
                In Progress ({summary.in_progress || 0})
              </h2>
            </div>
            <div className="space-y-4">
              {in_progress.length === 0 ? (
                <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 text-center">
                  <p className="text-gray-400 font-medium">No applications</p>
                </div>
              ) : (
                in_progress.map((app) => (
                  <ApplicationCard key={app.id} app={app} columnType="in-progress" />
                ))
              )}
            </div>
          </div>

          {/* Submitted Column */}
          <div className="bg-orange-400 rounded-2xl p-6 space-y-4">
            <div className="pb-2">
              <h2 className="text-lg font-black text-orange-950 flex items-center gap-2">
                <TrendingUp size={20} />
                Submitted ({summary.submitted || 0})
              </h2>
            </div>
            <div className="space-y-4">
              {submitted.length === 0 ? (
                <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 text-center">
                  <p className="text-gray-400 font-medium">No applications</p>
                </div>
              ) : (
                submitted.map((app) => (
                  <ApplicationCard key={app.id} app={app} columnType="submitted" />
                ))
              )}
            </div>
          </div>

          {/* Funded Column */}
          <div className="bg-green-400 rounded-2xl p-6 space-y-4">
            <div className="pb-2">
              <h2 className="text-lg font-black text-green-950 flex items-center gap-2">
                <CheckCircle size={20} />
                Funded ({summary.funded || 0})
              </h2>
            </div>
            <div className="space-y-4">
              {funded.length === 0 ? (
                <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 text-center">
                  <p className="text-gray-400 font-medium">No applications</p>
                </div>
              ) : (
                funded.map((app) => (
                  <ApplicationCard key={app.id} app={app} columnType="funded" />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
