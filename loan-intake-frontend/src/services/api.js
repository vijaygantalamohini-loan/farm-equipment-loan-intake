/**
 * API Service - Centralized API calls
 */

import { getValidToken, redirectToLogin, authStorage, isTokenLikelyExpired } from '../utils/auth';
import { v4 as uuidv4 } from 'uuid';
import errorBus from '../utils/errorBus';

// Prefer explicit API base when provided. Otherwise, align backend host with current frontend host
// to avoid localhost vs 127.0.0.1 mismatches causing network issues.
const RESOLVED_HOST = (typeof window !== 'undefined' && window.location && window.location.hostname)
  ? window.location.hostname
  : 'localhost';
const DEFAULT_API_BASE = `http://${RESOLVED_HOST}:8000`;
const IS_DEV = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development';
const IS_LOCAL_HOSTNAME = (typeof window !== 'undefined' && window.location && (/^(localhost|127\.0\.0\.1)$/).test(window.location.hostname));
const IS_CRA_DEV = (typeof window !== 'undefined' && window.location && (window.location.port === '3000' || window.location.port === '3001'));
const IS_CODESPACES = (typeof window !== 'undefined' && window.location && window.location.hostname && window.location.hostname.includes('github.dev'));
// Prefer CRA dev proxy when running locally or in Codespaces to avoid CORS; use relative paths
const PREFER_PROXY = IS_DEV || IS_CODESPACES || (IS_LOCAL_HOSTNAME && IS_CRA_DEV);
const API_BASE_URL = PREFER_PROXY ? '' : (process.env.REACT_APP_API_URL || DEFAULT_API_BASE);
// Expose API base globally for quick debugging
try { if (typeof window !== 'undefined') { window.__API_BASE = API_BASE_URL; } } catch {}

const formatErrorDetail = (detail) => {
  if (detail === null || detail === undefined) {
    return null;
  }

  const normalizeItem = (item) => {
    if (item === null || item === undefined) {
      return null;
    }
    if (typeof item === "string") {
      return item.trim().length > 0 ? item : null;
    }
    if (Array.isArray(item)) {
      const nested = item
        .map((entry) => normalizeItem(entry))
        .filter(Boolean);
      return nested.length > 0 ? nested.join(" ") : null;
    }
    if (typeof item === "object") {
      const msg = item.msg || item.message || item.detail || item.error;
      const loc = Array.isArray(item.loc)
        ? item.loc.filter((part) => part && part !== "body").join(".")
        : undefined;
      const code = item.type || item.code;
      const text = msg ? String(msg) : null;
      if (text) {
        const parts = [];
        if (loc) parts.push(loc);
        parts.push(text);
        if (code && code !== "value_error") {
          parts.push(`(${code})`);
        }
        return parts.join(": ");
      }
      try {
        return JSON.stringify(item);
      } catch {
        return null;
      }
    }
    return String(item);
  };

  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => normalizeItem(item))
      .filter(Boolean);
    return parts.length > 0 ? parts.join(" | ") : null;
  }

  return normalizeItem(detail);
};

class APIError extends Error {
  constructor(message, status, data, url) {
    super(message);
    this.status = status;
    this.data = data;
    this.url = url;
    this.name = 'APIError';
  }
}

