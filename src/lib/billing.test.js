import { describe, it, expect } from 'vitest';
import {
  round2,
  round6,
  sumMoney,
  parseNum,
  validateNumField,
  validateRate,
  evalMeter,
  computeBills,
  isBillDateEarlierThanLatest,
} from './billing.js';

describe('billing.js calculation and validation rules', () => {
  it('rounds money to 2 decimal places accurately', () => {
    expect(round2(10.555)).toBe(10.56);
    expect(round2(1.005)).toBe(1.01);
    expect(round2(120 * 8.5)).toBe(1020);
  });

  it('rounds units to 6 decimal places accurately', () => {
    expect(round6(100.1234567)).toBe(100.123457);
    expect(round6(580.4 - 500.1)).toBe(80.3);
  });

  it('sums rounded meter amounts without floating-point drift', () => {
    expect(sumMoney([10.1, 20.2, 30.3])).toBe(60.6);
    expect(sumMoney([33.33, 33.33, 33.34])).toBe(100);
  });

  it('parses numbers and detects empty or invalid inputs', () => {
    expect(parseNum('')).toEqual({ empty: true });
    expect(parseNum('  ')).toEqual({ empty: true });
    expect(parseNum('1,250.50')).toEqual({ v: 1250.5 });
    expect(parseNum('abc')).toEqual({ bad: true });
  });

  it('rejects negative values and empty required fields', () => {
    expect(validateNumField(parseNum(''), true, 'Enter reading.')).toBe('Enter reading.');
    expect(validateNumField(parseNum('-5'), true)).toBe('Negative values are not allowed.');
    expect(validateNumField(parseNum('12.5'), true)).toBeNull();
    expect(validateRate('')).toBe('Enter the per-unit rate.');
    expect(validateRate('8.5')).toBeNull();
  });

  it('validates that current reading is not lower than previous reading', () => {
    const res = evalMeter({ name: 'Room 1', prev: '500', cur: '450' }, '8.50');
    expect(res.ok).toBe(false);
    expect(res.errors.cur).toContain('Cannot be lower than the previous reading');
  });

  it('calculates meter units and total = units * rate with no additional charges', () => {
    const res = evalMeter({ name: 'Room 1', prev: '1000', cur: '1120.5' }, '8.25');
    expect(res.ok).toBe(true);
    expect(res.units).toBe(120.5);
    expect(res.amount).toBe(994.13);
    expect(res.total).toBe(994.13);
  });

  it('computes combined total as sum of rounded meter amounts and blocks save when invalid', () => {
    const meters = [
      { id: '1', name: 'Room 1', prev: '1000', cur: '1120' },
      { id: '2', name: 'Room 2', prev: '500', cur: '580' },
    ];
    const validComp = computeBills(meters, '8.50');
    expect(validComp.canSave).toBe(true);
    expect(validComp.totals.count).toBe(2);
    expect(validComp.totals.units).toBe(200);
    expect(validComp.totals.total).toBe(1700);

    const invalidComp = computeBills(
      [...meters, { id: '3', name: 'Room 3', prev: '300', cur: '250' }],
      '8.50'
    );
    expect(invalidComp.canSave).toBe(false);
    expect(invalidComp.totals.count).toBe(2);
  });

  it('warns if the bill date is earlier than the latest saved bill date', () => {
    expect(isBillDateEarlierThanLatest('2026-10-10', '2026-10-12')).toBe(true);
    expect(isBillDateEarlierThanLatest('2026-10-15', '2026-10-12')).toBe(false);
  });
});
