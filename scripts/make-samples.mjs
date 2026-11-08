// Renders the fictional sample letter as a PDF and as a page image (for the
// photo test and the demo). Uses Playwright's Chromium.
// Run: node scripts/make-samples.mjs <path-to-playwright-module>
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const text = readFileSync('public/sample/dunes-digital-offer.txt', 'utf8');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const [head, ...rest] = text.split('\n');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: A4; margin: 22mm 20mm; }
  body { font: 11.2pt/1.5 Georgia, 'Times New Roman', serif; color: #1c1c1c; margin: 0; }
  .lh { border-bottom: 2.5pt solid #b7862f; padding-bottom: 8pt; margin-bottom: 14pt; }
  .lh b { font: 700 20pt/1.1 'Segoe UI', Arial, sans-serif; letter-spacing: 0.06em; color: #0f3550; }
  pre { font: inherit; white-space: pre-wrap; margin: 0; }
  .page { width: 170mm; padding: 22mm 20mm; background: #fff; }
</style></head><body><div class="page"><div class="lh"><b>${esc(head)}</b></div><pre>${esc(rest.join('\n').trim())}</pre></div></body></html>`;

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(html);
writeFileSync('public/sample/dunes-digital-offer.pdf', await page.pdf({ format: 'A4', printBackground: true }));
const el = await page.$('.page');
await el.screenshot({ path: 'eval/out/sample-page.png' });
await browser.close();
console.log('wrote public/sample/dunes-digital-offer.pdf and eval/out/sample-page.png');
