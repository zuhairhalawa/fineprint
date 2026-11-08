/**
 * The rule checker. Each rule reads the terms and returns a finding or null.
 * No AI here: these are plain, tested checks against Federal Decree-Law No. 33
 * of 2021 (see docs/law-notes.md for the articles and the sources).
 */
import { gratuityGap } from '../money/gratuity.ts';
import type { Finding, Term, Terms } from '../types.ts';

type Rule = (t: Terms) => Finding | null;

const aed = (n: number) => `AED ${Math.round(n).toLocaleString('en-US')}`;

function from<T>(term: Term<T>, f: Omit<Finding, 'quote' | 'confidence'>): Finding {
  return { ...f, quote: term.quote, confidence: term.confidence };
}

const probationLength: Rule = ({ probationMonths: p }) => {
  if (!p) return null;
  const law = { article: 'Art. 9(1)', summary: 'Probation can last at most 6 months, and only once with the same employer.' };
  if (p.value > 6)
    return from(p, {
      id: 'probation-length',
      level: 'red',
      title: `Probation of ${p.value} months is over the 6-month limit`,
      law,
      ask: `Could the probation period be set at 6 months or less, as UAE labour law requires?`,
    });
  return from(p, { id: 'probation-length', level: 'green', title: `Probation of ${p.value} months is within the limit`, law });
};

const probationPaid: Rule = ({ probationPaid: p }) => {
  if (!p) return null;
  const law = {
    article: 'Art. 1, Art. 9',
    summary: 'An employment contract is work in return for a wage, and probation is part of the employment.',
  };
  if (!p.value)
    return from(p, {
      id: 'probation-paid',
      level: 'red',
      title: 'Probation looks unpaid',
      law,
      ask: 'Will I receive my salary during the probation period?',
    });
  return from(p, { id: 'probation-paid', level: 'green', title: 'Salary is paid during probation', law });
};

const probationNotice: Rule = ({ noticeDaysProbation: p }) => {
  if (!p) return null;
  const law = {
    article: 'Art. 9(1), 9(3), 9(4)',
    summary:
      'An employer ending probation must give at least 14 days’ written notice. If you leave during probation for another UAE job you must give at least 1 month; to leave the UAE, at least 14 days.',
  };
  if (p.value < 14)
    return from(p, {
      id: 'probation-notice',
      level: 'red',
      title: `${p.value} days’ notice in probation is under the 14-day minimum`,
      law,
      ask: 'Could the notice period during probation be at least 14 days, in line with the law?',
    });
  return null;
};

const noticePeriod: Rule = ({ noticeDaysAfterProbation: n }) => {
  if (!n) return null;
  const law = { article: 'Art. 43(1)', summary: 'After probation, notice must be between 30 and 90 days, and the same for both sides.' };
  if (n.value < 30 || n.value > 90)
    return from(n, {
      id: 'notice-period',
      level: 'red',
      title: `${n.value} days’ notice is outside the 30 to 90 day range`,
      law,
      ask: `Could the notice period be adjusted to fall between 30 and 90 days?`,
    });
  return from(n, { id: 'notice-period', level: 'green', title: `Notice of ${n.value} days is within the legal range`, law });
};

const nonCompete: Rule = ({ nonCompeteMonths: m, nonCompeteLimitedPlace: place, nonCompeteLimitedWork: work }) => {
  const anchor: Term<number | boolean> | null = m ?? place ?? work;
  if (!anchor) return null;
  const law = {
    article: 'Art. 10(1); Cabinet Resolution 1/2022, Art. 12',
    summary:
      'A non-compete must be limited in time, place and type of work to what protects the employer’s legitimate interests, and can last at most 2 years after the contract ends. It does not apply if the contract ends during probation.',
  };
  const problems: string[] = [];
  if (m && m.value > 24) problems.push(m.value >= 999 ? 'has no end date' : `lasts ${m.value} months`);
  if (place && !place.value) problems.push('covers any country or place');
  if (work && !work.value) problems.push('covers any kind of work');
  if (problems.length)
    return {
      id: 'non-compete',
      level: 'red',
      title: `The non-compete ${problems.join(' and ')}`,
      quote: (m ?? anchor).quote,
      confidence: (m ?? anchor).confidence,
      law,
      ask: 'Could the non-compete be limited to at most 2 years, a specific place and the specific type of work, as the law requires?',
    };
  return from(anchor, {
    id: 'non-compete',
    level: 'amber',
    title: 'There is a non-compete clause',
    law,
    ask: 'Which roles and companies would the non-compete cover after I leave?',
  });
};

