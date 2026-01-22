import { createContext, useReducer, useContext } from "react";

import { oneClickAPI } from "../../../services/api";

const STEP_ORDER = [
  "ocr",
  "explainability",
  "fraud",
  "prequalification",
  "equipment",
  "review",
  "confirmation",
];
const LOADING_STEPS = STEP_ORDER.slice(0, STEP_ORDER.length - 1);

const DEFAULT_STATE = {
  currentStep: "ocr",
  stepStatus: {
    ocr: "idle",
    explainability: "idle",
    fraud: "idle",
    prequalification: "idle",
    equipment: "idle",
    review: "idle",
    confirmation: "idle",
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

const toNumber = (value, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return fallback;
};

const normalizeValue = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
};

const normalizeSeverity = (value) => {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  return "low";
};

const titleize = (value) =>
  value
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (match) => match.toUpperCase());

const buildOcrField = (label, field) => ({
  name: label,
  value: normalizeValue(field?.value),
  confidence: toNumber(field?.confidence, CONFIDENCE_FALLBACK),
  flagged: Boolean(field?.needs_review),
});

const mapOcrFields = (ocrConfidence) => {
  const fields = {};
  const idFields = ocrConfidence?.id || {};
  const invoiceFields = ocrConfidence?.invoice || {};

  const addField = (label, data) => {
    fields[label] = buildOcrField(label, data);
  };

  if (idFields.firstName) addField("ID First Name", idFields.firstName);
  if (idFields.lastName) addField("ID Last Name", idFields.lastName);
  if (idFields.dateOfBirth) addField("ID Date Of Birth", idFields.dateOfBirth);
  if (idFields.ssn) addField("ID SSN", idFields.ssn);
  if (idFields.address) {
    if (idFields.address.street) addField("ID Address Street", idFields.address.street);
    if (idFields.address.city) addField("ID Address City", idFields.address.city);
    if (idFields.address.state) addField("ID Address State", idFields.address.state);
    if (idFields.address.zip) addField("ID Address Zip", idFields.address.zip);
  }

  Object.entries(invoiceFields || {}).forEach(([key, value]) => {
    addField(`Invoice ${titleize(key)}`, value);
  });

  return fields;
};

const buildExplanationData = (fields) => {
  const fieldExplanations = {};
  Object.values(fields).forEach((field) => {
    if (field.confidence >= EXPLANATION_THRESHOLD) {
      return;
    }
    fieldExplanations[field.name] = {
      scores: { confidence: field.confidence },
      textualExplanation: "Low OCR confidence; manual review recommended.",
      expanded: false,
    };
  });
  return { fieldExplanations };
};

const buildFraudData = (flags) => {
  const normalizedFlags = Array.isArray(flags) ? flags : [];
  const severityScore = { low: 15, medium: 30, high: 50 };
  const riskScore = Math.min(
    100,
    normalizedFlags.reduce(
      (sum, flag) => sum + severityScore[normalizeSeverity(flag?.severity)],
      0
    )
  );
  const riskLevel = riskScore >= 70 ? "high" : riskScore >= 35 ? "medium" : "low";

  return {
    riskScore,
    riskLevel,
    triggeredRules: normalizedFlags.map((flag, index) => ({
      id: flag?.code || flag?.message || `flag-${index + 1}`,
      description: flag?.message || flag?.code || "Flag triggered",
      triggered: true,
      severity: normalizeSeverity(flag?.severity),
    })),
    acknowledged: false,
  };
};

const buildPrequalData = (prequal) => {
  const approvalProbability = toNumber(prequal?.approval_probability, Number.NaN);
  const hasProbability = Number.isFinite(approvalProbability);
  const score = hasProbability ? Math.round(approvalProbability * 100) : 0;
  const status = hasProbability
    ? approvalProbability >= 0.6
      ? "passed"
      : "failed"
    : "pending";

  const reasons = Array.isArray(prequal?.reasons) ? prequal.reasons : [];
  const flags = Array.isArray(prequal?.flags) ? prequal.flags : [];
  const actionSource = reasons.length ? reasons : flags;
  const requiredActions = actionSource.map((item, index) => ({
    id: `action-${index + 1}`,
    description: typeof item === "string" ? item : item?.message || `Action ${index + 1}`,
    required: false,
    status: "pending",
  }));

  return {
    score,
    status,
    requiredActions,
    retryAvailable: status !== "passed",
  };
};

