import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import LoanApplicationWizard from '../LoanApplicationWizard';

jest.mock('../services/api.js', () => {
  return {
    loansAPI: {
      getApplication: jest.fn().mockResolvedValue({
        id: 'APP-TEST-ID',
        application_number: 'LA-TEST',
        borrower_type: 'individual',
        has_coborrower: false,
        borrower_data: { firstName: 'Alice', lastName: 'Tester' },
        dealer_data: { dealershipName: 'Dealers Inc' },
        loan_data: { purpose: '', naics_code: null, purchase_assets: [{}] },
        documents_and_consents_data: { documents: [], consents: { creditCheck: false, shareWithLenders: true } },
        missing_fields: { loan: ['naicsCode', 'purchaseAssets'] },
      }),
      startApplication: jest.fn().mockResolvedValue({ data: { application_id: 'APP-TEST-ID', application_number: 'LA-TEST' } }),
      saveDraft: jest.fn().mockResolvedValue({ data: { missing_fields: {} } }),
    },
    APIError: class APIError extends Error {},
  };
});

// Sidebar should show Missing (N) for step 4 (Equipment & Deal) and tooltip lists fields

describe('LoanApplicationWizard sidebar status', () => {
  test.skip('shows Missing count and tooltip for step 4 when backend reports loan missing fields', async () => {
    // Silence alert in jsdom
    try { window.alert = () => {}; } catch {}
    render(
      <LoanApplicationWizard 
        user={{ name: 'testuser2' }} 
        token={'dummy.token'} 
        editingApplicationId={'APP-TEST-ID'} 
        onBack={() => {}} 
        onViewOffers={() => {}} 
      />
    );

    // Wait for application to load and UI to render sidebar
    await waitFor(() => {
      expect(screen.getByText(/Steps/i)).toBeInTheDocument();
    });

    // Verify step label and status text are present
    expect(screen.getByText(/4\. Equipment & Deal/i)).toBeInTheDocument();
    const statusEl = screen.getByText(/Missing\s*\(\d+\)/i);
    expect(statusEl).toBeInTheDocument();
    expect((statusEl.getAttribute('title') || '')).toMatch(/naicsCode|purchaseAssets/);
  });
});
