import { fmtN } from './format.js';

/**
 * Pure calculation, validation, and rounding functions for the Electricity Bill Calculator.
 * Rules:
 * - Units = Current - Previous (rounded to 6 decimals)
 * - Amount = Units * Rate (rounded to 2 decimals)
 * - Combined total = sum of the rounded meter amounts
 * - No per-meter rate or additional charges.
 */

export function round2(x) {
  return Math.round((Number(x) + Number.EPSILON) * 100) / 100;
}

export function round6(x) {
  return Math.round((Number(x) + Number.EPSILON) * 1e6) / 1e6;
}

export function sumMoney(list) {
  return (
    list.reduce((acc, val) => acc + Math.round((Number(val) + Number.EPSILON) * 100), 0) / 100
  );
}

export function parseNum(s) {
  const t = String(s == null ? '' : s)
    .trim()
    .replace(/,/g, '');
  if (t === '') return { empty: true };
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return { bad: true };
  return { v: Number(t) };
}

export function validateNumField(parsed, required, emptyMsg = 'This field is required.') {
  if (parsed.empty) return required ? emptyMsg : null;
  if (parsed.bad) return 'Enter a valid number.';
  if (parsed.v < 0) return 'Negative values are not allowed.';
  return null;
}

export function validateRate(rateStr) {
  return validateNumField(parseNum(rateStr), true, 'Enter the per-unit rate.');
}

export function displayName(meter, index = 0) {
  const n = String(meter?.name || '').trim();
  return n || `Meter ${index + 1}`;
}

export function evalMeter(meter, globalRateStr) {
  const errors = {};
  const prevStr = String(meter?.prev ?? '');
  const curStr = String(meter?.cur ?? '');

  const p = parseNum(prevStr);
  const c = parseNum(curStr);
  const r = parseNum(globalRateStr);

  const prevErr = validateNumField(p, true, 'Enter the previous reading.');
  const curErr = validateNumField(c, true, 'Enter the current reading.');
  const rateErr = validateNumField(r, true, 'Set the billing rate first.');

  if (prevErr) errors.prev = prevErr;
  if (curErr) errors.cur = curErr;
  if (rateErr) errors.rate = rateErr;

  if (!prevErr && !curErr && c.v < p.v) {
    errors.cur = `Cannot be lower than the previous reading (${fmtN(p.v)}).`;
  }

  const idle = prevStr.trim() === '' && curStr.trim() === '';
  const out = {
    errors,
    ok: false,
    idle,
  };

  if (Object.keys(errors).length === 0) {
    const units = round6(c.v - p.v);
    const amount = round2(units * r.v);
    out.ok = true;
    out.prev = p.v;
    out.cur = c.v;
    out.rate = r.v;
    out.units = units;
    out.amount = amount;
    out.total = amount;
  }

  return out;
}

export function computeBills(meters, globalRateStr) {
  const safeMeters = Array.isArray(meters) ? meters : [];
  const res = safeMeters.map((m) => evalMeter(m, globalRateStr));
  const good = [];

  res.forEach((r, i) => {
    if (r.ok) {
      good.push({ m: safeMeters[i], i, r });
    }
  });

  const rateParsed = parseNum(globalRateStr);
  const rateError = validateRate(globalRateStr);
  const totalAmount = sumMoney(good.map((g) => g.r.total));

  const totals = {
    count: good.length,
    units: round6(good.reduce((acc, g) => acc + g.r.units, 0)),
    rate: !rateError && !rateParsed.empty ? rateParsed.v : null,
    charge: totalAmount,
    total: totalAmount,
  };

  const canSave =
    safeMeters.length > 0 &&
    good.length === safeMeters.length &&
    !rateError;

  return {
    res,
    good,
    totals,
    rateError,
    canSave,
  };
}

export function isBillDateEarlierThanLatest(billDateStr, latestBillDateStr) {
  if (!billDateStr || !latestBillDateStr) return false;
  return String(billDateStr).trim() < String(latestBillDateStr).trim();
}
