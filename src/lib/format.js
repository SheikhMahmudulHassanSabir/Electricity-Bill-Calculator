/**
 * Indian Rupee (₹) and Indian number system formatting helpers.
 */

export function fmtN(n, max = 3) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString('en-IN', {
    maximumFractionDigits: max == null ? 3 : max,
  });
}

export function inr(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '₹0.00';
  return (
    '₹' +
    num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function rateFmt(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '₹0.00 / kWh';
  return (
    '₹' +
    num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }) +
    ' / kWh'
  );
}

export function pdfMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return 'Rs. 0.00';
  return (
    'Rs. ' +
    num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function formatDateIN(dateInput) {
  if (!dateInput) return '';
  const str = String(dateInput).trim();
  // Handle YYYY-MM-DD without timezone shift
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  const d = parts
    ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
    : new Date(str);
  if (Number.isNaN(d.getTime())) return str;
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatLongDateIN(dateInput) {
  if (!dateInput) return '';
  const str = String(dateInput).trim();
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  const d = parts
    ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
    : new Date(str);
  if (Number.isNaN(d.getTime())) return str;
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function todayIsoDate(now = new Date()) {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
