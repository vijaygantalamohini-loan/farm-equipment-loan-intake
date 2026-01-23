import React, { useEffect, useMemo, useState } from "react";

import { useOneClickSubmission } from "./hooks/OneClickSubmissionContext";
import ProgressStepper from "./ProgressStepper";
import OCRResultPanel from "./OCRResultPanel";
import ExplainabilityPanel from "./ExplainabilityPanel";
import FraudSignalPanel from "./FraudSignalPanel";
import PrequalificationPanel from "./PrequalificationPanel";
import EquipmentIntelligencePanel from "./EquipmentIntelligencePanel";
import DataReviewPanel from "./DataReviewPanel";
import ErrorNotification from "./ErrorNotification";
import ConfirmSubmissionPanel from "./ConfirmSubmissionPanel";
import SubmissionSummary from "./SubmissionSummary";

/* -------------------- CONSTANTS (UNCHANGED) -------------------- */

const DEFAULT_STEPS = [
  { id: "ocr", label: "OCR Review" },
  { id: "explainability", label: "Explainability" },
  { id: "fraud", label: "Fraud Signals" },
  { id: "prequalification", label: "Prequalification" },
  { id: "equipment", label: "Equipment Intelligence" },
  { id: "review", label: "Review" },
  { id: "confirmation", label: "Confirmation" },
];

/* -------------------- COMPONENT -------------------- */

function OneClickSubmissionWizard({ initialData, onSubmit, onCancel, config }) {
  const {
    state,
    goNextStep,
    goPrevStep,
    goToStep,
    submit,
    overrideField,
    updateSubmissionPayload,
    updateFraudData,
    updateEquipmentData,
  } = useOneClickSubmission();

  const submissionResult = state.submissionResult;
  const submissionDetails = submissionResult?.submission;
  const submissionData = submissionDetails?.data || submissionDetails;
  const submissionApplicationNumber = submissionData?.application_number;

  const [idFileName, setIdFileName] = useState("");
  const [invoiceFileName, setInvoiceFileName] = useState("");
  const [expandedExplanations, setExpandedExplanations] = useState({});

  const steps = useMemo(
    () => (config?.steps?.length ? config.steps : DEFAULT_STEPS),
    [config]
  );

  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      updateSubmissionPayload(initialData);
    }
  }, [initialData, updateSubmissionPayload]);

  const currentStepIndex = Math.max(
    0,
    steps.findIndex((s) => s.id === state.currentStep)
  );

  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;
  const confidenceThreshold = config?.confidenceThreshold ?? 0.7;

  const stepStatus = state.stepStatus[currentStep.id];
  const stepError = state.errors[currentStep.id];
  const currentError = stepError || state.submissionError;

  const isOcrStep = currentStep.id === "ocr";
  const hasRequiredFiles = Boolean(
    state.submissionPayload?.idFile && state.submissionPayload?.invoiceFile
  );

  /* -------------------- HANDLERS (UNCHANGED) -------------------- */

  const handleSubmit = async () => {
    let result = state.submissionResult;
    if (!state.submissionSuccess || !result) {
      result = await submit();
      if (!result) return;
    }
    if (onSubmit) return onSubmit(result);
    if (onCancel) onCancel();
  };

  const handleNext = async () => {
    if (isOcrStep) {
      const result = await submit();
      if (!result) return;
    }
    goNextStep();
  };

  const handleFileChange = (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    updateSubmissionPayload({ [field]: file });
    field === "idFile" ? setIdFileName(file.name) : setInvoiceFileName(file.name);
  };

  /* -------------------- DATA -------------------- */

  const ocrFields = useMemo(() => {
    if (!state.ocrData?.fields) return [];
    return Object.values(state.ocrData.fields).map((field) => {
      const override = state.userOverrides[field.name];
      return {
        ...field,
        value: override?.value ?? field.value,
        flagged: override?.flagged ?? field.flagged,
      };
    });
  }, [state.ocrData, state.userOverrides]);

  const lowConfidenceFields = useMemo(
    () => ocrFields.filter((f) => f.confidence < confidenceThreshold),
    [ocrFields, confidenceThreshold]
  );

  const summaryItems = [
    { label: "OCR Fields", value: ocrFields.length || "N/A" },
    { label: "Low Confidence", value: lowConfidenceFields.length || "N/A" },
    { label: "Fraud Risk", value: state.fraudData?.riskLevel || "N/A" },
    { label: "Prequal Score", value: state.prequalData?.score ?? "N/A" },
    { label: "Equipment Issues", value: state.equipmentData?.issues?.length ?? "N/A" },
  ];

  if (submissionApplicationNumber) {
    summaryItems.push({
      label: "Application Number",
      value: submissionApplicationNumber,
    });
  }

  /* -------------------- RENDER -------------------- */

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.title}>One-Click Submission</h1>
        <p style={styles.subtitle}>
          Review AI-extracted data and risk signals before submitting.
        </p>
        <ProgressStepper
          steps={steps}
          currentStep={currentStep.id}
          stepStatus={state.stepStatus}
          onStepClick={(id) => !state.isSubmitting && goToStep(id)}
        />
      </header>

      {currentError && (
        <div style={{ marginBottom: 16 }}>
          <ErrorNotification message={currentError} />
        </div>
      )}

      {/* Content */}
      <section style={styles.panel}>
        {currentStep.id === "ocr" && (
          <div style={styles.stack}>
            <div style={styles.uploadGrid}>
              <UploadField
                label="Government ID"
                fileName={idFileName}
                onChange={(e) => handleFileChange(e, "idFile")}
              />
              <UploadField
                label="Invoice"
                fileName={invoiceFileName}
                onChange={(e) => handleFileChange(e, "invoiceFile")}
              />
            </div>

            <OCRResultPanel
              fields={ocrFields}
              confidenceThreshold={confidenceThreshold}
              onFieldEdit={(f, v) => overrideField(f, v)}
              onFlagToggle={(f, flagged) =>
                overrideField(
                  f,
                  state.ocrData?.fields[f]?.value ?? "",
                  flagged
                )
              }
              onRetry={submit}
              loading={stepStatus === "loading"}
              error={stepError || undefined}
            />

            {lowConfidenceFields.length > 0 && (
              <DataReviewPanel
                fields={lowConfidenceFields}
                onSave={(f, v) => overrideField(f, v)}
              />
            )}
          </div>
        )}

        {currentStep.id === "explainability" && (
          <ExplainabilityPanel
            explanations={state.explanationData?.fieldExplanations || {}}
            onToggleExpand={(f) =>
              setExpandedExplanations((p) => ({ ...p, [f]: !p[f] }))
            }
            onRetry={submit}
            loading={stepStatus === "loading"}
            error={stepError || undefined}
          />
        )}

        {currentStep.id === "fraud" && (
          <FraudSignalPanel
            riskScore={state.fraudData?.riskScore ?? 0}
            riskLevel={state.fraudData?.riskLevel ?? "low"}
            triggeredRules={state.fraudData?.triggeredRules ?? []}
            onAcknowledge={() =>
              updateFraudData({ ...state.fraudData, acknowledged: true })
            }
            onRequestReview={() =>
              updateFraudData({ ...state.fraudData, acknowledged: true })
            }
            onRetry={submit}
            loading={stepStatus === "loading"}
            error={stepError || undefined}
          />
        )}

        {currentStep.id === "prequalification" && (
          <PrequalificationPanel
            score={state.prequalData?.score ?? 0}
            status={state.prequalData?.status ?? "pending"}
            actions={state.prequalData?.requiredActions ?? []}
            onRetry={state.prequalData?.retryAvailable ? submit : undefined}
            loading={stepStatus === "loading"}
            error={stepError || undefined}
          />
        )}

        {currentStep.id === "equipment" && (
          <EquipmentIntelligencePanel
            equipmentId={state.equipmentData?.equipmentId ?? "N/A"}
            issues={state.equipmentData?.issues ?? []}
            recommendations={state.equipmentData?.recommendations ?? []}
            onIssueResolve={(id) =>
              updateEquipmentData({
                ...state.equipmentData,
                issues: state.equipmentData.issues.map((i) =>
                  i.id === id ? { ...i, resolved: true } : i
                ),
              })
            }
            onRetry={submit}
            loading={stepStatus === "loading"}
            error={stepError || undefined}
          />
        )}

        {currentStep.id === "review" && (
          <SubmissionSummary
            items={summaryItems}
            helperText="Review key signals before confirming."
          />
        )}

        {currentStep.id === "confirmation" && (
          <ConfirmSubmissionPanel
            summaryItems={summaryItems}
            onConfirm={handleSubmit}
            onBack={goPrevStep}
            loading={state.isSubmitting}
            error={state.submissionError || undefined}
            submissionNumber={submissionApplicationNumber}
            buttonLabel={submissionApplicationNumber ? "Finish" : undefined}
          />
        )}
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <button
          style={styles.secondaryBtn}
          onClick={goPrevStep}
          disabled={currentStepIndex === 0 || state.isSubmitting}
        >
          Back
        </button>

        {!isLastStep && (
          <button
            style={styles.primaryBtn}
            onClick={handleNext}
            disabled={state.isSubmitting || (isOcrStep && !hasRequiredFiles)}
          >
            Next
          </button>
        )}

        {onCancel && (
          <button style={styles.ghostBtn} onClick={onCancel}>
            Cancel
          </button>
        )}
      </footer>
    </div>
  );
}

