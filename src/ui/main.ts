/** The page flow: add the offer → check what will be sent → working → report. */
import './style.css';
import type { Doc } from '../ingest/types.ts';
import { locateQuote } from '../read/locateQuote.ts';
import { verifyTerms } from '../read/verifyTerms.ts';
import { type Mask, redact } from '../redact/redact.ts';
import { check } from '../rules/rules.ts';
import type { Finding, Terms } from '../types.ts';
import { type Explained, explain, readTerms } from './api.ts';
import { type Mark, renderPaper, selectionRange } from './paper.ts';
import { TERM_LABEL, fallbackEmail, findingCard, renderPhotos, tally } from './report.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const screens = ['start', 'review', 'working', 'report'] as const;
type Screen = (typeof screens)[number];

function show(s: Screen): void {
  for (const id of screens) $(id).hidden = id !== s;
  window.scrollTo({ top: 0 });
  const heading = $(s).querySelector<HTMLElement>('h1, h2');
  heading?.setAttribute('tabindex', '-1');
  heading?.focus({ preventScroll: true });
}

let doc: Doc | null = null;
let userMasks: Mask[] = [];
let safe = { text: '', masks: [] as Mask[] };

function setStatus(id: string, msg: string, error = false): void {
  const s = $(id);
  s.textContent = msg;
  s.classList.toggle('error', error);
}

/* ---------- 1. Add the offer ---------- */

async function loadFiles(list: FileList | File[] | null | undefined): Promise<void> {
  const files = [...(list ?? [])].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const file = files[0];
  if (!file) return;
  const progress = (m: string, f?: number) => setStatus('start-status', f !== undefined && f > 0 && f < 1 ? `${m} (${Math.round(f * 100)}%)` : m);
  try {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const { readPdf } = await import('../ingest/pdf.ts');
      await openReview(await readPdf(file, progress));
    } else if (files.every((f) => f.type.startsWith('image/'))) {
      const { readPhotos } = await import('../ingest/ocr.ts');
      await openReview(await readPhotos(files.slice(0, 6), progress));
    } else {
      setStatus('start-status', 'Please add one PDF, or photos of the letter (one per page).', true);
    }
  } catch (e) {
    console.error(e);
    setStatus('start-status', 'That file could not be read. Try a PDF, a clearer photo, or paste the text.', true);
  }
}

$('file').addEventListener('change', (e) => void loadFiles((e.target as HTMLInputElement).files));
$('camera').addEventListener('change', (e) => void loadFiles((e.target as HTMLInputElement).files));
const drop = $('drop');
drop.addEventListener('dragover', (e) => {
  e.preventDefault();
  drop.classList.add('over');
});
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => {
  e.preventDefault();
  drop.classList.remove('over');
  void loadFiles(e.dataTransfer?.files);
});
$('paste-open').addEventListener('click', () => {
  $('paste-box').hidden = false;
  $('paste-text').focus();
});
$('paste-go').addEventListener('click', () => {
  const text = $<HTMLTextAreaElement>('paste-text').value.trim();
  if (text.length < 80) return setStatus('start-status', 'That is too short to be an offer letter. Paste the whole letter.', true);
  void openReview({ text, source: 'paste', pages: [] });
});
$('sample').addEventListener('click', async () => {
  setStatus('start-status', 'Loading the sample letter');
  const text = await (await fetch('/sample/dunes-digital-offer.txt')).text();
  await openReview({ text, source: 'sample', pages: [] });
});

/* ---------- 2. Check what will be sent ---------- */

async function openReview(d: Doc): Promise<void> {
  doc = d;
  userMasks = [];
  setStatus('start-status', '');
  const warn: string[] = [];
  const arabic = (d.text.match(/[؀-ۿ]/g) ?? []).length;
  if (arabic > d.text.length * 0.2) warn.push('This letter looks mostly Arabic. Fineprint reads English letters only for now.');
  if (d.ocrConfidence !== undefined && d.ocrConfidence < 70)
    warn.push('Parts of this photo were hard to read. For a better result, take a flat, bright photo, or paste the text.');
  if (d.text.length < 300) warn.push('Very little text was found. Check that the whole letter is included.');
  $('ocr-warning').hidden = warn.length === 0;
  $('ocr-warning').textContent = warn.join(' ');
  refreshReview();
  show('review');
}

