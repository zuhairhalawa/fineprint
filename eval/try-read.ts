/**
 * Runs the read step on one letter against the live model and prints the terms.
 * Usage: node --experimental-strip-types eval/try-read.ts <letter.txt>
 * The API key comes from .dev.vars (git-ignored) and is never printed.
 */
import { readFileSync } from 'node:fs';
import { redact } from '../src/redact/redact.ts';
import { geminiJson } from '../src/read/gemini.ts';
import { READ_SCHEMA, READ_SYSTEM } from '../src/read/prompts.ts';

export function loadVars(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').split(/\r?\n/)) {
    const m = /^(\w+)="?(.*?)"?$/.exec(line.trim());
    if (m) out[m[1] as string] = m[2] as string;
  }
  return out;
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) {
  const vars = loadVars();
  const letter = readFileSync(process.argv[2] as string, 'utf8');
  const safe = redact(letter).text;
  const t0 = Date.now();
  const { data, model } = await geminiJson({
    apiKey: vars.GEMINI_API_KEY as string,
    models: (vars.GEMINI_MODELS ?? 'gemini-3-flash-preview').split(','),
    system: READ_SYSTEM,
    user: safe,
    schema: READ_SCHEMA,
  });
  console.log(model, `${Date.now() - t0} ms`);
  console.log(JSON.stringify(data, null, 1));
}
