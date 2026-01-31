import React, { useState, useEffect, useMemo, useRef } from "react";
import { autoValidateAddress, createAddressChangeHandler, fetchAddressSuggestions } from "../utils/addressUtils";
import { addressAPI, API_BASE } from "../services/api";
import { Upload, ChevronDown, AlertCircle, CheckCircle, Search } from "lucide-react";

const OTHER_OPTION_VALUE = "__other__";

const BORROWER_FIELD_LABELS = {
  firstName: "First name",
  lastName: "Last name",
  dateOfBirth: "Date of birth",
  ssn: "SSN",
  legalName: "Legal business name",
  entityType: "Entity type",
  tin: "EIN / TIN",
  signerName: "Authorized signer name",
  signerTitle: "Authorized signer title",
  signerEmail: "Authorized signer email",
  signerPhone: "Authorized signer phone",
  operationPurpose: "Primary operation purpose",
  employerName: "Employer/Business name",
};

const BORROWER_FIELD_ALIASES = {
  firstName: "firstName",
  firstname: "firstName",
  "first_name": "firstName",
  lastName: "lastName",
  lastname: "lastName",
  "last_name": "lastName",
  dateOfBirth: "dateOfBirth",
  dateofbirth: "dateOfBirth",
  "date_of_birth": "dateOfBirth",
  dob: "dateOfBirth",
  ssn: "ssn",
  socialSecurityNumber: "ssn",
  "social_security_number": "ssn",
  socialsecuritynumber: "ssn",
  legalName: "legalName",
  legalname: "legalName",
  "legal_name": "legalName",
  entityType: "entityType",
  entitytype: "entityType",
  "entity_type": "entityType",
  tin: "tin",
  tinNumber: "tin",
  tinnumber: "tin",
  "tin_number": "tin",
  taxId: "tin",
  taxid: "tin",
  "tax_id": "tin",
  ein: "tin",
  signerName: "signerName",
  signername: "signerName",
  "signer_name": "signerName",
  signerTitle: "signerTitle",
  signertitle: "signerTitle",
  "signer_title": "signerTitle",
  signerEmail: "signerEmail",
  signeremail: "signerEmail",
  "signer_email": "signerEmail",
  signerPhone: "signerPhone",
  signerphone: "signerPhone",
  "signer_phone": "signerPhone",
  employerName: "employerName",
  employername: "employerName",
  "employer_name": "employerName",
  operationPurpose: "operationPurpose",
  operationpurpose: "operationPurpose",
  "operation_purpose": "operationPurpose",
};

const toCamelCase = (value) => {
  if (!value) return "";
  return String(value)
    .toLowerCase()
    .replace(/[-_\s]+([a-z])/g, (_, char) => char.toUpperCase());
};

const canonicalizeBorrowerMissingField = (field) => {
  const raw = String(field || "").trim();
  if (!raw) return "";

  const parts = raw.split(".");
  const candidates = new Set();
  const addCandidate = (token) => {
    if (!token) return;
    candidates.add(token);
    candidates.add(token.toLowerCase());
    const stripped = token.replace(/[^a-zA-Z0-9]+/g, "");
    if (stripped) {
      candidates.add(stripped);
      candidates.add(stripped.toLowerCase());
    }
  };

  parts.forEach(addCandidate);
  addCandidate(raw);
  const strippedRaw = raw.replace(/[^a-zA-Z0-9]+/g, "");
  addCandidate(strippedRaw);

  for (const candidate of candidates) {
    const mapped = BORROWER_FIELD_ALIASES[candidate];
    if (mapped) {
      return mapped;
    }
  }

  const fallback = parts.pop() || raw;
  const camel = toCamelCase(fallback);
  if (BORROWER_FIELD_ALIASES[camel]) {
    return BORROWER_FIELD_ALIASES[camel];
  }
  return camel || fallback;
};

const formatBorrowerMissingField = (field, canonicalOverride) => {
  const raw = String(field || "");
  const canonical = canonicalOverride || canonicalizeBorrowerMissingField(raw);
  if (canonical && BORROWER_FIELD_LABELS[canonical]) {
    return BORROWER_FIELD_LABELS[canonical];
  }
  const token = (raw.split(".").pop() || raw)
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!token) return null;
  return token.charAt(0).toUpperCase() + token.slice(1);
};

const isStandardOptionValue = (value, options) =>
  options.some(option => option.value === value && option.value !== OTHER_OPTION_VALUE);

const getSelectValue = (currentValue, options) => {
  if (!currentValue) return "";
  return isStandardOptionValue(currentValue, options) ? currentValue : OTHER_OPTION_VALUE;
};

