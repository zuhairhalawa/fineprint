/**
 * Accuracy test: runs blank-out → read (live Gemini) → quote check → rules on
 * every fictional letter in eval/letters and compares the red and amber
 * findings with the planted issues in each *.expected.json.
 *
 * Usage: npm run eval   (needs GEMINI_API_KEY in .dev.vars; never printed)
 * Writes eval/out/results.json. Numbers in the README come from this file.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { geminiJson } from '../src/read/gemini.ts';
import { READ_SCHEMA, READ_SYSTEM } from '../src/read/prompts.ts';
import { verifyTerms } from '../src/read/verifyTerms.ts';
import { redact } from '../src/redact/redact.ts';
import { check } from '../src/rules/rules.ts';
import type { Terms } from '../src/types.ts';
import { loadVars } from './try-read.ts';

const dir = new URL('./letters/', import.meta.url);
const vars = loadVars();
const models = (vars.GEMINI_MODELS ?? 'gemini-3-flash-preview').split(',');
const runs = Number(process.argv[2] ?? 1);

interface Row {
  letter: string;
  run: number;
  model: string;
  ms: number;
  found: string[];
  missed: string[];
  falseAlarms: string[];
  unconfirmed: string[];
  terms?: Terms;
}

const rows: Row[] = [];
for (const file of readdirSync(dir).filter((f) => f.endsWith('.txt')).sort()) {
  const letter = readFileSync(new URL(file, dir), 'utf8');
  const expected = JSON.parse(readFileSync(new URL(file.replace('.txt', '.expected.json'), dir), 'utf8')).issues as Record<string, string>;
  for (let run = 1; run <= runs; run++) {
    const safe = redact(letter).text;
    const t0 = Date.now();
    const { data, model } = await geminiJson<{ terms: Terms; otherConcerns: Terms['otherConcerns'] }>({
      apiKey: vars.GEMINI_API_KEY as string,
      models,
      system: READ_SYSTEM,
      user: safe,
      schema: READ_SCHEMA,
    });
    const ms = Date.now() - t0;
    const v = verifyTerms(safe, { ...data.terms, otherConcerns: data.otherConcerns });
    const flagged = new Map(check(v.terms).filter((f) => f.level !== 'green').map((f) => [f.id, f.level]));
    const found: string[] = [];
    const missed: string[] = [];
    for (const [id, level] of Object.entries(expected)) {
      if (flagged.get(id) === level) found.push(id);
      else missed.push(`${id} (expected ${level}, got ${flagged.get(id) ?? 'nothing'})`);
    }
    const falseAlarms = [...flagged].filter(([id]) => !(id in expected)).map(([id, l]) => `${id} (${l})`);
    rows.push({ letter: file, run, model, ms, found, missed, falseAlarms, unconfirmed: v.unconfirmed, terms: v.terms });
    console.log(
      `${file.padEnd(28)} run ${run}  ${String(found.length).padStart(2)}/${Object.keys(expected).length} found` +
        `${missed.length ? `  MISSED ${missed.join(', ')}` : ''}${falseAlarms.length ? `  FALSE ${falseAlarms.join(', ')}` : ''}` +
        `${v.unconfirmed.length ? `  unconfirmed: ${v.unconfirmed.join(', ')}` : ''}  ${ms} ms`,
    );
  }
}

const planted = rows.reduce((n, r) => n + r.found.length + r.missed.length, 0);
const found = rows.reduce((n, r) => n + r.found.length, 0);
const falseAlarms = rows.reduce((n, r) => n + r.falseAlarms.length, 0);
const summary = {
  date: new Date().toISOString(),
  models: [...new Set(rows.map((r) => r.model))],
  letters: new Set(rows.map((r) => r.letter)).size,
  runsPerLetter: runs,
  planted,
  found,
  falseAlarms,
  medianMs: rows.map((r) => r.ms).sort((a, b) => a - b)[Math.floor(rows.length / 2)],
};
console.log(`\nFound ${found} of ${planted} planted issues, ${falseAlarms} false alarms.`, summary);
mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
writeFileSync(new URL('./out/results.json', import.meta.url), JSON.stringify({ summary, rows }, null, 1));