/**
 * Base fetch wrapper with error handling
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  if (API_BASE_URL === '') {
    // In proxy mode, ensure endpoint starts with '/'
    if (!endpoint.startsWith('/')) {
      throw new Error(`Endpoint must start with '/' when using proxy: received '${endpoint}'`);
    }
  }
  
  // Build headers: only set Content-Type when sending a JSON body
  const headers = {
    ...(options.headers || {}),
  };
  // Attach request ID for correlation
  const requestId = uuidv4();
  headers['X-Request-ID'] = requestId;

  // Attach Authorization header automatically when available and not already provided
  try {
    const hasAuthHeader = Object.keys(headers).some(k => k.toLowerCase() === 'authorization');
    if (!hasAuthHeader) {
      const token = getValidToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } else {
      // If caller provided Authorization, ensure it is not obviously expired
      const provided = headers['Authorization'] || headers['authorization'];
      if (typeof provided === 'string' && provided.toLowerCase().startsWith('bearer ')) {
        const candidate = provided.slice(7);
        if (isTokenLikelyExpired(candidate)) {
          authStorage.clearAuth?.();
          redirectToLogin();
          // Let the request continue; backend will 401 and we handle below
        }
      }
    }
  } catch {}

  const method = (options.method || 'GET').toUpperCase();
  const hasBody = options.body !== undefined && options.body !== null;
  const isFormData = typeof FormData !== 'undefined' && hasBody && options.body instanceof FormData;
  if (hasBody && !isFormData && !headers['Content-Type'] && method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = 'application/json';
  }
  
  console.log('=== API REQUEST DEBUG ===');
  console.log('URL:', url);
  console.log('Method:', method);
  console.log('Headers:', headers);
  console.log('Body type:', typeof options.body);
  console.log('Body content:', options.body);
  console.log('=======================');
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle non-OK responses
    if (!response.ok) {
      let errorData;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        errorData = await response.json();
      } else {
        errorData = { detail: await response.text() };
      }

      // Centralized 401/403 handling: clear auth and re-login for protected routes
      if (response.status === 401) {
        try { authStorage.clearAuth?.(); } catch {}
        // Only redirect for clearly protected endpoints
        if (endpoint.startsWith('/loans') || endpoint.startsWith('/auth/profile')) {
          redirectToLogin();
        }
      }
      if (response.status === 403) {
        // Keep token (it may be valid but lacking permission). Surface the error.
        // Optionally, we could route to an Unauthorized screen here.
      }
      
      const formattedDetail = formatErrorDetail(errorData && errorData.detail);
      const apiErr = new APIError(
        formattedDetail || errorData?.detail || `Request failed with status ${response.status}`,
        response.status,
        errorData,
        url
      );
      try { errorBus.emit({ message: apiErr.message, status: apiErr.status, url, requestId }); } catch {}
      throw apiErr;
    }

    // Return JSON response
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return data;
    }
    
    return response;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }

    // Preserve native abort semantics so callers can detect and ignore.
    if (error?.name === 'AbortError') {
      throw error;
    }

    // If using proxy (relative base), attempt a single absolute fallback to localhost/127.0.0.1:8000
    const triedFallback = options.__triedFallback === true;
    if (API_BASE_URL === '' && endpoint.startsWith('/') && !triedFallback) {
      const candidates = [
        `http://localhost:8000${endpoint}`,
        `http://127.0.0.1:8000${endpoint}`,
      ];
      for (const fallbackUrl of candidates) {
        try {
          const resp = await fetch(fallbackUrl, {
            ...options,
            __triedFallback: true,
            headers,
          });
          if (!resp.ok) {
            let errorData;
            const contentType = resp.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              errorData = await resp.json();
            } else {
              errorData = { detail: await resp.text() };
            }
            const fallbackErr = new APIError(
              formatErrorDetail(errorData && errorData.detail) || errorData?.detail || `Request failed with status ${resp.status}`,
              resp.status,
              errorData,
              fallbackUrl
            );
            try { errorBus.emit({ message: fallbackErr.message, status: fallbackErr.status, url: fallbackUrl, requestId }); } catch {}
            throw fallbackErr;
          }
          const ct = resp.headers.get('content-type');
          if (ct && ct.includes('application/json')) {
            return await resp.json();
          }
          return resp;
        } catch (fallbackErr) {
          // try next candidate
        }
      }
    }

    // Network or other errors
    const apiErr = new APIError(
      error.message || 'Network error occurred',
      0,
      { originalError: error },
      url
    );
    try { errorBus.emit({ message: apiErr.message, status: apiErr.status, url, requestId }); } catch {}
    throw apiErr;
  }
}

/**
 * Authentication API
 */