const workingHours: Rule = ({ weeklyHours: w, dailyHours: d }) => {
  const law = { article: 'Art. 17(1), Art. 19', summary: 'Normal hours are at most 8 a day and 48 a week. Overtime is paid at basic wage plus at least 25%.' };
  if (w && w.value > 48)
    return from(w, {
      id: 'working-hours',
      level: 'red',
      title: `${w.value} hours a week is over the 48-hour limit`,
      law,
      ask: 'Are hours above 48 a week treated as paid overtime?',
    });
  if (d && d.value > 8)
    return from(d, {
      id: 'working-hours',
      level: 'red',
      title: `${d.value} hours a day is over the 8-hour limit`,
      law,
      ask: 'Are hours above 8 a day treated as paid overtime?',
    });
  return null;
};

const annualLeave: Rule = ({ annualLeaveDays: l, annualLeaveDayType: type }) => {
  if (!l) return null;
  const law = { article: 'Art. 29(1)', summary: 'At least 30 days of paid annual leave a year after one year of service (2 days a month between 6 and 12 months).' };
  const kind = type?.value ?? 'not stated';
  // 22 working days on a 5-day week is about 30 calendar days.
  const calendar = kind === 'working' ? (l.value * 7) / 5 : l.value;
  if (calendar >= 29.5)
    return from(l, { id: 'annual-leave', level: 'green', title: `${l.value} ${kind === 'working' ? 'working ' : ''}days of annual leave meets the minimum`, law });
  if (kind === 'not stated' && l.value >= 22)
    return from(l, {
      id: 'annual-leave',
      level: 'amber',
      title: `${l.value} days of leave: working or calendar days?`,
      law,
      ask: `Are the ${l.value} days of annual leave working days or calendar days?`,
    });
  return from(l, {
    id: 'annual-leave',
    level: 'red',
    title: `${l.value} days of annual leave is under the 30-day minimum`,
    law,
    ask: 'Could annual leave be set at the legal minimum of 30 days a year?',
  });
};

const basicShare: Rule = ({ basicMonthlyAed: b, totalMonthlyAed: t }) => {
  if (!b || !t || t.value <= 0 || b.value >= t.value) return null;
  const share = b.value / t.value;
  if (share >= 0.5) return null;
  const g = gratuityGap(b.value, t.value, 3);
  return from(b, {
    id: 'basic-share',
    level: 'amber',
    title: `Basic salary is only ${Math.round(share * 100)}% of your pay`,
    law: {
      article: 'Art. 51; Art. 1; Art. 19',
      summary:
        'End-of-service gratuity is 21 days of basic wage per year for the first 5 years, and basic wage excludes allowances. Overtime is also calculated on basic.',
    },
    money: [
      { label: `Gratuity after 3 years, on your basic of ${aed(b.value)}`, aed: g.onBasic },
      { label: `What it would be on the full ${aed(t.value)}`, aed: g.onTotal },
      { label: 'Difference', aed: g.gap },
    ],
    ask: 'Is there any flexibility in how the package is split between basic salary and allowances?',
  });
};

const passport: Rule = ({ passportHeldByEmployer: p }) => {
  if (!p || !p.value) return null;
  return from(p, {
    id: 'passport',
    level: 'red',
    title: 'The employer would keep your passport',
    law: { article: 'Art. 13(2)', summary: 'Employers must not withhold a worker’s official documents.' },
    ask: 'Could I keep my own passport? I understand employers should not hold official documents.',
  });
};