const COMMON_OPERATION_PURPOSES = [
  "Purchase tractor for farming operations",
  "Purchase combine harvester for crop production",
  "Purchase farm equipment for agricultural use",
  "Cattle ranching and livestock equipment",
  "Dairy farm equipment and operations",
  "Construction equipment and machinery",
  "Excavator for construction business",
  "Transportation and trucking equipment",
  "Forestry and logging equipment",
  "Purchase skid steer loader",
  "Purchase grain handling equipment",
  "Purchase irrigation system",
  "Purchase hay baling equipment"
];

const FARM_LEGAL_ENTITY_OPTIONS = [
  { value: "Sole Proprietorship", label: "Sole Proprietorship" },
  { value: "General Partnership", label: "General Partnership" },
  { value: "Limited Partnership", label: "Limited Partnership" },
  { value: "Limited Liability Company (LLC)", label: "Limited Liability Company (LLC)" },
  { value: "Limited Liability Partnership (LLP)", label: "Limited Liability Partnership (LLP)" },
  { value: "S Corporation", label: "S Corporation" },
  { value: "C Corporation", label: "C Corporation" },
  { value: "Cooperative", label: "Cooperative" },
  { value: "Trust", label: "Trust" },
  { value: "Estate", label: "Estate" },
  { value: OTHER_OPTION_VALUE, label: "Other" },
];

const deriveInitialNaicsCode = (data) => {
  const raw = data?.borrower?.naicsCode ?? data?.loan?.naicsCode;
  if (raw === undefined || raw === null) {
    return "";
  }
  const text = String(raw).trim();
  return text;
};

const parseIntOrNull = (value) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.trunc(value) : null;
  }
  const numeric = Number.parseInt(String(value).replace(/,/g, ""), 10);
  return Number.isFinite(numeric) ? numeric : null;
};

