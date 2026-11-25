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
 *    SITE=http://127.0.0.1:4321/gallery/ npm run check:browser
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

/** A real pointer on the part of an opener that is on screen — no
 *  scroll-into-view. `page.click` scrolls the strip itself, and in an endless
 *  strip that runs a copy into the end, where it is rightly moved away from
 *  under the pointer. Null when none of the matches can be seen. */
const onScreen = (page, selector) => page.evaluate((sel) => {
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    const left = Math.max(r.left, 0), right = Math.min(r.right, innerWidth);
    const top = Math.max(r.top, 0), bottom = Math.min(r.bottom, innerHeight);
    if (right - left < 30 || bottom - top < 30) continue;
    const x = (left + right) / 2, y = (top + bottom) / 2;
    if (el.contains(document.elementFromPoint(x, y))) return { x, y, at: Number(el.dataset.agOpen) + 1 };
  }
  return null;
}, selector);

/** Where the strip stands in the window: what a visitor sees of the page. */
const stripTop = (page) => page.evaluate(() =>
  Math.round(document.querySelector('.ag-strip').getBoundingClientRect().top));
const isOpen = (page) => page.evaluate(() =>
  document.querySelector('[data-ag-big]').classList.contains('is-open'));

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
    viewport: document.querySelector('meta[name=viewport]').content,
  }));
  is('the pointer is read right', page_.coarse, coarse);
  // Since 1.5.0 the arrows have a row of their own below the strip, and it is
  // the row that is hidden — so ask what is rendered, not for one `display`.
  const wanted = !coarse && viewport.width >= 960;
  is('strip arrows are shown', await page.evaluate(() =>
    [...document.querySelectorAll('.ag-step')].every((b) => b.checkVisibility())), wanted);
  if (wanted) {
    is('and stand below the strip', await page.evaluate(() => {
      const strip = document.querySelector('.ag-strip').getBoundingClientRect();
      return [...document.querySelectorAll('.ag-step')].every((b) => b.getBoundingClientRect().top >= strip.bottom - 1);
    }), true);
  }
  // A locked scale made Chrome lay the page out at desk width inside a
  // phone-sized window. It must not come back.
  is('the viewport scale is not locked', /maximum-scale|user-scalable/.test(page_.viewport), false);

  // The strip settles in with the scroll and, once the page has been
  // scrolled past it, every picture stands fully there. Chrome supports scroll
  // timelines; where `reveal` is on, the frames carry the animation.
  const revealOn = await page.evaluate(() => !!document.querySelector('[data-ag-reveal]'));
  if (revealOn) {
    is('the strip pictures settle in on scroll', await page.evaluate(() =>
      getComputedStyle(document.querySelector('.ag-frame')).animationName), 'ag-settle');
    await page.evaluate(() => document.querySelector('.ag-strip').scrollIntoView({ block: 'center', behavior: 'instant' }));
    await wait(600);
    is('and are all fully there once in view', await page.evaluate(() =>
      [...document.querySelectorAll('.ag-frame')].slice(0, 2).every((f) => getComputedStyle(f).opacity === '1')), true);
  }
  // Soft arrival: nothing stays held back once it has loaded (a hold left on
  // would be a picture that never shows), and the stand-in is never touched.
  is('loaded strip pictures are not held back', await page.evaluate(() =>
    [...document.querySelectorAll('.ag-open img')].filter((im) => im.complete && im.hasAttribute('data-ag-wait')).length), 0);
  is('and are fully opaque', await page.evaluate(() =>
    [...document.querySelectorAll('.ag-open img')].filter((im) => im.complete)
      .every((im) => getComputedStyle(im).opacity === '1')), true);

  // Partway down before opening, so that a page pinned or given back at the
  // top shows. The position comes from this page: the strip near the upper
  // edge, at least 100 px down, never further than the page goes.
  await page.evaluate(() => {
    const top = document.querySelector('.ag-strip').getBoundingClientRect().top + scrollY;
    scrollTo({ top: Math.max(top - 20, 100), behavior: 'instant' });
  });
  await wait(600);
  const before = await page.evaluate(() => window.scrollY);
  const seen = await stripTop(page);
  is('the page is scrolled before opening', before > 0, true);

  const picture = await onScreen(page, '.ag-frame:not([data-ag-copy]) [data-ag-open]');
  if (!picture) throw new Error('no picture of the strip is on screen');
  await page.mouse.click(picture.x, picture.y);
  await wait(900);

  // Where the page was pinned. The script writes it into the body.
  const held = await page.evaluate(() => -parseFloat(document.body.style.top || '0'));
  is('opens', await isOpen(page), true);
  is('on the picture clicked', await page.evaluate(() => document.querySelector('[data-ag-at]').textContent), picture.at);
  is('the page is pinned', await page.evaluate(() => getComputedStyle(document.body).position), 'fixed');
  is('pinned where it stood', Math.abs(held - before) < 2, true);
  is('and nothing behind has moved', Math.abs(await stripTop(page) - seen) < 2, true);
  // The fault that shipped: slides no stylesheet reached, so no picture.
  // Where there is a finger, swiping leads and the buttons are in the way.
  is('lightbox arrows', await page.evaluate(() => getComputedStyle(document.querySelector('.ag-prev')).display),
    coarse ? 'none' : 'grid');
  is('the picture is laid out and loaded', await page.evaluate((i) => {
    const im = document.querySelectorAll('.ag-photo')[i];
    const r = im.getBoundingClientRect();
    return r.width > 100 && r.height > 100 && im.complete && im.naturalWidth > 0;
  }, picture.at - 1), true);

  is('the large picture is fully shown after its fade', await page.evaluate((i) => {
    const im = document.querySelectorAll('.ag-photo')[i];
    return !im.hasAttribute('data-ag-wait') && getComputedStyle(im).opacity === '1';
  }, picture.at - 1), true);

  await page.mouse.move(viewport.width / 2, viewport.height / 2);
  await page.mouse.wheel({ deltaY: 1200 }).catch(() => {});
  await wait(400);
  is('the wheel moves nothing', await page.evaluate(() => window.scrollY), 0);
  is('and does not shift the hold',
    await page.evaluate(() => -parseFloat(document.body.style.top || '0')), held);
  is('nor what is behind the picture', Math.abs(await stripTop(page) - seen) < 2, true);

  const next = picture.at % await page.evaluate(() => document.querySelectorAll('.ag-photo').length) + 1;
  await page.keyboard.press('ArrowRight');
  await wait(400);
  is('the arrow key leafs on', await page.evaluate(() => document.querySelector('[data-ag-at]').textContent), next);
  is('and the next picture is there', await page.evaluate((i) => {
    const im = document.querySelectorAll('.ag-photo')[i];
    return im.complete && im.naturalWidth > 0 && im.getBoundingClientRect().width > 100;
  }, next - 1), true);

  await page.keyboard.press('Escape');
  await wait(600);
  is('escape closes', await page.evaluate(() => document.querySelector('[data-ag-big]').classList.contains('is-open')), false);
  is('the page is free again', await page.evaluate(() => getComputedStyle(document.body).position), 'static');
  is('and back where it was', Math.abs(await page.evaluate(() => window.scrollY) - before) < 4, true);

  await page.mouse.wheel({ deltaY: 400 });
  await wait(300);
  is('it scrolls again afterwards', await page.evaluate(() => window.scrollY) > held, true);
  is('no scrollbars', await page.evaluate(() =>
    getComputedStyle(document.documentElement).scrollbarWidth), 'none');

  // An endless strip: the copies that peek in are pictures like any other to
  // whoever sees them, and have to open the one they show.
  await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(800);
  if (await page.evaluate(() => !!document.querySelector('[data-ag-loop] .ag-strip:not([data-ag-short]) [data-ag-copy]'))) {
    await page.evaluate(() => document.querySelector('.ag-strip').scrollIntoView({ block: 'center', behavior: 'instant' }));
    await wait(600);
    const copy = await onScreen(page, '[data-ag-copy] .ag-open');
    is('a copy is on screen', !!copy, true);
    if (copy) {
      await page.mouse.click(copy.x, copy.y);
      await wait(900);
      is('clicking it opens the large view', await isOpen(page), true);
      is('on the picture it shows', await page.evaluate(() => document.querySelector('[data-ag-at]').textContent), copy.at);
    }
  }

  await page.close();
}