const recruitmentCosts: Rule = ({ costsChargedToEmployee: c }) => {
  if (!c) return null;
  const isRecruitment = /recruit|agency|placement|employment fee|hiring fee/i.test(`${c.value} ${c.quote}`);
  return from(c, {
    id: 'recruitment-costs',
    level: isRecruitment ? 'red' : 'amber',
    title: isRecruitment ? 'You would pay recruitment costs' : `You would pay: ${c.value}`,
    law: {
      article: 'Art. 6(4)',
      summary:
        'Employers must not charge workers the fees and costs of recruitment and employment, directly or indirectly. Visa and permit fees are commonly read as included, though the text does not name them.',
    },
    ask: 'Which costs would I be expected to cover, and could the company cover them?',
  });
};

const deductions: Rule = ({ wageDeductions: d, costsChargedToEmployee: c }) => {
  if (!d) return null;
  // A fee taken from salary is already covered by the recruitment-costs finding.
  if (c && sameClause(c.quote, d.quote)) return null;
  return from(d, {
    id: 'deductions',
    level: 'amber',
    title: `Salary deductions: ${d.value}`,
    law: { article: 'Art. 25', summary: 'Deductions are allowed only in 8 listed cases (such as loans, fines up to 5%, damage), and never more than 50% of the wage in total.' },
    ask: 'In what situations would deductions be made from my salary, and how much?',
  });
};

const trainingPayback: Rule = ({ trainingPaybackAed: t }) => {
  if (!t) return null;
  return from(t, {
    id: 'training-payback',
    level: 'amber',
    title: t.value ? `You may have to repay ${aed(t.value)} of training costs` : 'You may have to repay training costs',
    law: {
      article: 'Art. 65(3)',
      summary: 'The labour law does not cover repaying training costs. Contract terms that conflict with the law are void unless they favour the worker.',
    },
    ...(t.value ? { money: [{ label: 'Repayment if you leave early', aed: t.value }] } : {}),
    ask: 'Does the training repayment reduce over time (for example, monthly), and is the amount capped at the actual cost?',
  });
};

const contractType: Rule = ({ contractType: c }) => {
  const law = {
    article: 'Art. 8(1), 8(3); Art. 66(2)',
    summary: 'Every contract must be written, fixed-term and renewable, on MOHRE forms, in Arabic plus a language you understand.',
  };
  // Offer letters often leave the type to the MOHRE contract, so only a stated
  // "unlimited" contract (the pre-2022 kind) is worth asking about.
  if (!c || c.value !== 'unlimited') return null;
  return from(c, {
    id: 'contract-type',
    level: 'amber',
    title: 'The contract is described as unlimited',
    law,
    ask: 'Will I receive the official MOHRE contract, and what fixed term will it state?',
  });
};

/** True when two quotes are about the same sentence (one contains most of the other's words). */
function sameClause(a: string, b: string): boolean {
  const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]+/g) ?? []);
  const wa = words(a);
  const wb = words(b);
  const [small, big] = wa.size <= wb.size ? [wa, wb] : [wb, wa];
  if (small.size === 0) return false;
  let shared = 0;
  for (const w of small) if (big.has(w)) shared++;
  return shared / small.size >= 0.6;
}

export const RULES: Rule[] = [
  probationLength,
  probationPaid,
  probationNotice,
  noticePeriod,
  nonCompete,
  workingHours,
  annualLeave,
  basicShare,
  passport,
  recruitmentCosts,
  deductions,
  trainingPayback,
  contractType,
];

const ORDER = { red: 0, amber: 1, green: 2 } as const;

/** Runs every rule; findings come back red first, then amber, then green. */
export function check(terms: Terms): Finding[] {
  return RULES.map((r) => r(terms))
    .filter((f): f is Finding => f !== null)
    .sort((a, b) => ORDER[a.level] - ORDER[b.level]);
}
