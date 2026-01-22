import React, { createContext, useReducer, useContext, ReactNode } from 'react';

import { oneClickAPI } from '../../../../loan-intake-frontend/src/services/api';

// Types for Steps
export type StepId = 'ocr' | 'explainability' | 'fraud' | 'prequalification' | 'equipment' | 'review' | 'confirmation';

// Data types
export interface OCRField {
  name: string;
  value: string;
  confidence: number;
  flagged?: boolean;
}

export interface OCRData {
  fields: Record<string, OCRField>;
  rawText: string;
  documentType?: string;
}

export interface ExplanationItem {
  scores: Record<string, number>;
  textualExplanation: string;
  expanded: boolean;
}

export interface ExplanationData {
  fieldExplanations: Record<string, ExplanationItem>;
}

export interface FraudRule {
  id: string;
  description: string;
  triggered: boolean;
  severity: 'low' | 'medium' | 'high';
}

export interface FraudData {
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  triggeredRules: FraudRule[];
  acknowledged: boolean;
}

export interface PrequalAction {
  id: string;
  description: string;
  url?: string;
  required: boolean;
  status: 'pending' | 'completed' | 'failed';
}

export interface PrequalificationData {
  score: number;
  status: 'passed' | 'failed' | 'pending';
  requiredActions: PrequalAction[];
  retryAvailable: boolean;
}

export interface EquipmentIssue {
  id: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  resolved: boolean;
}

export interface EquipmentData {
  equipmentId: string;
  issues: EquipmentIssue[];
  recommendations: string[];
}

export interface OneClickSubmissionState {
  currentStep: StepId;
  stepStatus: Record<StepId, 'idle' | 'loading' | 'success' | 'error'>;
  errors: Record<StepId, string | null>;

  ocrData: OCRData | null;
  explanationData: ExplanationData | null;
  fraudData: FraudData | null;
  prequalData: PrequalificationData | null;
  equipmentData: EquipmentData | null;

  userOverrides: Record<string, { value: string; flagged: boolean }>;

  submissionPayload: Record<string, any>;

  isSubmitting: boolean;
  submissionError: string | null;
  submissionSuccess: boolean;
  submissionResult: any | null;
}

type Action =
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'GO_TO_STEP'; step: StepId }
  | { type: 'SET_STEP_STATUS'; step: StepId; status: 'idle' | 'loading' | 'success' | 'error' }
  | { type: 'SET_ERROR'; step: StepId; errorMessage: string | null }
  | { type: 'UPDATE_OCR_DATA'; data: OCRData }
  | { type: 'UPDATE_EXPLANATION_DATA'; data: ExplanationData }
  | { type: 'UPDATE_FRAUD_DATA'; data: FraudData }
  | { type: 'UPDATE_PREQUAL_DATA'; data: PrequalificationData }
  | { type: 'UPDATE_EQUIPMENT_DATA'; data: EquipmentData }
  | { type: 'UPDATE_SUBMISSION_PAYLOAD'; payload: Record<string, any> }
  | { type: 'OVERRIDE_FIELD'; fieldName: string; value: string; flagged: boolean }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS' }
  | { type: 'SUBMIT_ERROR'; errorMessage: string }
  | { type: 'SET_SUBMISSION_RESULT'; data: any | null };

const DEFAULT_STATE: OneClickSubmissionState = {
  currentStep: 'ocr',
  stepStatus: {
    ocr: 'idle',
    explainability: 'idle',
    fraud: 'idle',
    prequalification: 'idle',
    equipment: 'idle',
    review: 'idle',
    confirmation: 'idle',
  },
  errors: {
    ocr: null,
    explainability: null,
    fraud: null,
    prequalification: null,
    equipment: null,
    review: null,
    confirmation: null,
  },
  ocrData: null,
  explanationData: null,
  fraudData: null,
  prequalData: null,
  equipmentData: null,
  userOverrides: {},
  submissionPayload: {},
  isSubmitting: false,
  submissionError: null,
  submissionSuccess: false,
  submissionResult: null,
};

const CONFIDENCE_FALLBACK = 0;
const EXPLANATION_THRESHOLD = 0.7;

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return fallback;
};

const normalizeValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
};

const normalizeSeverity = (value: unknown): 'low' | 'medium' | 'high' => {
  if (value === 'low' || value === 'medium' || value === 'high') {
    return value;
  }
  return 'low';
};

const titleize = (value: string) => value
  .replace(/_/g, ' ')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/\b\w/g, (match) => match.toUpperCase());

const buildOcrField = (label: string, field: any): OCRField => ({
  name: label,
  value: normalizeValue(field?.value),
  confidence: toNumber(field?.confidence, CONFIDENCE_FALLBACK),
  flagged: Boolean(field?.needs_review),
});