// Reduced motion and no script: nothing may stay hidden or move.
{
  console.log('\nreduced motion');
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(800);
  is('no settle-in', await page.evaluate(() => getComputedStyle(document.querySelector('.ag-frame')).animationName), 'none');
  is('pictures are there at once', await page.evaluate(() =>
    [...document.querySelectorAll('.ag-open img')].every((im) => getComputedStyle(im).opacity === '1')), true);
  await page.close();

  console.log('\nno script');
  const bare = await browser.newPage();
  await bare.setViewport({ width: 1440, height: 900 });
  await bare.setJavaScriptEnabled(false);
  await bare.goto(SITE, { waitUntil: 'networkidle2', timeout: 60000 });
  await bare.evaluate(() => document.querySelector('.ag-strip').scrollIntoView({ block: 'center', behavior: 'instant' }));
  await wait(600);
  is('the pictures are visible', await bare.evaluate(() =>
    [...document.querySelectorAll('.ag-open img')].every((im) =>
      !im.hasAttribute('data-ag-wait') && getComputedStyle(im).opacity === '1')), true);
  await bare.close();
}

await browser.close();
console.log(failed.length ? `\n${failed.length} failed:\n  ${failed.join('\n  ')}` : '\nall green');
process.exit(failed.length ? 1 : 0);