const buildEquipmentData = (equipment, intelligence) => {
  const fraudFlags = Array.isArray(intelligence?.fraud_flags)
    ? intelligence.fraud_flags
    : [];
  const issues = fraudFlags.map((flag, index) => {
    const severity = normalizeSeverity(flag?.severity);
    const mappedSeverity =
      severity === "high" ? "critical" : severity === "medium" ? "warning" : "info";
    return {
      id: flag?.code || `issue-${index + 1}`,
      description: flag?.message || "Potential issue detected",
      severity: mappedSeverity,
      resolved: false,
    };
  });

  const recommendations = [];
  if (intelligence?.valuation?.error) {
    recommendations.push("Valuation unavailable; confirm equipment details.");
  }
  if (toNumber(intelligence?.confidence_score, 1) < 0.5) {
    recommendations.push("Low valuation confidence; consider manual review.");
  }
  if (recommendations.length === 0) {
    recommendations.push("Review equipment details against the invoice.");
  }

  return {
    equipmentId:
      equipment?.serialNumber || equipment?.serial_number || equipment?.model || "Unknown",
    issues,
    recommendations,
  };
};

function oneClickSubmissionReducer(state, action) {
  switch (action.type) {
    case "NEXT_STEP": {
      const currentIndex = STEP_ORDER.indexOf(state.currentStep);
      const nextIndex = Math.min(currentIndex + 1, STEP_ORDER.length - 1);
      return { ...state, currentStep: STEP_ORDER[nextIndex] };
    }
    case "PREV_STEP": {
      const currentIndex = STEP_ORDER.indexOf(state.currentStep);
      const prevIndex = Math.max(currentIndex - 1, 0);
      return { ...state, currentStep: STEP_ORDER[prevIndex] };
    }
    case "GO_TO_STEP": {
      return { ...state, currentStep: action.step };
    }
    case "SET_STEP_STATUS":
      return {
        ...state,
        stepStatus: { ...state.stepStatus, [action.step]: action.status },
      };
    case "SET_ERROR":
      return {
        ...state,
        errors: { ...state.errors, [action.step]: action.errorMessage },
      };
    case "UPDATE_OCR_DATA":
      return {
        ...state,
        ocrData: action.data,
      };
    case "UPDATE_EXPLANATION_DATA":
      return {
        ...state,
        explanationData: action.data,
      };
    case "UPDATE_FRAUD_DATA":
      return {
        ...state,
        fraudData: action.data,
      };
    case "UPDATE_PREQUAL_DATA":
      return {
        ...state,
        prequalData: action.data,
      };
    case "UPDATE_EQUIPMENT_DATA":
      return {
        ...state,
        equipmentData: action.data,
      };
    case "UPDATE_SUBMISSION_PAYLOAD":
      return {
        ...state,
        submissionPayload: {
          ...state.submissionPayload,
          ...action.payload,
        },
      };
    case "OVERRIDE_FIELD": {
      const { fieldName, value, flagged } = action;
      return {
        ...state,
        userOverrides: { ...state.userOverrides, [fieldName]: { value, flagged } },
      };
    }
    case "SUBMIT_START":
      return { ...state, isSubmitting: true, submissionError: null, submissionSuccess: false, submissionResult: null };
    case "SUBMIT_SUCCESS":
      return { ...state, isSubmitting: false, submissionSuccess: true };
    case "SUBMIT_ERROR":
      return { ...state, isSubmitting: false, submissionError: action.errorMessage, submissionResult: null };
    case "SET_SUBMISSION_RESULT":
      return { ...state, submissionResult: action.data };
    default:
      return state;
  }
}

const OneClickSubmissionContext = createContext(undefined);

export function useOneClickSubmission() {
  const context = useContext(OneClickSubmissionContext);
  if (!context) {
    throw new Error("useOneClickSubmission must be used within OneClickSubmissionProvider");
  }
  return context;
}

