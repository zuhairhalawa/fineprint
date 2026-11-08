/**
 * POST /api/read  { text }  →  { model, isOfferLetter, language, terms, otherConcerns }
 * The text has already had personal details blanked out in the browser.
 */
import { GeminiError, geminiJson } from '../../src/read/gemini.ts';
import { READ_SCHEMA, READ_SYSTEM } from '../../src/read/prompts.ts';
import { type Env, MAX_CHARS, guard, json, models } from '../../src/server/guard.ts';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const blocked = guard(request, 'read', 20);
  if (blocked) return blocked;
  let text: unknown;
  try {
    ({ text } = (await request.json()) as { text?: unknown });
  } catch {
    return json({ error: 'Send JSON.' }, 400);
  }
  if (typeof text !== 'string' || text.trim().length < 80) return json({ error: 'The letter text is too short to check.' }, 400);
  if (text.length > MAX_CHARS) return json({ error: 'This letter is longer than Fineprint can check (about 10 pages).' }, 413);
  try {
    const { data, model } = await geminiJson<Record<string, unknown>>({
      apiKey: env.GEMINI_API_KEY,
      models: models(env),
      system: READ_SYSTEM,
      user: text,
      schema: READ_SCHEMA,
      rounds: 2,
    });
    return json({ model, ...data });
  } catch (e) {
    const status = e instanceof GeminiError && e.status === 429 ? 429 : 502;
    return json({ error: status === 429 ? 'The free AI quota is busy. Please try again in a minute.' : 'The AI reader is busy right now. Please try again in a minute.' }, status);
  }
};
