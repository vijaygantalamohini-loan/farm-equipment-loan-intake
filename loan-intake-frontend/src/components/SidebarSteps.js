import React from 'react';
import { validateBorrower, validateDealer, validateLoan, validateDocuments } from '../validation/schemas';

function SidebarSteps({ step, formData, missingFields = {}, onStepClick }) {
  const items = [
    { num: 1, key: 'borrower', label: 'Borrower' },
    { num: 2, key: 'coborrower', label: 'Co-Borrower' },
    { num: 3, key: 'dealer', label: 'Dealer' },
    { num: 4, key: 'loan', label: 'Equipment & Deal' },
    { num: 5, key: 'documents', label: 'Documents' },
    { num: 6, key: 'confirm', label: 'Confirm' },
  ];

  const isStepEnabled = (n) => !(n === 2 && !formData.hasCoBorrower);
  const handleStepClick = (n) => {
    if (!isStepEnabled(n)) return;
    if (typeof onStepClick === 'function') onStepClick(n);
  };

  const computeLocalMissing = (sectionKey) => {
    try {
      if (sectionKey === 'borrower') {
        const local = validateBorrower(formData.borrower);
        const backend = (missingFields && missingFields.borrower) || [];
        return Array.from(new Set([...(local || []), ...(backend || [])]));
      }
      if (sectionKey === 'dealer') {
        const local = validateDealer(formData.dealer);
        const backend = (missingFields && missingFields.dealer) || [];
        return Array.from(new Set([...(local || []), ...(backend || [])]));
      }
      if (sectionKey === 'loan') {
        const local = validateLoan(formData.loan);
        const backend = (missingFields && missingFields.loan) || [];
        return Array.from(new Set([...(local || []), ...(backend || [])]));
      }
      if (sectionKey === 'coborrower') {
        if (!formData.hasCoBorrower) return [];
        const local = validateBorrower(formData.coBorrower);
        const backend = (missingFields && missingFields.coborrower) || [];
        return Array.from(new Set([...(local || []), ...(backend || [])]));
      }
      if (sectionKey === 'documents') {
        const docObj = Array.isArray(formData.documents)
          ? { documents: formData.documents, consents: formData.consents || {} }
          : (formData.documents || { documents: [], consents: { creditCheck: false, shareWithLenders: false } });
        const baseMissing = validateDocuments(docObj) || [];
        const consentMissing = (!docObj.consents?.creditCheck || !docObj.consents?.shareWithLenders) ? ['consents'] : [];
        const backend = (missingFields && missingFields.documents) || [];
        return Array.from(new Set([...(baseMissing || []), ...consentMissing, ...(backend || [])]));
      }
    } catch {}
    return [];
  };

  const isSectionStarted = (sectionKey) => {
    try {
      if (sectionKey === 'borrower') {
        const b = formData.borrower || {};
        return !!(b.firstName || b.lastName || b.email || b.phone || (b.address && (b.address.street || b.address.city || b.address.state || b.address.zip)));
      }
      if (sectionKey === 'coborrower') {
        if (!formData.hasCoBorrower) return false;
        const c = formData.coBorrower || {};
        return !!(c.firstName || c.lastName || c.email || c.phone || (c.address && (c.address.street || c.address.city || c.address.state || c.address.zip)));
      }
      if (sectionKey === 'dealer') {
        const d = formData.dealer || {};
        return !!(d.dealershipName || d.email || d.phoneNumber || (d.address && (d.address.street || d.address.city || d.address.state || d.address.zip)));
      }
      if (sectionKey === 'loan') {
        const l = formData.loan || {};
        const assets = Array.isArray(l.purchaseAssets) ? l.purchaseAssets : [];
        const hasAssetData = assets.some(a => a.make || a.model || a.year || a.serialNumber || a.valueEstimate);
        return !!(l.purpose || l.naicsCode || l.cashDown || hasAssetData || (Array.isArray(l.tradeIns) && l.tradeIns.length > 0));
      }
      if (sectionKey === 'documents') {
        const docObj = Array.isArray(formData.documents)
          ? { documents: formData.documents, consents: formData.consents || {} }
          : (formData.documents || { documents: [], consents: { creditCheck: false, shareWithLenders: false } });
        const docsLen = Array.isArray(docObj.documents) ? docObj.documents.length : 0;
        return !!(docsLen > 0 || docObj.consents?.creditCheck || docObj.consents?.shareWithLenders);
      }
      if (sectionKey === 'confirm') {
        const keys = ['borrower', formData.hasCoBorrower ? 'coborrower' : null, 'dealer', 'loan', 'documents'].filter(Boolean);
        return keys.every(k => {
          const missing = computeLocalMissing(k);
          return Array.isArray(missing) && missing.length === 0 && isSectionStarted(k);
        });
      }
    } catch {}
    return false;
  };

  return (
    <div style={{ width: '240px', alignSelf: 'flex-start', position: 'sticky', top: '16px', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', background: '#f8f9fa', border: '1px solid #eee', borderRadius: '8px', padding: '12px' }}>
      <h4 style={{ marginTop: 0, marginBottom: '10px' }}>Steps</h4>
      {items.map(({ num, key, label }) => {
        const isCurrent = step === num;
        const enabled = isStepEnabled(num);
        let status = 'Ready';
        let color = '#388e3c';
        let missingList = [];
        if (num === 2 && !formData.hasCoBorrower) {
          status = 'Disabled';
          color = '#6c757d';
        } else {
          const started = isSectionStarted(key);
          const localMissing = computeLocalMissing(key);
          missingList = Array.isArray(localMissing) ? localMissing : [];
          if (!started) {
            status = 'Not started';
            color = '#666';
          } else if (Array.isArray(localMissing) && localMissing.length > 0) {
            status = `Missing${missingList.length ? ` (${missingList.length})` : ''}`;
            color = '#d32f2f';
          }
        }
        return (
          <div
            key={num}
            onClick={enabled ? () => handleStepClick(num) : undefined}
            title={enabled ? `Go to ${label}` : (num === 2 ? 'Enable co-borrower on Step 1 to use this step' : '')}
            style={{
              padding: '6px 8px',
              borderRadius: '6px',
              marginBottom: '6px',
              background: isCurrent ? '#e8f0fe' : 'transparent',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: enabled ? 'pointer' : 'default'
            }}
          >
            <span>{num}. {label}</span>
            <span
              style={{ color, fontSize: '12px' }}
              title={status.startsWith('Missing') && missingList.length ? `Missing: ${missingList.join(', ')}` : ''}
            >
              {status}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default SidebarSteps;
