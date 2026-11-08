// Takes the README and Devpost screenshots from the running site, using the
// fictional sample letter and its photos only.
// Run: node scripts/screenshots.mjs <path-to-playwright-index.mjs> [base-url]
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const base = process.argv[3] ?? 'http://localhost:8788';
const out = 'docs/media';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge' });

async function waitReport(page) {
  await page.waitForSelector('#report:not([hidden])', { timeout: 120_000 });
  await page.waitForFunction(() => !document.querySelector('.plain.pending'), null, { timeout: 120_000 });
  await page.waitForTimeout(2600); // let the highlighter sweep finish
}

// Desktop: sample letter as text.
let page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
await page.goto(base);
await page.screenshot({ path: `${out}/01-start.png` });
await page.click('#sample');
await page.waitForSelector('#review:not([hidden])');
await page.screenshot({ path: `${out}/02-review.png` });
await page.click('#check');
await waitReport(page);
await page.screenshot({ path: `${out}/03-report.png` });
await page.locator('#finding-basic-share').screenshot({ path: `${out}/04-gratuity-card.png` });
await page.locator('#finding-probation-length').screenshot({ path: `${out}/05-probation-card.png` });
await page.locator('.email').screenshot({ path: `${out}/06-hr-email.png` });

// Desktop: the same letter as two phone photos.
await page.goto(base);
await page.setInputFiles('#file', ['eval/out/sample-photo-p1.jpg', 'eval/out/sample-photo-p2.jpg']);
await page.waitForSelector('#review:not([hidden])', { timeout: 120_000 });
await page.click('#check');
await waitReport(page);
await page.screenshot({ path: `${out}/07-photo-report.png` });
await page.evaluate(() => (document.getElementById('photo-view').scrollTop = 560));
await page.waitForTimeout(300);
await page.locator('.letter-col').screenshot({ path: `${out}/08-photo-highlights.png` });
await page.close();

// Phone.
page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(base);
await page.screenshot({ path: `${out}/09-mobile-start.png` });
await page.click('#sample');
await page.click('#check');
await waitReport(page);
await page.screenshot({ path: `${out}/10-mobile-report.png` });
await browser.close();
console.log('screenshots written to', out);
