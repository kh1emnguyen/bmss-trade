// Defensive formatters and helpers — every input is coerced so a bad row can't crash the UI.

export const safeStr = (v) => (v == null ? '' : String(v));
export const safeNum = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);

export const fmtMoney = (n) => '$' + Math.round(safeNum(n)).toLocaleString();
export const fmt2 = (n) => '$' + safeNum(n).toFixed(2);
export const fmtPct = (n) => safeNum(n).toFixed(1) + '%';

export function pctClass(p) {
  const v = safeNum(p);
  if (v <= -25) return 'pct-strong';
  if (v <= -10) return 'pct-med';
  if (v <= 0) return 'pct-mild';
  return 'pct-neg';
}
