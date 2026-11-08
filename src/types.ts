/** What the reader (Gemini) returns for one term of the offer. */
export type Confidence = 'high' | 'medium' | 'low';

export interface Term<T> {
  value: T;
  /** The sentence in the letter this came from, word for word. */
  quote: string;
  confidence: Confidence;
}

export type ContractType = 'fixed-term' | 'unlimited' | 'internship' | 'part-time' | 'unclear';

/** Every term is null when the letter doesn't mention it. */
export interface Terms {
  role: Term<string> | null;
  employer: Term<string> | null;
  contractType: Term<ContractType> | null;
  contractMonths: Term<number> | null;
  totalMonthlyAed: Term<number> | null;
  basicMonthlyAed: Term<number> | null;
  probationMonths: Term<number> | null;
  probationPaid: Term<boolean> | null;
  noticeDaysProbation: Term<number> | null;
  noticeDaysAfterProbation: Term<number> | null;
  nonCompeteMonths: Term<number> | null;
  /** Whether the non-compete names a place (city, emirate, country) it applies to. */
  nonCompeteLimitedPlace: Term<boolean> | null;
  /** Whether the non-compete names the type of work it applies to. */
  nonCompeteLimitedWork: Term<boolean> | null;
  weeklyHours: Term<number> | null;
  dailyHours: Term<number> | null;
  annualLeaveDays: Term<number> | null;
  annualLeaveDayType: Term<'working' | 'calendar' | 'not stated'> | null;
  trainingPaybackAed: Term<number | null> | null;
  passportHeldByEmployer: Term<boolean> | null;
  costsChargedToEmployee: Term<string> | null;
  wageDeductions: Term<string> | null;
  /** Anything else a careful friend would ask about. Shown as "ask about this" only. */
  otherConcerns: { topic: string; quote: string }[];
}

export type TermKey = Exclude<keyof Terms, 'otherConcerns'>;

export type Level = 'red' | 'amber' | 'green';

export interface Finding {
  id: string;
  level: Level;
  title: string;
  /** The sentence in the letter this finding is about. */
  quote: string;
  law: { article: string; summary: string };
  money?: { label: string; aed: number }[];
  /** The reader's confidence in the term behind this finding. */
  confidence?: Confidence;
  /** A question to put to HR. */
  ask?: string;
}

/** A span of the letter's text, optionally with where it sits on the page image. */
export interface Span {
  start: number;
  end: number;
  box?: { x: number; y: number; w: number; h: number; page?: number };
}
