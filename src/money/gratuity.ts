/**
 * End-of-service gratuity for full-time foreign workers (Art. 51): 21 days of
 * BASIC wage for each of the first 5 years, 30 days per year after that, at
 * least 1 year of service, capped at 2 years' wage. A day's basic wage is
 * taken as monthly basic ÷ 30, the convention MOHRE's calculator uses.
 */
export function gratuityAed(monthly: number, years: number): number {
  if (years < 1 || monthly <= 0) return 0;
  const daily = monthly / 30;
  const first = Math.min(years, 5) * 21 * daily;
  const after = Math.max(0, years - 5) * 30 * daily;
  return Math.round(Math.min(first + after, monthly * 24));
}

/** The gratuity on basic pay against the figure someone reading only the total might expect. */
export function gratuityGap(basic: number, total: number, years: number) {
  const onBasic = gratuityAed(basic, years);
  const onTotal = gratuityAed(total, years);
  return { years, onBasic, onTotal, gap: onTotal - onBasic };
}
