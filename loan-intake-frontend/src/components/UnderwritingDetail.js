import React, { useState, useEffect } from 'react';
import { underwritingAPI } from '../services/api';
import { useUpdateUnderwritingStatus } from '../hooks/useUnderwriting';

/**
 * Component for viewing underwriting request details
 */
export default function UnderwritingDetail({ requestId }) {
  const [request, setRequest] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [notes, setNotes] = useState('');
  
  const { updateStatus, loading: updating } = useUpdateUnderwritingStatus();

  useEffect(() => {
    if (requestId) {
      fetchData();
    }
  }, [requestId]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [reqData, actData] = await Promise.all([
        underwritingAPI.getById(requestId),
        underwritingAPI.getActivities(requestId),
      ]);
      setRequest(reqData);
      setActivities(actData);
    } catch (err) {
      setError(err.message || 'Failed to load underwriting data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    try {
      await updateStatus(requestId, { status: newStatus, notes });
      setShowUpdateForm(false);
      setNewStatus('');
      setNotes('');
      await fetchData();
    } catch (err) {
      alert('Failed to update status: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>;
  }

  if (!request) {
    return <div className="p-4 text-gray-500">No underwriting request found</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Underwriting Request Details</h1>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Application ID</h3>
            <p className="mt-1 text-lg">{request.applicationId}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Status</h3>
            <p className="mt-1 text-lg font-medium">{request.status.replace(/_/g, ' ').toUpperCase()}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Borrower</h3>
            <p className="mt-1">{request.borrowerData?.firstName} {request.borrowerData?.lastName}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Loan Amount</h3>
            <p className="mt-1">${request.loanData?.amount?.toLocaleString()}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Credit Score</h3>
            <p className="mt-1">{request.borrowerData?.creditScore || 'N/A'}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Income</h3>
            <p className="mt-1">${request.borrowerData?.income?.toLocaleString() || 'N/A'}</p>
          </div>
        </div>

        {request.notes && (
          <div className="mt-4 p-3 bg-yellow-50 rounded">
            <h4 className="text-sm font-medium text-gray-700">Notes</h4>
            <p className="mt-1 text-sm text-gray-600">{request.notes}</p>
          </div>
        )}

        {request.decision && (
          <div className={`mt-4 p-3 rounded ${request.decision.approved ? 'bg-green-50' : 'bg-red-50'}`}>
            <h4 className="text-sm font-medium text-gray-700">Decision</h4>
            <p className="mt-1 text-sm">
              <strong>Approved:</strong> {request.decision.approved ? 'Yes' : 'No'}
            </p>
            {request.decision.approvedAmount && (
              <p className="text-sm">
                <strong>Amount:</strong> ${request.decision.approvedAmount.toLocaleString()}
              </p>
            )}
            {request.decision.interestRate && (
              <p className="text-sm">
                <strong>Interest Rate:</strong> {request.decision.interestRate}%
              </p>
            )}
            {request.decision.reason && (
              <p className="text-sm">
                <strong>Reason:</strong> {request.decision.reason}
              </p>
            )}
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={() => setShowUpdateForm(!showUpdateForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Update Status
          </button>
        </div>

        {showUpdateForm && (
          <form onSubmit={handleUpdateStatus} className="mt-4 p-4 bg-gray-50 rounded">
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">New Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                required
              >
                <option value="">Select status</option>
                <option value="pending">Pending</option>
                <option value="in_review">In Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="more_info_needed">More Info Needed</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                rows={3}
              />
            </div>
            <button
              type="submit"
              disabled={updating}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {updating ? 'Updating...' : 'Submit'}
            </button>
          </form>
        )}
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Activity Log</h2>
        {activities.length === 0 ? (
          <p className="text-gray-500">No activities yet</p>
        ) : (
          <ul className="space-y-3">
            {activities.map((activity) => (
              <li key={activity.id} className="p-3 bg-gray-50 rounded">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(activity.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {activity.activityType.replace(/_/g, ' ')}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
