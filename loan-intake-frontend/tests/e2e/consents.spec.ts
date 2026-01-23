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

// Authenticate via localStorage before each test
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('auth_token', 'dummy.token.value');
      localStorage.setItem('user', JSON.stringify({ name: 'testuser2', email: 'test@example.com' }));
      // Prevent external navigation during tests
      try { (window as any).location.assign = () => {}; } catch {}
    } catch {}
  });
});

test('consents enable Next and navigate to Confirm', async ({ page }) => {
  // Stub backend endpoints to avoid real auth/backend dependency during e2e
  await page.route('**/loans/start', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ application_id: 'APP-TEST', application_number: 'LA-TEST' })
    });
  });
  await page.route('**/loans/**', async route => {
    // Generic success for save-draft/submit with no missing fields
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { missing_fields: {} } })
    });
  });
  await page.route('**/auth/profile', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ name: 'Playwright Test User', email: 'test@example.com' })
    });
  });
  await page.route('**/lookup/naics**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ found: true, naics_code: '1111', description: 'Agriculture', sector: 'Agriculture' })
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
        flags: [],
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
  // Block accidental auth redirects
  await page.route('**/*oauth2*', async route => {
    await route.fulfill({ status: 200, contentType: 'text/plain', body: 'ok' });
  });

  // Go directly to the application view to avoid auth navigation
  await page.goto('/?view=application');

  await completeBorrowerStep(page);
  await completeDealerStep(page);
  await completeEquipmentStep(page);

  // Step 5: Documents & Consents — tick checkboxes and verify Next enabled
  const creditConsent = page.getByRole('checkbox', { name: /Consent to Credit Check/i });
  const shareConsent = page.getByRole('checkbox', { name: /Consent to Share Application with Lenders/i });
  await creditConsent.check();
  await shareConsent.check();
  const nextBtn = page.getByRole('button', { name: 'Next' });
  await expect(nextBtn).toBeEnabled();

  // Navigate to Confirm
  await nextBtn.click();
  await expect(page.getByText('Review & Confirmation')).toBeVisible();
});