/* -------------------- SMALL COMPONENTS -------------------- */

function UploadField({ label, fileName, onChange }) {
  return (
    <div>
      <label style={styles.label}>{label}</label>
      <input type="file" onChange={onChange} />
      {fileName && <div style={styles.muted}>Selected: {fileName}</div>}
    </div>
  );
}

/* -------------------- STYLES -------------------- */

const styles = {
  page: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "32px 24px",
  },
  header: { marginBottom: 24 },
  title: { margin: 0, fontSize: 26 },
  subtitle: { marginTop: 6, color: "#666" },

  panel: {
    border: "1px solid #e5e5e5",
    borderRadius: 16,
    padding: 24,
    background: "#fff",
  },

  stack: { display: "grid", gap: 20 },
  uploadGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 },

  footer: {
    marginTop: 24,
    display: "flex",
    gap: 12,
    alignItems: "center",
  },

  label: { fontWeight: 600, marginBottom: 6, display: "block" },
  muted: { fontSize: 12, color: "#777" },

  primaryBtn: {
    background: "#111",
    color: "#fff",
    border: "1px solid #111",
    borderRadius: 10,
    padding: "10px 18px",
    fontWeight: 600,
    cursor: "pointer",
  },
  secondaryBtn: {
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: 10,
    padding: "10px 18px",
    cursor: "pointer",
  },
  ghostBtn: {
    marginLeft: "auto",
    background: "none",
    border: "none",
    color: "#666",
    cursor: "pointer",
  },
};

export default OneClickSubmissionWizard;
