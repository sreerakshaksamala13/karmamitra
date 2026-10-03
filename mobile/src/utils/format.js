/** Formatting helpers shared by the mobile screens. */

export function formatMoney(value) {
  const num = Number(value || 0);
  return `\u20B9${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function toDateInput(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toDateInput(d);
}

export function prettyDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function weekdayName(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-IN', { weekday: 'long' });
}

export function isPayoutDay(dateStr) {
  return new Date(`${dateStr}T00:00:00`).getDay() === 3;
}

export const STATUS_LABELS = {
  present: 'Present',
  'half-day': 'Half',
  absent: 'Absent',
};

export const statusFactor = (status) =>
  status === 'present' ? 1 : status === 'half-day' ? 0.5 : 0;