function refreshReview(): void {
  if (!doc) return;
  safe = redact(doc.text, userMasks);
  renderPaper($('review-paper'), safe.text);
  const auto = safe.masks.length;
  $('mask-count').textContent = `${auto} ${auto === 1 ? 'item' : 'items'} blacked out`;
}

$('mask-selection').addEventListener('click', () => {
  const r = selectionRange($('review-paper'));
  if (!r) return;
  userMasks.push({ ...r, kind: 'user' });
  window.getSelection()?.removeAllRanges();
  refreshReview();
});
$('mask-undo').addEventListener('click', () => {
  userMasks.pop();
  refreshReview();
});

/* ---------- 3. Working ---------- */

function step(name: string, state: 'active' | 'done'): void {
  const li = $('steps').querySelector<HTMLElement>(`[data-step="${name}"]`);
  if (!li) return;
  li.classList.remove('active', 'done');
  li.classList.add(state);
}

$('check').addEventListener('click', () => void runCheck());

async function runCheck(): Promise<void> {
  if (!doc) return;
  for (const li of $('steps').querySelectorAll('li')) li.classList.remove('active', 'done');
  setStatus('working-status', '');
  show('working');
  try {
    step('read', 'active');
    const read = await readTerms(safe.text);
    step('read', 'done');
    if (!read.isOfferLetter) {
      show('review');
      $('ocr-warning').hidden = false;
      $('ocr-warning').textContent = 'This doesn’t look like a job offer or employment contract. Fineprint only checks those.';
      return;
    }
    step('verify', 'active');
    const v = verifyTerms(safe.text, { ...read.terms, otherConcerns: read.otherConcerns } as Terms);
    step('verify', 'done');
    step('rules', 'active');
    const findings = check(v.terms);
    step('rules', 'done');
    // Show the report now; the plain-English explanations fill in when ready.
    showReport(findings, v, null);
    const run = ++reportRun;
    try {
      const explained = await explain(findings, v.terms.role?.value, v.terms.employer?.value);
      if (run === reportRun) applyExplanations(findings, explained);
    } catch (e) {
      console.warn('explain failed', e);
      if (run === reportRun) applyExplanations(findings, null);
    }
  } catch (e) {
    setStatus('working-status', (e as Error).message, true);
    const back = document.createElement('button');
    back.className = 'btn';
    back.textContent = 'Back to the letter';
    back.onclick = () => show('review');
    $('working-status').append(' ', back);
  }
}

/* ---------- 4. Report ---------- */

let spoken = '';
let reportRun = 0;

/** Fills in the AI's plain-English text, or falls back to the rule text. */
function applyExplanations(findings: Finding[], explained: Explained | null): void {
  const plain = new Map(explained?.cards.map((c) => [c.id, c.plain]) ?? []);
  for (const f of findings) {
    const p = document.querySelector<HTMLElement>(`#finding-${f.id} .plain`);
    if (!p) continue;
    const text = plain.get(f.id);
    if (text) {
      p.textContent = text;
      p.classList.remove('pending');
    } else p.remove();
  }
  if (explained?.summary) $('summary').textContent = explained.summary;
  if (explained?.email) {
    let email = explained.email.trim();
    if (!email.includes('[Your name]')) email += '\n\nKind regards,\n[Your name]';
    $<HTMLTextAreaElement>('email').value = email;
  }
  spoken = [
    $('summary').textContent ?? '',
    ...findings.filter((f) => f.level !== 'green').map((f) => `${f.title}. ${plain.get(f.id) ?? f.law.summary}`),
  ].join(' ');
}

