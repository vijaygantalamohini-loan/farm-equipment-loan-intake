/**
 * Shared utilities for address handling across components
 */
import { API_BASE } from "../services/api";

/**
 * Auto-validate address with USPS API
 * Silently applies standardized address without interrupting user
 */
export const autoValidateAddress = async (address, setStateCallback) => {
  const { street, city, state, zip } = address;
  
  // Only validate if all required fields are filled
  if (!street || !city || !state || state.length !== 2) {
    return;
  }
  
  try {
    const url = API_BASE ? `${API_BASE}/address/validate` : `/address/validate`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ street, city, state, zip })
    });
    
    const data = await response.json();
    
    if (data.validated && data.suggested && data.changed) {
      // Auto-apply USPS standardized address
      setStateCallback({
        street: data.suggested.street,
        city: data.suggested.city,
        state: data.suggested.state,
        zip: data.suggested.zip
      });
    }
  } catch (err) {
    // Silent fail - don't interrupt user experience
    console.log("Address validation unavailable:", err);
  }
};

/**
 * Create address change handler for nested address state
 */
export const createAddressChangeHandler = (setParentState, addressKey = "address") => {
  return (field, value) => {
    setParentState(prev => ({
      ...prev,
      [addressKey]: { ...prev[addressKey], [field]: value }
    }));
  };
};

/**
 * Fetch address suggestions
 */
export const fetchAddressSuggestions = async (query) => {
  if (!query || query.length < 3) return [];
  try {
    const resp = await fetch(`/address/autocomplete?q=${encodeURIComponent(query)}`);
    const data = await resp.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.log("Address autocomplete unavailable:", err);
    return [];
  }
};
