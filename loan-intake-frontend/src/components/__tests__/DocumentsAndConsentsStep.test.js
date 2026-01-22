import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DocumentsAndConsentsStep from '../../components/DocumentsAndConsentsStep';

describe('DocumentsAndConsentsStep', () => {
  test('Next is disabled until both consents checked', async () => {
    render(<DocumentsAndConsentsStep initialData={{ documents: [], consents: { creditCheck: false, shareWithLenders: false } }} onNext={() => {}} nextStep={() => {}} prevStep={() => {}} />);

    const nextBtn = screen.getByRole('button', { name: 'Next' });
    expect(nextBtn).toBeDisabled();

    await userEvent.click(screen.getByRole('checkbox', { name: /Consent to Credit Check \*/i }));
    expect(nextBtn).toBeDisabled();

    await userEvent.click(screen.getByRole('checkbox', { name: /Consent to Share Application with Lenders \*/i }));
    expect(nextBtn).toBeEnabled();
  });
});
