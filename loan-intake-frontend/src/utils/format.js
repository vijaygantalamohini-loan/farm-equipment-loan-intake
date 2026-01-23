/**
 * Formatting utilities
 */

/**
 * Format currency
 */
export function formatCurrency(amount, options = {}) {
  const {
    locale = 'en-US',
    currency = 'USD',
    minimumFractionDigits = 0,
    maximumFractionDigits = 0,
  } = options;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(amount || 0);
}

/**
 * Format date
 */
export function formatDate(dateString, options = {}) {
  if (!dateString) return 'N/A';

  const {
    locale = 'en-US',
    dateStyle = 'medium',
  } = options;

  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(locale, { dateStyle }).format(date);
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
}

/**
 * Format date with time
 */
export function formatDateTime(dateString, options = {}) {
  if (!dateString) return 'N/A';

  const {
    locale = 'en-US',
    dateStyle = 'medium',
    timeStyle = 'short',
  } = options;

  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(locale, { dateStyle, timeStyle }).format(date);
  } catch (error) {
    console.error('Error formatting date/time:', error);
    return dateString;
  }
}

/**
 * Format phone number
 */
export function formatPhoneNumber(phone) {
  if (!phone) return '';

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // Format as (XXX) XXX-XXXX
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return phone;
}

/**
 * Format SSN (partially hidden)
 */
export function formatSSN(ssn, masked = true) {
  if (!ssn) return '';

  // Remove all non-digit characters
  const digits = ssn.replace(/\D/g, '');

  if (digits.length === 9) {
    if (masked) {
      return `***-**-${digits.slice(5)}`;
    }
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  }

  return ssn;
}

/**
 * Format zip code
 */
export function formatZipCode(zip) {
  if (!zip) return '';

  const digits = zip.replace(/\D/g, '');

  if (digits.length === 9) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }

  return digits.slice(0, 5);
}

/**
 * Format percentage
 */
export function formatPercentage(value, decimals = 2) {
  if (value === null || value === undefined) return 'N/A';
  return `${Number(value).toFixed(decimals)}%`;
}

/**
 * Format number with commas
 */
export function formatNumber(num, decimals = 0) {
  if (num === null || num === undefined) return 'N/A';
  return Number(num).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text, maxLength = 50) {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Format address to single line
 */
export function formatAddress(address) {
  if (!address) return '';

  const parts = [
    address.street,
    address.city,
    address.state,
    address.zip,
  ].filter(Boolean);

  return parts.join(', ');
}

/**
 * Format file size
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Capitalize first letter
 */
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert snake_case to Title Case
 */
export function snakeToTitle(str) {
  if (!str) return '';
  return str
    .split('_')
    .map(word => capitalize(word))
    .join(' ');
}
