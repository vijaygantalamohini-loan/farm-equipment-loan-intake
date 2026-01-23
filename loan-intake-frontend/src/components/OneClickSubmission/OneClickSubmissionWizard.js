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

const DEFAULT_STEPS = [
  { id: "ocr", label: "OCR Review" },
  { id: "explainability", label: "Explainability" },
  { id: "fraud", label: "Fraud Signals" },
  { id: "prequalification", label: "Prequalification" },
  { id: "equipment", label: "Equipment Intelligence" },
  { id: "review", label: "Review" },
  { id: "confirmation", label: "Confirmation" },
];

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
  const submissionDetails = submissionResult && submissionResult.submission;
  const submissionData = submissionDetails?.data || submissionDetails;
  const submissionApplicationNumber = submissionData?.application_number;
  const [idFileName, setIdFileName] = useState("");
  const [invoiceFileName, setInvoiceFileName] = useState("");
  const [expandedExplanations, setExpandedExplanations] = useState({});

  const steps = useMemo(() => {
    if (config?.steps && config.steps.length) {
      return config.steps;
    }
    return DEFAULT_STEPS;
  }, [config]);

  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      updateSubmissionPayload(initialData);
    }
  }, [initialData, updateSubmissionPayload]);

  const currentStepIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === state.currentStep)
  );
  const currentStep = steps[currentStepIndex] || steps[0];
  const isLastStep = currentStepIndex === steps.length - 1;
  const confidenceThreshold = config?.confidenceThreshold ?? 0.7;
  const stepStatus = state.stepStatus[currentStep.id];
  const stepError = state.errors[currentStep.id];
  const isOcrStep = currentStep.id === "ocr";
  const hasRequiredFiles = Boolean(
    state.submissionPayload?.idFile && state.submissionPayload?.invoiceFile
  );
  const currentError = stepError || state.submissionError;

  const handleSubmit = async () => {
    let result = state.submissionResult;
    if (!state.submissionSuccess || !result) {
      result = await submit();
      if (!result) {
        return;
      }
    }

    if (onSubmit) {
      await onSubmit(result);
      return;
    }

    // Default behaviour: if we already have a submission stored, exit the wizard
    if (result?.submission && onCancel) {
      onCancel();
      return;
    }
  };

  const handlePanelRetry = async () => {
    await submit();
  };

  const handleNext = async () => {
    if (currentStep.id === "ocr") {
      const result = await submit();
      if (!result) return;
    }
    goNextStep();
  };

  const handleStepClick = (stepId) => {
    if (state.isSubmitting) {
      return;
    }
    goToStep(stepId);
  };

  const handleFileChange = (event, field) => {
    const file = event.target.files?.[0];
    if (!file) return;
    updateSubmissionPayload({ [field]: file });
    if (field === "idFile") {
      setIdFileName(file.name);
    } else {
      setInvoiceFileName(file.name);
    }
  };

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

  const lowConfidenceFields = useMemo(() => {
    return ocrFields.filter((field) => field.confidence < confidenceThreshold);
  }, [ocrFields, confidenceThreshold]);

  const handleFieldEdit = (fieldName, newValue) => {
    const current = state.userOverrides[fieldName];
    overrideField(fieldName, newValue, current?.flagged ?? false);
  };

  const handleFlagToggle = (fieldName, flagged) => {
    const current = state.userOverrides[fieldName];
    const value = current?.value ?? state.ocrData?.fields[fieldName]?.value ?? "";
    overrideField(fieldName, value, flagged);
  };

  const explanationItems = useMemo(() => {
    const items = state.explanationData?.fieldExplanations || {};
    return Object.entries(items).map(([fieldName, explanation]) => ({
      fieldName,
      scores: explanation.scores,
      textualExplanation: explanation.textualExplanation,
      expanded: expandedExplanations[fieldName] ?? explanation.expanded ?? false,
    }));
  }, [expandedExplanations, state.explanationData]);

  const handleToggleExplainability = (fieldName) => {
    setExpandedExplanations((prev) => ({ ...prev, [fieldName]: !prev[fieldName] }));
  };

  const handleFraudAcknowledge = () => {
    if (!state.fraudData) return;
    updateFraudData({ ...state.fraudData, acknowledged: true });
  };

  const handleFraudReviewRequest = () => {
    if (!state.fraudData) return;
    updateFraudData({ ...state.fraudData, acknowledged: true });
  };

  const handlePrequalRetry = async () => {
    await submit();
  };

  const handleIssueResolve = (issueId) => {
    if (!state.equipmentData) return;
    const updatedIssues = state.equipmentData.issues.map((issue) =>
      issue.id === issueId ? { ...issue, resolved: true } : issue
    );
    updateEquipmentData({ ...state.equipmentData, issues: updatedIssues });
  };

  const summaryItems = [
    {
      label: "OCR Fields",
      value: ocrFields.length > 0 ? ocrFields.length : "N/A",
    },
    {
      label: "Low-Confidence Fields",
      value: lowConfidenceFields.length > 0 ? lowConfidenceFields.length : "N/A",
    },
    { label: "Fraud Risk", value: state.fraudData?.riskLevel || "N/A" },
    { label: "Prequal Score", value: state.prequalData?.score ?? "N/A" },
    {
      label: "Equipment Issues",
      value: state.equipmentData?.issues?.length ?? "N/A",
    },
  ];

  if (submissionApplicationNumber) {
    summaryItems.push({
      label: "Application Number",
      value: submissionApplicationNumber,
    });
  }

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "24px" }}>
      <header style={{ marginBottom: "24px" }}>
        <h2 style={{ margin: 0 }}>One-Click Submission</h2>
        <p style={{ color: "#6c757d", marginTop: "8px" }}>
          Review OCR output, AI signals, and eligibility before submitting.
        </p>
        <div style={{ marginTop: "16px" }}>
          <ProgressStepper
            steps={steps}
            currentStep={currentStep.id}
            stepStatus={state.stepStatus}
            onStepClick={handleStepClick}
          />
        </div>
      </header>

      {currentError && (
        <div style={{ marginBottom: "16px" }}>
          <ErrorNotification message={currentError} />
        </div>
      )}

      <section
        style={{
          border: "1px solid #e6e6e6",
          borderRadius: "10px",
          padding: "20px",
          marginTop: "12px",
        }}
      >
        {currentStep.id === "ocr" && (
          <div style={{ display: "grid", gap: "16px" }}>
            <div style={{ display: "grid", gap: "12px" }}>
              <div>
                <label
                  htmlFor="id-upload"
                  style={{ fontWeight: 600, display: "block" }}
                >
                  Upload ID document
                </label>
                <input
                  id="id-upload"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(event) => handleFileChange(event, "idFile")}
                />
                {idFileName && (
                  <div style={{ fontSize: "12px", color: "#6c757d" }}>
                    Selected: {idFileName}
                  </div>
                )}
              </div>
              <div>
                <label
                  htmlFor="invoice-upload"
                  style={{ fontWeight: 600, display: "block" }}
                >
                  Upload invoice
                </label>
                <input
                  id="invoice-upload"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(event) => handleFileChange(event, "invoiceFile")}
                />
                {invoiceFileName && (
                  <div style={{ fontSize: "12px", color: "#6c757d" }}>
                    Selected: {invoiceFileName}
                  </div>
                )}
              </div>
            </div>
            <OCRResultPanel
              fields={ocrFields}
              confidenceThreshold={confidenceThreshold}
              onFieldEdit={handleFieldEdit}
              onFlagToggle={handleFlagToggle}
              onRetry={handlePanelRetry}
              loading={stepStatus === "loading"}
              error={stepError || undefined}
            />
            {lowConfidenceFields.length > 0 && (
              <DataReviewPanel
                fields={lowConfidenceFields}
                onSave={handleFieldEdit}
              />
            )}
          </div>
        )}
        {currentStep.id === "explainability" && (
          <ExplainabilityPanel
            explanations={explanationItems}
            onToggleExpand={handleToggleExplainability}
            onRetry={handlePanelRetry}
            loading={stepStatus === "loading"}
            error={stepError || undefined}
          />
        )}
        {currentStep.id === "fraud" && (
          <FraudSignalPanel
            riskScore={state.fraudData?.riskScore ?? 0}
            riskLevel={state.fraudData?.riskLevel ?? "low"}
            triggeredRules={state.fraudData?.triggeredRules ?? []}
            onAcknowledge={handleFraudAcknowledge}
            onRequestReview={handleFraudReviewRequest}
            onRetry={handlePanelRetry}
            loading={stepStatus === "loading"}
            error={stepError || undefined}
          />
        )}
        {currentStep.id === "prequalification" && (
          <PrequalificationPanel
            score={state.prequalData?.score ?? 0}
            status={state.prequalData?.status ?? "pending"}
            actions={state.prequalData?.requiredActions ?? []}
            onRetry={state.prequalData?.retryAvailable ? handlePrequalRetry : undefined}
            loading={stepStatus === "loading"}
            error={stepError || undefined}
          />
        )}
        {currentStep.id === "equipment" && (
          <EquipmentIntelligencePanel
            equipmentId={state.equipmentData?.equipmentId ?? "N/A"}
            issues={state.equipmentData?.issues ?? []}
            recommendations={state.equipmentData?.recommendations ?? []}
            onIssueResolve={handleIssueResolve}
            onRetry={handlePanelRetry}
            loading={stepStatus === "loading"}
            error={stepError || undefined}
          />
        )}
        {currentStep.id === "review" && (
          <SubmissionSummary items={summaryItems} helperText="Review key signals before confirming." />
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

      <footer style={{ marginTop: "24px", display: "flex", gap: "12px" }}>
        <button onClick={goPrevStep} disabled={currentStepIndex === 0 || state.isSubmitting}>
          Back
        </button>
        {!isLastStep && (
          <button
            onClick={handleNext}
            disabled={state.isSubmitting || (isOcrStep && !hasRequiredFiles)}
          >
            Next
          </button>
        )}
        {isLastStep && currentStep.id !== "confirmation" && (
          <button onClick={handleSubmit} disabled={state.isSubmitting}>
            Submit
          </button>
        )}
        {onCancel && (
          <button onClick={onCancel} style={{ marginLeft: "auto" }}>
            Cancel
          </button>
        )}
      </footer>
    </div>
  );
}

export default OneClickSubmissionWizard;
