import { test, expect, request } from '@playwright/test';

// Contract test: /lookup/naics should return shape used by frontend
// { found: boolean, naics_code: string|number, description: string, sector: string }

test('NAICS lookup contract: shape is stable', async ({}) => {
  const r = await request.newContext();
  const resp = await r.get('http://localhost:8000/lookup/naics?keyword=tractor');
  expect(resp.status()).toBe(200);
  const data = await resp.json();
  expect(typeof data.found).toBe('boolean');
  if (data.found) {
    expect(data).toHaveProperty('naics_code');
    expect(data).toHaveProperty('description');
    expect(data).toHaveProperty('sector');
  }
});
