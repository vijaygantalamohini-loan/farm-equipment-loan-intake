import React, { useState, useEffect } from "react";
import { loansAPI, APIError } from "./services/api";
import { v4 as uuidv4 } from "uuid";
import { validateBorrower, validateDealer, validateLoan, validateDocuments } from "./validation/schemas";
import errorBus from "./utils/errorBus";
import { ArrowLeft, ArrowRight } from "lucide-react";
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
  normalizeAsset,
  normalizeTradeIn,
  normalizeLoan,
  normalizeDocuments,
} from "./utils/normalizers";

function LoanApplicationWizard({ user, token, editingApplicationId, onBack, onViewOffers }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    borrowerType: "individual",
    hasCoBorrower: false,
  });
  const [missingFields, setMissingFields] = useState({});
  const [debugOpen, setDebugOpen] = useState(false);
  const [lastSaveInfo, setLastSaveInfo] = useState(null);
  const [attemptedSections, setAttemptedSections] = useState({});
  const [applicationId, setApplicationId] = useState(null);
  const [applicationNumber, setApplicationNumber] = useState(null);
  const [isStarting, setIsStarting] = useState(true);
  const idempotencyKeyRef = React.useRef(uuidv4());
  const startInitiatedRef = React.useRef(false);
  const autosaveTimerRef = React.useRef(null);

  // Load existing application or start new one (only once on mount)
  useEffect(() => {
    // If we ever land on /auth/callback without a code (e.g., direct visit), force re-login
    const params = new URLSearchParams(window.location.search);
    if (window.location.pathname.includes("/auth/callback") && !params.get("code")) {
      window.location.href = "/auth/login";
    }

    if (!token) {
      console.log("No token available yet, waiting...");
      return;
    }
    if (applicationId) {
      // Already started/loaded
      return;
    }
    const loadApplication = async (appId) => {
      try {
        console.log(`Loading existing application ${appId}...`);
        const resp = await loansAPI.getApplication(appId, token);
        const data = resp && resp.data ? resp.data : resp; // unwrap ResponseFormatter
        console.log("Application loaded successfully:", data);
        setApplicationId(data.id || data.application_id);
        setApplicationNumber(data.application_number);
        setFormData({
          borrowerType: data.borrower_type || "individual",
          hasCoBorrower: !!(data.has_coborrower),
          borrower: normalizePerson(data.borrower_data),
          coBorrower: normalizePerson(data.coborrower_data),
          dealer: normalizeDealer(data.dealer_data),
          loan: normalizeLoan(data.loan_data),
          documents: normalizeDocuments(data.documents_and_consents_data),
        });
        // If backend provides missing_fields for this in-progress application, reflect them in sidebar status
        if (data && data.missing_fields && typeof data.missing_fields === 'object') {
          setMissingFields(data.missing_fields);
          setAttemptedSections(prev => {
            const updated = { ...prev };
            Object.entries(data.missing_fields).forEach(([section, fields]) => {
              if (Array.isArray(fields) && fields.length > 0) {
                updated[section] = true;
              }
            });
            return updated;
          });
        } else {
          setMissingFields({});
        }
      } catch (error) {
        console.error("Error loading application:", error);
        alert("Failed to load application. Please try again.");
        if (onBack) onBack();
      } finally {
        setIsStarting(false);
      }
    };
    const startApplication = async () => {
      try {
        if (startInitiatedRef.current) {
          console.log("Start already initiated; skipping duplicate call.");
          return;
        }
        startInitiatedRef.current = true;
        console.log("Starting new loan application...");
        const resp = await loansAPI.startApplication(token, idempotencyKeyRef.current);
        const data = resp && resp.data ? resp.data : resp; // support ResponseFormatter.success_response shape
        console.log("New application started:", data);
        setApplicationId(data.application_id);
        setApplicationNumber(data.application_number);
      } catch (error) {
        console.error("Error starting application:", error);
        const msg = error instanceof APIError
          ? `Failed to start application (${error.status || 'network'}): ${error.message}\nURL: ${error.url || 'unknown'}`
          : "Failed to start application. Please try again.";
        alert(msg);
        if (onBack) onBack();
        startInitiatedRef.current = false; // allow retry on explicit user action
      } finally {
        setIsStarting(false);
      }
    };
    if (editingApplicationId) {
      console.log(`Edit mode: Loading application ID ${editingApplicationId}`);
      loadApplication(editingApplicationId);
    } else {
      console.log("New application mode: Starting fresh application");
      startApplication();
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, editingApplicationId]);

  // Navigation helpers that respect optional co-borrower step
  const nextStep = () => {
    const prevStepNum = step;
    const target = prevStepNum + 1;
    // Skip step 2 if co-borrower is not enabled
    const next = (target === 2 && !formData.hasCoBorrower) ? 3 : target;
    console.debug('[Wizard] Advancing from step', prevStepNum, 'to', next, 'formData:', formData);
    setStep(next);
  };

  const prevStep = () => {
    let target = step - 1;
    if (target === 2 && !formData.hasCoBorrower) target = 1;
    const finalTarget = Math.max(1, target);
    console.debug('[Wizard] Going back from step', step, 'to', finalTarget);
    setStep(finalTarget);
  };

  const updateData = async (newData, options = { validate: true }) => {
    const shouldValidate = options.validate !== false;
    const updatedFormData = { ...formData, ...newData };
    setFormData(updatedFormData);

    // Prepare payload for backend (map documents to documents_and_consents_data)
    // Build documents_and_consents_data as an object containing both documents and consents
    let documents_and_consents_data = null;
    if (Array.isArray(updatedFormData.documents)) {
      documents_and_consents_data = {
        documents: updatedFormData.documents,
        consents: updatedFormData.consents || {},
      };
    } else if (updatedFormData.documents && typeof updatedFormData.documents === 'object') {
      documents_and_consents_data = {
        documents: Array.isArray(updatedFormData.documents.documents)
          ? updatedFormData.documents.documents
          : [],
        consents: (updatedFormData.documents.consents || updatedFormData.consents || {}),
      };
    }

    // Derive top-level loan fields from first purchase asset for backend compatibility
    const deriveLoanTopLevel = (loanObj) => {
      if (!loanObj || typeof loanObj !== 'object') return loanObj;
      const assets = Array.isArray(loanObj.purchaseAssets) ? loanObj.purchaseAssets : [];
      const first = assets[0] || {};
      const totalEquipmentValue = assets.reduce((sum, a) => sum + (parseFloat(a.valueEstimate) || 0), 0);
      const totalTradeIn = Array.isArray(loanObj.tradeIns) ? loanObj.tradeIns.reduce((sum, t) => sum + (parseFloat(t.valueEstimate) || 0), 0) : 0;
      const cashDownAmount = parseFloat(loanObj.cashDown) || 0;

      const derived = { ...loanObj };
      derived.equipmentType = first.equipmentType || loanObj.purpose || derived.equipmentType;
      derived.make = first.make || derived.make;
      derived.model = first.model || derived.model;
      derived.year = first.year || derived.year;
      derived.serialNumber = first.serialNumber || derived.serialNumber;
      derived.condition = first.condition || derived.condition;
      if (totalEquipmentValue > 0) {
        derived.purchasePrice = String(totalEquipmentValue);
      }
      const amount = Math.max(0, totalEquipmentValue - totalTradeIn - cashDownAmount);
      if (!Number.isNaN(amount)) {
        derived.amount = String(amount);
      }
      return derived;
    };

    const cleanLoan = (loanObj) => {
      if (!loanObj || typeof loanObj !== 'object') return loanObj;
      const trimSerial = (v) => {
        if (v === undefined || v === null) return undefined;
        const t = String(v).trim();
        return t === '' ? undefined : t;
      };
      const normalizeAssetSerials = (arr) => Array.isArray(arr)
        ? arr.map(item => {
            const next = { ...(item || {}) };
            next.serialNumber = trimSerial(next.serialNumber);
            return next;
          })
        : [];
      const purchaseAssets = Array.isArray(loanObj.purchaseAssets)
        ? normalizeAssetSerials(loanObj.purchaseAssets)
        : [];
      const tradeIns = Array.isArray(loanObj.tradeIns)
        ? normalizeAssetSerials(loanObj.tradeIns)
        : [];
      return {
        ...loanObj,
        purchaseAssets,
        tradeIns,
        serialNumber: trimSerial(loanObj.serialNumber),
      };
    };

    const payload = {
      borrower_type: updatedFormData.borrowerType || "individual",
      has_coborrower: !!updatedFormData.hasCoBorrower,
      borrower_data: updatedFormData.borrower,
      coborrower_data: updatedFormData.coBorrower,
      loan_data: deriveLoanTopLevel(cleanLoan(updatedFormData.loan)),
      dealer_data: updatedFormData.dealer,
      documents_and_consents_data,
    };

    if (shouldValidate) {
      // Local validation: fail fast and map errors to missingFields per section
      const localMissing = { borrower: [], coborrower: [], dealer: [], loan: [], documents: [] };
      // Validate only sections present in the update or always? Validate all to be safe
      localMissing.borrower = validateBorrower(payload.borrower_data);
      localMissing.dealer = validateDealer(payload.dealer_data);
      localMissing.loan = validateLoan(payload.loan_data);
      localMissing.documents = validateDocuments(documents_and_consents_data || { documents: [], consents: { creditCheck: false, shareWithLenders: false } });
      // If co-borrower enabled, require minimal fields (reuse borrower schema for now)
      if (payload.has_coborrower) {
        localMissing.coborrower = validateBorrower(payload.coborrower_data);
      }
      const hasLocalErrors = Object.values(localMissing).some(arr => Array.isArray(arr) && arr.length > 0);
      if (hasLocalErrors) {
        setMissingFields(localMissing);
        try { errorBus.emit({ message: "Validation failed — please complete required fields", status: 0, url: "local" }); } catch {}
        return localMissing;
      }
    }

    // Auto-save draft after each step
    if (applicationId) {
      try {
        console.log(`Saving draft for application ${applicationId}...`);
        // Use a fresh idempotency key per save to avoid deduping subsequent saves
        const idk = uuidv4();
        const resp = await loansAPI.saveDraft(applicationId, { ...payload, idempotencyKey: idk }, token);
        const data = resp && resp.data ? resp.data : resp; // support ResponseFormatter.success_response shape
        if (data?.missing_fields) {
          setMissingFields(data.missing_fields);
        } else {
          // If backend returns no missing fields, clear banner
          setMissingFields({});
        }
        setLastSaveInfo({ status: 'ok', idempotencyKey: idk, timestamp: new Date().toISOString() });
        console.log("Draft saved successfully");
        return data?.missing_fields || null;
      } catch (error) {
        console.error("Error saving draft:", error);
        setLastSaveInfo({ status: 'error', message: error?.message, timestamp: new Date().toISOString() });
        // Don't block user progress if auto-save fails
        return null;
      }
    }
    return null;
  };

  const applyOcrResults = (ocr) => {
    if (!ocr || typeof ocr !== "object") return;

    const hasText = (value) => value !== undefined && value !== null && String(value).trim() !== "";
    const unwrapOcrValue = (value) => {
      if (value && typeof value === "object" && "value" in value) {
        return value.value;
      }
      return value;
    };
    const pickValue = (obj, keys) => {
      if (!obj || typeof obj !== "object") return null;
      for (const key of keys) {
        const nextValue = unwrapOcrValue(obj[key]);
        if (hasText(nextValue)) return nextValue;
      }
      return null;
    };
    const normalizeMoney = (value) => {
      if (!hasText(value)) return "";
      return String(value).replace(/[$,]/g, "").trim();
    };
    const normalizeSerial = (value) => {
      if (!hasText(value)) return "";
      return String(value).replace(/\s+/g, "").toUpperCase();
    };
    const splitName = (name) => {
      if (!hasText(name)) return { first: "", last: "" };
      const cleaned = String(name).trim();
      if (cleaned.includes(",")) {
        const [last, first] = cleaned.split(",").map(part => part.trim()).filter(Boolean);
        return { first: first || "", last: last || "" };
      }
      const parts = cleaned.split(/\s+/);
      if (parts.length === 1) return { first: parts[0], last: "" };
      return { first: parts[0], last: parts.slice(1).join(" ") };
    };

    const idPayload = ocr.id || ocr;
    const invoicePayload = ocr.invoice || ocr.extractedData || ocr;

    const idFirstName = pickValue(idPayload, ["firstName", "first_name", "given_name", "first"]);
    const idLastName = pickValue(idPayload, ["lastName", "last_name", "surname", "last"]);
    const idDob = pickValue(idPayload, ["dateOfBirth", "date_of_birth", "dob"]);
    const idStreet = pickValue(idPayload, ["street", "address", "address_line1"]);
    const idCity = pickValue(idPayload, ["city", "town"]);
    const idState = pickValue(idPayload, ["state", "province", "region"]);
    const idZip = pickValue(idPayload, ["zip", "postal", "postalCode"]);

    const buyerName = pickValue(invoicePayload, [
      "buyer_name",
      "buyerName",
      "customer",
      "purchaser",
      "sold_to",
      "bill_to",
    ]);
    const buyerSplit = splitName(buyerName);

    const borrower = {
      ...(formData.borrower || {}),
      address: { ...(formData.borrower?.address || {}) },
    };
    let borrowerChanged = false;
    const assignBorrower = (field, value) => {
      if (!hasText(value)) return;
      borrower[field] = String(value).trim();
      borrowerChanged = true;
    };
    const assignAddress = (field, value) => {
      if (!hasText(value)) return;
      borrower.address[field] = String(value).trim();
      borrowerChanged = true;
    };

    const nextFirst = hasText(idFirstName) ? idFirstName : buyerSplit.first;
    const nextLast = hasText(idLastName) ? idLastName : buyerSplit.last;
    assignBorrower("firstName", nextFirst);
    assignBorrower("lastName", nextLast);
    assignBorrower("dateOfBirth", idDob);
    assignAddress("street", idStreet);
    assignAddress("city", idCity);
    assignAddress("state", idState);
    assignAddress("zip", idZip);

    const invoiceMake = pickValue(invoicePayload, ["make", "manufacturer", "brand"]);
    const invoiceModel = pickValue(invoicePayload, ["model"]);
    const invoiceYear = pickValue(invoicePayload, ["year", "model_year"]);
    const invoiceSerial = pickValue(invoicePayload, ["serial_number", "serialNumber", "serial", "vin"]);
    const invoicePrice = pickValue(invoicePayload, ["price", "salePrice", "purchasePrice", "cashPrice"]);
    const tradeInValue = pickValue(invoicePayload, ["trade_in_value", "tradeInValue", "tradeIn", "tradeValue"]);
    const downPayment = pickValue(invoicePayload, ["down_payment", "downPayment", "cashDown"]);
    const totalFinanced = pickValue(invoicePayload, [
      "total_financed_amount",
      "amount_financed",
      "totalFinanced",
      "amount",
    ]);

    const hasInvoiceData = [invoiceMake, invoiceModel, invoiceYear, invoiceSerial, invoicePrice, tradeInValue, downPayment, totalFinanced]
      .some(hasText);

    const normalizedLoan = normalizeLoan(formData.loan);
    let loanChanged = false;

    if (hasInvoiceData) {
      const assetIndex = Number.isInteger(ocr.assetIndex) ? ocr.assetIndex : 0;
      const assetType = ocr.assetType === "trade-in" ? "trade-in" : "purchase";

      if (assetType === "purchase") {
        const purchaseAssets = Array.isArray(normalizedLoan.purchaseAssets)
          ? normalizedLoan.purchaseAssets.map(normalizeAsset)
          : [normalizeAsset({})];
        if (purchaseAssets.length === 0) {
          purchaseAssets.push(normalizeAsset({}));
        }
        const targetIndex = Math.min(Math.max(assetIndex, 0), purchaseAssets.length - 1);
        const asset = { ...purchaseAssets[targetIndex] };
        if (hasText(invoiceMake)) asset.make = String(invoiceMake).trim();
        if (hasText(invoiceModel)) asset.model = String(invoiceModel).trim();
        if (hasText(invoiceYear)) asset.year = String(invoiceYear).trim();
        if (hasText(invoiceSerial)) asset.serialNumber = normalizeSerial(invoiceSerial);
        if (hasText(invoicePrice)) asset.valueEstimate = normalizeMoney(invoicePrice);
        purchaseAssets[targetIndex] = asset;
        normalizedLoan.purchaseAssets = purchaseAssets;
        loanChanged = true;
      }

      if (hasText(tradeInValue)) {
        const tradeIns = Array.isArray(normalizedLoan.tradeIns)
          ? normalizedLoan.tradeIns.map(normalizeTradeIn)
          : [normalizeTradeIn({})];
        if (tradeIns.length === 0) {
          tradeIns.push(normalizeTradeIn({}));
        }
        const trade = { ...tradeIns[0] };
        trade.valueEstimate = normalizeMoney(tradeInValue);
        tradeIns[0] = trade;
        normalizedLoan.tradeIns = tradeIns;
        normalizedLoan.hasTradeIn = true;
        loanChanged = true;
      }

      if (hasText(downPayment)) {
        normalizedLoan.cashDown = normalizeMoney(downPayment);
        loanChanged = true;
      }
      if (hasText(totalFinanced)) {
        normalizedLoan.amount = normalizeMoney(totalFinanced);
        loanChanged = true;
      }
    }

    const updates = {};
    if (borrowerChanged) updates.borrower = borrower;
    if (loanChanged) updates.loan = normalizedLoan;
    if (Object.keys(updates).length > 0) {
      updateData(updates, { validate: false });
    }
  };

  // Debounced autosave helper: merges data and saves after short delay
  const scheduleAutosave = (partialData) => {
    const merged = { ...formData, ...partialData };
    setFormData(merged);
    // Save immediately for trade-ins, documents, or consents updates
    const hasTradeInsUpdate = partialData && partialData.loan && Array.isArray(partialData.loan.tradeIns);
    const hasDocumentsUpdate = partialData && (
      Array.isArray(partialData.documents) || (partialData.documents && typeof partialData.documents === 'object')
    );
    const hasConsentsUpdate = partialData && partialData.consents && typeof partialData.consents === 'object';
    if (hasTradeInsUpdate || hasDocumentsUpdate || hasConsentsUpdate) {
      // Skip validation for autosave-triggered updates to avoid blocking serial entry
      updateData(partialData, { validate: false });
      return;
    }
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(() => {
      updateData(partialData, { validate: false });
      autosaveTimerRef.current = null;
    }, 600);
  };

  // Validate current step on Next; only advance if no missing fields for that section
  const validateAndNext = async (newData, sectionKey) => {
    console.debug('[Wizard] validateAndNext called for section', sectionKey, 'with newData:', newData);
    await updateData(newData, { validate: true });
    setAttemptedSections(prev => ({ ...prev, [sectionKey]: true }));

    // Prefer local validation to gate navigation; compute using merged newData to avoid stale state
    let localFields = [];
    try {
      const merged = { ...formData, ...newData };
      if (sectionKey === 'borrower') {
        localFields = validateBorrower(merged.borrower);
      } else if (sectionKey === 'dealer') {
        localFields = validateDealer(merged.dealer);
      } else if (sectionKey === 'loan') {
        localFields = validateLoan(merged.loan);
      } else if (sectionKey === 'coborrower' && merged.hasCoBorrower) {
        localFields = validateBorrower(merged.coBorrower);
      } else if (sectionKey === 'documents') {
        const docObj = Array.isArray(merged.documents)
          ? { documents: merged.documents, consents: merged.consents || {} }
          : (merged.documents || { documents: [], consents: { creditCheck: false, shareWithLenders: false } });
        localFields = validateDocuments(docObj);
      }
      console.debug('[Wizard] Validation for section', sectionKey, 'missing fields:', localFields);
    } catch (err) {
      console.error('[Wizard] Validation error:', err);
    }

    if (!localFields || localFields.length === 0) {
      console.debug('[Wizard] Validation passed for section', sectionKey, 'advancing step.');
      nextStep();
      return true;
    }

    // keep user on current step, show banner
    console.debug('[Wizard] Validation failed for section', sectionKey, 'fields:', localFields);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return false;
  };

  // Show loading screen while starting application
  if (isStarting) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px',
        fontSize: '1.2rem',
        color: '#666'
      }}>
        <div>
          <p>{editingApplicationId ? 'Loading application...' : 'Starting new application...'}</p>
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <div className="spinner" style={{
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #007bff',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              animation: 'spin 1s linear infinite',
              margin: '0 auto'
            }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Title Bar */}
        <div className="flex items-center justify-between mb-6">
          <div>
            {(() => {
              const totalSteps = formData.hasCoBorrower ? 6 : 5;
              const displayStep = formData.hasCoBorrower ? step : (step >= 3 ? step - 1 : step);
              return (
                <>
                  <h2 className="text-2xl font-black mb-1">
                    {editingApplicationId ? 'Resume' : 'New'} Loan Application - Step {displayStep} of {totalSteps}
                  </h2>
                  {applicationNumber && (
                    <p className="text-sm text-gray-500">(App #: {applicationNumber})</p>
                  )}
                </>
              );
            })()}
          </div>
          {onBack && (
            <button 
              onClick={onBack}
              className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-black font-bold text-sm rounded-xl transition-colors"
            >
              Back to Dashboard
            </button>
          )}
        </div>

        {/* Debug Panel - Development Only */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-6">
            <button 
              onClick={() => setDebugOpen(v => !v)}
              className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg transition-colors"
            >
              {debugOpen ? 'Hide' : 'Show'} Debug
            </button>
            {debugOpen && (
              <div className="mt-3 p-4 bg-white border border-gray-200 rounded-lg text-sm text-gray-700">
                <div>Idempotency Key: {lastSaveInfo?.idempotencyKey || 'n/a'}</div>
                <div>Last Save: {lastSaveInfo ? `${lastSaveInfo.status} at ${lastSaveInfo.timestamp}` : 'n/a'}</div>
                <div>Missing Fields: {Object.keys(missingFields).length}</div>
              </div>
            )}
          </div>
        )}

        {/* Progress Bar */}
        <div className="mb-8">
          {(() => {
            const totalSteps = formData.hasCoBorrower ? 6 : 5;
            const displayStep = formData.hasCoBorrower ? step : (step >= 3 ? step - 1 : step);
            return (
              <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-black h-full transition-all duration-300"
                  style={{ width: `${(displayStep / totalSteps) * 100}%` }}
                />
              </div>
            );
          })()}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Form Area */}
          <div className="lg:col-span-3">
            <div className="bg-white border-2 border-black rounded-2xl p-8">
{/* Missing Fields Banner */}
              {(() => {
                const sectionForStep = (
                  step === 1 ? 'borrower' :
                  step === 2 ? 'coborrower' :
                  step === 3 ? 'dealer' :
                  step === 4 ? 'loan' :
                  step === 5 ? 'documents' :
                  null
                );

                if (!sectionForStep) return null;
                if (step === 2 && !formData.hasCoBorrower) return null;
                if (!attemptedSections[sectionForStep]) return null;

                const fields = (missingFields && missingFields[sectionForStep]) || [];
                if (!fields || fields.length === 0) return null;

                const labels = {
                  borrower: 'Borrower',
                  coborrower: 'Co-Borrower',
                  dealer: 'Dealer',
                  loan: 'Equipment & Deal',
                  documents: 'Documents & Consents',
                };

                return (
                  <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                    <p className="text-sm text-yellow-800">
                      <strong>Missing fields in {labels[sectionForStep]}:</strong> {fields.join(', ')}
                    </p>
                  </div>
                );
              })()}

              {/* Step Content */}

          {step === 1 && (
            <BorrowerInfoStep
              onNext={updateData}
              onDraftChange={scheduleAutosave}
              onOcrResults={applyOcrResults}
              nextStep={nextStep}
              initialData={formData}
              missingFields={missingFields.borrower || []}
              onBack={onBack}
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
              onNextValidate={validateAndNext}
              onDraftChange={scheduleAutosave}
              onOcrResults={applyOcrResults}
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
              onSuccess={() => {
                // After successful submission, go directly to offers
                if (typeof onViewOffers === 'function' && applicationId) {
                  onViewOffers(applicationId);
                } else if (typeof onBack === 'function') {
                  onBack();
                }
              }}
              applicationId={applicationId}
              onValidationError={(mf) => {
                if (!mf) return;
                setMissingFields(mf);
                // Mark sections as attempted so banners appear
                const sections = Object.keys(mf);
                setAttemptedSections(prev => {
                  const updated = { ...prev };
                  sections.forEach(s => { updated[s] = true; });
                  return updated;
                });
                // Navigate to the most relevant section to fix
                const priority = ['loan', 'borrower', 'coborrower', 'dealer', 'documents'];
                const stepMap = { borrower: 1, coborrower: 2, dealer: 3, loan: 4, documents: 5 };
                const targetSection = priority.find(s => Array.isArray(mf[s]) && mf[s].length > 0 && (s !== 'coborrower' || formData.hasCoBorrower));
                if (targetSection) {
                  setStep(stepMap[targetSection]);
                }
              }}
            />
          )}

              {/* Navigation Buttons */}
            </div>
          </div>

          {/* Steps Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white border-2 border-black rounded-2xl p-6 sticky top-6">
              <h3 className="text-lg font-black mb-4">Steps</h3>
              <div className="space-y-3">
                <SidebarSteps
                  step={step}
                  formData={formData}
                  missingFields={missingFields}
                  onStepClick={(n) => {
                    // Allow forward navigation when resuming an existing application
                    // up to the first incomplete step, so users can jump directly to fill it.
                    if (n > step) {
                      const isCoBorrowerEnabled = !!formData.hasCoBorrower;
                      const getMissingForStep = (s) => {
                        try {
                          if (s === 1) return validateBorrower(formData.borrower);
                          if (s === 2) return isCoBorrowerEnabled ? validateBorrower(formData.coBorrower) : [];
                          if (s === 3) return validateDealer(formData.dealer);
                          if (s === 4) return validateLoan(formData.loan);
                          if (s === 5) {
                            const docObj = Array.isArray(formData.documents)
                              ? { documents: formData.documents, consents: formData.consents || {} }
                              : (formData.documents || { documents: [], consents: { creditCheck: false, shareWithLenders: false } });
                            return validateDocuments(docObj);
                          }
                        } catch {}
                        return [];
                      };
                      const stepsToCheck = [1, isCoBorrowerEnabled ? 2 : null, 3].filter(Boolean);
                      const firstIncomplete = (() => {
                        for (const s of stepsToCheck) {
                          const missing = getMissingForStep(s) || [];
                          if (Array.isArray(missing) && missing.length > 0) return s;
                        }
                        // If earlier steps are ready, the next actionable section is 4 (Equipment & Deal)
                        return 4;
                      })();
                      if (n <= firstIncomplete) {
                        setStep(n);
                        return;
                      }
                      try { alert('Please complete earlier sections before jumping further ahead.'); } catch {}
                      return;
                    }
                    setStep(n);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoanApplicationWizard;
