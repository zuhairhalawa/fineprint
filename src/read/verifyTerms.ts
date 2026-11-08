/**
 * Keeps only the terms whose quote really appears in the letter. A term with
 * an unconfirmed quote is dropped (null), so no verdict is built on it, and
 * reported so the page can say "couldn't confirm".
 */
import type { Span, TermKey, Terms } from '../types.ts';
import { locateQuote } from './locateQuote.ts';

export interface Verified {
  terms: Terms;
  /** Where each kept term's quote sits in the letter. */
  spans: Partial<Record<TermKey, Span>>;
  unconfirmed: TermKey[];
  otherConcerns: { topic: string; quote: string; span: Span }[];
}

export function verifyTerms(text: string, raw: Terms): Verified {
  const terms = { ...raw, otherConcerns: [] } as Terms;
  const spans: Partial<Record<TermKey, Span>> = {};
  const unconfirmed: TermKey[] = [];
  for (const key of Object.keys(raw) as (keyof Terms)[]) {
    if (key === 'otherConcerns') continue;
    const term = raw[key];
    if (!term) continue;
    const at = locateQuote(text, term.quote);
    if (at) spans[key] = { start: at.start, end: at.end };
    else {
      (terms as unknown as Record<string, unknown>)[key] = null;
      unconfirmed.push(key);
    }
  }
  const otherConcerns: Verified['otherConcerns'] = [];
  for (const c of raw.otherConcerns ?? []) {
    const at = locateQuote(text, c.quote);
    if (at) otherConcerns.push({ ...c, span: { start: at.start, end: at.end } });
  }
  terms.otherConcerns = otherConcerns.map(({ topic, quote }) => ({ topic, quote }));
  return { terms, spans, unconfirmed, otherConcerns };
}
