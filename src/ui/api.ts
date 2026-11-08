/** Calls to the site's own server functions. */
import type { Finding, Terms } from '../types.ts';

export interface ReadResult {
  model: string;
  isOfferLetter: boolean;
  language: string;
  terms: Omit<Terms, 'otherConcerns'>;
  otherConcerns: Terms['otherConcerns'];
}

export interface Explained {
  summary: string;
  cards: { id: string; plain: string }[];
  email: string;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new Error('No connection. Check your internet and try again.');
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Something went wrong (${res.status}). Please try again.`);
  return data as T;
}

export const readTerms = (text: string) => post<ReadResult>('/api/read', { text });

export const explain = (findings: Finding[], role?: string, employer?: string) =>
  post<Explained>('/api/explain', { findings, role, employer });
