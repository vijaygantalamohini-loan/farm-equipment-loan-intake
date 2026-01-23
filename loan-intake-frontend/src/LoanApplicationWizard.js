import React, { useEffect, useState } from "react";
import { loansAPI, APIError } from "./services/api";
import { v4 as uuidv4 } from "uuid";
import {
  validateBorrower,
  validateDealer,
  validateLoan,
  validateDocuments,
} from "./validation/schemas";
import errorBus from "./utils/errorBus";

import BorrowerInfoStep from "./components/BorrowerInfoStep";
import CoBorrowerInfoStep from "./components/CoBorrowerInfoStep";
import DealerInfoStep from "./components/DealerInfoStep";
import LoanRequestStep from "./components/LoanRequestStep";
import DocumentsAndConsentsStep from "./components/DocumentsAndConsentsStep";
import SidebarSteps from "./components/SidebarSteps";
import ConfirmationStep from "./components/ConfirmationStep";

import {
  normalizePerson,
  normalizeDealer,
  normalizeLoan,
  normalizeDocuments,
  normalizeAsset,
  normalizeTradeIn,
} from "./utils/normalizers";

/* =========================================================
   COMPONENT
========================================================= */

function LoanApplicationWizard({
  user,
  token,
  editingApplicationId,
  onBack,
  onViewOffers,
}) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    borrowerType: "individual",
    hasCoBorrower: false,
  });
  const [missingFields, setMissingFields] = useState({});
  const [attemptedSections, setAttemptedSections] = useState({});
  const [applicationId, setApplicationId] = useState(null);
  const [applicationNumber, setApplicationNumber] = useState(null);
  const [isStarting, setIsStarting] = useState(true);

  const idempotencyKeyRef = React.useRef(uuidv4());
  const startInitiatedRef = React.useRef(false);
  const autosaveTimerRef = React.useRef(null);

  /* =========================================================
     INITIAL LOAD / START
  ========================================================= */

  useEffect(() => {
    if (!token || applicationId) return;

    const loadApplication = async (id) => {
      try {
        const resp = await loansAPI.getApplication(id, token);
        const data = resp?.data || resp;

        setApplicationId(data.id || data.application_id);
        setApplicationNumber(data.application_number);
        setFormData({
          borrowerType: data.borrower_type || "individual",
          hasCoBorrower: !!data.has_coborrower,
          borrower: normalizePerson(data.borrower_data),
          coBorrower: normalizePerson(data.coborrower_data),
          dealer: normalizeDealer(data.dealer_data),
          loan: normalizeLoan(data.loan_data),
          documents: normalizeDocuments(data.documents_and_consents_data),
        });

        if (data.missing_fields) setMissingFields(data.missing_fields);
      } catch {
        alert("Failed to load application");
        onBack?.();
      } finally {
        setIsStarting(false);
      }
    };

    const startApplication = async () => {
      if (startInitiatedRef.current) return;
      startInitiatedRef.current = true;

      try {
        const resp = await loansAPI.startApplication(
          token,
          idempotencyKeyRef.current
        );
        const data = resp?.data || resp;
        setApplicationId(data.application_id);
        setApplicationNumber(data.application_number);
      } catch (error) {
        const msg =
          error instanceof APIError
            ? error.message
            : "Failed to start application";
        alert(msg);
        onBack?.();
      } finally {
        setIsStarting(false);
      }
    };

    editingApplicationId
      ? loadApplication(editingApplicationId)
      : startApplication();
  }, [token, editingApplicationId, applicationId, onBack]);

  /* =========================================================
     STEP NAVIGATION
  ========================================================= */

  const nextStep = () => {
    const target = step + 1;
    if (target === 2 && !formData.hasCoBorrower) {
      setStep(3);
    } else {
      setStep(target);
    }
  };

  const prevStep = () => {
    let target = step - 1;
    if (target === 2 && !formData.hasCoBorrower) target = 1;
    setStep(Math.max(1, target));
  };

  /* =========================================================
     DATA UPDATE + AUTOSAVE (UNCHANGED)
  ========================================================= */

  const updateData = async (newData, options = { validate: true }) => {
    const updated = { ...formData, ...newData };
    setFormData(updated);

    if (options.validate !== false) {
      const errors = {
        borrower: validateBorrower(updated.borrower),
        dealer: validateDealer(updated.dealer),
        loan: validateLoan(updated.loan),
        documents: validateDocuments(
          Array.isArray(updated.documents)
            ? { documents: updated.documents, consents: updated.consents || {} }
            : updated.documents || {}
        ),
      };

      if (updated.hasCoBorrower) {
        errors.coborrower = validateBorrower(updated.coBorrower);
      }

      const hasErrors = Object.values(errors).some(
        (v) => Array.isArray(v) && v.length
      );

      if (hasErrors) {
        setMissingFields(errors);
        try {
          errorBus.emit({
            message: "Please complete required fields",
          });
        } catch {}
        return errors;
      }
    }

    if (applicationId) {
      try {
        await loansAPI.saveDraft(
          applicationId,
          { ...updated, idempotencyKey: uuidv4() },
          token
        );
      } catch {
        // silent autosave failure
      }
    }

    return null;
  };

  const scheduleAutosave = (partial) => {
    setFormData((prev) => ({ ...prev, ...partial }));
    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(
      () => updateData(partial, { validate: false }),
      600
    );
  };

  /* =========================================================
     LOADING STATE
  ========================================================= */

  if (isStarting) {
    return (
      <div style={styles.loader}>
        <div>
          <div className="spinner" />
          <p style={{ marginTop: 12, color: "#666" }}>
            {editingApplicationId
              ? "Loading application…"
              : "Starting application…"}
          </p>
        </div>
      </div>
    );
  }

  /* =========================================================
     RENDER
  ========================================================= */

  const totalSteps = formData.hasCoBorrower ? 6 : 5;
  const displayStep =
    formData.hasCoBorrower || step < 3 ? step : step - 1;

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>
            {editingApplicationId ? "Resume" : "New"} Loan Application
          </h1>
          <p style={styles.subtitle}>
            Step {displayStep} of {totalSteps}
            {applicationNumber && (
              <span style={styles.appNo}>App #{applicationNumber}</span>
            )}
          </p>
          <progress
            value={displayStep}
            max={totalSteps}
            style={styles.progress}
          />
        </div>

        {onBack && (
          <button onClick={onBack} style={styles.backBtn}>
            ← Dashboard
          </button>
        )}
      </header>

      {/* Layout */}
      <div style={styles.layout}>
        <main style={styles.main}>
          {step === 1 && (
            <BorrowerInfoStep
              onNext={updateData}
              onDraftChange={scheduleAutosave}
              nextStep={nextStep}
              initialData={formData}
              missingFields={missingFields.borrower || []}
            />
          )}

          {step === 2 && (
            <CoBorrowerInfoStep
              onNext={updateData}
              onDraftChange={scheduleAutosave}
              nextStep={nextStep}
              prevStep={prevStep}
              initialData={formData.coBorrower || {}}
              missingFields={missingFields.coborrower || []}
            />
          )}

          {step === 3 && (
            <DealerInfoStep
              onNext={updateData}
              onDraftChange={scheduleAutosave}
              nextStep={nextStep}
              prevStep={prevStep}
              user={user}
              initialData={formData.dealer || {}}
              missingFields={missingFields.dealer || []}
            />
          )}

          {step === 4 && (
            <LoanRequestStep
              onNextValidate={updateData}
              onDraftChange={scheduleAutosave}
              nextStep={nextStep}
              prevStep={prevStep}
              initialData={formData}
              missingFields={missingFields.loan || []}
            />
          )}

          {step === 5 && (
            <DocumentsAndConsentsStep
              onNext={updateData}
              onDraftChange={scheduleAutosave}
              nextStep={nextStep}
              prevStep={prevStep}
              initialData={formData.documents || {}}
            />
          )}

          {step === 6 && (
            <ConfirmationStep
              formData={formData}
              prevStep={prevStep}
              token={token}
              applicationId={applicationId}
              onSuccess={() =>
                onViewOffers
                  ? onViewOffers(applicationId)
                  : onBack?.()
              }
            />
          )}
        </main>

        <aside style={styles.sidebar}>
          <SidebarSteps
            step={step}
            formData={formData}
            missingFields={missingFields}
            onStepClick={(n) => setStep(n)}
          />
        </aside>
      </div>
    </div>
  );
}

/* =========================================================
   STYLES
========================================================= */

const styles = {
  page: {
    background: "#fafafa",
    minHeight: "100vh",
  },

  header: {
    background: "#fff",
    borderBottom: "1px solid #e5e5e5",
    padding: "24px 32px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 600,
  },

  subtitle: {
    marginTop: 6,
    color: "#666",
  },

  appNo: {
    marginLeft: 12,
    fontSize: 13,
    color: "#999",
  },

  progress: {
    width: 300,
    marginTop: 8,
  },

  backBtn: {
    background: "#111",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "10px 16px",
    cursor: "pointer",
  },

  layout: {
    display: "grid",
    gridTemplateColumns: "1fr 320px",
    gap: 24,
    padding: 32,
  },

  main: {
    background: "#fff",
    borderRadius: 16,
    padding: 24,
    border: "1px solid #e5e5e5",
  },

  sidebar: {
    background: "#fff",
    borderRadius: 16,
    padding: 20,
    border: "1px solid #e5e5e5",
    height: "fit-content",
  },

  loader: {
    minHeight: "60vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
};

export default LoanApplicationWizard;
