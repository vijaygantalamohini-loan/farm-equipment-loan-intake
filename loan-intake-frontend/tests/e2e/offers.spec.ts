import { test, expect, Page } from '@playwright/test';

async function completeBorrowerStep(page: Page) {
  await page.getByPlaceholder('First Name').fill('Alice');
  await page.getByPlaceholder('Last Name').fill('Tester');
  await page.locator('input[type="date"]').first().fill('1990-01-01');
  await page.getByPlaceholder('123-45-6789').fill('123-45-6789');
  await page.getByPlaceholder('email@example.com').fill('alice@example.com');
  await page.getByPlaceholder('(555) 123-4567').fill('555-111-2222');
  await page.getByPlaceholder('123 Main Street', { exact: true }).fill('123 Main St');
  await page.getByPlaceholder('City', { exact: true }).fill('Springfield');
  await page.getByPlaceholder('ST', { exact: true }).fill('IL');
  await page.getByPlaceholder('12345', { exact: true }).fill('62704');
  await page.getByPlaceholder('Employer/Farm Name').fill('ACME Farms');
  await page.getByPlaceholder('50000').fill('65000');
  await page.locator('label:has-text("Employment Status")').locator('..').locator('select').first().selectOption('employed');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Dealer Information' })).toBeVisible();
}

async function completeDealerStep(page: Page) {
  await page.getByPlaceholder('Enter dealership name').fill('Dealers Inc');
  await page.getByPlaceholder('Sales representative name').fill('Dana Rep');
  await page.getByPlaceholder('(555) 123-4567').fill('555-555-5555');
  await page.getByPlaceholder('contact@dealership.com').fill('dealer@example.com');
  await page.getByPlaceholder('123 Main Street', { exact: true }).fill('456 Commerce Way');
  await page.getByPlaceholder('City', { exact: true }).fill('Springfield');
  await page.getByPlaceholder('ST', { exact: true }).fill('IL');
  await page.getByPlaceholder('12345', { exact: true }).fill('62701');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Loan Request' })).toBeVisible();
}

async function completeEquipmentStep(page: Page) {
  await page.getByPlaceholder('Enter serial number or VIN').fill('SN123456789');
  await page.getByPlaceholder('Type or select manufacturer').fill('John Deere');
  await page.getByPlaceholder('e.g., 5075E').fill('5075E');
  await page.getByPlaceholder('2024').fill('2023');
  await page.locator('label:has-text("Condition")').locator('..').locator('select').first().selectOption('Excellent');
  await page.getByPlaceholder('75000').fill('85000');
  await page.getByPlaceholder('e.g., Purchase tractor for farming operations').fill('Purchase tractor for farming operations');
  await page.waitForResponse(resp => resp.url().includes('/lookup/naics') && resp.status() === 200);
  await expect(page.getByText('✓ Agriculture')).toBeVisible();
  await expect(page.locator('text=Missing: naicsCode')).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator('text=Missing: purchaseAssets')).toHaveCount(0, { timeout: 5000 });
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Documents & Consents' })).toBeVisible();
}

// Reusable mock offers payload with multiple lenders
const mockOffersPayload = {
  application_id: 'APP-TEST',
  application_number: 'LA-TEST-1234',
  total_lenders: 4,
  approved_offers: 2,
  conditional_offers: 1,
  declined_offers: 1,
  offers: [
    {
      offer_id: 'AgCredit_20240101010101',
      lender_name: 'AgCredit Financial',
      decision: 'approved',
      approved_amount: 65000,
      interest_rate: 6.75,
      term_months: 60,
      monthly_payment: 1280.33,
      conditions: ['Proof of income required', 'Equipment inspection required'],
      decline_reason: null,
      generated_at: '2025-01-01T01:01:01.000Z',
    },
    {
      offer_id: 'FarmEquipmentFinance_20240101010102',
      lender_name: 'Farm Equipment Finance Corp',
      decision: 'conditional',
      approved_amount: 60000,
      interest_rate: 9.5,
      term_months: 72,
      monthly_payment: 1115.12,
      conditions: ['Equipment must be less than 5 years old'],
      decline_reason: null,
      generated_at: '2025-01-01T01:01:02.000Z',
    },
    {
      offer_id: 'GreenValleyCapital_20240101010103',
      lender_name: 'Green Valley Capital',
      decision: 'approved',
      approved_amount: 65000,
      interest_rate: 6.9,
      term_months: 60,
      monthly_payment: 1290.45,
      conditions: ['Annual financial review required'],
      decline_reason: null,
      generated_at: '2025-01-01T01:01:03.000Z',
    },
    {
      offer_id: 'PrairieStateBank_20240101010104',
      lender_name: 'Prairie State Bank',
      decision: 'declined',
      approved_amount: null,
      interest_rate: null,
      term_months: null,
      monthly_payment: null,
      conditions: [],
      decline_reason: 'Debt-to-income ratio exceeds maximum of 35%',
      generated_at: '2025-01-01T01:01:04.000Z',
    },
  ],
};

