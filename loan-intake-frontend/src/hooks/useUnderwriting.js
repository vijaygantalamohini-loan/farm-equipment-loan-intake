import { useState } from 'react';
import { underwritingAPI } from '../services/api';

/**
 * Custom hook for creating underwriting requests
 */
export function useCreateUnderwritingRequest() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createRequest = async (payload) => {
    setLoading(true);
    setError(null);
    try {
      const result = await underwritingAPI.createRequest(payload);
      return result;
    } catch (err) {
      setError(err.message || 'Failed to create underwriting request');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { createRequest, loading, error };
}

/**
 * Custom hook for updating underwriting status
 */
export function useUpdateUnderwritingStatus() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const updateStatus = async (requestId, payload) => {
    setLoading(true);
    setError(null);
    try {
      const result = await underwritingAPI.updateStatus(requestId, payload);
      return result;
    } catch (err) {
      setError(err.message || 'Failed to update status');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { updateStatus, loading, error };
}