function showReport(findings: Finding[], v: ReturnType<typeof verifyTerms>, explained: Explained | null): void {
  const plain = new Map(explained?.cards.map((c) => [c.id, c.plain]) ?? []);
  const marks: Mark[] = [];
  const exact = new Map<string, boolean>();
  findings.forEach((f, i) => {
    const at = locateQuote(safe.text, f.quote);
    if (at) {
      marks.push({ start: at.start, end: at.end, level: f.level, id: f.id, order: i });
      exact.set(f.id, at.exact);
    }
  });

  tally($('tally'), findings);
  const asks = findings.filter((f) => f.level !== 'green').length;
  const summary =
    explained?.summary ??
    (asks ? `${asks} ${asks === 1 ? 'thing' : 'things'} to ask about before you sign.` : 'Nothing in this letter goes against the rules Fineprint checks.');
  $('summary').textContent = summary;

  const paper = $('report-paper');
  renderPaper(paper, safe.text, marks);
  paper.classList.remove('sweep');
  void paper.offsetWidth;
  paper.classList.add('sweep');

  const hasPhoto = (doc?.pages.length ?? 0) > 0;
  $('view-tabs').hidden = !hasPhoto;
  if (hasPhoto && doc) {
    renderPhotos($('photo-view'), doc, safe.masks, marks);
    setView('photo');
  } else {
    $('photo-view').hidden = true;
    paper.hidden = false;
  }

  const list = $('findings');
  list.replaceChildren();
  for (const f of findings) {
    list.append(findingCard(f, explained ? plain.get(f.id) : null, exact.has(f.id) ? (exact.get(f.id) as boolean) : null, () => focusMark(f.id)));
  }
  if (!findings.length) {
    const li = document.createElement('li');
    li.className = 'finding';
    li.textContent = 'Fineprint found none of the terms it checks in this letter. That can mean the letter is short; the official MOHRE contract will have the full terms.';
    list.append(li);
  }

  // AI-spotted clauses that no rule covers, minus ones already shown.
  const others = v.otherConcerns.filter((c) => !marks.some((m) => m.start < c.span.end && m.end > c.span.start));
  $('others').hidden = others.length === 0;
  if (others.length) {
    const box = $('others');
    box.replaceChildren();
    const h = document.createElement('h3');
    h.textContent = 'Also worth a look';
    const note = document.createElement('p');
    note.className = 'meta';
    note.textContent = 'Spotted by the AI reader. No rule checks these, so treat them as questions, not findings.';
    const ul = document.createElement('ul');
    for (const c of others) {
      const li = document.createElement('li');
      li.textContent = `${c.topic}: “${c.quote}”`;
      ul.append(li);
    }
    box.append(h, note, ul);
  }
  $('unconfirmed').hidden = v.unconfirmed.length === 0;
  $('unconfirmed').textContent = v.unconfirmed.length
    ? `Not judged, because the AI’s quote could not be found in your letter: ${v.unconfirmed.map((k) => TERM_LABEL[k]).join(', ')}.`
    : '';

  $<HTMLTextAreaElement>('email').value = explained?.email ?? fallbackEmail(findings, v.terms.role?.value);
  spoken = [summary, ...findings.filter((f) => f.level !== 'green').map((f) => `${f.title}. ${plain.get(f.id) ?? f.law.summary}`)].join(' ');
  show('report');
}

function setView(view: 'photo' | 'text'): void {
  $('photo-view').hidden = view !== 'photo';
  $('report-paper').hidden = view !== 'text';
  for (const b of $('view-tabs').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.view === view));
}
$('view-tabs').addEventListener('click', (e) => {
  const v = (e.target as HTMLElement).closest<HTMLButtonElement>('button')?.dataset.view;
  if (v === 'photo' || v === 'text') setView(v);
});

function focusMark(id: string): void {
  const photo = !$('photo-view').hidden;
  const target = photo ? $('photo-view').querySelector<HTMLElement>(`.box[data-id="${id}"]`) : document.getElementById(`mark-${id}`);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  for (const m of document.querySelectorAll('mark.focus')) m.classList.remove('focus');
  if (!photo) target.classList.add('focus');
}

$('report-paper').addEventListener('click', (e) => {
  const id = (e.target as HTMLElement).closest('mark')?.getAttribute('data-id');
  if (id) document.getElementById(`finding-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

$('speak').addEventListener('click', () => {
  const synth = window.speechSynthesis;
  if (!synth) return;
  if (synth.speaking) {
    synth.cancel();
    $('speak').textContent = 'Read aloud';
    return;
  }
  const u = new SpeechSynthesisUtterance(spoken);
  u.lang = 'en-GB';
  u.voice = synth.getVoices().find((v) => v.lang.startsWith('en')) ?? null;
  u.rate = 1;
  u.onend = () => ($('speak').textContent = 'Read aloud');
  $('speak').textContent = 'Stop reading';
  synth.speak(u);
});

$('copy-email').addEventListener('click', async () => {
  await navigator.clipboard.writeText($<HTMLTextAreaElement>('email').value);
  $('copy-status').textContent = 'Copied.';
  setTimeout(() => ($('copy-status').textContent = ''), 2500);
});

for (const id of ['restart-1', 'restart-2']) {
  $(id).addEventListener('click', () => {
    window.speechSynthesis?.cancel();
    doc = null;
    userMasks = [];
    ($('file') as HTMLInputElement).value = '';
    show('start');
  });
}