// Authenticate via localStorage before each test
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('auth_token', 'dummy.token.value');
      localStorage.setItem('user', JSON.stringify({ name: 'e2e user', email: 'e2e@example.com' }));
      try { (window as any).location.assign = () => {}; } catch {}
    } catch {}
  });
});

// Full happy-path: submit then see offers, accept one
test('offers flow: submit -> view offers -> accept', async ({ page }) => {
  // Stub backend endpoints
  await page.route('**/auth/profile', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ name: 'E2E User', email: 'e2e@example.com' }) });
  });
  await page.route('**/lookup/naics**', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ found: true, naics_code: '1111', description: 'Agriculture', sector: 'Agriculture' }) });
  });
  await page.route('**/prequalify', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        approval_probability: 0.78,
        risk_tier: 'Medium',
        risk_score: 630,
        flags: [],
        optimal_structure: {
          recommended_down_payment: 4000,
          recommended_term: 72,
          expected_monthly_payment: 1100
        }
      })
    });
  });
  await page.route('**/equipment/intelligence', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        valuation: { blended_value: 78000 },
        overall_confidence: 0.88,
        serial_number: { confidence: 0.8 },
        history: { hour_consistency: 'consistent' },
        predictive_resale: { predicted_resale: 76000 },
        risk_flags: []
      })
    });
  });
  await page.route('**/prequalify', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        approval_probability: 0.82,
        risk_tier: 'Medium',
        risk_score: 640,
        flags: ['Stable cash flow'],
        optimal_structure: {
          recommended_down_payment: 5000,
          recommended_term: 60,
          expected_monthly_payment: 1250
        }
      })
    });
  });
  await page.route('**/equipment/intelligence', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        valuation: { blended_value: 85000 },
        overall_confidence: 0.9,
        serial_number: { confidence: 0.85 },
        history: { hour_consistency: 'consistent' },
        predictive_resale: { predicted_resale: 82000 },
        risk_flags: []
      })
    });
  });
  await page.route('**/*oauth2*', async route => {
    await route.fulfill({ status: 200, contentType: 'text/plain', body: 'ok' });
  });
  await page.route('**/loans/start', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ application_id: 'APP-TEST', application_number: 'LA-TEST-1234' }) });
  });
  await page.route('**/loans/**', async route => {
    const url = route.request().url();
    if (url.endsWith('/dashboard')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          salesperson: { name: 'E2E User' },
          summary: { total: 1, in_progress: 0, submitted: 1, funded: 0 },
          applications: {
            in_progress: [],
            submitted: [
              {
                id: 'APP-TEST',
                application_number: 'LA-TEST-1234',
                status: 'submitted',
                borrower_name: 'Alice Tester',
                loan_amount: 65000,
                equipment: 'Tractor',
                serial_number: 'N/A',
                trade_in_serials: [],
                submitted_at: new Date().toISOString(),
              },
            ],
            funded: [],
          },
        }),
      });
      return;
    }
    if (url.includes('/loans/submit')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { application_number: 'LA-TEST-1234', id: 'APP-TEST', status: 'submitted', missing_fields: {} } }) });
      return;
    }
    if (url.endsWith('/get-offers')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockOffersPayload) });
      return;
    }
    if (url.includes('/accept-offer')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'Loan offer accepted successfully' }) });
      return;
    }
    // Default for save-draft, etc.
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { missing_fields: {} } }) });
  });

  // Go directly to the application view to avoid auth UI
  await page.goto('/?view=application');

  await completeBorrowerStep(page);
  await completeDealerStep(page);
  await completeEquipmentStep(page);

  // Step 5: Documents & Consents — tick both required
  await page.getByRole('checkbox', { name: /Consent to Credit Check/i }).check();
  await page.getByRole('checkbox', { name: /Consent to Share Application with Lenders/i }).check();
  await page.getByRole('button', { name: 'Next' }).click();

  // Step 6: Confirmation — submit
  const submitPromise = page.waitForEvent('dialog');
  await page.getByRole('button', { name: 'Submit Application' }).click();
  const dialog = await submitPromise;
  await dialog.accept();

  // We should see dashboard after submit (then navigate to offers via button)
  await expect(page.getByText('My Dashboard')).toBeVisible();
  await page.getByRole('button', { name: '🎯 Get Loan Offers' }).click();
  // Now Offers view should load and auto-fetch offers
  await expect(page.getByRole('heading', { name: 'Loan Offers' })).toBeVisible();
  await expect(page.getByText('Application #LA-TEST-1234')).toBeVisible();

  // Verify lender cards render
  await expect(page.getByText('AgCredit Financial')).toBeVisible();
  await expect(page.getByText('Green Valley Capital')).toBeVisible();
  await expect(page.getByText('Prairie State Bank')).toBeVisible();

  // Accept the first available offer
  await page.evaluate(() => { window.confirm = () => true; });
  await page.getByRole('button', { name: 'Accept Offer' }).first().click();

  // After accept, we should navigate back (onBack -> Dashboard)
  await expect(page.getByRole('button', { name: 'New Application' })).toBeVisible();
});

