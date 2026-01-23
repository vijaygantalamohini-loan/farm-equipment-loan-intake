import React, { useState } from "react";
import { loansAPI, APIError } from '../services/api';
import { validateBorrower, validateDealer, validateLoan, validateDocuments } from '../validation/schemas';

function ConfirmationStep({ formData, prevStep, token, onSuccess, applicationId, onValidationError }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      console.debug('[ConfirmationStep] handleSubmit called. formData:', formData);
      // Client-side validation before submitting
      const payload = {
        borrower_data: formData.borrower,
        coborrower_data: formData.coBorrower,
        dealer_data: formData.dealer,
        loan_data: formData.loan,
        documents_and_consents_data: Array.isArray(formData.documents) || formData.consents
          ? { documents: formData.documents || [], consents: formData.consents || {} }
          : formData.documents || { documents: [], consents: { creditCheck: false, shareWithLenders: false } },
        has_coborrower: !!formData.hasCoBorrower,
      };

      const mf = {
        borrower: validateBorrower(payload.borrower_data),
        dealer: validateDealer(payload.dealer_data),
        loan: validateLoan(payload.loan_data),
        documents: validateDocuments(payload.documents_and_consents_data),
      };
      if (payload.has_coborrower) {
        mf.coborrower = validateBorrower(payload.coborrower_data);
      }
      const hasErrors = Object.values(mf).some(arr => Array.isArray(arr) && arr.length > 0);
      if (hasErrors) {
        console.debug('[ConfirmationStep] Validation failed. Missing fields:', mf);
        if (typeof onValidationError === 'function') onValidationError(mf);
        throw new Error('Please fix highlighted missing fields before submitting.');
      }
      console.debug('[ConfirmationStep] Validation passed. Submitting application.');

      console.log('Submitting application data:', formData);
      console.log('Application ID:', applicationId);
      const result = await loansAPI.submitApplication(formData, token, applicationId);
      console.log('Submission result:', result);
      
      // Show success message
      const appNumber = result.application_number || result.id || 'Unknown';
      alert(`Success! Your application has been submitted.\n\nApplication Number: ${appNumber}\n\nYou will be redirected to the dashboard.`);
      
      // Go back to dashboard
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Submission error:', err);
      
      // Extract error message from various error types
      let errorMessage = 'Failed to submit application';
      
      if (err instanceof APIError) {
        errorMessage = err.message;
        // If there's additional detail in the data
        if (err.data && err.data.detail) {
          errorMessage = typeof err.data.detail === 'string' 
            ? err.data.detail 
            : JSON.stringify(err.data.detail);
          // Try to surface missing_fields to parent for sidebar status
          try {
            const detailObj = typeof err.data.detail === 'object' ? err.data.detail : JSON.parse(errorMessage);
            if (detailObj && detailObj.missing_fields && typeof onValidationError === 'function') {
              onValidationError(detailObj.missing_fields);
            }
          } catch {}
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      } else if (err && err.message) {
        errorMessage = err.message;
      } else if (err) {
        // Fallback for any other error type
        errorMessage = JSON.stringify(err);
        // Attempt to parse and bubble missing_fields if present
        try {
          const obj = typeof err === 'object' ? err : JSON.parse(errorMessage);
          if (obj && obj.missing_fields && typeof onValidationError === 'function') {
            onValidationError(obj.missing_fields);
          }
        } catch {}
      }
      
      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
      <h2>Review & Confirmation</h2>
      <p style={{ color: "#666", marginBottom: "20px" }}>
        Please review your information before submitting. Use the Back button to make any changes.
      </p>

      <div style={{ backgroundColor: "#f9f9f9", border: "1px solid #ddd", padding: "15px", marginBottom: "20px" }}>
        <h3 style={{ marginTop: "0", marginBottom: "10px", borderBottom: "2px solid #007bff", paddingBottom: "5px" }}>
          Borrower Information
        </h3>
        <div style={{ fontSize: "14px", lineHeight: "1.6" }}>
          <p style={{ margin: "5px 0" }}><strong>Name:</strong> {formData.borrower?.firstName} {formData.borrower?.lastName}</p>
          <p style={{ margin: "5px 0" }}><strong>Date of Birth:</strong> {formData.borrower?.dateOfBirth}</p>
          <p style={{ margin: "5px 0" }}><strong>Email:</strong> {formData.borrower?.email}</p>
          <p style={{ margin: "5px 0" }}><strong>Phone:</strong> {formData.borrower?.phone}</p>
          <p style={{ margin: "5px 0" }}><strong>Address:</strong> {formData.borrower?.address?.street}, {formData.borrower?.address?.city}, {formData.borrower?.address?.state} {formData.borrower?.address?.zip}</p>
          <p style={{ margin: "5px 0" }}><strong>Employer:</strong> {formData.borrower?.employerName}</p>
          <p style={{ margin: "5px 0" }}><strong>Annual Income:</strong> ${formData.borrower?.annualIncome}</p>
        </div>
      </div>

      <div style={{ backgroundColor: "#f9f9f9", border: "1px solid #ddd", padding: "15px", marginBottom: "20px" }}>
        <h3 style={{ marginTop: "0", marginBottom: "10px", borderBottom: "2px solid #007bff", paddingBottom: "5px" }}>
          Co-Borrower Information
        </h3>
        <div style={{ fontSize: "14px", lineHeight: "1.6" }}>
          <p style={{ margin: "5px 0" }}><strong>Name:</strong> {formData.coBorrower?.firstName} {formData.coBorrower?.lastName}</p>
          <p style={{ margin: "5px 0" }}><strong>Date of Birth:</strong> {formData.coBorrower?.dateOfBirth}</p>
          <p style={{ margin: "5px 0" }}><strong>Email:</strong> {formData.coBorrower?.email}</p>
          <p style={{ margin: "5px 0" }}><strong>Phone:</strong> {formData.coBorrower?.phone}</p>
          <p style={{ margin: "5px 0" }}><strong>Address:</strong> {formData.coBorrower?.address?.street}, {formData.coBorrower?.address?.city}, {formData.coBorrower?.address?.state} {formData.coBorrower?.address?.zip}</p>
          <p style={{ margin: "5px 0" }}><strong>Employer:</strong> {formData.coBorrower?.employerName}</p>
          <p style={{ margin: "5px 0" }}><strong>Annual Income:</strong> ${formData.coBorrower?.annualIncome}</p>
        </div>
      </div>

      <div style={{ backgroundColor: "#f9f9f9", border: "1px solid #ddd", padding: "15px", marginBottom: "20px" }}>
        <h3 style={{ marginTop: "0", marginBottom: "10px", borderBottom: "2px solid #007bff", paddingBottom: "5px" }}>
          Dealer Information
        </h3>
        <div style={{ fontSize: "14px", lineHeight: "1.6" }}>
          <p style={{ margin: "5px 0" }}><strong>Dealership:</strong> {formData.dealer?.dealershipName}</p>
          <p style={{ margin: "5px 0" }}><strong>Contact Person:</strong> {formData.dealer?.contactPerson}</p>
          <p style={{ margin: "5px 0" }}><strong>Phone:</strong> {formData.dealer?.phoneNumber}</p>
          <p style={{ margin: "5px 0" }}><strong>Email:</strong> {formData.dealer?.email}</p>
          <p style={{ margin: "5px 0" }}><strong>Address:</strong> {formData.dealer?.address?.street}, {formData.dealer?.address?.city}, {formData.dealer?.address?.state} {formData.dealer?.address?.zip}</p>
          {formData.dealer?.dealerLicenseNumber && (
            <p style={{ margin: "5px 0" }}><strong>License #:</strong> {formData.dealer?.dealerLicenseNumber}</p>
          )}
        </div>
      </div>

      {/* Loan Calculation Breakdown */}
      <div style={{ backgroundColor: "#e7f3ff", border: "2px solid #007bff", padding: "20px", marginBottom: "20px", borderRadius: "8px" }}>
        <h3 style={{ marginTop: "0", marginBottom: "15px", color: "#007bff" }}>
          💰 Loan Summary
        </h3>
        
        {/* Loan Info */}
        <div style={{ fontSize: "14px", marginBottom: "20px", padding: "15px", backgroundColor: "#fff", borderRadius: "4px" }}>
          <div style={{ marginBottom: "10px" }}>
            <strong style={{ display: "block", marginBottom: "5px" }}>Purpose:</strong>
            <div style={{ padding: "8px", backgroundColor: "#f8f9fa", border: "1px solid #dee2e6", borderRadius: "4px" }}>
              {formData.loan?.purpose}
            </div>
          </div>
          
          {(() => {
            const naics = formData.loan?.naicsCode;
            if (!naics) return null;
            const code = typeof naics === 'object' && naics !== null ? (naics.naics_code || '') : naics;
            const desc = typeof naics === 'object' && naics !== null ? (naics.description || '') : '';
            const sector = typeof naics === 'object' && naics !== null ? (naics.sector || '') : '';
            return (
            <div style={{ marginTop: "15px" }}>
              <strong style={{ display: "block", marginBottom: "5px" }}>NAICS Code:</strong>
              <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: "10px" }}>
                <div style={{ 
                  padding: "8px", 
                  backgroundColor: "#e9ecef", 
                  border: "1px solid #ced4da", 
                  borderRadius: "4px",
                  fontWeight: "bold",
                  color: "#495057"
                }}>
                  {code}
                </div>
                <div style={{ 
                  padding: "8px", 
                  backgroundColor: "#e9ecef", 
                  border: "1px solid #ced4da", 
                  borderRadius: "4px",
                  color: "#495057"
                }}>
                  {desc || 'NAICS code selected'}{sector ? ` - ${sector}` : ''}
                </div>
              </div>
            </div>
            );
          })()}
        </div>

        {/* Calculation */}
        <div style={{ fontSize: "15px", lineHeight: "2" }}>
          {(() => {
            const totalEquipment = (formData.loan?.purchaseAssets || []).reduce(
              (sum, a) => sum + (parseFloat(a.valueEstimate) || 0), 0
            );
            const totalTradeIn = (formData.loan?.tradeIns || []).reduce(
              (sum, t) => sum + (parseFloat(t.valueEstimate) || 0), 0
            );
            const cashDown = parseFloat(formData.loan?.cashDown) || 0;
            const loanAmount = parseFloat(formData.loan?.amount) || 0;

            return (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span>Total Equipment Value:</span>
                  <strong>${totalEquipment.toLocaleString()}</strong>
                </div>
                {totalTradeIn > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", color: "#28a745" }}>
                    <span>Less: Trade-In Allowance:</span>
                    <strong>-${totalTradeIn.toLocaleString()}</strong>
                  </div>
                )}
                {cashDown > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", color: "#28a745" }}>
                    <span>Less: Cash Down:</span>
                    <strong>-${cashDown.toLocaleString()}</strong>
                  </div>
                )}
                <hr style={{ margin: "12px 0", border: "none", borderTop: "2px solid #007bff" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "18px", color: "#007bff" }}>
                  <strong>Loan Amount Requested:</strong>
                  <strong>${loanAmount.toLocaleString()}</strong>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Purchase Assets */}
      <div style={{ backgroundColor: "#f9f9f9", border: "1px solid #ddd", padding: "15px", marginBottom: "20px" }}>
        <h3 style={{ marginTop: "0", marginBottom: "10px", borderBottom: "2px solid #007bff", paddingBottom: "5px" }}>
          Equipment to Purchase ({formData.loan?.purchaseAssets?.length || 0})
        </h3>
        {(formData.loan?.purchaseAssets || []).map((asset, idx) => (
          <div key={idx} style={{ 
            fontSize: "14px", 
            lineHeight: "1.6", 
            marginBottom: idx < (formData.loan?.purchaseAssets?.length || 0) - 1 ? "15px" : "0",
            paddingBottom: idx < (formData.loan?.purchaseAssets?.length || 0) - 1 ? "15px" : "0",
            borderBottom: idx < (formData.loan?.purchaseAssets?.length || 0) - 1 ? "1px solid #ddd" : "none"
          }}>
            <p style={{ margin: "5px 0", fontWeight: "bold", color: "#007bff" }}>Asset {idx + 1}</p>
            <p style={{ margin: "5px 0" }}><strong>Equipment:</strong> {asset.year} {asset.make} {asset.model}</p>
            <p style={{ margin: "5px 0" }}><strong>Serial Number:</strong> {asset.serialNumber}</p>
            <p style={{ margin: "5px 0" }}><strong>Value:</strong> ${parseFloat(asset.valueEstimate).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Trade-Ins (if any) */}
      {formData.loan?.tradeIns && formData.loan.tradeIns.length > 0 && (
        <div style={{ backgroundColor: "#f9f9f9", border: "1px solid #ddd", padding: "15px", marginBottom: "20px" }}>
          <h3 style={{ marginTop: "0", marginBottom: "10px", borderBottom: "2px solid #17a2b8", paddingBottom: "5px" }}>
            Trade-In Equipment ({formData.loan.tradeIns.length})
          </h3>
          {formData.loan.tradeIns.map((tradeIn, idx) => (
            <div key={idx} style={{ 
              fontSize: "14px", 
              lineHeight: "1.6",
              marginBottom: idx < formData.loan.tradeIns.length - 1 ? "15px" : "0",
              paddingBottom: idx < formData.loan.tradeIns.length - 1 ? "15px" : "0",
              borderBottom: idx < formData.loan.tradeIns.length - 1 ? "1px solid #ddd" : "none"
            }}>
              <p style={{ margin: "5px 0", fontWeight: "bold", color: "#17a2b8" }}>Trade-In {idx + 1}</p>
              <p style={{ margin: "5px 0" }}><strong>Equipment:</strong> {tradeIn.year} {tradeIn.make} {tradeIn.model}</p>
              {tradeIn.serialNumber && (
                <p style={{ margin: "5px 0" }}><strong>Serial Number:</strong> {tradeIn.serialNumber}</p>
              )}
              {tradeIn.hoursOrMiles && (
                <p style={{ margin: "5px 0" }}><strong>Hours/Miles:</strong> {tradeIn.hoursOrMiles}</p>
              )}
              <p style={{ margin: "5px 0" }}><strong>Condition:</strong> {tradeIn.condition}</p>
              <p style={{ margin: "5px 0" }}><strong>Trade-In Value:</strong> ${parseFloat(tradeIn.valueEstimate).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      <div style={{ backgroundColor: "#f9f9f9", border: "1px solid #ddd", padding: "15px", marginBottom: "20px" }}>
        <h3 style={{ marginTop: "0", marginBottom: "10px", borderBottom: "2px solid #007bff", paddingBottom: "5px" }}>
          Documents & Consents
        </h3>
        <div style={{ fontSize: "14px", lineHeight: "1.6" }}>
          <p style={{ margin: "5px 0" }}><strong>Documents:</strong> {formData.documents?.length > 0 ? formData.documents?.map((doc, idx) => <span key={idx}>{doc.name}{idx < formData.documents.length - 1 ? ", " : ""}</span>) : "None uploaded"}</p>
          <p style={{ margin: "5px 0" }}><strong>Credit Check Consent:</strong> {formData.consents?.creditCheck ? "✓ Yes" : "✗ No"}</p>
          <p style={{ margin: "5px 0" }}><strong>Share With Lenders:</strong> {formData.consents?.shareWithLenders ? "✓ Yes" : "✗ No"}</p>
        </div>
      </div>

      {submitError && (
        <div style={{ 
          backgroundColor: '#f8d7da', 
          color: '#721c24', 
          border: '1px solid #f5c6cb',
          borderRadius: '4px',
          padding: '15px',
          marginBottom: '20px'
        }}>
          <strong>Error:</strong> {submitError}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "30px" }}>
        <button 
          onClick={prevStep}
          disabled={isSubmitting}
          style={{ 
            padding: "10px 30px", 
            fontSize: "16px", 
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.6 : 1
          }}
        >
          Back
        </button>
        <button 
          onClick={handleSubmit}
          disabled={isSubmitting}
          style={{ 
            padding: "10px 30px", 
            fontSize: "16px", 
            cursor: isSubmitting ? 'not-allowed' : 'pointer', 
            backgroundColor: "#28a745", 
            color: "white", 
            border: "none", 
            fontWeight: "bold",
            opacity: isSubmitting ? 0.6 : 1
          }}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Application'}
        </button>
      </div>
    </div>
  );
}

export default ConfirmationStep;