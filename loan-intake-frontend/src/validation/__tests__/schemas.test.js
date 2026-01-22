import { validateBorrower, validateDealer, validateLoan, validateDocuments } from '../../validation/schemas';

describe('validation/schemas', () => {
  test('validateBorrower requires first and last name', () => {
    expect(validateBorrower({})).toEqual(expect.arrayContaining(['firstName', 'lastName']));
    expect(validateBorrower({ firstName: 'Alice', lastName: 'Tester' })).toEqual([]);
  });

  test('validateDealer requires dealershipName', () => {
    expect(validateDealer({})).toEqual(expect.arrayContaining(['dealershipName']));
    expect(validateDealer({ dealershipName: 'Dealers Inc' })).toEqual([]);
  });

  test('validateLoan requires naicsCode and at least one purchase asset', () => {
    // Missing all fields
    const missing = validateLoan({});
    // Depending on zod error path/message, purchaseAssets may report as 'purchaseAssets' or 'purchaseAssets[0]'
    expect(missing).toEqual(expect.arrayContaining(['naicsCode']));
    expect(missing.some(f => f === 'purchaseAssets' || f.startsWith('purchaseAssets'))).toBe(true);

    // Provide NAICS and asset list
    const ok = validateLoan({ naicsCode: '1111', purchaseAssets: [{}] });
    expect(ok).toEqual([]);
  });

  test('validateDocuments schema accepts booleans; missing fields enforced at UI layer', () => {
    const missingFalse = validateDocuments({ documents: [], consents: { creditCheck: false, shareWithLenders: false } });
    expect(missingFalse).toEqual([]);

    const missingTrue = validateDocuments({ documents: [], consents: { creditCheck: true, shareWithLenders: true } });
    expect(missingTrue).toEqual([]);
  });
});
