import React, { createContext, useReducer, useContext, ReactNode } from 'react';

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
}

type Action =
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'SET_STEP_STATUS'; step: StepId; status: 'idle' | 'loading' | 'success' | 'error' }
  | { type: 'SET_ERROR'; step: StepId; errorMessage: string | null }
  | { type: 'UPDATE_OCR_DATA'; data: OCRData }
  | { type: 'UPDATE_EXPLANATION_DATA'; data: ExplanationData }
  | { type: 'UPDATE_FRAUD_DATA'; data: FraudData }
  | { type: 'UPDATE_PREQUAL_DATA'; data: PrequalificationData }
  | { type: 'UPDATE_EQUIPMENT_DATA'; data: EquipmentData }
  | { type: 'OVERRIDE_FIELD'; fieldName: string; value: string; flagged: boolean }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS' }
  | { type: 'SUBMIT_ERROR'; errorMessage: string };

const initialState: OneClickSubmissionState = {
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
    case 'OVERRIDE_FIELD': {
      const { fieldName, value, flagged } = action;
      return {
        ...state,
        userOverrides: { ...state.userOverrides, [fieldName]: { value, flagged } },
      };
    }
    case 'SUBMIT_START':
      return { ...state, isSubmitting: true, submissionError: null, submissionSuccess: false };
    case 'SUBMIT_SUCCESS':
      return { ...state, isSubmitting: false, submissionSuccess: true };
    case 'SUBMIT_ERROR':
      return { ...state, isSubmitting: false, submissionError: action.errorMessage };
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
  setStepStatus: (step: StepId, status: 'idle' | 'loading' | 'success' | 'error') => void;
  setError: (step: StepId, errorMessage: string | null) => void;
  updateOCRData: (data: OCRData) => void;
  updateExplanationData: (data: ExplanationData) => void;
  updateFraudData: (data: FraudData) => void;
  updatePrequalData: (data: PrequalificationData) => void;
  updateEquipmentData: (data: EquipmentData) => void;
  overrideField: (fieldName: string, value: string, flagged: boolean) => void;
  submit: () => Promise<void>;
} | undefined>(undefined);

export function useOneClickSubmission() {
  const context = useContext(OneClickSubmissionContext);
  if (!context) {
    throw new Error('useOneClickSubmission must be used within OneClickSubmissionProvider');
  }
  return context;
}

export function OneClickSubmissionProvider({ children, initialState }: ProviderProps) {
  const [state, dispatch] = useReducer(oneClickSubmissionReducer, { ...initialState, ...initialState, ...initialState });

  const goNextStep = () => dispatch({ type: 'NEXT_STEP' });
  const goPrevStep = () => dispatch({ type: 'PREV_STEP' });
  const setStepStatus = (step: StepId, status: 'idle' | 'loading' | 'success' | 'error') => dispatch({ type: 'SET_STEP_STATUS', step, status });
  const setError = (step: StepId, errorMessage: string | null) => dispatch({ type: 'SET_ERROR', step, errorMessage });
  const updateOCRData = (data: OCRData) => dispatch({ type: 'UPDATE_OCR_DATA', data });
  const updateExplanationData = (data: ExplanationData) => dispatch({ type: 'UPDATE_EXPLANATION_DATA', data });
  const updateFraudData = (data: FraudData) => dispatch({ type: 'UPDATE_FRAUD_DATA', data });
  const updatePrequalData = (data: PrequalificationData) => dispatch({ type: 'UPDATE_PREQUAL_DATA', data });
  const updateEquipmentData = (data: EquipmentData) => dispatch({ type: 'UPDATE_EQUIPMENT_DATA', data });
  const overrideField = (fieldName: string, value: string, flagged: boolean) => dispatch({ type: 'OVERRIDE_FIELD', fieldName, value, flagged });

  const submit = async () => {
    dispatch({ type: 'SUBMIT_START' });
    try {
      // Connect to backend submission API here
      dispatch({ type: 'SUBMIT_SUCCESS' });
    } catch (error) {
      dispatch({ type: 'SUBMIT_ERROR', errorMessage: error instanceof Error ? error.message : 'Unknown error' });
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
      setStepStatus,
      setError,
      updateOCRData,
      updateExplanationData,
      updateFraudData,
      updatePrequalData,
      updateEquipmentData,
      overrideField,
      submit,
    }}>
      {children}
    </OneClickSubmissionContext.Provider>
  );
}