const mapOcrFields = (ocrConfidence: any): Record<string, OCRField> => {
  const fields: Record<string, OCRField> = {};
  const idFields = ocrConfidence?.id || {};
  const invoiceFields = ocrConfidence?.invoice || {};

  const addField = (label: string, data: any) => {
    fields[label] = buildOcrField(label, data);
  };

  if (idFields.firstName) addField('ID First Name', idFields.firstName);
  if (idFields.lastName) addField('ID Last Name', idFields.lastName);
  if (idFields.dateOfBirth) addField('ID Date Of Birth', idFields.dateOfBirth);
  if (idFields.ssn) addField('ID SSN', idFields.ssn);
  if (idFields.address) {
    if (idFields.address.street) addField('ID Address Street', idFields.address.street);
    if (idFields.address.city) addField('ID Address City', idFields.address.city);
    if (idFields.address.state) addField('ID Address State', idFields.address.state);
    if (idFields.address.zip) addField('ID Address Zip', idFields.address.zip);
  }

  Object.entries(invoiceFields || {}).forEach(([key, value]) => {
    addField(`Invoice ${titleize(key)}`, value);
  });

  return fields;
};

const buildExplanationData = (fields: Record<string, OCRField>): ExplanationData => {
  const fieldExplanations: Record<string, ExplanationItem> = {};
  Object.values(fields).forEach((field) => {
    if (field.confidence >= EXPLANATION_THRESHOLD) {
      return;
    }
    fieldExplanations[field.name] = {
      scores: { confidence: field.confidence },
      textualExplanation: 'Low OCR confidence; manual review recommended.',
      expanded: false,
    };
  });
  return { fieldExplanations };
};

const buildFraudData = (flags: any[]): FraudData => {
  const normalizedFlags = Array.isArray(flags) ? flags : [];
  const severityScore = { low: 15, medium: 30, high: 50 };
  const riskScore = Math.min(
    100,
    normalizedFlags.reduce((sum, flag) => sum + severityScore[normalizeSeverity(flag?.severity)], 0)
  );
  const riskLevel: FraudData['riskLevel'] =
    riskScore >= 70 ? 'high' : riskScore >= 35 ? 'medium' : 'low';

  return {
    riskScore,
    riskLevel,
    triggeredRules: normalizedFlags.map((flag, index) => ({
      id: flag?.code || flag?.message || `flag-${index + 1}`,
      description: flag?.message || flag?.code || 'Flag triggered',
      triggered: true,
      severity: normalizeSeverity(flag?.severity),
    })),
    acknowledged: false,
  };
};

const buildPrequalData = (prequal: any): PrequalificationData => {
  const approvalProbability = toNumber(prequal?.approval_probability, Number.NaN);
  const hasProbability = Number.isFinite(approvalProbability);
  const score = hasProbability ? Math.round(approvalProbability * 100) : 0;
  const status: PrequalificationData['status'] = hasProbability
    ? (approvalProbability >= 0.6 ? 'passed' : 'failed')
    : 'pending';

  const reasons = Array.isArray(prequal?.reasons) ? prequal.reasons : [];
  const flags = Array.isArray(prequal?.flags) ? prequal.flags : [];
  const actionSource = reasons.length ? reasons : flags;
  const requiredActions = actionSource.map((item: any, index: number) => ({
    id: `action-${index + 1}`,
    description: typeof item === 'string' ? item : item?.message || `Action ${index + 1}`,
    required: false,
    status: 'pending' as const,
  }));

  return {
    score,
    status,
    requiredActions,
    retryAvailable: status !== 'passed',
  };
};

const buildEquipmentData = (equipment: any, intelligence: any): EquipmentData => {
  const fraudFlags = Array.isArray(intelligence?.fraud_flags) ? intelligence.fraud_flags : [];
  const issues = fraudFlags.map((flag: any, index: number) => {
    const severity = normalizeSeverity(flag?.severity);
    const mappedSeverity: EquipmentIssue['severity'] =
      severity === 'high' ? 'critical' : severity === 'medium' ? 'warning' : 'info';
    return {
      id: flag?.code || `issue-${index + 1}`,
      description: flag?.message || 'Potential issue detected',
      severity: mappedSeverity,
      resolved: false,
    };
  });

  const recommendations: string[] = [];
  if (intelligence?.valuation?.error) {
    recommendations.push('Valuation unavailable; confirm equipment details.');
  }
  if (toNumber(intelligence?.confidence_score, 1) < 0.5) {
    recommendations.push('Low valuation confidence; consider manual review.');
  }
  if (recommendations.length === 0) {
    recommendations.push('Review equipment details against the invoice.');
  }

  return {
    equipmentId: equipment?.serialNumber || equipment?.serial_number || equipment?.model || 'Unknown',
    issues,
    recommendations,
  };
};