export function OneClickSubmissionProvider({ children, initialState: initialOverrides }) {
  const mergedInitialState = { ...DEFAULT_STATE, ...(initialOverrides || {}) };
  const [state, dispatch] = useReducer(oneClickSubmissionReducer, mergedInitialState);

  const goNextStep = () => dispatch({ type: "NEXT_STEP" });
  const goPrevStep = () => dispatch({ type: "PREV_STEP" });
  const goToStep = (step) => dispatch({ type: "GO_TO_STEP", step });
  const setStepStatus = (step, status) =>
    dispatch({ type: "SET_STEP_STATUS", step, status });
  const setError = (step, errorMessage) =>
    dispatch({ type: "SET_ERROR", step, errorMessage });
  const updateOCRData = (data) => dispatch({ type: "UPDATE_OCR_DATA", data });
  const updateExplanationData = (data) =>
    dispatch({ type: "UPDATE_EXPLANATION_DATA", data });
  const updateFraudData = (data) => dispatch({ type: "UPDATE_FRAUD_DATA", data });
  const updatePrequalData = (data) => dispatch({ type: "UPDATE_PREQUAL_DATA", data });
  const updateEquipmentData = (data) =>
    dispatch({ type: "UPDATE_EQUIPMENT_DATA", data });
  const updateSubmissionPayload = (payload) =>
    dispatch({ type: "UPDATE_SUBMISSION_PAYLOAD", payload });
  const overrideField = (fieldName, value, flagged) =>
    dispatch({ type: "OVERRIDE_FIELD", fieldName, value, flagged });

  const submit = async () => {
    if (state.isSubmitting) {
      return null;
    }
    dispatch({ type: "SUBMIT_START" });
    LOADING_STEPS.forEach((step) =>
      dispatch({ type: "SET_STEP_STATUS", step, status: "loading" })
    );
    try {
      const { idFile, invoiceFile, token } = state.submissionPayload || {};
      if (!idFile || !invoiceFile) {
        throw new Error("Upload both ID and invoice images.");
      }
      if (!token) {
        throw new Error("Missing auth token for one-click submission.");
      }
      const response = await oneClickAPI.submit(idFile, invoiceFile, token);
      const ocrFields = mapOcrFields(response?.ocr_confidence || {});
      const hasOcr = Object.keys(ocrFields).length > 0;
      const hasFraud = Array.isArray(response?.fraud_flags);
      const hasPrequal = Boolean(response?.ai_prequal);
      const hasEquipment = Boolean(response?.equipment || response?.equipment_intelligence);

      updateOCRData({ fields: ocrFields, rawText: "", documentType: "one-click" });
      updateExplanationData(buildExplanationData(ocrFields));
      updateFraudData(buildFraudData(response?.fraud_flags || []));
      updatePrequalData(buildPrequalData(response?.ai_prequal || {}));
      updateEquipmentData(
        buildEquipmentData(response?.equipment || {}, response?.equipment_intelligence || {})
      );

      dispatch({ type: "SET_SUBMISSION_RESULT", data: response });

      const nextStatuses = {
        ocr: hasOcr ? "success" : "error",
        explainability: hasOcr ? "success" : "idle",
        fraud: hasFraud ? "success" : "idle",
        prequalification: hasPrequal ? "success" : "idle",
        equipment: hasEquipment ? "success" : "idle",
        review: hasOcr ? "success" : "idle",
      };

      const nextErrors = {
        ocr: hasOcr ? null : "OCR extraction returned no fields.",
        explainability: hasOcr ? null : "Explainability requires OCR results.",
        fraud: hasFraud ? null : "Fraud signals are unavailable right now.",
        prequalification: hasPrequal ? null : "Prequalification data is unavailable.",
        equipment: hasEquipment ? null : "Equipment intelligence is unavailable.",
        review: hasOcr ? null : "Review is unavailable without OCR results.",
        confirmation: null,
      };

      Object.entries(nextStatuses).forEach(([step, status]) => {
        dispatch({ type: "SET_STEP_STATUS", step, status });
      });
      Object.entries(nextErrors).forEach(([step, errorMessage]) => {
        dispatch({ type: "SET_ERROR", step, errorMessage });
      });
      dispatch({ type: "SUBMIT_SUCCESS" });
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      dispatch({ type: "SUBMIT_ERROR", errorMessage: message });
      LOADING_STEPS.forEach((step) => {
        dispatch({
          type: "SET_STEP_STATUS",
          step,
          status: step === state.currentStep ? "error" : "idle",
        });
      });
      dispatch({ type: "SET_ERROR", step: state.currentStep, errorMessage: message });
      return null;
    }
  };

  if (!state) {
    throw new Error("OneClickSubmissionProvider must wrap component tree");
  }

  return (
    <OneClickSubmissionContext.Provider
      value={{
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
      }}
    >
      {children}
    </OneClickSubmissionContext.Provider>
  );
}
