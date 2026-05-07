/**
 * UK ISA Tax Year Utilities
 *
 * UK tax year runs 6 April – 5 April.
 * Format: 'YYYY-YY' e.g. '2025-26' for 6 Apr 2025 – 5 Apr 2026.
 *
 * D-15: Tax year boundary is strictly 6 April.
 * CLAUDE.md: ISA calculations use UK tax year (not calendar year).
 */

/**
 * Returns the UK tax year string for a given date.
 * Examples:
 *   2025-04-06 → '2025-26'
 *   2025-04-05 → '2024-25'
 *   2026-04-06 → '2026-27'
 */
export function getTaxYearForDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const year = d.getUTCFullYear()
  const month = d.getUTCMonth() + 1  // 1-indexed
  const day = d.getUTCDate()

  // On or after 6 April: tax year starts in this calendar year
  const isAfterApril6 = month > 4 || (month === 4 && day >= 6)
  const startYear = isAfterApril6 ? year : year - 1
  const endYear = startYear + 1

  // Format end year as 2-digit suffix
  return `${startYear}-${String(endYear).slice(2)}`
}

/**
 * Returns the current UK tax year string based on today's date (UTC).
 * Example: if today is 2026-05-06 → '2025-26'... wait, 6 Apr 2026 has passed, so yes '2026-27'.
 * If today is 2026-03-10 → '2025-26'.
 */
export function getCurrentTaxYear(): string {
  return getTaxYearForDate(new Date())
}

/**
 * Returns the display string for a tax year.
 * '2025-26' → '6 Apr 2025 – 5 Apr 2026'
 */
export function formatTaxYearDisplay(taxYear: string): string {
  const [startStr] = taxYear.split('-')
  const startYear = parseInt(startStr, 10)
  const endYear = startYear + 1
  return `6 Apr ${startYear} – 5 Apr ${endYear}`
}