function oneClickSubmissionReducer(state: OneClickSubmissionState, action: Action): OneClickSubmissionState {
  switch (action.type) {
    case 'NEXT_STEP': {
      const steps: StepId[] = ['ocr', 'explainability', 'fraud', 'prequalification', 'equipment', 'review', 'confirmation'];
      const currentIndex = steps.indexOf(state.currentStep);
      const nextIndex = Math.min(currentIndex + 1, steps.length - 1);
      return { ...state, currentStep: steps[nextIndex] };
    }
    case 'PREV_STEP': {
      const steps: StepId[] = ['ocr', 'explainability', 'fraud', 'prequalification', 'equipment', 'review', 'confirmation'];
      const currentIndex = steps.indexOf(state.currentStep);
      const prevIndex = Math.max(currentIndex - 1, 0);
      return { ...state, currentStep: steps[prevIndex] };
    }
    case 'GO_TO_STEP': {
      return { ...state, currentStep: action.step };
    }
    case 'SET_STEP_STATUS':
      return {
        ...state,
        stepStatus: { ...state.stepStatus, [action.step]: action.status },
      };
    case 'SET_ERROR':
      return {
        ...state,
        errors: { ...state.errors, [action.step]: action.errorMessage },
      };
    case 'UPDATE_OCR_DATA':
      return {
        ...state,
        ocrData: action.data,
      };
    case 'UPDATE_EXPLANATION_DATA':
      return {
        ...state,
        explanationData: action.data,
      };
    case 'UPDATE_FRAUD_DATA':
      return {
        ...state,
        fraudData: action.data,
      };
    case 'UPDATE_PREQUAL_DATA':
      return {
        ...state,
        prequalData: action.data,
      };
    case 'UPDATE_EQUIPMENT_DATA':
      return {
        ...state,
        equipmentData: action.data,
      };
    case 'UPDATE_SUBMISSION_PAYLOAD':
      return {
        ...state,
        submissionPayload: {
          ...state.submissionPayload,
          ...action.payload,
        },
      };
    case 'OVERRIDE_FIELD': {
      const { fieldName, value, flagged } = action;
      return {
        ...state,
        userOverrides: { ...state.userOverrides, [fieldName]: { value, flagged } },
      };
    }
    case 'SUBMIT_START':
      return { ...state, isSubmitting: true, submissionError: null, submissionSuccess: false, submissionResult: null };
    case 'SUBMIT_SUCCESS':
      return { ...state, isSubmitting: false, submissionSuccess: true };
    case 'SUBMIT_ERROR':
      return { ...state, isSubmitting: false, submissionError: action.errorMessage, submissionResult: null };
    case 'SET_SUBMISSION_RESULT':
      return { ...state, submissionResult: action.data };
    default:
      return state;
  }
}

interface ProviderProps {
  children: ReactNode;
  initialState?: Partial<OneClickSubmissionState>;
}

const OneClickSubmissionContext = createContext<{
  state: OneClickSubmissionState;
  dispatch: React.Dispatch<Action>;
  goNextStep: () => void;
  goPrevStep: () => void;
  goToStep: (step: StepId) => void;
  setStepStatus: (step: StepId, status: 'idle' | 'loading' | 'success' | 'error') => void;
  setError: (step: StepId, errorMessage: string | null) => void;
  updateOCRData: (data: OCRData) => void;
  updateExplanationData: (data: ExplanationData) => void;
  updateFraudData: (data: FraudData) => void;
  updatePrequalData: (data: PrequalificationData) => void;
  updateEquipmentData: (data: EquipmentData) => void;
  updateSubmissionPayload: (payload: Record<string, any>) => void;
  overrideField: (fieldName: string, value: string, flagged: boolean) => void;
  submit: () => Promise<any | null>;
} | undefined>(undefined);

export function useOneClickSubmission() {
  const context = useContext(OneClickSubmissionContext);
  if (!context) {
    throw new Error('useOneClickSubmission must be used within OneClickSubmissionProvider');
  }
  return context;
}

