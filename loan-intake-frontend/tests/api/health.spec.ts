import { test, expect, request } from '@playwright/test';

test('backend health endpoint returns ok', async ({}) => {
  const r = await request.newContext();
  const resp = await r.get('http://localhost:8000/health/healthz');
  expect(resp.status()).toBe(200);
  const data = await resp.json();
  expect(data.status).toBe('ok');
});