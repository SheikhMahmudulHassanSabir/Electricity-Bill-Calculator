import test from 'node:test';
import assert from 'node:assert/strict';
import {
  round2,
  round6,
  sumMoney,
  evalMeter,
  computeBills,
  isBillDateEarlierThanLatest,
} from './billing.js';
import { fmtN, inr, pdfMoney, rateFmt } from './format.js';

test('billing calculations and rounding rules', () => {
  assert.equal(round2(10.555), 10.56);
  assert.equal(round6(580.4 - 500.1), 80.3);
  assert.equal(sumMoney([10.1, 20.2, 30.3]), 60.6);

  const valid = evalMeter({ name: 'Room 1', prev: '1000', cur: '1120' }, '8.50');
  assert.equal(valid.ok, true);
  assert.equal(valid.units, 120);
  assert.equal(valid.total, 1020);

  const lowerCur = evalMeter({ name: 'Room 1', prev: '500', cur: '450' }, '8.50');
  assert.equal(lowerCur.ok, false);
  assert.ok(lowerCur.errors.cur.includes('Cannot be lower'));
});

test('combined bill computation and save gate', () => {
  const meters = [
    { id: '1', name: 'Room 1', prev: '1000', cur: '1120' },
    { id: '2', name: 'Room 2', prev: '500', cur: '580' },
  ];
  const comp = computeBills(meters, '8.50');
  assert.equal(comp.canSave, true);
  assert.equal(comp.totals.units, 200);
  assert.equal(comp.totals.total, 1700);
  assert.equal(isBillDateEarlierThanLatest('2026-10-01', '2026-10-12'), true);
});

test('Indian number and currency formatting', () => {
  assert.equal(fmtN(123456), '1,23,456');
  assert.equal(inr(123456), '₹1,23,456.00');
  assert.equal(rateFmt(8.5), '₹8.50 / kWh');
  assert.equal(pdfMoney(123456), 'Rs. 1,23,456.00');
});