export function OneClickSubmissionProvider({ children, initialState: initialOverrides }: ProviderProps) {
  const mergedInitialState = { ...DEFAULT_STATE, ...(initialOverrides || {}) };
  const [state, dispatch] = useReducer(oneClickSubmissionReducer, mergedInitialState);

  const goNextStep = () => dispatch({ type: 'NEXT_STEP' });
  const goPrevStep = () => dispatch({ type: 'PREV_STEP' });
  const goToStep = (step: StepId) => dispatch({ type: 'GO_TO_STEP', step });
  const setStepStatus = (step: StepId, status: 'idle' | 'loading' | 'success' | 'error') => dispatch({ type: 'SET_STEP_STATUS', step, status });
  const setError = (step: StepId, errorMessage: string | null) => dispatch({ type: 'SET_ERROR', step, errorMessage });
  const updateOCRData = (data: OCRData) => dispatch({ type: 'UPDATE_OCR_DATA', data });
  const updateExplanationData = (data: ExplanationData) => dispatch({ type: 'UPDATE_EXPLANATION_DATA', data });
  const updateFraudData = (data: FraudData) => dispatch({ type: 'UPDATE_FRAUD_DATA', data });
  const updatePrequalData = (data: PrequalificationData) => dispatch({ type: 'UPDATE_PREQUAL_DATA', data });
  const updateEquipmentData = (data: EquipmentData) => dispatch({ type: 'UPDATE_EQUIPMENT_DATA', data });
  const updateSubmissionPayload = (payload: Record<string, any>) =>
    dispatch({ type: 'UPDATE_SUBMISSION_PAYLOAD', payload });
  const overrideField = (fieldName: string, value: string, flagged: boolean) => dispatch({ type: 'OVERRIDE_FIELD', fieldName, value, flagged });

  const submit = async () => {
    if (state.isSubmitting) {
      return false;
    }
    dispatch({ type: 'SUBMIT_START' });
    const loadingSteps: StepId[] = ['ocr', 'explainability', 'fraud', 'prequalification', 'equipment', 'review'];
    loadingSteps.forEach((step) => dispatch({ type: 'SET_STEP_STATUS', step, status: 'loading' }));
    try {
      const { idFile, invoiceFile, token } = state.submissionPayload || {};
      if (!idFile || !invoiceFile) {
        throw new Error('Upload both ID and invoice images.');
      }
      if (!token) {
        throw new Error('Missing auth token for one-click submission.');
      }
      const response = await oneClickAPI.submit(idFile, invoiceFile, token);
      const ocrFields = mapOcrFields(response?.ocr_confidence || {});
      const hasOcr = Object.keys(ocrFields).length > 0;
      const hasFraud = Array.isArray(response?.fraud_flags);
      const hasPrequal = Boolean(response?.ai_prequal);
      const hasEquipment = Boolean(response?.equipment || response?.equipment_intelligence);

      updateOCRData({ fields: ocrFields, rawText: '', documentType: 'one-click' });
      updateExplanationData(buildExplanationData(ocrFields));
      updateFraudData(buildFraudData(response?.fraud_flags || []));
      updatePrequalData(buildPrequalData(response?.ai_prequal || {}));
      updateEquipmentData(buildEquipmentData(response?.equipment || {}, response?.equipment_intelligence || {}));

      dispatch({ type: 'SET_SUBMISSION_RESULT', data: response });

      const nextStatuses: Record<Exclude<StepId, 'confirmation'>, 'idle' | 'loading' | 'success' | 'error'> = {
        ocr: hasOcr ? 'success' : 'error',
        explainability: hasOcr ? 'success' : 'idle',
        fraud: hasFraud ? 'success' : 'idle',
        prequalification: hasPrequal ? 'success' : 'idle',
        equipment: hasEquipment ? 'success' : 'idle',
        review: hasOcr ? 'success' : 'idle',
      };

      const nextErrors: Record<StepId, string | null> = {
        ocr: hasOcr ? null : 'OCR extraction returned no fields.',
        explainability: hasOcr ? null : 'Explainability requires OCR results.',
        fraud: hasFraud ? null : 'Fraud signals are unavailable right now.',
        prequalification: hasPrequal ? null : 'Prequalification data is unavailable.',
        equipment: hasEquipment ? null : 'Equipment intelligence is unavailable.',
        review: hasOcr ? null : 'Review is unavailable without OCR results.',
        confirmation: null,
      };

      Object.entries(nextStatuses).forEach(([step, status]) => {
        dispatch({ type: 'SET_STEP_STATUS', step: step as StepId, status });
      });
      Object.entries(nextErrors).forEach(([step, errorMessage]) => {
        dispatch({ type: 'SET_ERROR', step: step as StepId, errorMessage });
      });

      dispatch({ type: 'SUBMIT_SUCCESS' });
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      dispatch({ type: 'SUBMIT_ERROR', errorMessage: message });
      dispatch({ type: 'SET_STEP_STATUS', step: state.currentStep, status: 'error' });
      dispatch({ type: 'SET_ERROR', step: state.currentStep, errorMessage: message });
      return null;
    }
  };

  if (!state) {
    throw new Error('OneClickSubmissionProvider must wrap component tree');
  }

  return (
    <OneClickSubmissionContext.Provider value={{
      state,
      dispatch,
      goNextStep,
      goPrevStep,
      goToStep,
      setStepStatus,
      setError,
      updateOCRData,
      updateExplanationData,
      updateFraudData,
      updatePrequalData,
      updateEquipmentData,
      updateSubmissionPayload,
      overrideField,
      submit,
    }}>
      {children}
    </OneClickSubmissionContext.Provider>
  );
}
