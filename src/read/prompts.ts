/**
 * Prompts and output formats for the two Gemini steps. Shared by the
 * server functions and the accuracy test, so both run the same thing.
 */
import type { TermKey } from '../types.ts';

const conf = { type: 'string', enum: ['high', 'medium', 'low'] };

function term(value: object, description: string) {
  return {
    description,
    anyOf: [
      { type: 'null' },
      {
        type: 'object',
        properties: { value, quote: { type: 'string' }, confidence: conf },
        required: ['value', 'quote', 'confidence'],
      },
    ],
  };
}

const num = { type: 'number' };
const str = { type: 'string' };
const bool = { type: 'boolean' };

export const TERM_FIELDS: Record<TermKey, object> = {
  role: term(str, 'Job title offered.'),
  employer: term(str, 'Employer name.'),
  contractType: term(
    { type: 'string', enum: ['fixed-term', 'unlimited', 'internship', 'part-time', 'unclear'] },
    'Contract type as stated.',
  ),
  contractMonths: term(num, 'Contract length in months, if a fixed term is stated.'),
  totalMonthlyAed: term(num, 'Total monthly pay in AED (basic plus all monthly allowances). Convert yearly figures to monthly.'),
  basicMonthlyAed: term(num, 'Basic monthly salary in AED, only if the letter states a basic figure.'),
  probationMonths: term(num, 'Probation length in months (90 days = 3, 26 weeks = 6).'),
  probationPaid: term(bool, 'Whether pay is given during probation. Only if the letter says so.'),
  noticeDaysProbation: term(num, 'Notice in days during probation (1 month = 30 days).'),
  noticeDaysAfterProbation: term(num, 'Notice in days after probation (1 month = 30 days).'),
  nonCompeteMonths: term(num, 'How long after leaving the non-compete lasts, in months. Use 999 if it has no end.'),
  nonCompeteLimitedPlace: term(bool, 'True if the non-compete names a limited place (city, emirate, country). False if it says anywhere or worldwide or names no place.'),
  nonCompeteLimitedWork: term(bool, 'True if the non-compete names the type of work or business it covers. False if it covers any work or any company.'),
  weeklyHours: term(num, 'Normal working hours per week. Compute from daily hours and working days only if both are stated.'),
  dailyHours: term(num, 'Normal working hours per day.'),
  annualLeaveDays: term(num, 'Paid annual leave days per year, as the number written.'),
  annualLeaveDayType: term(
    { type: 'string', enum: ['working', 'calendar', 'not stated'] },
    'Whether the leave days are working days or calendar days, as written. "not stated" if the letter just says days.',
  ),
  trainingPaybackAed: term(
    { anyOf: [num, { type: 'null' }] },
    'Only a clause that makes the employee repay training, course or certification costs if they leave. Value is the AED amount, or null if no amount is given. The whole term is null if the letter says training is free or there is no repayment.',
  ),
  passportHeldByEmployer: term(bool, 'True if the employer keeps or holds the employee passport or other official documents.'),
  costsChargedToEmployee: term(str, 'Any recruitment, visa, work permit, medical test or similar cost the employee must pay or that is deducted from pay. Value names the costs.'),
  wageDeductions: term(
    str,
    'Deductions from salary for other reasons (fines, penalties, lost or damaged equipment). Do not repeat costs already given in costsChargedToEmployee. Value names them.',
  ),
};

export const READ_SCHEMA = {
  type: 'object',
  properties: {
    isOfferLetter: { type: 'boolean' },
    language: { type: 'string', description: 'Main language of the letter, e.g. English or Arabic.' },
    terms: { type: 'object', properties: TERM_FIELDS, required: Object.keys(TERM_FIELDS) },
    otherConcerns: {
      type: 'array',
      description:
        'Up to 3 OTHER clauses a careful friend would ask about before signing, that are not already covered by the terms above (for example: unpaid overtime expectations, clawbacks, unilateral changes, short acceptance deadlines).',
      items: { type: 'object', properties: { topic: str, quote: str }, required: ['topic', 'quote'] },
    },
  },
  required: ['isOfferLetter', 'language', 'terms', 'otherConcerns'],
};

export const READ_SYSTEM = `You read job offer letters and employment contracts from the UAE private sector and return their key terms as JSON.

Rules:
- Return only what the letter states. If a term is not in the letter, return null for it. Never guess or fill in typical values.
- "quote" must be copied word for word from the letter: one sentence or clause, under 40 words, exactly as written (same spelling and numbers). Never paraphrase.
- Convert units as described for each field, but keep the quote as written.
- confidence: "high" when the letter states it plainly; "medium" when you had to combine or convert figures; "low" when the wording is ambiguous.
- Characters like ████ are personal details the user blanked out. Ignore them.
- You do not judge legality. Another system does that.
- If the text is not a job offer or employment contract, set isOfferLetter to false.`;

export const EXPLAIN_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'One sentence for the top of the report.' },
    cards: {
      type: 'array',
      items: { type: 'object', properties: { id: str, plain: str }, required: ['id', 'plain'] },
    },
    email: { type: 'string', description: 'A short, polite email to HR asking about the red and amber findings.' },
  },
  required: ['summary', 'cards', 'email'],
};

export const EXPLAIN_SYSTEM = `You help a student or fresh graduate in the UAE understand findings about their job offer. The findings were produced by a rule checker against UAE labour law (Federal Decree-Law No. 33 of 2021). You only explain them.

Rules:
- Write one card per finding, with the same id. "plain" is at most 50 words, in plain English, second person ("you"), friendly and calm.
- Use only the facts in the findings. Do not add legal claims, article numbers or amounts that are not given. Do not tell the user what to do legally; suggest what to ask.
- summary: one sentence, at most 25 words, saying how many things are worth asking about (red and amber findings) and the most important one.
- email: under 160 words, polite and positive about the offer, asking about each red and amber finding as a question (never an accusation). No green findings in the email. Lay it out with line breaks (\\n) exactly like this: "Dear Hiring Team," then a blank line, one or two thank-you sentences, a blank line, the questions as a numbered list with one question per line ("1. ..."), a blank line, one closing sentence, a blank line, "Kind regards," and "[Your name]" on the last line.
- English only.`;
