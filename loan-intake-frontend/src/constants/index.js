/**
 * Application constants
 */

// API Configuration
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
export const API_TIMEOUT = 30000; // 30 seconds

// Application Status
export const APPLICATION_STATUS = {
  IN_PROGRESS: 'in_progress',
  DRAFT: 'draft',
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  REVIEWING: 'reviewing',
  APPROVED: 'approved',
  FUNDED: 'funded',
  DENIED: 'denied',
};

// Application Status Labels
export const STATUS_LABELS = {
  [APPLICATION_STATUS.IN_PROGRESS]: 'In Progress',
  [APPLICATION_STATUS.DRAFT]: 'Draft',
  [APPLICATION_STATUS.PENDING]: 'Pending',
  [APPLICATION_STATUS.SUBMITTED]: 'Submitted',
  [APPLICATION_STATUS.REVIEWING]: 'Under Review',
  [APPLICATION_STATUS.APPROVED]: 'Approved',
  [APPLICATION_STATUS.FUNDED]: 'Funded',
  [APPLICATION_STATUS.DENIED]: 'Denied',
};

// Status Colors
export const STATUS_COLORS = {
  [APPLICATION_STATUS.IN_PROGRESS]: '#FF9800',
  [APPLICATION_STATUS.DRAFT]: '#9E9E9E',
  [APPLICATION_STATUS.PENDING]: '#FFC107',
  [APPLICATION_STATUS.SUBMITTED]: '#9C27B0',
  [APPLICATION_STATUS.REVIEWING]: '#2196F3',
  [APPLICATION_STATUS.APPROVED]: '#4CAF50',
  [APPLICATION_STATUS.FUNDED]: '#4CAF50',
  [APPLICATION_STATUS.DENIED]: '#F44336',
};

// US States
export const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

// Validation
export const VALIDATION = {
  SSN_PATTERN: /^\d{3}-?\d{2}-?\d{4}$/,
  PHONE_PATTERN: /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/,
  EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  ZIP_PATTERN: /^\d{5}(-\d{4})?$/,
  VIN_PATTERN: /^[A-HJ-NPR-Z0-9]{17}$/i,
};

// Date Formats
export const DATE_FORMATS = {
  DISPLAY: 'MMM D, YYYY',
  INPUT: 'YYYY-MM-DD',
  FULL: 'MMMM D, YYYY h:mm A',
};

// Currency
export const CURRENCY = {
  LOCALE: 'en-US',
  CURRENCY_CODE: 'USD',
  MIN_LOAN_AMOUNT: 1000,
  MAX_LOAN_AMOUNT: 10000000,
};

// Wizard Steps
export const WIZARD_STEPS = {
  BORROWER: 1,
  CO_BORROWER: 2,
  DEALER: 3,
  LOAN_REQUEST: 4,
  DOCUMENTS: 5,
  CONFIRMATION: 6,
};

export const WIZARD_STEP_TITLES = {
  [WIZARD_STEPS.BORROWER]: 'Borrower Information',
  [WIZARD_STEPS.CO_BORROWER]: 'Co-Borrower Information',
  [WIZARD_STEPS.DEALER]: 'Dealer Information',
  [WIZARD_STEPS.LOAN_REQUEST]: 'Loan Request',
  [WIZARD_STEPS.DOCUMENTS]: 'Documents & Consents',
  [WIZARD_STEPS.CONFIRMATION]: 'Review & Confirmation',
};
