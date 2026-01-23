import React, { useState, useEffect, useMemo, useRef } from "react";
import { autoValidateAddress, createAddressChangeHandler, fetchAddressSuggestions } from "../utils/addressUtils";
import { addressAPI, API_BASE } from "../services/api";

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
    .replace(/[_\-]+/g, " ")
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
  }, [borrower.operationPurpose]);

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
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
      <h2>Borrower Information</h2>
      <p style={{ color: "#666", marginBottom: "20px" }}>
        Scan your ID for quick entry or enter your information manually.
      </p>

      {missingFriendly.length > 0 && (
        <div
          style={{
            marginBottom: "20px",
            padding: "12px 16px",
            backgroundColor: "#fff5f5",
            border: "1px solid #f5c2c7",
            borderRadius: "6px",
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: missingFriendly.length > 1 ? "8px" : "0" }}>
            Finish these borrower details to keep moving:
          </div>
          {missingFriendly.length === 1 ? (
            <div>{missingFriendly[0]}</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "20px" }}>
              {missingFriendly.map(label => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div style={{ marginBottom: "16px", display: "flex", gap: "16px", alignItems: "center" }}>
        <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            type="radio"
            name="borrowerType"
            value="individual"
            checked={borrowerType === "individual"}
            onChange={() => {
              setBorrowerType("individual");
              emitDraftWithMeta(borrower, { borrowerType: "individual" });
            }}
          />
          Individual
        </label>
        <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            type="radio"
            name="borrowerType"
            value="business"
            checked={borrowerType === "business"}
            onChange={() => {
              setBorrowerType("business");
              emitDraftWithMeta(borrower, { borrowerType: "business" });
            }}
          />
          Business
        </label>
        <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            type="checkbox"
            checked={hasCoBorrower}
            onChange={(e) => {
              const val = e.target.checked;
              setHasCoBorrower(val);
              emitDraftWithMeta(borrower, { hasCoBorrower: val });
            }}
          />
          Add co-borrower/guarantor
        </label>
      </div>

      <div style={{ marginBottom: "20px", display: "flex", gap: "10px" }}>
        <button
          onClick={() => setMode("scan")}
          style={{
            padding: "10px 20px",
            fontSize: "14px",
            cursor: "pointer",
            backgroundColor: mode === "scan" ? "#007bff" : "#f0f0f0",
            color: mode === "scan" ? "white" : "black",
            border: "1px solid #ccc",
          }}
        >
          Scan ID / Upload Image
        </button>
      </div>

      {mode === "scan" && (
        <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#f9f9f9", border: "1px solid #ddd" }}>
          <input type="file" accept="image/*" onChange={handleFileUpload} style={{ marginBottom: "10px" }} />
          <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>Upload or take a picture of your ID to auto-fill fields.</p>
        </div>
      )}

      {mode === "manual" && (
        <div>
          {borrowerType === "business" ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                    Legal Business Name *
                  </label>
                  <input
                    placeholder="ABC Farms LLC"
                    value={borrower.legalName}
                    onChange={e => handleChange("legalName", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      fontSize: "14px",
                      border: isMissing("legalName") ? "1px solid #dc3545" : "1px solid #ced4da",
                      borderRadius: "4px",
                    }}
                  />
                  {isMissing("legalName") && <div style={{ color: "red", fontSize: "12px" }}>Required</div>}
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                    Entity Type *
                  </label>
                  <input
                    placeholder="LLC, S-Corp, Partnership"
                    value={borrower.entityType}
                    onChange={e => handleChange("entityType", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      fontSize: "14px",
                      border: isMissing("entityType") ? "1px solid #dc3545" : "1px solid #ced4da",
                      borderRadius: "4px",
                    }}
                  />
                  {isMissing("entityType") && <div style={{ color: "red", fontSize: "12px" }}>Required</div>}
                </div>
              </div>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                  EIN / TIN *
                </label>
                <input
                  placeholder="12-3456789"
                  value={borrower.tin}
                  onChange={e => handleChange("tin", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px",
                    fontSize: "14px",
                    border: isMissing("tin") ? "1px solid #dc3545" : "1px solid #ced4da",
                    borderRadius: "4px",
                  }}
                />
                {isMissing("tin") && <div style={{ color: "red", fontSize: "12px" }}>Required</div>}
              </div>

              <h3 style={{ marginTop: "10px", marginBottom: "10px" }}>Authorized Signer</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                    Name *
                  </label>
                  <input
                    placeholder="Jane Doe"
                    value={borrower.signerName}
                    onChange={e => handleChange("signerName", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      fontSize: "14px",
                      border: isMissing("signerName") ? "1px solid #dc3545" : "1px solid #ced4da",
                      borderRadius: "4px",
                    }}
                  />
                  {isMissing("signerName") && <div style={{ color: "red", fontSize: "12px" }}>Required</div>}
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                    Title *
                  </label>
                  <input
                    placeholder="Owner, CFO"
                    value={borrower.signerTitle}
                    onChange={e => handleChange("signerTitle", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      fontSize: "14px",
                      border: isMissing("signerTitle") ? "1px solid #dc3545" : "1px solid #ced4da",
                      borderRadius: "4px",
                    }}
                  />
                  {isMissing("signerTitle") && <div style={{ color: "red", fontSize: "12px" }}>Required</div>}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                    Signer Email *
                  </label>
                  <input
                    placeholder="signer@example.com"
                    value={borrower.signerEmail}
                    onChange={e => handleChange("signerEmail", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      fontSize: "14px",
                      border: isMissing("signerEmail") ? "1px solid #dc3545" : "1px solid #ced4da",
                      borderRadius: "4px",
                    }}
                  />
                  {isMissing("signerEmail") && <div style={{ color: "red", fontSize: "12px" }}>Required</div>}
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                    Signer Phone *
                  </label>
                  <input
                    placeholder="(555) 123-4567"
                    value={borrower.signerPhone}
                    onChange={e => handleChange("signerPhone", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      fontSize: "14px",
                      border: isMissing("signerPhone") ? "1px solid #dc3545" : "1px solid #ced4da",
                      borderRadius: "4px",
                    }}
                  />
                  {isMissing("signerPhone") && <div style={{ color: "red", fontSize: "12px" }}>Required</div>}
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                    First Name *
                  </label>
                  <input
                    placeholder="First Name"
                    value={borrower.firstName}
                    onChange={e => handleChange("firstName", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      fontSize: "14px",
                      border: isMissing("firstName") ? "1px solid #dc3545" : "1px solid #ced4da",
                      borderRadius: "4px",
                    }}
                  />
                  {isMissing("firstName") && <div style={{ color: "red", fontSize: "12px" }}>Required</div>}
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                    Last Name *
                  </label>
                  <input
                    placeholder="Last Name"
                    value={borrower.lastName}
                    onChange={e => handleChange("lastName", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      fontSize: "14px",
                      border: isMissing("lastName") ? "1px solid #dc3545" : "1px solid #ced4da",
                      borderRadius: "4px",
                    }}
                  />
                  {isMissing("lastName") && <div style={{ color: "red", fontSize: "12px" }}>Required</div>}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                    Date of Birth *
                  </label>
                  <input
                    type="date"
                    value={borrower.dateOfBirth}
                    onChange={e => handleChange("dateOfBirth", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      fontSize: "14px",
                      border: isMissing("dateOfBirth") ? "1px solid #dc3545" : "1px solid #ced4da",
                      borderRadius: "4px",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                    SSN *
                  </label>
                  <input
                    placeholder="123-45-6789"
                    value={borrower.ssn}
                    onChange={e => handleChange("ssn", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      fontSize: "14px",
                      border: isMissing("ssn") ? "1px solid #dc3545" : "1px solid #ced4da",
                      borderRadius: "4px",
                    }}
                  />
                </div>
              </div>
            </>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Email *
              </label>
              <input
                placeholder="email@example.com"
                value={borrower.email}
                onChange={e => handleChange("email", e.target.value)}
                style={{ width: "100%", padding: "8px", fontSize: "14px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Phone *
              </label>
              <input
                placeholder="(555) 123-4567"
                value={borrower.phone}
                onChange={e => handleChange("phone", e.target.value)}
                style={{ width: "100%", padding: "8px", fontSize: "14px" }}
              />
            </div>
          </div>

          <h3 style={{ marginTop: "25px", marginBottom: "15px" }}>Address</h3>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
              Street Address *
            </label>
            <input
              placeholder="123 Main Street"
              value={borrower.address.street}
              onChange={e => handleAddressInput("street", e.target.value)}
              style={{ width: "100%", padding: "8px", fontSize: "14px" }}
            />
            {addressSuggestions.length > 0 && (
              <div style={{ border: "1px solid #ddd", borderRadius: "4px", marginTop: "8px", background: "#fff" }}>
                {addressSuggestions.map((s, idx) => (
                  <div
                    key={idx}
                    onClick={() => applyAddressSuggestion(s)}
                    style={{ padding: "8px", cursor: "pointer", borderBottom: idx === addressSuggestions.length - 1 ? "none" : "1px solid #eee" }}
                  >
                    {s.text || `${s.street || ""}, ${s.city || ""}, ${s.state || ""} ${s.zip || ""}`}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "15px", marginBottom: "15px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                City *
              </label>
              <input
                placeholder="City"
                value={borrower.address.city}
                onChange={e => {
                  const v = e.target.value;
                  handleAddressChange("city", v);
                  emitBorrowerDraft({ ...borrower, address: { ...borrower.address, city: v } });
                }}
                style={{ width: "100%", padding: "8px", fontSize: "14px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                State *
              </label>
              <input
                placeholder="ST"
                value={borrower.address.state}
                onChange={e => {
                  const v = e.target.value;
                  handleAddressChange("state", v);
                  emitBorrowerDraft({ ...borrower, address: { ...borrower.address, state: v } });
                }}
                onBlur={validateAddress}
                maxLength="2"
                style={{ width: "100%", padding: "8px", fontSize: "14px", textTransform: "uppercase" }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                ZIP Code *
              </label>
              <input
                placeholder="12345"
                value={borrower.address.zip}
                onChange={e => {
                  const v = e.target.value;
                  handleAddressChange("zip", v);
                  emitBorrowerDraft({ ...borrower, address: { ...borrower.address, zip: v } });
                }}
                onBlur={validateAddress}
                maxLength="10"
                style={{ width: "100%", padding: "8px", fontSize: "14px" }}
              />
            </div>
          </div>

          <h3 style={{ marginTop: "25px", marginBottom: "15px" }}>Employment</h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Employer/Business Name *
              </label>
              <input
                placeholder="Employer/Business Name"
                value={borrower.employerName}
                onChange={e => handleChange("employerName", e.target.value)}
                style={{ width: "100%", padding: "8px", fontSize: "14px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Annual Income ($) *
              </label>
              <input
                type="number"
                placeholder="50000"
                value={borrower.annualIncome}
                onChange={e => handleChange("annualIncome", e.target.value)}
                style={{ width: "100%", padding: "8px", fontSize: "14px" }}
              />
            </div>
          </div>

          <h3 style={{ marginTop: "25px", marginBottom: "10px" }}>Operational Details</h3>
          <p style={{ color: "#666", marginTop: "0", marginBottom: "15px", fontSize: "13px" }}>
            Share a snapshot of the farm&apos;s footprint so lenders understand how the operation runs today.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
            <div style={{ position: "relative" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "14px" }}>
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
                style={{ width: "100%", padding: "8px", fontSize: "14px" }}
              />
              {showOperationPurposeSuggestions && (borrower.operationPurpose || "").trim().length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    backgroundColor: "white",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    marginTop: "2px",
                    maxHeight: "200px",
                    overflowY: "auto",
                    zIndex: 1000,
                    boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
                  }}
                >
                  {filteredOperationPurposes.map((suggestion, idx) => (
                    <div
                      key={`${suggestion}-${idx}`}
                      onMouseDown={event => {
                        event.preventDefault();
                        handleOperationPurposeInput(suggestion);
                        setShowOperationPurposeSuggestions(false);
                      }}
                      style={{
                        padding: "10px",
                        cursor: "pointer",
                        borderBottom: idx === filteredOperationPurposes.length - 1 ? "none" : "1px solid #eee",
                        fontSize: "13px",
                        backgroundColor: "white"
                      }}
                      onMouseEnter={event => (event.currentTarget.style.backgroundColor = "#f0f0f0")}
                      onMouseLeave={event => (event.currentTarget.style.backgroundColor = "white")}
                    >
                      {suggestion}
                    </div>
                  ))}
                  {filteredOperationPurposes.length === 0 && (
                    <div style={{ padding: "10px", fontSize: "12px", color: "#666" }}>
                      Type a few more keywords to see suggestions.
                    </div>
                  )}
                </div>
              )}
              
              {naicsLookupLoading && (
                <small style={{ display: "block", marginTop: "3px", color: "#007bff", fontSize: "12px" }}>
                  🔍 Looking up NAICS code...
                </small>
              )}
              {operationNaicsDetails && operationNaicsDetails.description && (
                <small style={{ display: "block", marginTop: "3px", color: "#28a745", fontSize: "12px", fontWeight: "500" }}>
                  ✓ {operationNaicsDetails.description}
                  <span style={{ marginLeft: "8px", color: "#666" }}>({operationNaicsDetails.sector})</span>
                </small>
              )}
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "14px" }}>
                NAICS Code <span style={{ fontWeight: "normal", fontSize: "12px", color: "#666" }}>(auto-detected)</span>
              </label>
              <input
                type="text"
                value={naicsDisplayValue}
                placeholder={naicsLookupLoading ? "Looking up..." : "Enter purpose to auto-detect"}
                readOnly
                title={naicsTitle}
                style={{
                  width: "100%",
                  padding: "8px",
                  fontSize: "14px",
                  backgroundColor: naicsDisplayValue ? "#e9ecef" : "#f8f9fa",
                  border: "1px solid #ced4da",
                  color: naicsDisplayValue ? "#495057" : "#999",
                  cursor: "not-allowed",
                  fontWeight: naicsDisplayValue ? "500" : "normal"
                }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Years In Operation
              </label>
              <input
                type="number"
                min="0"
                placeholder="10"
                value={borrower.yearsInOperation}
                onChange={e => handleChange("yearsInOperation", e.target.value)}
                style={{ width: "100%", padding: "8px", fontSize: "14px" }}
              />
              <small style={{ color: "#777" }}>Number of years the farm has been active.</small>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Farm Legal Entity
              </label>
              <select
                value={farmLegalEntitySelectValue}
                onChange={e => handleSelectChange("farmLegalEntity", e.target.value, FARM_LEGAL_ENTITY_OPTIONS)}
                style={{ width: "100%", padding: "8px", fontSize: "14px" }}
              >
                <option value="">Select legal structure</option>
                {FARM_LEGAL_ENTITY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {farmLegalEntitySelectValue === OTHER_OPTION_VALUE && (
                <input
                  placeholder="Enter legal structure"
                  value={farmLegalEntityOtherValue}
                  onChange={e => handleChange("farmLegalEntity", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px",
                    fontSize: "14px",
                    marginTop: "8px",
                    borderColor: farmLegalEntityOtherHasError ? "red" : "#ccc",
                  }}
                />
              )}
              {farmLegalEntityOtherHasError && (
                <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>
                  Enter the legal structure when selecting Other.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: onBack ? "space-between" : "flex-end",
          marginTop: "30px",
        }}
      >
        {onBack && (
          <button
            onClick={onBack}
            style={{ padding: "10px 30px", fontSize: "16px", cursor: "pointer" }}
          >
            Back
          </button>
        )}
        <button
          onClick={handleSubmit}
          style={{ padding: "10px 30px", fontSize: "16px", cursor: "pointer", backgroundColor: "#007bff", color: "white", border: "none" }}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default BorrowerInfoStep;