function BorrowerInfoStep({
  onNext,
  nextStep,
  initialData,
  missingFields = [],
  onDraftChange = () => {},
  onOcrResults = () => {},
  onBack,
}) {
  const buildLoanNaicsMeta = (value) => {
    const nextLoan = { ...(initialData?.loan || {}) };
    const trimmed = typeof value === "string" ? value.trim() : value;
    if (trimmed) {
      nextLoan.naicsCode = String(trimmed);
    } else {
      delete nextLoan.naicsCode;
    }
    return { loan: nextLoan };
  };

  const [borrowerType, setBorrowerType] = useState(initialData?.borrowerType || "individual");
  const [hasCoBorrower, setHasCoBorrower] = useState(initialData?.hasCoBorrower || false);
  const [borrower, setBorrower] = useState(() => ({
    firstName: initialData?.borrower?.firstName || "",
    lastName: initialData?.borrower?.lastName || "",
    dateOfBirth: initialData?.borrower?.dateOfBirth || "",
    ssn: initialData?.borrower?.ssn || "",
    email: initialData?.borrower?.email || "",
    phone: initialData?.borrower?.phone || "",
    address: {
      street: initialData?.borrower?.address?.street || "",
      city: initialData?.borrower?.address?.city || "",
      state: initialData?.borrower?.address?.state || "",
      zip: initialData?.borrower?.address?.zip || "",
    },
    employerName: initialData?.borrower?.employerName || "",
    annualIncome: initialData?.borrower?.annualIncome || "",
    legalName: initialData?.borrower?.legalName || "",
    entityType: initialData?.borrower?.entityType || "",
    tin: initialData?.borrower?.tin || "",
    signerName: initialData?.borrower?.signerName || "",
    signerTitle: initialData?.borrower?.signerTitle || "",
    signerEmail: initialData?.borrower?.signerEmail || "",
    signerPhone: initialData?.borrower?.signerPhone || "",
    operationPurpose: initialData?.borrower?.operationPurpose || "",
    yearsInOperation: initialData?.borrower?.yearsInOperation || "",
    naicsCode: deriveInitialNaicsCode(initialData),
    farmLegalEntity: initialData?.borrower?.farmLegalEntity || "",
  }));
  const [farmLegalEntitySelectValue, setFarmLegalEntitySelectValue] = useState(() =>
    getSelectValue(initialData?.borrower?.farmLegalEntity, FARM_LEGAL_ENTITY_OPTIONS)
  );
  const [farmLegalEntityOtherError, setFarmLegalEntityOtherError] = useState(false);

  const [mode, setMode] = useState("manual"); // "manual" or "scan"
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const farmLegalEntityOtherValue = farmLegalEntitySelectValue === OTHER_OPTION_VALUE ? borrower.farmLegalEntity || "" : "";
  const farmLegalEntityOtherHasError = farmLegalEntityOtherError && farmLegalEntitySelectValue === OTHER_OPTION_VALUE;
  const operationPurposeTimeoutRef = useRef(null);
  const suggestionHideTimeoutRef = useRef(null);
  const operationPurposeLatestRef = useRef((initialData?.borrower?.operationPurpose || "").trim());
  const hasMountedRef = useRef(false);
  const [showOperationPurposeSuggestions, setShowOperationPurposeSuggestions] = useState(false);
  const [operationNaicsDetails, setOperationNaicsDetails] = useState(() => {
    const code = deriveInitialNaicsCode(initialData);
    return code ? { naics_code: code } : null;
  });
  const [naicsLookupLoading, setNaicsLookupLoading] = useState(false);
  const filteredOperationPurposes = useMemo(() => {
    const keyword = (borrower.operationPurpose || "").toLowerCase();
    if (!keyword) {
      return COMMON_OPERATION_PURPOSES.slice(0, 6);
    }
    return COMMON_OPERATION_PURPOSES.filter(p => p.toLowerCase().includes(keyword)).slice(0, 6);
  }, [borrower.operationPurpose]);
  const naicsDisplayValue = operationNaicsDetails
    ? operationNaicsDetails.description
      ? `${operationNaicsDetails.naics_code} - ${operationNaicsDetails.description}`
      : operationNaicsDetails.naics_code || borrower.naicsCode || ""
    : borrower.naicsCode || "";
  const naicsTitle = operationNaicsDetails && operationNaicsDetails.description
    ? `${operationNaicsDetails.naics_code} - ${operationNaicsDetails.description}${operationNaicsDetails.sector ? ` (${operationNaicsDetails.sector})` : ""}`
    : "";

  // Sync local state when initialData changes (e.g., on resume)
  useEffect(() => {
    setBorrowerType(initialData?.borrowerType || "individual");
    setHasCoBorrower(initialData?.hasCoBorrower || false);
    const initialCode = deriveInitialNaicsCode(initialData);
    const nextBorrower = {
      firstName: initialData?.borrower?.firstName || "",
      lastName: initialData?.borrower?.lastName || "",
      dateOfBirth: initialData?.borrower?.dateOfBirth || "",
      ssn: initialData?.borrower?.ssn || "",
      email: initialData?.borrower?.email || "",
      phone: initialData?.borrower?.phone || "",
      address: { 
        street: initialData?.borrower?.address?.street || "", 
        city: initialData?.borrower?.address?.city || "", 
        state: initialData?.borrower?.address?.state || "", 
        zip: initialData?.borrower?.address?.zip || "" 
      },
      employerName: initialData?.borrower?.employerName || "",
      annualIncome: initialData?.borrower?.annualIncome || "",
      legalName: initialData?.borrower?.legalName || "",
      entityType: initialData?.borrower?.entityType || "",
      tin: initialData?.borrower?.tin || "",
      signerName: initialData?.borrower?.signerName || "",
      signerTitle: initialData?.borrower?.signerTitle || "",
      signerEmail: initialData?.borrower?.signerEmail || "",
      signerPhone: initialData?.borrower?.signerPhone || "",
      operationPurpose: initialData?.borrower?.operationPurpose || "",
      yearsInOperation: initialData?.borrower?.yearsInOperation || "",
      naicsCode: initialCode,
      farmLegalEntity: initialData?.borrower?.farmLegalEntity || "",
    };
    setBorrower(nextBorrower);
    setFarmLegalEntitySelectValue(getSelectValue(initialData?.borrower?.farmLegalEntity, FARM_LEGAL_ENTITY_OPTIONS));
    setFarmLegalEntityOtherError(false);
    setOperationNaicsDetails(initialCode ? { naics_code: initialCode } : null);
    setShowOperationPurposeSuggestions(false);
    setNaicsLookupLoading(false);
    if (operationPurposeTimeoutRef.current) {
      clearTimeout(operationPurposeTimeoutRef.current);
      operationPurposeTimeoutRef.current = null;
    }
    if (suggestionHideTimeoutRef.current) {
      clearTimeout(suggestionHideTimeoutRef.current);
      suggestionHideTimeoutRef.current = null;
    }
    if (initialCode) {
      const borrowerCode = initialData?.borrower?.naicsCode === undefined || initialData?.borrower?.naicsCode === null
        ? ""
        : String(initialData.borrower.naicsCode).trim();
      const loanCode = initialData?.loan?.naicsCode === undefined || initialData?.loan?.naicsCode === null
        ? ""
        : String(initialData.loan.naicsCode).trim();
      if (borrowerCode !== initialCode || loanCode !== initialCode) {
        emitBorrowerDraft(nextBorrower, buildLoanNaicsMeta(initialCode));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]);

  useEffect(() => {
    const normalized = getSelectValue(borrower.farmLegalEntity, FARM_LEGAL_ENTITY_OPTIONS);
    setFarmLegalEntitySelectValue(prev => {
      if (prev === OTHER_OPTION_VALUE && normalized === "") {
        return OTHER_OPTION_VALUE;
      }
      return normalized;
    });
  }, [borrower.farmLegalEntity]);

  useEffect(() => {
    operationPurposeLatestRef.current = (borrower.operationPurpose || "").trim();
  }, [borrower.operationPurpose]);

  useEffect(() => {
    return () => {
      if (operationPurposeTimeoutRef.current) {
        clearTimeout(operationPurposeTimeoutRef.current);
        operationPurposeTimeoutRef.current = null;
      }
      if (suggestionHideTimeoutRef.current) {
        clearTimeout(suggestionHideTimeoutRef.current);
        suggestionHideTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    hasMountedRef.current = true;
  }, []);

  // NAICS lookup when operation purpose changes (simplified working version)
  useEffect(() => {
    const purpose = (borrower.operationPurpose || "").trim();
    
    if (!purpose || purpose.length < 3) {
      setOperationNaicsDetails(null);
      setNaicsLookupLoading(false);
      return;
    }

    // Clear previous timeout
    if (operationPurposeTimeoutRef.current) {
      clearTimeout(operationPurposeTimeoutRef.current);
    }

    // Debounce NAICS lookup
    operationPurposeTimeoutRef.current = setTimeout(async () => {
      setNaicsLookupLoading(true);
      try {
        const url = API_BASE ? `${API_BASE}/lookup/naics?keyword=${encodeURIComponent(purpose)}` : `/lookup/naics?keyword=${encodeURIComponent(purpose)}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data?.found) {
          setOperationNaicsDetails(data);
          handleChange("naicsCode", data.naics_code, buildLoanNaicsMeta(data.naics_code));
        } else {
          setOperationNaicsDetails(null);
          handleChange("naicsCode", "", buildLoanNaicsMeta(""));
        }
      } catch (err) {
        console.error("NAICS lookup error:", err);
        setOperationNaicsDetails(null);
        handleChange("naicsCode", "", buildLoanNaicsMeta(""));
      } finally {
        setNaicsLookupLoading(false);
      }
    }, 800);

    return () => {
      if (operationPurposeTimeoutRef.current) {
        clearTimeout(operationPurposeTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [borrower.operationPurpose]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const code = (borrower.naicsCode || "").toString().trim();
    if (!code) {
      return;
    }

    if (operationNaicsDetails && operationNaicsDetails.naics_code === code && operationNaicsDetails.description) {
      return;
    }

    let cancelled = false;
    const fetchDetails = async () => {
      try {
        const url = API_BASE ? `${API_BASE}/lookup/naics?keyword=${encodeURIComponent(code)}` : `/lookup/naics?keyword=${encodeURIComponent(code)}`;
        const response = await fetch(url);
        const data = await response.json();
        if (cancelled) return;
        if (data?.found) {
          setOperationNaicsDetails(data);
        } else {
          setOperationNaicsDetails({ naics_code: code });
        }
      } catch (err) {
        if (!cancelled) {
          console.error("NAICS lookup error:", err);
          setOperationNaicsDetails({ naics_code: code });
        }
      }
    };

    fetchDetails();
    return () => {
      cancelled = true;
    };
  }, [borrower.naicsCode]);

  const prepareBorrowerForSave = (draft) => {
    const prepared = { ...draft };
    prepared.yearsInOperation = parseIntOrNull(draft.yearsInOperation);
    return prepared;
  };

  const emitDraftWithMeta = (draft, meta = {}) => {
    try {
      onDraftChange({
        borrower: prepareBorrowerForSave(draft),
        borrowerType,
        hasCoBorrower,
        ...meta,
      });
    } catch {}
  };

  const emitBorrowerDraft = (draft, meta) => {
    emitDraftWithMeta(draft, meta);
  };

  const handleChange = (field, value, meta) => {
    setBorrower(prev => {
      if (prev[field] === value) {
        if (meta) {
          emitBorrowerDraft(prev, meta);
        }
        return prev;
      }
      const updated = { ...prev, [field]: value };
      emitBorrowerDraft(updated, meta);
      return updated;
    });
    if (field === "farmLegalEntity" && typeof value === "string" && value.trim()) {
      setFarmLegalEntityOtherError(false);
    }
  };

  const handleSelectChange = (field, value, options) => {
    if (field === "farmLegalEntity") {
      setFarmLegalEntitySelectValue(value);
      if (value !== OTHER_OPTION_VALUE) {
        setFarmLegalEntityOtherError(false);
      }
    }

    if (value === OTHER_OPTION_VALUE) {
      const current = borrower[field];
      if (!current || isStandardOptionValue(current, options)) {
        handleChange(field, "");
      }
      return;
    }

    handleChange(field, value);
  };

  const handleOperationPurposeInput = (rawValue) => {
    const nextValue = rawValue || "";
    if (suggestionHideTimeoutRef.current) {
      clearTimeout(suggestionHideTimeoutRef.current);
      suggestionHideTimeoutRef.current = null;
    }
    setShowOperationPurposeSuggestions(true);
    handleChange("operationPurpose", nextValue);
  };

  const handleAddressChange = createAddressChangeHandler(setBorrower);
  const handleAddressInput = async (field, value) => {
    handleAddressChange(field, value);
    const nextBorrower = {
      ...borrower,
      address: { ...borrower.address, [field]: value },
    };
    emitBorrowerDraft(nextBorrower);
    if (field === "street") {
      const suggestions = await fetchAddressSuggestions(value);
      setAddressSuggestions(suggestions);
    }
  };
  const applyAddressSuggestion = async (s) => {
    const newAddr = {
      street: s.street || borrower.address.street,
      city: s.city || borrower.address.city,
      state: s.state || borrower.address.state,
      zip: s.zip || borrower.address.zip,
    };
    try {
      const validated = await addressAPI.validateAddress(newAddr);
      if (validated?.suggested) {
        newAddr.street = validated.suggested.street || newAddr.street;
        newAddr.city = validated.suggested.city || newAddr.city;
        newAddr.state = validated.suggested.state || newAddr.state;
        newAddr.zip = validated.suggested.zip || newAddr.zip;
      }
    } catch (e) {
      // ignore validation errors, use raw suggestion
    }
    setBorrower(prev => {
      const updated = { ...prev, address: newAddr };
      emitBorrowerDraft(updated);
      return updated;
    });
    setAddressSuggestions([]);
  };

  const validateAddress = () => {
    autoValidateAddress(borrower.address, (newAddress) => {
      setBorrower(prev => ({ ...prev, address: newAddress }));
    });
  };

  // Handle ID image upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const ocrUrl = API_BASE ? `${API_BASE}/ocr/id` : '/ocr/id';
      const response = await fetch(ocrUrl, {
        method: "POST",
        body: formData
      });

      const text = await response.text();
      let data = null;
      try { data = JSON.parse(text); } catch (e) { /* non-json response */ }

      if (!response.ok) {
        // Try to extract an informative message from the backend/CV response
        const errMsg = data?.detail?.cv_error?.error?.message || data?.detail?.cv_error?.message || data?.detail?.cv_error || data?.detail || text || "OCR failed";
        console.error("OCR error:", errMsg);
        alert(`Could not read ID: ${errMsg}`);
        setMode("manual");
        return;
      }

      // If OCR returned but with empty text, inform user
      if (data && Array.isArray(data.rawText) && data.rawText.length === 0) {
        alert("Could not read ID from the uploaded image. Please try a clearer photo or enter details manually.");
        setMode("manual");
        return;
      }

      // Map OCR results into borrower fields
      setBorrower(prev => ({
        ...prev,
        firstName: data?.firstName || prev.firstName,
        lastName: data?.lastName || prev.lastName,
        dateOfBirth: data?.dateOfBirth || prev.dateOfBirth,
        address: {
          street: data?.street || prev.address.street,
          city: data?.city || prev.address.city,
          state: data?.state || prev.address.state,
          zip: data?.zip || prev.address.zip
        }
      }));
      onOcrResults({ source: "id", ...data });
      // show manual entry form with populated values
      setMode("manual");
    } catch (err) {
      console.error("OCR failed", err);
      // network or unexpected error
      alert("Could not read ID due to a network error. Please enter manually.");
      setMode("manual");
    }
  };

  const handleSubmit = () => {
    const ensureCustomValue = (field, selectValue) => {
      if (selectValue !== OTHER_OPTION_VALUE) {
        return true;
      }
      const current = typeof borrower[field] === "string" ? borrower[field].trim() : "";
      const isValid = Boolean(current);
      if (!isValid) {
        if (field === "farmLegalEntity") {
          setFarmLegalEntityOtherError(true);
        }
      }
      return isValid;
    };

    const legalEntityOk = ensureCustomValue("farmLegalEntity", farmLegalEntitySelectValue);
    if (!legalEntityOk) {
      return;
    }

    console.debug('[BorrowerInfoStep] handleSubmit called. Borrower:', borrower, 'Type:', borrowerType, 'HasCoBorrower:', hasCoBorrower);
    onNext({ borrower: prepareBorrowerForSave(borrower), borrowerType, hasCoBorrower });
    nextStep();
  };

  const missingMeta = useMemo(() => {
    const lookup = new Set();
    const friendly = [];
    const friendlySeen = new Set();

    (missingFields || []).forEach((field) => {
      if (!field) return;
      const raw = String(field);
      const canonical = canonicalizeBorrowerMissingField(raw);
      if (canonical) {
        lookup.add(canonical);
        const sanitizedCanonical = canonical.replace(/[^a-zA-Z0-9]+/g, "");
        if (sanitizedCanonical) {
          lookup.add(sanitizedCanonical);
        }
      }
      const sanitizedRaw = raw.replace(/[^a-zA-Z0-9]+/g, "");
      if (sanitizedRaw) {
        lookup.add(sanitizedRaw);
      }

      const label = BORROWER_FIELD_LABELS[canonical] || formatBorrowerMissingField(raw, canonical);
      if (label && !friendlySeen.has(label)) {
        friendly.push(label);
        friendlySeen.add(label);
      }
    });

    return { lookup, friendly };
  }, [missingFields]);

  const missingLookup = missingMeta.lookup;
  const missingFriendly = missingMeta.friendly;

  const isMissing = (field) => {
    if (!field) return false;
    const sanitized = field.replace(/[^a-zA-Z0-9]+/g, "");
    return missingLookup.has(field) || missingLookup.has(sanitized);
  };

  return (
    <div className="mx-auto px-4 sm:px-6 py-8 bg-white">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black mb-2">Borrower Information</h1>
        <p className="text-gray-700">
          Scan your ID for quick entry or enter your information manually.
        </p>
      </div>

      {/* Missing Fields Alert */}
      {missingFriendly.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-black mb-2">
                Finish these borrower details to keep moving:
              </div>
              {missingFriendly.length === 1 ? (
                <p className="text-gray-700 text-sm">{missingFriendly[0]}</p>
              ) : (
                <ul className="space-y-1">
                  {missingFriendly.map(label => (
                    <li key={label} className="text-gray-700 text-sm">• {label}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Borrower Type & Co-Borrower Selection */}
      <div className="mb-6 p-4 border border-gray-300 rounded-lg">
        <h3 className="font-semibold text-black mb-4">Select borrower type</h3>
        <div className="space-y-3 sm:space-y-0 sm:flex sm:gap-6 flex-wrap">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="borrowerType"
              value="individual"
              checked={borrowerType === "individual"}
              onChange={() => {
                setBorrowerType("individual");
                emitDraftWithMeta(borrower, { borrowerType: "individual" });
              }}
              className="w-4 h-4 accent-black"
            />
            <span className="text-gray-700">Individual</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="borrowerType"
              value="business"
              checked={borrowerType === "business"}
              onChange={() => {
                setBorrowerType("business");
                emitDraftWithMeta(borrower, { borrowerType: "business" });
              }}
              className="w-4 h-4 accent-black"
            />
            <span className="text-gray-700">Business</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={hasCoBorrower}
              onChange={(e) => {
                const val = e.target.checked;
                setHasCoBorrower(val);
                emitDraftWithMeta(borrower, { hasCoBorrower: val });
              }}
              className="w-4 h-4 accent-black"
            />
            <span className="text-gray-700">Add co-borrower/guarantor</span>
          </label>
        </div>
      </div>

      {/* Scan / Upload Button */}
      <div className="mb-6">
        <button
          onClick={() => setMode("scan")}
          className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 font-semibold rounded-lg transition-all ${
            mode === "scan"
              ? "bg-black text-white"
              : "bg-gray-200 text-black hover:bg-gray-300"
          }`}
        >
          <Upload size={20} />
          Scan ID / Upload Image
        </button>
      </div>

      {/* Scan Mode */}
      {mode === "scan" && (
        <div className="mb-6 p-6 bg-gray-100 border-2 border-dashed border-gray-400 rounded-lg">
          <div className="flex flex-col items-center gap-4">
            <Upload size={40} className="text-gray-600" />
            <div className="text-center">
              <label className="inline-block px-4 py-2 bg-black text-white rounded-lg cursor-pointer hover:bg-gray-800 transition">
                Choose Image
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <p className="mt-3 text-sm text-gray-600">
                Upload or take a picture of your ID to auto-fill fields.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Manual Entry Mode */}
      {mode === "manual" && (
        <div className="space-y-8">
          {/* Business Type Form */}
          {borrowerType === "business" ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  label="Legal Business Name *"
                  placeholder="ABC Farms LLC"
                  value={borrower.legalName}
                  onChange={e => handleChange("legalName", e.target.value)}
                  error={isMissing("legalName")}
                />
                <FormField
                  label="Entity Type *"
                  placeholder="LLC, S-Corp, Partnership"
                  value={borrower.entityType}
                  onChange={e => handleChange("entityType", e.target.value)}
                  error={isMissing("entityType")}
                />
              </div>

              <FormField
                label="EIN / TIN *"
                placeholder="12-3456789"
                value={borrower.tin}
                onChange={e => handleChange("tin", e.target.value)}
                error={isMissing("tin")}
              />

              {/* Authorized Signer Section */}
              <div>
                <h3 className="text-xl font-bold text-black mb-4">Authorized Signer</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    label="Name *"
                    placeholder="Jane Doe"
                    value={borrower.signerName}
                    onChange={e => handleChange("signerName", e.target.value)}
                    error={isMissing("signerName")}
                  />
                  <FormField
                    label="Title *"
                    placeholder="Owner, CFO"
                    value={borrower.signerTitle}
                    onChange={e => handleChange("signerTitle", e.target.value)}
                    error={isMissing("signerTitle")}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <FormField
                    label="Signer Email *"
                    placeholder="signer@example.com"
                    value={borrower.signerEmail}
                    onChange={e => handleChange("signerEmail", e.target.value)}
                    error={isMissing("signerEmail")}
                  />
                  <FormField
                    label="Signer Phone *"
                    placeholder="(555) 123-4567"
                    value={borrower.signerPhone}
                    onChange={e => handleChange("signerPhone", e.target.value)}
                    error={isMissing("signerPhone")}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Individual Type Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  label="First Name *"
                  placeholder="First Name"
                  value={borrower.firstName}
                  onChange={e => handleChange("firstName", e.target.value)}
                  error={isMissing("firstName")}
                />
                <FormField
                  label="Last Name *"
                  placeholder="Last Name"
                  value={borrower.lastName}
                  onChange={e => handleChange("lastName", e.target.value)}
                  error={isMissing("lastName")}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  label="Date of Birth *"
                  type="date"
                  value={borrower.dateOfBirth}
                  onChange={e => handleChange("dateOfBirth", e.target.value)}
                />
                <FormField
                  label="SSN *"
                  placeholder="123-45-6789"
                  value={borrower.ssn}
                  onChange={e => handleChange("ssn", e.target.value)}
                />
              </div>
            </>
          )}

          {/* Contact Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              label="Email *"
              placeholder="email@example.com"
              value={borrower.email}
              onChange={e => handleChange("email", e.target.value)}
            />
            <FormField
              label="Phone *"
              placeholder="(555) 123-4567"
              value={borrower.phone}
              onChange={e => handleChange("phone", e.target.value)}
            />
          </div>

          {/* Address Section */}
          <div>
            <h3 className="text-xl font-bold text-black mb-4">Address</h3>
            <div className="space-y-4">
              <FormField
                label="Street Address *"
                placeholder="123 Main Street"
                value={borrower.address.street}
                onChange={e => handleAddressInput("street", e.target.value)}
              />
              {addressSuggestions.length > 0 && (
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  {addressSuggestions.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => applyAddressSuggestion(s)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-100 transition text-gray-700 text-sm border-b border-gray-200 last:border-b-0"
                    >
                      {s.text || `${s.street || ""}, ${s.city || ""}, ${s.state || ""} ${s.zip || ""}`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              <FormField
                label="City *"
                placeholder="City"
                value={borrower.address.city}
                onChange={e => {
                  const v = e.target.value;
                  handleAddressChange("city", v);
                  emitBorrowerDraft({ ...borrower, address: { ...borrower.address, city: v } });
                }}
              />
              <FormField
                label="State *"
                placeholder="ST"
                maxLength="2"
                value={borrower.address.state}
                onChange={e => {
                  const v = e.target.value;
                  handleAddressChange("state", v);
                  emitBorrowerDraft({ ...borrower, address: { ...borrower.address, state: v } });
                }}
                onBlur={validateAddress}
              />
              <FormField
                label="ZIP Code *"
                placeholder="12345"
                maxLength="10"
                value={borrower.address.zip}
                onChange={e => {
                  const v = e.target.value;
                  handleAddressChange("zip", v);
                  emitBorrowerDraft({ ...borrower, address: { ...borrower.address, zip: v } });
                }}
                onBlur={validateAddress}
              />
            </div>
          </div>

          {/* Employment Section */}
          <div>
            <h3 className="text-xl font-bold text-black mb-4">Employment</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                label="Employer/Business Name *"
                placeholder="Employer/Business Name"
                value={borrower.employerName}
                onChange={e => handleChange("employerName", e.target.value)}
              />
              <FormField
                label="Annual Income ($) *"
                type="number"
                placeholder="50000"
                value={borrower.annualIncome}
                onChange={e => handleChange("annualIncome", e.target.value)}
              />
            </div>
          </div>

          {/* Operational Details */}
          <div>
            <h3 className="text-xl font-bold text-black mb-2">Operational Details</h3>
            <p className="text-gray-600 text-sm mb-4">
              Share a snapshot of the farm's footprint so lenders understand how the operation runs today.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Purpose Field with Suggestions */}
              <div className="relative">
                <label className="block text-sm font-semibold text-black mb-2">
                  Purpose *
                </label>
                <input
                  placeholder="e.g., Dairy farm equipment and operations"
                  value={borrower.operationPurpose}
                  onChange={e => handleOperationPurposeInput(e.target.value)}
                  onFocus={() => setShowOperationPurposeSuggestions(true)}
                  onBlur={() => {
                    if (suggestionHideTimeoutRef.current) {
                      clearTimeout(suggestionHideTimeoutRef.current);
                    }
                    suggestionHideTimeoutRef.current = setTimeout(() => {
                      setShowOperationPurposeSuggestions(false);
                      suggestionHideTimeoutRef.current = null;
                    }, 120);
                  }}
                  required
                  className="w-full px-3 py-2 border-2 border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                />
                {showOperationPurposeSuggestions && (borrower.operationPurpose || "").trim().length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-gray-500 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                    {filteredOperationPurposes.map((suggestion, idx) => (
                      <button
                        key={`${suggestion}-${idx}`}
                        onMouseDown={event => {
                          event.preventDefault();
                          handleOperationPurposeInput(suggestion);
                          setShowOperationPurposeSuggestions(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 transition text-sm border-b border-gray-200 last:border-b-0"
                      >
                        {suggestion}
                      </button>
                    ))}
                    {filteredOperationPurposes.length === 0 && (
                      <div className="px-4 py-2 text-sm text-gray-600">
                        Type a few more keywords to see suggestions.
                      </div>
                    )}
                  </div>
                )}
                
                {naicsLookupLoading && (
                  <div className="flex items-center gap-2 mt-2 text-blue-600 text-sm">
                    <Search size={16} className="animate-spin" />
                    Looking up NAICS code...
                  </div>
                )}
                {operationNaicsDetails && operationNaicsDetails.description && (
                  <div className="flex items-center gap-2 mt-2 text-green-600 text-sm font-medium">
                    <CheckCircle size={16} />
                    {operationNaicsDetails.description}
                    <span className="text-gray-600">({operationNaicsDetails.sector})</span>
                  </div>
                )}
              </div>

              {/* NAICS Code Field */}
              <div>
                <label className="block text-sm font-semibold text-black mb-2">
                  NAICS Code <span className="font-normal text-xs text-gray-600">(auto-detected)</span>
                </label>
                <input
                  type="text"
                  value={naicsDisplayValue}
                  placeholder={naicsLookupLoading ? "Looking up..." : "Enter purpose to auto-detect"}
                  readOnly
                  title={naicsTitle}
                  className="w-full px-3 py-2 bg-gray-100 border-2 border-gray-500 rounded-lg text-gray-600 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div>
                <label className="block text-sm font-semibold text-black mb-2">
                  Years In Operation
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="10"
                  value={borrower.yearsInOperation}
                  onChange={e => handleChange("yearsInOperation", e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                />
                <p className="text-xs text-gray-600 mt-1">Number of years the farm has been active.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-black mb-2">
                  Farm Legal Entity
                </label>
                <div className="relative">
                  <select
                    value={farmLegalEntitySelectValue}
                    onChange={e => handleSelectChange("farmLegalEntity", e.target.value, FARM_LEGAL_ENTITY_OPTIONS)}
                    className="w-full px-3 py-2 border-2 border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-black appearance-none bg-white pr-10"
                  >
                    <option value="">Select legal structure</option>
                    {FARM_LEGAL_ENTITY_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                </div>
                {farmLegalEntitySelectValue === OTHER_OPTION_VALUE && (
                  <input
                    placeholder="Enter legal structure"
                    value={farmLegalEntityOtherValue}
                    onChange={e => handleChange("farmLegalEntity", e.target.value)}
                    className={`w-full px-3 py-2 border-2 rounded-lg mt-2 focus:outline-none focus:ring-2 focus:ring-black ${
                      farmLegalEntityOtherHasError ? "border-red-500" : "border-gray-500"
                    }`}
                  />
                )}
                {farmLegalEntityOtherHasError && (
                  <p className="text-red-600 text-xs mt-1">
                    Enter the legal structure when selecting Other.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col-reverse sm:flex-row justify-between gap-4 mt-10 pt-8 border-t border-gray-300">
        {onBack && (
          <button
            onClick={onBack}
            className="px-6 py-3 font-semibold text-black bg-gray-200 rounded-lg hover:bg-gray-300 transition"
          >
            Back
          </button>
        )}
        <button
          onClick={handleSubmit}
          className="px-6 py-3 font-semibold text-white bg-black rounded-lg hover:bg-gray-800 transition"
        >
          Next
        </button>
      </div>
    </div>
  );
}

// Reusable FormField Component
function FormField({
  label,
  placeholder,
  type = "text",
  value,
  onChange,
  onBlur,
  error = false,
  maxLength,
  ...props
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-black mb-2">
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        maxLength={maxLength}
        className={`w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-black transition ${
          error ? "border-red-500" : "border-gray-500"
        }`}
        {...props}
      />
      {error && <p className="text-red-600 text-xs mt-1">Required</p>}
    </div>
  );
}

export default BorrowerInfoStep;
