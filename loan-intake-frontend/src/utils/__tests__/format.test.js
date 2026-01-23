import { formatCurrency, formatDate, formatPhoneNumber, formatSSN, formatZipCode, formatPercentage, formatNumber, truncate, formatAddress, formatFileSize, capitalize, snakeToTitle } from '../../utils/format';

describe('utils/format', () => {
  test('formatCurrency', () => {
    expect(formatCurrency(1234, { minimumFractionDigits: 2, maximumFractionDigits: 2 })).toContain('$1,234.00');
  });

  test('formatDate returns N/A for empty and formats valid date', () => {
    expect(formatDate(undefined)).toBe('N/A');
    const formatted = formatDate('2025-12-29T00:00:00Z');
    expect(typeof formatted).toBe('string');
  });

  test('formatPhoneNumber formats 10 digits', () => {
    expect(formatPhoneNumber('5555551234')).toBe('(555) 555-1234');
  });

  test('formatSSN masks by default and can show full', () => {
    expect(formatSSN('123456789')).toBe('***-**-6789');
    expect(formatSSN('123456789', false)).toBe('123-45-6789');
  });

  test('formatZipCode handles 5 and 9 digits', () => {
    expect(formatZipCode('12345')).toBe('12345');
    expect(formatZipCode('123456789')).toBe('12345-6789');
  });

  test('formatPercentage and formatNumber', () => {
    expect(formatPercentage(12.345, 1)).toBe('12.3%');
    expect(formatNumber(1234, 2)).toBe('1,234.00');
  });

  test('truncate and formatAddress', () => {
    expect(truncate('abcdef', 3)).toBe('abc...');
    expect(formatAddress({ street: '1 Main', city: 'Town', state: 'TX', zip: '75001' })).toBe('1 Main, Town, TX, 75001');
  });

  test('formatFileSize', () => {
    expect(formatFileSize(0)).toBe('0 Bytes');
    expect(formatFileSize(2048)).toContain('KB');
  });

  test('capitalize and snakeToTitle', () => {
    expect(capitalize('hello')).toBe('Hello');
    expect(snakeToTitle('in_progress')).toBe('In Progress');
  });
});
