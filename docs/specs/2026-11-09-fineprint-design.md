# Fineprint: design

Date: 2026-11-09. Entry for SLAY HACKS 2026 (Devpost). Deadline: Dec 7, 5:00 PM EST, which is Dec 8, 02:00 Dubai. We aim to submit by Dec 5.

## Goal

Fineprint helps UAE students and fresh graduates understand a job or internship offer before they sign it. You add the offer letter. Fineprint highlights the clauses worth asking about, says what UAE labour law says about each one (with the article), shows the money effect in AED, and drafts polite questions for HR.

**Success means:**
- a live site that a judge can use in one click with the built-in sample letter
- a measured accuracy figure on fictional test letters
- a 2–4 minute video
- a Devpost write-up that scores on both judging rubrics: innovation, technical work, real-world impact, responsible AI, UX and presentation, and "fully deployable"

**Constraints:**
- everything is in English, with no multilingual features
- $0: free tiers only
- the user's face doesn't appear anywhere
- no invented personal story: the write-up says "a CS student in the UAE about to get first offers"
- the app gives information, not legal advice, and says so

## User flow (one page)

1. **Add the offer.** Drop a PDF, take a photo or choose an image, or paste the text. A "Try the sample letter" button loads a fictional internship offer from Dunes Digital LLC.
2. **Blank out personal details on the device.** The letter's text is shown with names, email addresses, phone numbers, Emirates ID numbers, passport numbers and IBANs blacked out. The user can black out more by selecting text. Nothing has been sent yet. The button reads "Check my offer".
3. **The report:**
   - **Left:** the letter (the photo, or the text), with each finding's sentence highlighted. Red means likely against UAE law, amber means legal but worth asking about, green means good to see.
   - **Right:** one card per finding, with:
     - the title
     - the quoted sentence
     - what the law says, with the article
     - what it means for the user
     - the money effect in AED, where it applies
     - the AI's confidence in its reading of the term
   - **Top:** a one-line summary ("3 things to ask about before you sign") and a **Read aloud** button, which uses the browser's own speech.
4. **Questions for HR.** A short, polite email that asks about each red or amber finding, with a Copy button.

Every screen says "Information, not legal advice", "English letters only" and "Nothing is stored".

## Architecture

```
browser                                        Cloudflare Pages Function            Gemini
-------                                        -------------------------            ------
PDF  -> pdf.js text (+ positions)    \
photo -> tesseract.js OCR (+ boxes)   } text -> redact (on device) -> POST /api/read ----> read: terms JSON
paste -> text                        /                                (key held here)
                                                terms + quotes  <--------------------------
browser: verify every quote appears in the redacted text (drop any that don't)
browser: rules.ts judges the terms -> findings (+ AED maths)   <- deterministic, unit-tested
         POST /api/explain (findings only) ---------------------------------------------> explain: plain English + HR email
browser: render report, map quotes -> highlight boxes / text ranges
```

**Units, each with one job:**
- **`src/ingest/`:** `pdfText.ts` (pdf.js), `ocr.ts` (tesseract.js, words with boxes), `pasteText.ts`. Each returns `{ text, spans: [{start, end, box?, page?}] }`.
- **`src/redact/redact.ts`:** finds personal details with patterns (email, UAE phone, Emirates ID 784-XXXX-XXXXXXX-X, passport, IBAN AE..), the "Dear <Name>" and "Name:" lines, and spans the user selects. Returns the redacted text and the list of masked ranges. Pure and unit-tested.
- **`src/read/schema.ts`:** the terms the reader must return. Each term is `{ value, quote, confidence: "high"|"medium"|"low" }`, or `null` if the letter doesn't mention it. Terms:
  - role, employer, start date, contract type and term
  - total monthly pay, basic monthly pay, allowances
  - probation months, and whether probation is paid
  - notice days in probation and after probation
  - non-compete: months, area and scope
  - weekly hours and daily hours
  - annual leave days
  - training-cost payback (amount and period)
  - passport kept by employer
  - recruitment or visa costs charged to the employee
  - salary deductions
  - extra clauses of concern: free text with a quote, shown as amber "ask about this" only, never as red
