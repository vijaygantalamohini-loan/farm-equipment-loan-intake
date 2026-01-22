// Normalization helpers used by LoanApplicationWizard

export const normalizeAddress = (addr) => {
  if (!addr || typeof addr !== 'object') return {};
  return {
    street: addr.street || addr.line1 || addr.address1 || "",
    city: addr.city || addr.town || "",
    state: addr.state || addr.province || addr.region || "",
    zip: addr.zip || addr.postal || addr.postalCode || "",
  };
};

export const normalizePerson = (p) => {
  if (!p || typeof p !== 'object') return {};
  return {
    firstName: p.firstName || p.first_name || "",
    lastName: p.lastName || p.last_name || "",
    dateOfBirth: p.dateOfBirth || p.date_of_birth || "",
    ssn: p.ssn || p.ssn_last4 || "",
    email: p.email || "",
    phone: p.phone || p.phone_number || "",
    address: normalizeAddress(p.address || {}),
    employerName: p.employerName || p.employer_name || "",
    annualIncome: p.annualIncome || p.annual_income || "",
    legalName: p.legalName || p.legal_name || "",
    entityType: p.entityType || p.entity_type || "",
    tin: p.tin || p.ein || "",
    signerName: p.signerName || p.signer_name || "",
    signerTitle: p.signerTitle || p.signer_title || "",
    signerEmail: p.signerEmail || p.signer_email || "",
    signerPhone: p.signerPhone || p.signer_phone || "",
    operationPurpose: p.operationPurpose || p.operation_purpose || "",
    yearsInOperation: p.yearsInOperation || p.years_in_operation || "",
    naicsCode: p.naicsCode || p.naics_code || "",
    farmLegalEntity: p.farmLegalEntity || p.farm_legal_entity || "",
  };
};

export const normalizeDealer = (d) => {
  if (!d || typeof d !== 'object') return {};
  return {
    dealershipName: d.dealershipName || d.dealership_name || d.name || "",
    contactPerson: d.contactPerson || d.contact_person || d.contact || "",
    phoneNumber: d.phoneNumber || d.phone_number || d.phone || "",
    email: d.email || "",
    address: normalizeAddress(d.address || {}),
    dealerLicenseNumber: d.dealerLicenseNumber || d.license_number || "",
    notes: d.notes || "",
  };
};

export const normalizeAsset = (a) => {
  if (!a || typeof a !== 'object') {
    return { id: Date.now(), make: "", model: "", year: "", serialNumber: "", condition: "", valueEstimate: "" };
  }
  return {
    id: a.id || Date.now(),
    make: a.make || "",
    model: a.model || "",
    year: a.year || "",
    serialNumber: a.serialNumber || a.serial_number || "",
    condition: a.condition || "",
    valueEstimate: a.valueEstimate || a.value_estimate || "",
    equipmentType: a.equipmentType || a.equipment_type || undefined,
  };
};

export const normalizeTradeIn = (t) => {
  if (!t || typeof t !== 'object') {
    return { id: Date.now(), make: "", model: "", year: "", serialNumber: "", hoursOrMiles: "", condition: "", valueEstimate: "" };
  }
  return {
    id: t.id || Date.now(),
    make: t.make || "",
    model: t.model || "",
    year: t.year || "",
    serialNumber: t.serialNumber || t.serial_number || "",
    hoursOrMiles: t.hoursOrMiles || t.hours_or_miles || "",
    condition: t.condition || "",
    valueEstimate: t.valueEstimate || t.value_estimate || "",
  };
};

export const normalizeLoan = (l) => {
  if (!l || typeof l !== 'object') return {};
  const purchaseAssets = Array.isArray(l.purchaseAssets || l.purchase_assets) ? (l.purchaseAssets || l.purchase_assets).map(normalizeAsset) : [];
  const tradeIns = Array.isArray(l.tradeIns || l.trade_ins) ? (l.tradeIns || l.trade_ins).map(normalizeTradeIn) : [];
  return {
    purpose: l.purpose || "",
    cashDown: l.cashDown || l.cash_down || "",
    termMonths: l.termMonths || l.term_months || "60",
    condition: l.condition || "",
    naicsCode: l.naicsCode || l.naics_code || null,
    hasTradeIn: l.hasTradeIn ?? (tradeIns.length > 0),
    purchaseAssets: purchaseAssets.length > 0 ? purchaseAssets : [{ id: Date.now(), make: "", model: "", year: "", serialNumber: "", condition: "", valueEstimate: "" }],
    tradeIns,
    amount: l.amount || ""
  };
};

export const normalizeDocuments = (doc) => {
  // Normalize to an object: { documents: [], consents: { creditCheck, shareWithLenders } }
  if (!doc) {
    return { documents: [], consents: { creditCheck: false, shareWithLenders: false } };
  }
  let documents = [];
  let consents = { creditCheck: false, shareWithLenders: false };
  if (Array.isArray(doc)) {
    documents = doc;
  } else if (typeof doc === 'object') {
    documents = Array.isArray(doc.documents) ? doc.documents : [];
    if (doc.consents && typeof doc.consents === 'object') {
      consents = {
        creditCheck: !!doc.consents.creditCheck,
        shareWithLenders: !!doc.consents.shareWithLenders,
      };
    }
  }
  return { documents, consents };
};

