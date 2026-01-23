import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SidebarSteps from '../SidebarSteps';

function makeForm(overrides = {}) {
  return {
    borrowerType: 'individual',
    hasCoBorrower: false,
    borrower: {},
    coBorrower: {},
    dealer: {},
    loan: { purchaseAssets: [], tradeIns: [] },
    documents: { documents: [], consents: { creditCheck: false, shareWithLenders: false } },
    ...overrides
  };
}

describe('SidebarSteps', () => {
  test('shows Missing count and tooltip for Equipment & Deal (Step 4)', async () => {
    const formData = makeForm({
      borrower: { firstName: 'A', lastName: 'B' },
      dealer: { dealershipName: 'D' },
      loan: { purpose: 'Purchase', purchaseAssets: [], tradeIns: [], naicsCode: null },
    });
    const missingFields = {
      loan: ['naicsCode', 'purchaseAssets[0]']
    };

    render(
      <SidebarSteps
        step={4}
        formData={formData}
        missingFields={missingFields}
        onStepClick={() => {}}
      />
    );

    expect(screen.getByText(/Equipment & Deal/i)).toBeInTheDocument();
    const statusEl = screen.getByText(/Missing \(3\)/i);
    expect(statusEl).toBeInTheDocument();
    expect(statusEl).toHaveAttribute('title', expect.stringContaining('naicsCode'));
    expect(statusEl).toHaveAttribute('title', expect.stringContaining('purchaseAssets[0]'));
  });

  test('disables Co-Borrower when hasCoBorrower is false', () => {
    const formData = makeForm({ hasCoBorrower: false });
    render(<SidebarSteps step={1} formData={formData} missingFields={{}} onStepClick={() => {}} />);
    expect(screen.getByText(/Co-Borrower/i)).toBeInTheDocument();
    expect(screen.getByText(/Disabled/i)).toBeInTheDocument();
  });

  test('clicking earlier step triggers onStepClick', async () => {
    const formData = makeForm();
    const onStepClick = jest.fn();
    render(<SidebarSteps step={4} formData={formData} missingFields={{}} onStepClick={onStepClick} />);
    fireEvent.click(screen.getByText(/Dealer/i));
    expect(onStepClick).toHaveBeenCalledWith(3);
  });
});
