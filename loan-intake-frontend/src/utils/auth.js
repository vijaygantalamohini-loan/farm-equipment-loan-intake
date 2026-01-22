/**
 * Authentication utilities
 */

const AUTH_TOKEN_KEY = 'auth_token';
const USER_DATA_KEY = 'user';

export const authStorage = {
  /**
   * Save authentication data to localStorage
   */
  saveAuth(token, user) {
    try {
      console.log('🔐 SAVING AUTH TOKEN');
      console.log('Token (first 50 chars):', token.substring(0, 50) + '...');
      console.log('Token length:', token.length);
      console.log('User:', user);
      
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      localStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
      
      console.log('✅ Token saved successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to save auth data:', error);
      return false;
    }
  },

  /**
   * Load authentication data from localStorage
   */
  loadAuth() {
    try {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      const userJson = localStorage.getItem(USER_DATA_KEY);
      
      if (token && userJson) {
        console.log('🔐 LOADED AUTH TOKEN');
        console.log('Token (first 50 chars):', token.substring(0, 50) + '...');
        console.log('Token length:', token.length);
        
        return {
          token,
          user: JSON.parse(userJson),
        };
      }
      
      console.log('⚠️ No auth token found in localStorage');
      return null;
    } catch (error) {
      console.error('❌ Failed to load auth data:', error);
      return null;
    }
  },

  /**
   * Clear authentication data from localStorage
   */
  clearAuth() {
    try {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(USER_DATA_KEY);
      return true;
    } catch (error) {
      console.error('Failed to clear auth data:', error);
      return false;
    }
  },

  /**
   * Get token from URL parameters (OAuth callback)
   */
  getAuthFromUrl() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      const userDataEncoded = urlParams.get('user');

      if (token && userDataEncoded) {
        const user = JSON.parse(decodeURIComponent(userDataEncoded));
        return { token, user };
      }
      
      return null;
    } catch (error) {
      console.error('Failed to parse auth from URL:', error);
      return null;
    }
  },

  /**
   * Clean up URL parameters after successful auth
   */
  cleanUrlParams() {
    try {
      window.history.replaceState({}, document.title, '/');
      return true;
    } catch (error) {
      console.error('Failed to clean URL params:', error);
      return false;
    }
  },
};

/**
 * Format user display name
 */
export function getUserDisplayName(user) {
  if (!user) return 'User';
  return user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'User';
}

/**
 * Check if token appears to be expired (simple check)
 */
export function isTokenLikelyExpired(token) {
  if (!token) return true;
  
  try {
    // JWT tokens have 3 parts separated by dots
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    // Decode the payload (2nd part)
    const payload = JSON.parse(atob(parts[1]));
    
    // Check expiration time (exp claim)
    if (payload.exp) {
      const expirationTime = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      return now >= expirationTime;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking token expiration:', error);
    return false;
  }
}

/**
 * Convenience: get current token from storage
 */
export function getStoredToken() {
  const auth = authStorage.loadAuth();
  return auth?.token || null;
}

/**
 * Convenience: get a valid (non-expired) token if available
 */
export function getValidToken() {
  const token = getStoredToken();
  if (!token) return null;
  if (isTokenLikelyExpired(token)) return null;
  return token;
}

/**
 * Redirect to backend login via proxy
 */
export function redirectToLogin() {
  try {
    window.location.assign('/auth/login');
  } catch (e) {
    // no-op
  }
}