export const authAPI = {
  /**
   * Get login URL
   */
  getLoginUrl() {
    return `${API_BASE_URL}/auth/login`;
  },

  /**
   * Get user profile
   */
  async getProfile(token) {
    return apiRequest('/auth/profile', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },
};

/**
 * Loans API
 */
export const loansAPI = {
  /**
   * Start a new loan application (draft)
   */
  async startApplication(token, idempotencyKey) {
    return apiRequest('/loans/start', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Idempotency-Key': idempotencyKey || undefined,
      },
    });
  },

  /**
   * Get a specific application by id
   */
  async getApplication(applicationId, token) {
    return apiRequest(`/loans/${applicationId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  /**
   * Save draft for an application
   */
  async saveDraft(applicationId, draftData, token) {
    return apiRequest(`/loans/${applicationId}/save-draft`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Idempotency-Key': draftData.idempotencyKey || undefined,
      },
      body: JSON.stringify(draftData ?? {}),
    });
  },
  /**
   * Submit a new loan application
   */
  async submitApplication(data, token, applicationId = null) {
    // Normalize documents & consents shape
    let documents_and_consents_data = null;
    if (Array.isArray(data.documents) || data.consents) {
      documents_and_consents_data = {
        documents: data.documents || [],
        consents: data.consents || {},
      };
    } else if (data.documents && typeof data.documents === 'object') {
      documents_and_consents_data = {
        documents: Array.isArray(data.documents.documents) ? data.documents.documents : [],
        consents: data.documents.consents || {},
      };
    }

    const hasCoBorrowerFlag = !!data.hasCoBorrower;

    // Normalize loan data similar to draft saves to ensure serials persist
    const normalizeLoanForSubmit = (loanObj) => {
      if (!loanObj || typeof loanObj !== 'object') return loanObj;
      const trim = (v) => {
        if (v === undefined || v === null) return undefined;
        const t = String(v).trim();
        return t === '' ? undefined : t;
      };
      const normalizeSerials = (arr) => Array.isArray(arr)
        ? arr.map((it) => ({ ...(it || {}), serialNumber: trim((it || {}).serialNumber) }))
        : [];
      const loan = { ...loanObj };
      loan.purchaseAssets = normalizeSerials(loan.purchaseAssets);
      loan.tradeIns = normalizeSerials(loan.tradeIns);
      if (!loan.serialNumber && Array.isArray(loan.purchaseAssets) && loan.purchaseAssets.length > 0) {
        const first = loan.purchaseAssets[0] || {};
        if (first.serialNumber) loan.serialNumber = first.serialNumber;
      }
      // Convenience array for backends/UI that surface summary
      loan.tradeInSerials = (loan.tradeIns || []).map(t => t && t.serialNumber).filter(Boolean);
      return loan;
    };
    const normalizedLoan = normalizeLoanForSubmit(data.loan);
    const payload = {
      borrower_type: data.borrowerType || "individual",
      has_coborrower: hasCoBorrowerFlag,
      borrower_data: data.borrower,
      loan_data: normalizedLoan,
      dealer_data: data.dealer,
      documents_and_consents_data,
    };
    if (hasCoBorrowerFlag) {
      payload.coborrower_data = data.coBorrower || {};
    }
    
    // Include application_id if provided (for updating existing drafts)
    if (applicationId) {
      payload.application_id = applicationId;
    }
    
    console.log('API payload before stringify:', payload);
    const bodyString = JSON.stringify(payload);
    console.log('API body string:', bodyString);
    
    return apiRequest('/loans/submit', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: bodyString,
    });
  },

  /**
   * Get dashboard data
   */
  async getDashboard(token) {
    return apiRequest('/loans/dashboard', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  /**
   * Delete a loan application
   */
  async deleteApplication(applicationId, token) {
    return apiRequest(`/loans/${applicationId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  /**
   * Get my applications
   */
  async getMyApplications(token) {
    return apiRequest('/loans/my-applications', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  /**
   * Get location applications (team view)
   */
  async getLocationApplications(token) {
    return apiRequest('/loans/location-applications', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  /**
   * Get vendor applications (management view)
   */
  async getVendorApplications(token) {
    return apiRequest('/loans/vendor-applications', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  /**
   * Get application details
   */
  async getApplicationDetails(applicationId, token) {
    return apiRequest(`/loans/${applicationId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  /**
   * Get my statistics
   */
  async getMyStats(token) {
    return apiRequest('/loans/stats/my-stats', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  /**
   * Get location statistics
   */
  async getLocationStats(token) {
    return apiRequest('/loans/stats/location-stats', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  /**
   * Get vendor statistics
   */
  async getVendorStats(token) {
    return apiRequest('/loans/stats/vendor-stats', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  /**
   * Get loan offers from lenders for a specific application
   */
  async getOffers(applicationId, token) {
    return apiRequest(`/loans/${applicationId}/get-offers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  /**
   * Accept a specific lender offer for the application
   */
  async acceptOffer(applicationId, offerId, token) {
    return apiRequest(`/loans/${applicationId}/accept-offer?offer_id=${encodeURIComponent(offerId)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  /**
   * Reopen a submitted application for edits
   */
  async reopenApplication(applicationId, token, reason) {
    const payload = {};
    if (reason && typeof reason === 'string' && reason.trim().length > 0) {
      payload.reason = reason.trim();
    }

    return apiRequest(`/loans/${applicationId}/reopen`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  },
};

/**
 * Prequalification API
 */
export const prequalificationAPI = {
  async prequalify(payload, signal = undefined) {
    return apiRequest('/prequalify', {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
    });
  },
};

export const equipmentIntelligenceAPI = {
  async getIntelligence(payload, signal = undefined) {
    return apiRequest('/equipment/intelligence', {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
    });
  },
};

/**
 * One-Click Submission API
 */
export const oneClickAPI = {
  async submit(idFile, invoiceFile, token) {
    const formData = new FormData();
    if (idFile) {
      formData.append('id_image', idFile);
    }
    if (invoiceFile) {
      formData.append('invoice_image', invoiceFile);
    }

    return apiRequest('/loans/one-click-submit', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
  },
};

/**
 * Lookup API
 */
export const lookupAPI = {
  /**
   * Decode VIN
   */
  async decodeVin(vin) {
    return apiRequest(`/lookup/decode-vin/${vin}`);
  },

  /**
   * Decode serial number
   */
  async decodeSerial(serialNumber) {
    return apiRequest(`/lookup/decode-serial/${serialNumber}`);
  },

  /**
   * Search NAICS codes
   */
  async searchNaics(query) {
    return apiRequest(`/lookup/naics?keyword=${encodeURIComponent(query)}`);
  },
};

/**
 * Address API
 */
export const addressAPI = {
  /**
   * Validate address
   */
  async validateAddress(address) {
    return apiRequest('/address/validate', {
      method: 'POST',
      body: JSON.stringify(address),
    });
  },
  /**
   * Autocomplete address
   */
  async autocomplete(query) {
    return apiRequest(`/address/autocomplete?q=${encodeURIComponent(query)}`);
  },
};

/**
 * OCR API
 */
export const ocrAPI = {
  /**
   * Upload and process document
   */
  async processDocument(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    return apiRequest('/ocr/upload', {
      method: 'POST',
      headers: {
        // Don't set Content-Type for FormData, browser will set it with boundary
      },
      body: formData,
    });
  },
};

/**
 * Email API
 * @typedef {{to: string, subject: string, template: string, data: Record<string, any>}} SendEmailPayload
 * @typedef {{items: Array<any>, page: number, pageSize: number, total: number, totalPages: number}} EmailLogPage
 */
export const emailAPI = {
  /**
   * Send an email (enqueue)
   * @param {SendEmailPayload} payload
   */
  async sendEmail(payload) {
    const adminToken = (typeof window !== 'undefined' && window.localStorage)
      ? window.localStorage.getItem('admin_token')
      : null;
    return apiRequest('/email/send', {
      method: 'POST',
      headers: adminToken ? { 'X-Admin-Token': adminToken } : undefined,
      body: JSON.stringify(payload),
    });
  },

  /**
   * Get email logs (paginated)
   */
  async getEmailLogs({ page = 1, pageSize = 25 } = {}) {
    const adminToken = (typeof window !== 'undefined' && window.localStorage)
      ? window.localStorage.getItem('admin_token')
      : null;
    return apiRequest(`/email/logs?page=${page}&page_size=${pageSize}`, {
      headers: adminToken ? { 'X-Admin-Token': adminToken } : undefined,
    });
  },
};

/**
 * Notification API
 * @typedef {{channel: string, recipientId: string, title?: string, message: string, data?: Record<string, any>, phoneNumber?: string}} SendNotificationPayload
 */
export const notificationAPI = {
  /**
   * Send a notification (enqueue)
   * @param {SendNotificationPayload} payload
   */
  async sendNotification(payload) {
    return apiRequest('/notifications/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Get notification logs (paginated, admin only)
   */
  async getNotificationLogs({ page = 1, pageSize = 25 } = {}) {
    const adminToken = (typeof window !== 'undefined' && window.localStorage)
      ? window.localStorage.getItem('admin_token')
      : null;
    return apiRequest(`/notifications/logs?page=${page}&page_size=${pageSize}`, {
      headers: adminToken ? { 'X-Admin-Token': adminToken } : undefined,
    });
  },

  /**
   * Get notifications for a specific recipient
   */
  async getRecipientNotifications(recipientId, { page = 1, pageSize = 25 } = {}) {
    return apiRequest(`/notifications/recipient/${recipientId}?page=${page}&page_size=${pageSize}`);
  },
};

/**
 * Underwriting API
 * @typedef {{applicationId: string, lenderId: string, borrowerData: object, loanData: object, collateralData?: object}} CreateUnderwritingPayload
 * @typedef {{status: string, notes?: string, decision?: object}} UpdateStatusPayload
 */
export const underwritingAPI = {
  /**
   * Create an underwriting request
   * @param {CreateUnderwritingPayload} payload
   */
  async createRequest(payload) {
    return apiRequest('/underwriting/requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Get underwriting request by ID
   */
  async getById(requestId) {
    return apiRequest(`/underwriting/requests/${requestId}`);
  },

  /**
   * Get underwriting request by application ID
   */
  async getByApplicationId(applicationId) {
    return apiRequest(`/underwriting/by-application/${applicationId}`);
  },

  /**
   * Update underwriting status
   * @param {string} requestId
   * @param {UpdateStatusPayload} payload
   */
  async updateStatus(requestId, payload) {
    return apiRequest(`/underwriting/requests/${requestId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Add a note to underwriting request
   */
  async addNote(requestId, note, performedBy = null) {
    return apiRequest(`/underwriting/requests/${requestId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note, performedBy }),
    });
  },

  /**
   * Get all underwriting requests (paginated, admin only)
   */
  async getAllRequests({ page = 1, pageSize = 25 } = {}) {
    const adminToken = (typeof window !== 'undefined' && window.localStorage)
      ? window.localStorage.getItem('admin_token')
      : null;
    return apiRequest(`/underwriting/requests?page=${page}&page_size=${pageSize}`, {
      headers: adminToken ? { 'X-Admin-Token': adminToken } : undefined,
    });
  },

  /**
   * Get underwriting requests by lender
   */
  async getByLender(lenderId, { page = 1, pageSize = 25 } = {}) {
    return apiRequest(`/underwriting/by-lender/${lenderId}?page=${page}&page_size=${pageSize}`);
  },

  /**
   * Get underwriting requests by status
   */
  async getByStatus(status, { page = 1, pageSize = 25 } = {}) {
    return apiRequest(`/underwriting/by-status/${status}?page=${page}&page_size=${pageSize}`);
  },

  /**
   * Get activities for an underwriting request
   */
  async getActivities(requestId) {
    return apiRequest(`/underwriting/requests/${requestId}/activities`);
  },
};


// Export APIError for error handling
export { APIError };
export const API_BASE = API_BASE_URL;
