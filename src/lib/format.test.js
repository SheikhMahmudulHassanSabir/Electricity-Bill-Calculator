import { describe, it, expect } from 'vitest';
import {
  fmtN,
  inr,
  rateFmt,
  pdfMoney,
  formatDateIN,
} from './format.js';

describe('format.js Indian Rupee and Indian number formatting', () => {
  it('formats numbers using Indian lakh/crore grouping', () => {
    expect(fmtN(123456)).toBe('1,23,456');
    expect(fmtN(123456.789)).toBe('1,23,456.789');
  });

  it('formats currency with ₹ symbol and 2 decimal places in en-IN format', () => {
    expect(inr(0)).toBe('₹0.00');
    expect(inr(1700)).toBe('₹1,700.00');
    expect(inr(123456.5)).toBe('₹1,23,456.50');
  });

  it('formats per-unit rate with ₹ and / kWh suffix', () => {
    expect(rateFmt(8.5)).toBe('₹8.50 / kWh');
    expect(rateFmt(8.125)).toBe('₹8.125 / kWh');
  });

  it('formats PDF money using Rs. prefix for Helvetica compatibility', () => {
    expect(pdfMoney(123456)).toBe('Rs. 1,23,456.00');
    expect(pdfMoney(994.13)).toBe('Rs. 994.13');
  });

  it('formats ISO dates cleanly into Indian readable dates', () => {
    const formatted = formatDateIN('2026-10-12');
    expect(formatted).toContain('12');
    expect(formatted).toContain('Oct');
    expect(formatted).toContain('2026');
  });
});
