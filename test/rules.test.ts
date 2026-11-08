import { describe, expect, it } from 'vitest';
import { gratuityAed, gratuityGap } from '../src/money/gratuity.ts';
import { check } from '../src/rules/rules.ts';
import type { Term, Terms } from '../src/types.ts';

const t = <T>(value: T, quote = 'a clause from the letter'): Term<T> => ({ value, quote, confidence: 'high' });

function terms(over: Partial<Terms> = {}): Terms {
  return {
    role: null,
    employer: null,
    contractType: null,
    contractMonths: null,
    totalMonthlyAed: null,
    basicMonthlyAed: null,
    probationMonths: null,
    probationPaid: null,
    noticeDaysProbation: null,
    noticeDaysAfterProbation: null,
    nonCompeteMonths: null,
    nonCompeteLimitedPlace: null,
    nonCompeteLimitedWork: null,
    weeklyHours: null,
    dailyHours: null,
    annualLeaveDays: null,
    annualLeaveDayType: null,
    trainingPaybackAed: null,
    passportHeldByEmployer: null,
    costsChargedToEmployee: null,
    wageDeductions: null,
    otherConcerns: [],
    ...over,
  };
}

const one = (over: Partial<Terms>, id: string) => check(terms(over)).find((f) => f.id === id);

describe('gratuity', () => {
  it('is 21 days of basic per year for the first 5 years', () => {
    expect(gratuityAed(3000, 1)).toBe(2100);
    expect(gratuityAed(4000, 3)).toBe(8400);
  });
  it('is 30 days per year after 5 years, capped at 2 years of wage', () => {
    expect(gratuityAed(3000, 6)).toBe(5 * 2100 + 3000);
    expect(gratuityAed(3000, 40)).toBe(72000);
  });
  it('is nothing under 1 year', () => {
    expect(gratuityAed(5000, 0.9)).toBe(0);
  });
  it('shows the gap between basic and total', () => {
    expect(gratuityGap(4000, 10000, 3)).toEqual({ years: 3, onBasic: 8400, onTotal: 21000, gap: 12600 });
  });
});

