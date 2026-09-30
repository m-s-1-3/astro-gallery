/** The gallery of a SITE THAT USES THIS PACKAGE, in a real browser.
 *
 *  Point SITE at a page that renders <Gallery>. The package has no page of
 *  its own — what has to hold is that it works where it is used.
 *
 *  `test/gallery.test.ts` runs the same script in jsdom and settles what the
 *  code does. It cannot settle what the page LOOKS like — jsdom has no
 *  layout — and both faults this feature shipped with were layout: slides
 *  that no stylesheet reached, and a page that went on scrolling behind the
 *  picture. So this one drives Chrome, at a phone size and a desk size, and
 *  measures.
 *
 *    docker compose -f docker-compose.dev.yml --profile media up -d
 *    npx puppeteer-core … — or simply: node scripts/check-gallery.mjs
 *
 *  Set CHROME to another binary, SITE to another address.
 */
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME
  ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SITE = process.env.SITE ?? 'http://127.0.0.1:4321/de/';

/** Four corners: a finger on a small screen and on a big one, a mouse on a
 *  big screen and in a narrow window. The pair that matters is the pointer,
 *  not the width — the arrows hang off `pointer: coarse` because a width can
 *  be reported wrong, and once was. */
const sizes = [
  ['phone, finger', { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, true],
  ['tablet, finger', { width: 1024, height: 768, isMobile: true, hasTouch: true }, true],
  ['desk, mouse', { width: 1440, height: 900 }, false],
  ['narrow window, mouse', { width: 700, height: 900 }, false],
];

const failed = [];
const is = (what, got, want) => {
  const ok = String(got) === String(want);
  if (!ok) failed.push(`${what}: ${got} (expected ${want})`);
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${what} = ${got}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, timeout: 120000, protocolTimeout: 180000,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});

for (const [name, viewport, coarse] of sizes) {
  console.log(`\n${name}`);
  const page = await browser.newPage();
  await page.setViewport(viewport);
  page.on('pageerror', (e) => failed.push(`page error: ${e}`));
  await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(1200);

  const page_ = await page.evaluate(() => ({
    coarse: matchMedia('(pointer: coarse)').matches,
    strip: getComputedStyle(document.querySelector('.ag-step')).display,
    viewport: document.querySelector('meta[name=viewport]').content,
  }));
  is('the pointer is read right', page_.coarse, coarse);
  is('strip arrows', page_.strip, (!coarse && viewport.width >= 960) ? 'grid' : 'none');
  // A locked scale made Chrome lay the page out at desk width inside a
  // phone-sized window. It must not come back.
  is('the viewport scale is not locked', /maximum-scale|user-scalable/.test(page_.viewport), false);

  await page.click('[data-ag-open]');
  await wait(700);

  // Where the page was pinned. The script writes it into the body, so the
  // check does not have to guess.
  const held = await page.evaluate(() => -parseInt(document.body.style.top || '0', 10));
  is('opens', await page.evaluate(() => document.querySelector('[data-ag-big]').classList.contains('is-open')), true);
  is('the page is pinned', await page.evaluate(() => getComputedStyle(document.body).position), 'fixed');
  is('pinned partway down, not at the top', held > 100, true);
  // The fault that shipped: slides no stylesheet reached, so no picture.
  // Where there is a finger, swiping leads and the buttons are in the way.
  is('lightbox arrows', await page.evaluate(() => getComputedStyle(document.querySelector('.ag-prev')).display),
    coarse ? 'none' : 'grid');
  is('the picture is laid out and loaded', await page.evaluate(() => {
    const im = document.querySelectorAll('.ag-photo')[0];
    const r = im.getBoundingClientRect();
    return r.width > 100 && r.height > 100 && im.complete && im.naturalWidth > 0;
  }), true);

  await page.mouse.move(viewport.width / 2, viewport.height / 2);
  await page.mouse.wheel({ deltaY: 1200 }).catch(() => {});
  await wait(400);
  is('the wheel moves nothing', await page.evaluate(() => window.scrollY), 0);
  is('and does not shift the hold',
    await page.evaluate(() => -parseInt(document.body.style.top || '0', 10)), held);

  await page.keyboard.press('ArrowRight');
  await wait(400);
  is('the arrow key leafs on', await page.evaluate(() => document.querySelector('[data-ag-at]').textContent), '2');
  is('and the next picture is there', await page.evaluate(() => {
    const im = document.querySelectorAll('.ag-photo')[1];
    return im.complete && im.naturalWidth > 0 && im.getBoundingClientRect().width > 100;
  }), true);

  await page.keyboard.press('Escape');
  await wait(600);
  is('escape closes', await page.evaluate(() => document.querySelector('[data-ag-big]').classList.contains('is-open')), false);
  is('the page is free again', await page.evaluate(() => getComputedStyle(document.body).position), 'static');
  is('and back where it was', Math.abs(await page.evaluate(() => window.scrollY) - held) < 4, true);

  await page.mouse.wheel({ deltaY: 400 });
  await wait(300);
  is('it scrolls again afterwards', await page.evaluate(() => window.scrollY) > held, true);
  is('no scrollbars', await page.evaluate(() =>
    getComputedStyle(document.documentElement).scrollbarWidth), 'none');

  await page.close();
}

await browser.close();
console.log(failed.length ? `\n${failed.length} failed:\n  ${failed.join('\n  ')}` : '\nall green');
process.exit(failed.length ? 1 : 0);