- **`src/read/verifyQuotes.ts`:** a quote must appear in the redacted text after whitespace and case are normalised (with a small allowance for OCR noise). If not, that term becomes "couldn't confirm" and gets no verdict.
- **`src/rules/`:** one file per rule, plus `index.ts`. A rule is `(terms) => Finding | null`. A finding is `{ id, level: "red"|"amber"|"green", title, quote, law: { article, summary }, money?: { label, aed }, needsHuman?: string }`. The rule values, with the exact articles, live in `docs/law-notes.md`, checked against the official text of Federal Decree-Law No. 33 of 2021 and its amendments.
- **`src/money/gratuity.ts`:** end-of-service gratuity on basic pay versus on total pay, over 1, 3 and 5 years, plus the gap. Pure and unit-tested.
- **`functions/api/read.ts` and `functions/api/explain.ts`** (Cloudflare Pages Functions):
  - **Model:** Gemini, `gemini-3-flash-preview` by default, set by `GEMINI_MODEL`, with one fallback model.
  - **Output:** JSON-schema output (`responseSchema`).
  - **Limits:** text input up to 30,000 characters. Per-IP rate limits (KV, or an in-memory and header-based best effort).
  - **Origin:** only requests from the site's own origin are accepted.
  - **Privacy:** the function never logs letter text.
- **`src/ui/`:** plain TypeScript and DOM with no framework. `main.ts` handles the flow, plus `upload.ts`, `redactView.ts`, `report.ts`, `highlights.ts` and `email.ts`.

**The explain step's limits:** its input is the findings list, not the letter. Its prompt says to explain only the findings given, add no new legal claims, and keep each one under 60 words. Its output is `{ summary, cards: [{id, plain}], email }`. If it fails, the report still shows the rule text, so the explanation is a bonus, not a dependency.

## Rules (first set, about 10)

Each is red, amber or green. The exact thresholds and articles are in `docs/law-notes.md`.
1. Probation longer than the legal maximum (red); unpaid probation (red).
2. Notice period below the legal minimum or above the maximum (red); notice in probation (amber, explains both directions).
3. Non-compete longer than the legal maximum, or with no limit on place or type of work (red); any non-compete (amber, explains its conditions).
4. Weekly hours above the legal maximum (red).
5. Annual leave below the legal entitlement (red).
6. Basic pay below 50% of total pay (amber), with the gratuity gap in AED over 1, 3 and 5 years.
7. Passport kept by the employer (red).
8. Recruitment or visa costs charged to the employee (red).
9. Training-cost payback (amber: ask for the amount, the period and whether it reduces over time).
10. Contract type or term missing or unclear (amber).
11. Good things the letter states clearly (green), for example paid probation or 30 days' leave.

## Testing

- **Unit tests** (Vitest): every rule (red, amber, green and null cases), the gratuity maths, redaction patterns and quote checking.
- **Test letters:** `eval/letters/*.txt`, 8 fictional letters, each with `*.expected.json` listing the planted issues. `npm run eval` runs read, verify and rules against the live model and reports found, missed and false alarms. The numbers go in the README and the write-up exactly as measured.
- **End to end:** a Playwright script loads the sample letter, runs the check (live, or with a saved model response) and takes the screenshots used in the README and on Devpost.

## Errors and limits shown to the user

- **Model busy or rate-limited:** "Try again in a minute", with the redacted text kept so nothing is lost.
- **OCR confidence too low:** "This photo is hard to read. Try a flatter, brighter photo, or paste the text."
- **Not an offer letter:** "This doesn't look like a job offer."
- **Arabic text detected:** "English letters only for now."
- **Always visible:** information, not legal advice; free-zone (DIFC/ADGM) and government jobs follow other rules; ask MOHRE (800 60) or a lawyer for advice.

## Deliverables

- live site on Cloudflare Pages
- public repo `zuhairhalawa/fineprint` (MIT)
- README with setup steps and the measured accuracy
- 8–12 screenshots
- a 2–4 minute video with a male narrator
- Devpost write-up: overview, problem and solution, AI implementation, demo link, screenshots, repo

## User-only steps

- join SLAY HACKS on Devpost
- create a Cloudflare account and connect the repo, or run `wrangler login` once
- set the `GEMINI_API_KEY` secret, or allow me to set it with a script that never prints it
- `gh repo create`
- upload the YouTube video
- press Submit on Devpost

## Out of scope

- other languages
- accounts and saved history
- free-zone (DIFC/ADGM) employment law
- government jobs
- domestic workers
- contract drafting
