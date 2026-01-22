import { test, expect, request } from '@playwright/test';

// Contract tests for loans API endpoints used by the wizard

const BASE = 'http://localhost:8000';

test('Loans: start returns application identifiers', async ({}) => {
  const r = await request.newContext({
    extraHTTPHeaders: { Authorization: 'Bearer dummy.token.value' }
  });
  const resp = await r.post(`${BASE}/loans/start`, {
    headers: { Authorization: 'Bearer dummy.token.value', 'Idempotency-Key': `TEST-${Date.now()}` },
    data: {},
  });
  expect([200, 201]).toContain(resp.status());
  const data = await resp.json();
  const body = data.data || data;
  expect(body).toHaveProperty('application_id');
  expect(body).toHaveProperty('application_number');
});

test('Loans: save-draft accepts payload and returns missing_fields object', async ({}) => {
  const r = await request.newContext({
    extraHTTPHeaders: { Authorization: 'Bearer dummy.token.value' }
  });
  // Start an application first (or assume one exists)
  const start = await r.post(`${BASE}/loans/start`, { headers: { Authorization: 'Bearer dummy.token.value', 'Idempotency-Key': `TEST-${Date.now()}` } });
  const startBody = (await start.json()).data || (await start.json());
  const appId = startBody.application_id || startBody.id;

  const draft = await r.put(`${BASE}/loans/${appId}/save-draft`, {
    headers: { Authorization: 'Bearer dummy.token.value', 'Idempotency-Key': `TEST-DRAFT-${Date.now()}` },
    data: {
      borrower_type: 'individual',
      has_coborrower: false,
      borrower_data: { firstName: 'Alice', lastName: 'Tester' },
      dealer_data: { dealershipName: 'Dealers Inc' },
      loan_data: { naicsCode: '', purchaseAssets: [{}] },
      documents_and_consents_data: { documents: [], consents: { creditCheck: false, shareWithLenders: false } },
    }
  });
  expect([200, 201]).toContain(draft.status());
  const data = await draft.json();
  const body = data.data || data;
  expect(body).toHaveProperty('missing_fields');
  expect(typeof body.missing_fields).toBe('object');
});
