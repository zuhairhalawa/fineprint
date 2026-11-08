/**
 * POST /api/explain  { findings, role?, employer? }  →  { summary, cards, email }
 * Gets only the rule checker's findings, never the letter.
 */
import { GeminiError, geminiJson } from '../../src/read/gemini.ts';
import { EXPLAIN_SCHEMA, EXPLAIN_SYSTEM } from '../../src/read/prompts.ts';
import { type Env, guard, json, models } from '../../src/server/guard.ts';
import type { Finding } from '../../src/types.ts';

interface Explained {
  summary: string;
  cards: { id: string; plain: string }[];
  email: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const blocked = guard(request, 'explain', 30);
  if (blocked) return blocked;
  let body: { findings?: Finding[]; role?: string; employer?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'Send JSON.' }, 400);
  }
  if (!Array.isArray(body.findings) || body.findings.length > 30) return json({ error: 'Send the findings list.' }, 400);
  // Only the fields the explainer needs, so nothing else reaches the model.
  const findings = body.findings.map((f) => ({
    id: String(f.id),
    level: f.level,
    title: String(f.title).slice(0, 200),
    quote: String(f.quote).slice(0, 400),
    law: { article: String(f.law?.article).slice(0, 80), summary: String(f.law?.summary).slice(0, 400) },
    money: Array.isArray(f.money) ? f.money.slice(0, 4) : undefined,
    ask: f.ask ? String(f.ask).slice(0, 300) : undefined,
  }));
  const user = JSON.stringify({ role: body.role ?? null, employer: body.employer ?? null, findings });
  try {
    const { data } = await geminiJson<Explained>({
      apiKey: env.GEMINI_API_KEY,
      models: models(env),
      system: EXPLAIN_SYSTEM,
      user,
      schema: EXPLAIN_SCHEMA,
      rounds: 2,
    });
    const ids = new Set(findings.map((f) => f.id));
    return json({ ...data, cards: data.cards.filter((c) => ids.has(c.id)) });
  } catch (e) {
    const status = e instanceof GeminiError && e.status === 429 ? 429 : 502;
    return json({ error: 'Explanations are unavailable right now; the findings above still stand.' }, status);
  }
};
