/**
 * SteelTrack Enterprise Currency & Number Formatting Helpers
 * Standardizes Philippine Peso (₱) display and exact two-decimal fraction formatting.
 */

/**
 * Format a numeric amount as Philippine Peso with exact 2 decimal places.
 * Example: 1250 -> "₱1,250.00"
 */
export function formatPHP(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '₱0.00';
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount)) || 0;
  return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format a numeric amount with exact 2 decimal places without currency symbol.
 * Example: 1250 -> "1,250.00"
 */
export function formatNumber2(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '0.00';
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount)) || 0;
  return num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
