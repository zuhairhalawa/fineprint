/** Builds the report: finding cards, the photo view with boxes, and the HR email. */
import type { Doc } from '../ingest/types.ts';
import type { Mask } from '../redact/redact.ts';
import type { Finding, Level, TermKey } from '../types.ts';
import type { Mark } from './paper.ts';

const LEVEL_LABEL: Record<Level, string> = {
  red: 'Likely against UAE law',
  amber: 'Worth asking about',
  green: 'Good to see',
};

const aed = (n: number) => `AED ${Math.round(n).toLocaleString('en-US')}`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function findingCard(f: Finding, plain: string | null | undefined, exact: boolean | null, onQuote: () => void): HTMLLIElement {
  const li = el('li', `finding ${f.level}`);
  li.id = `finding-${f.id}`;
  li.append(el('span', 'level', LEVEL_LABEL[f.level]), el('h3', undefined, f.title));

  const q = el('blockquote', undefined, `“${f.quote}”`);
  q.title = 'Show in the letter';
  q.tabIndex = 0;
  q.addEventListener('click', onQuote);
  q.addEventListener('keydown', (e) => e.key === 'Enter' && onQuote());
  li.append(q);

  // null: the explanation is still being written; undefined: none.
  if (plain !== undefined) li.append(el('p', plain === null ? 'plain pending' : 'plain', plain ?? 'Writing a plain-English explanation…'));

  const law = el('p', 'law');
  law.append(el('b', undefined, `${f.law.article}: `), document.createTextNode(f.law.summary));
  li.append(law);

  if (f.money?.length) {
    const table = el('table', 'money');
    for (const m of f.money) {
      const tr = el('tr');
      tr.append(el('td', undefined, m.label), el('td', undefined, aed(m.aed)));
      table.append(tr);
    }
    li.append(table);
  }
  if (f.ask && f.level !== 'green') {
    const ask = el('p', 'ask');
    ask.append(el('b', undefined, 'Ask: '), document.createTextNode(f.ask));
    li.append(ask);
  }
  const meta: string[] = [];
  if (f.confidence) meta.push(`AI reading confidence: ${f.confidence}`);
  if (exact !== null) meta.push(exact ? 'quote found word for word in your letter' : 'quote matched in your letter, allowing for photo reading errors');
  if (meta.length) li.append(el('p', 'meta', meta.join(' · ')));
  return li;
}

export function tally(container: HTMLElement, findings: Finding[]): void {
  container.replaceChildren();
  for (const [level, label] of [
    ['red', 'against the law'],
    ['amber', 'to ask about'],
    ['green', 'good to see'],
  ] as const) {
    const n = findings.filter((f) => f.level === level).length;
    const d = el('div', `t-${level}`);
    d.append(el('b', undefined, String(n)), el('span', undefined, label));
    container.append(d);
  }
}

/** Draws each page photo with black boxes over masked words and highlighter boxes over findings. */
export function renderPhotos(container: HTMLElement, doc: Doc, masks: Mask[], marks: Mark[]): void {
  container.replaceChildren();
  const RANK: Record<Level, number> = { red: 0, amber: 1, green: 2 };
  for (const page of doc.pages) {
    const wrap = el('div');
    wrap.style.position = 'relative';
    const img = el('img');
    img.src = page.imageUrl;
    img.alt = 'Your letter, with personal details blacked out and findings highlighted';
    wrap.append(img);
    for (const w of page.words) {
      const masked = masks.some((m) => m.start < w.end && m.end > w.start);
      const hit = marks.filter((m) => m.start < w.end && m.end > w.start).sort((a, b) => RANK[a.level] - RANK[b.level])[0];
      if (!masked && !hit) continue;
      const box = el('div', `box ${masked ? 'mask' : hit!.level}`);
      const pad = 2;
      box.style.left = `${((w.x - pad) / page.width) * 100}%`;
      box.style.top = `${((w.y - pad) / page.height) * 100}%`;
      box.style.width = `${((w.w + pad * 2) / page.width) * 100}%`;
      box.style.height = `${((w.h + pad * 2) / page.height) * 100}%`;
      if (hit && !masked) box.dataset.id = hit.id;
      wrap.append(box);
    }
    container.append(wrap);
  }
}

/** A plain email built from the findings, used when the AI explanation is unavailable. */
export function fallbackEmail(findings: Finding[], role?: string): string {
  const asks = findings.filter((f) => f.level !== 'green' && f.ask).map((f) => `- ${f.ask}`);
  return [
    'Dear Hiring Team,',
    '',
    `Thank you for the offer${role ? ` for the ${role} role` : ''}. I'm excited about joining, and before signing I'd be grateful for clarification on a few points:`,
    '',
    ...asks,
    '',
    'Thank you for your help.',
    '',
    'Kind regards,',
    '[Your name]',
  ].join('\n');
}

export const TERM_LABEL: Record<TermKey, string> = {
  role: 'job title',
  employer: 'employer',
  contractType: 'contract type',
  contractMonths: 'contract length',
  totalMonthlyAed: 'total pay',
  basicMonthlyAed: 'basic pay',
  probationMonths: 'probation length',
  probationPaid: 'pay during probation',
  noticeDaysProbation: 'notice during probation',
  noticeDaysAfterProbation: 'notice period',
  nonCompeteMonths: 'non-compete length',
  nonCompeteLimitedPlace: 'non-compete place',
  nonCompeteLimitedWork: 'non-compete scope',
  weeklyHours: 'weekly hours',
  dailyHours: 'daily hours',
  annualLeaveDays: 'annual leave',
  annualLeaveDayType: 'leave day type',
  trainingPaybackAed: 'training repayment',
  passportHeldByEmployer: 'passport',
  costsChargedToEmployee: 'costs charged to you',
  wageDeductions: 'salary deductions',
};