// Scenario: all lenders decline, UI still renders declined card with reason
test('offers flow: all declined still renders and no accept buttons', async ({ page }) => {
  const declinedPayload = {
    ...mockOffersPayload,
    approved_offers: 0,
    conditional_offers: 0,
    declined_offers: 4,
    offers: mockOffersPayload.offers.map(o => ({ ...o, decision: 'declined', approved_amount: null, interest_rate: null, term_months: null, monthly_payment: null, conditions: [], decline_reason: 'Policy declined' })),
  };

  await page.route('**/auth/profile', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ name: 'E2E User', email: 'e2e@example.com' }) });
  });
  await page.route('**/loans/start', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ application_id: 'APP-DECLINE', application_number: 'LA-DECLINE-1' }) });
  });
  await page.route('**/lookup/naics**', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ found: true, naics_code: '1111', description: 'Agriculture', sector: 'Agriculture' }) });
  });
  await page.route('**/loans/**', async route => {
    const url = route.request().url();
    if (url.endsWith('/dashboard')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          salesperson: { name: 'E2E User' },
          summary: { total: 1, in_progress: 0, submitted: 1, funded: 0 },
          applications: {
            in_progress: [],
            submitted: [
              {
                id: 'APP-DECLINE',
                application_number: 'LA-DECLINE-1',
                status: 'submitted',
                borrower_name: 'Alice Tester',
                loan_amount: 50000,
                equipment: 'Tractor',
                serial_number: 'N/A',
                trade_in_serials: [],
                submitted_at: new Date().toISOString(),
              },
            ],
            funded: [],
          },
        }),
      });
      return;
    }
    if (url.endsWith('/get-offers')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(declinedPayload) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { missing_fields: {} } }) });
  });

  // Go through minimal flow and submit, then navigate to offers via dashboard button
  await page.goto('/?view=application');
  await completeBorrowerStep(page);
  await completeDealerStep(page);
  await completeEquipmentStep(page);
  await page.getByRole('checkbox', { name: /Consent to Credit Check/i }).check();
  await page.getByRole('checkbox', { name: /Consent to Share Application with Lenders/i }).check();
  const submitDialogP = page.waitForEvent('dialog');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Submit Application' }).click();
  const subDlg = await submitDialogP;
  await subDlg.accept();
  await expect(page.getByText('My Dashboard')).toBeVisible();
  await page.getByRole('button', { name: '🎯 Get Loan Offers' }).click();
  await expect(page.getByRole('heading', { name: 'Loan Offers' })).toBeVisible();
  await expect(page.getByText('Decline Reason: Policy declined').first()).toBeVisible();
  // No Accept buttons when all declined
  await expect(page.getByRole('button', { name: 'Accept Offer' })).toHaveCount(0);
});