describe('rules', () => {
  it('returns nothing for an empty letter', () => {
    expect(check(terms())).toEqual([]);
  });

  it('probation: over 6 months is red, 6 or less is green', () => {
    expect(one({ probationMonths: t(9) }, 'probation-length')?.level).toBe('red');
    expect(one({ probationMonths: t(6) }, 'probation-length')?.level).toBe('green');
  });

  it('probation: unpaid is red', () => {
    expect(one({ probationPaid: t(false) }, 'probation-paid')?.level).toBe('red');
    expect(one({ probationPaid: t(true) }, 'probation-paid')?.level).toBe('green');
  });

  it('probation notice under 14 days is red', () => {
    expect(one({ noticeDaysProbation: t(7) }, 'probation-notice')?.level).toBe('red');
    expect(one({ noticeDaysProbation: t(14) }, 'probation-notice')).toBeUndefined();
  });

  it('notice after probation must be 30 to 90 days', () => {
    expect(one({ noticeDaysAfterProbation: t(15) }, 'notice-period')?.level).toBe('red');
    expect(one({ noticeDaysAfterProbation: t(120) }, 'notice-period')?.level).toBe('red');
    expect(one({ noticeDaysAfterProbation: t(30) }, 'notice-period')?.level).toBe('green');
  });

  it('non-compete: over 2 years or unlimited place or work is red; otherwise amber', () => {
    expect(one({ nonCompeteMonths: t(36) }, 'non-compete')?.level).toBe('red');
    expect(one({ nonCompeteMonths: t(999) }, 'non-compete')?.title).toContain('no end date');
    expect(one({ nonCompeteMonths: t(12), nonCompeteLimitedPlace: t(false) }, 'non-compete')?.title).toContain('any country');
    expect(
      one({ nonCompeteMonths: t(12), nonCompeteLimitedPlace: t(true), nonCompeteLimitedWork: t(true) }, 'non-compete')?.level,
    ).toBe('amber');
  });

  it('working hours over 48 a week or 8 a day are red', () => {
    expect(one({ weeklyHours: t(54) }, 'working-hours')?.level).toBe('red');
    expect(one({ dailyHours: t(9) }, 'working-hours')?.level).toBe('red');
    expect(one({ weeklyHours: t(40), dailyHours: t(8) }, 'working-hours')).toBeUndefined();
  });

  it('annual leave: 22 working days is fine, 21 calendar days is red, 25 unstated days is amber', () => {
    expect(one({ annualLeaveDays: t(22), annualLeaveDayType: t('working' as const) }, 'annual-leave')?.level).toBe('green');
    expect(one({ annualLeaveDays: t(21), annualLeaveDayType: t('calendar' as const) }, 'annual-leave')?.level).toBe('red');
    expect(one({ annualLeaveDays: t(25) }, 'annual-leave')?.level).toBe('amber');
    expect(one({ annualLeaveDays: t(30) }, 'annual-leave')?.level).toBe('green');
    expect(one({ annualLeaveDays: t(14) }, 'annual-leave')?.level).toBe('red');
  });

  it('basic under half of total is amber, with the gratuity gap', () => {
    const f = one({ basicMonthlyAed: t(4000), totalMonthlyAed: t(10000) }, 'basic-share');
    expect(f?.level).toBe('amber');
    expect(f?.title).toContain('40%');
    expect(f?.money?.find((m) => m.label === 'Difference')?.aed).toBe(12600);
    expect(one({ basicMonthlyAed: t(6000), totalMonthlyAed: t(10000) }, 'basic-share')).toBeUndefined();
  });

  it('passport held by employer is red', () => {
    expect(one({ passportHeldByEmployer: t(true) }, 'passport')?.level).toBe('red');
    expect(one({ passportHeldByEmployer: t(false) }, 'passport')).toBeUndefined();
  });

  it('recruitment fees are red; other named costs are amber', () => {
    expect(one({ costsChargedToEmployee: t('recruitment agency fee') }, 'recruitment-costs')?.level).toBe('red');
    expect(one({ costsChargedToEmployee: t('visa medical test') }, 'recruitment-costs')?.level).toBe('amber');
  });

  it('training payback and deductions are amber', () => {
    const f = one({ trainingPaybackAed: t(15000 as number | null) }, 'training-payback');
    expect(f?.level).toBe('amber');
    expect(f?.money?.[0]?.aed).toBe(15000);
    expect(one({ wageDeductions: t('laptop damage') }, 'deductions')?.level).toBe('amber');
  });

  it('unlimited contract type is amber', () => {
    expect(one({ contractType: t('unlimited' as const) }, 'contract-type')?.level).toBe('amber');
    expect(one({ contractType: t('fixed-term' as const) }, 'contract-type')).toBeUndefined();
  });

  it('sorts red, then amber, then green, and carries the quote and confidence', () => {
    const fs = check(
      terms({ probationMonths: t(6, 'Probation is six months.'), passportHeldByEmployer: t(true), trainingPaybackAed: t(null) }),
    );
    expect(fs.map((f) => f.level)).toEqual(['red', 'amber', 'green']);
    expect(fs[2]?.quote).toBe('Probation is six months.');
    expect(fs[0]?.confidence).toBe('high');
  });
});

describe('rules: duplicates and noise', () => {
  it('does not flag a deduction that is the same clause as a cost charged to you', () => {
    const q = 'The recruitment agency fee of AED 2,000 will be deducted from your first two salaries.';
    const fs = check(terms({ costsChargedToEmployee: t('recruitment agency fee', q), wageDeductions: t('agency fee', q) }));
    expect(fs.map((f) => f.id)).toEqual(['recruitment-costs']);
  });
  it('keeps a deduction that is a different clause', () => {
    const fs = check(
      terms({ costsChargedToEmployee: t('visa', 'Visa costs are deducted.'), wageDeductions: t('equipment damage', 'Lost laptops will be charged to you.') }),
    );
    expect(fs.map((f) => f.id).sort()).toEqual(['deductions', 'recruitment-costs']);
  });
  it('does not flag an unclear contract type', () => {
    expect(one({ contractType: t('unclear' as const) }, 'contract-type')).toBeUndefined();
  });
});
