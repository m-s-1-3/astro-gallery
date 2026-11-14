/** The gallery, executed.
 *
 *  Two faults shipped in the version this package was lifted out of, and
 *  neither a type check nor a build could have seen either: both were about
 *  what happens in a browser. So this runs the component's own script in a
 *  DOM, and `npm run check:browser` runs the built page in Chrome.
 *
 *  The markup here is built by hand rather than rendered by Astro — pulling
 *  Astro in to render one component would cost more than it is worth. What
 *  keeps the two from drifting is the first test: every hook the script
 *  reaches for has to appear in the component.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { transform } from 'esbuild';

const component = readFileSync(new URL('../src/Gallery.astro', import.meta.url), 'utf8');
const template = component.slice(component.indexOf('---', 3) + 3, component.indexOf('<script>'));
const source = component.slice(component.indexOf('<script>') + 8, component.indexOf('</script>'));
const styles = component.slice(component.indexOf('<style is:global>'));

test('the component carries every hook the script reaches for', () => {
  const hooks = [...new Set([...source.matchAll(/\[data-(ag[a-z-]*)\]/g)].map((m) => m[1]!))];
  assert.ok(hooks.length >= 6, `expected a handful of hooks, found ${hooks.join(', ')}`);
  for (const hook of hooks) {
    assert.match(template, new RegExp(`data-${hook}`), `the template has no ${hook}`);
  }
  // The classes the script tests for by name, not by attribute.
  for (const cls of ['ag-slide', 'ag-photo', 'ag-frame']) {
    assert.match(template, new RegExp(cls), `the template has no .${cls}`);
  }
});

test('the stylesheet is global and reaches outside the component', () => {
  // Scoped, `html.ag-held` could never match: Astro's scope attribute goes
  // on the component's own elements, and <html> is not one of them.
  assert.match(component, /<style is:global>/);
  assert.match(styles, /html\.ag-held/);
});

/** The component's markup, as a page with four pictures. */
async function open(count = 4, loop = false, fly = false) {
  const js = (await transform(source, { loader: 'ts' })).code;
  const frames = Array.from({ length: count }, (_, i) =>
    `<li class="ag-frame"><button class="ag-open" data-ag-open="${i}">`
    + `<img src="thumb-${i}.webp" alt="Bild ${i + 1}"></button></li>`).join('');
  const slides = Array.from({ length: count }, (_, i) =>
    `<div class="ag-slide"><img class="ag-photo" data-src="big-${i}.webp" alt="Bild ${i + 1}"></div>`).join('');

  const dom = new JSDOM(
    `<!doctype html><html><body><div class="ag" data-ag ${loop ? 'data-ag-loop' : ''} ${fly ? 'data-ag-fly' : ''}>
       <div class="ag-band">
         <button class="ag-step" data-ag-step="-1">‹</button>
         <ul class="ag-strip" data-ag-strip>${frames}</ul>
         <button class="ag-step" data-ag-step="1">›</button>
       </div>
       <div class="ag-big" data-ag-big aria-hidden="true">
         <button data-ag-close>✕</button>
         <button data-ag-go="-1">‹</button>
         <div class="ag-view" data-ag-view><div class="ag-track" data-ag-track>${slides}</div></div>
         <button data-ag-go="1">›</button>
         <p class="ag-count"><span data-ag-at>1</span> / <span>${count}</span></p>
       </div>
     </div></body></html>`,
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://example.test/' },
  );
  const { window } = dom;
  window.HTMLElement.prototype.setPointerCapture = () => {};
  window.eval(js);
  const doc = window.document;
  return {
    window, doc,
    big: doc.querySelector('[data-ag-big]')!,
    at: () => doc.querySelector('[data-ag-at]')!.textContent,
    srcs: () => [...doc.querySelectorAll('.ag-photo')].map((im) => im.getAttribute('src')),
    click: (sel: string, i = 0) =>
      doc.querySelectorAll(sel)[i]!.dispatchEvent(new window.MouseEvent('click', { bubbles: true })),
    key: (key: string) => doc.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true })),
  };
}

test('clicking a picture opens it, at that picture', async () => {
  const g = await open();
  assert.equal(g.big.classList.contains('is-open'), false, 'closed until asked');
  g.click('[data-ag-open]', 2);
  assert.ok(g.big.classList.contains('is-open'));
  assert.equal(g.at(), '3');
  assert.equal(g.srcs()[2], 'big-2.webp', 'the large version, not the thumbnail');
});

test('only the picture shown and its two neighbours are fetched', async () => {
  const g = await open();
  g.click('[data-ag-open]', 2);
  assert.deepEqual(g.srcs().map((s) => s !== null), [false, true, true, true]);
});

test('the arrow keys leaf through and stop at both ends', async () => {
  const g = await open();
  g.click('[data-ag-open]', 0);
  g.key('ArrowLeft');
  assert.equal(g.at(), '1', 'the first has nothing before it');
  g.key('ArrowRight');
  g.key('ArrowRight');
  g.key('ArrowRight');
  g.key('ArrowRight');
  assert.equal(g.at(), '4', 'the last has nothing after it');
});

test('the buttons do what the keys do', async () => {
  const g = await open();
  g.click('[data-ag-open]', 0);
  g.click('[data-ag-go]', 1);
  assert.equal(g.at(), '2');
  g.click('[data-ag-go]', 0);
  assert.equal(g.at(), '1');
});

test('while a picture is open the page behind it is pinned', async () => {
  const g = await open();
  g.window.scrollY = 1234;
  const mode = g.window.history.scrollRestoration;
  g.click('[data-ag-open]', 1);
  assert.ok(g.doc.documentElement.classList.contains('ag-held'));
  assert.equal(g.doc.body.style.top, '-1234px', 'pinned where it stood');
  // Never touched: it belongs to the history entry and survives a reload.
  // Set to `manual` here, a visitor who reloaded with a picture open left
  // that entry on manual for good, and every later reload jumped to the top.
  assert.equal(g.window.history.scrollRestoration, mode,
    'the scroll restoration mode is not ours to change');

  g.key('Escape');
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(g.big.classList.contains('is-open'), false);
  assert.equal(g.doc.body.style.top, '');
  assert.equal(g.window.history.scrollRestoration, mode, 'still untouched');
});

test('a page left with a picture open is let go of first', async () => {
  // The browser writes the scroll position into the history entry as it
  // leaves, and a pinned body stands at zero: reloading with a picture open
  // came back at the top.
  const g = await open();
  g.window.scrollY = 700;
  g.click('[data-ag-open]', 1);
  assert.equal(g.doc.body.style.top, '-700px');
  g.window.dispatchEvent(new g.window.Event('pagehide'));
  assert.equal(g.doc.body.style.top, '', 'released on the way out');
  assert.equal(g.doc.documentElement.classList.contains('ag-held'), false);
});

test('the history entry is pushed before the page is pinned', async () => {
  // Otherwise the entry saves a scroll position of zero — the pinned body
  // reads as top — and the browser puts the page there on the way back.
  const g = await open();
  g.window.scrollY = 900;
  let topWhenPushed: string | null = null;
  const push = g.window.history.pushState.bind(g.window.history);
  g.window.history.pushState = ((...args: unknown[]) => {
    topWhenPushed = g.doc.body.style.top || '';
    return push(...(args as [unknown, string]));
  }) as typeof g.window.history.pushState;

  g.click('[data-ag-open]', 0);
  assert.equal(topWhenPushed, '', 'the body was still in the flow');
  assert.equal(g.doc.body.style.top, '-900px', 'and is pinned right after');
});

test('without the loop the ends are ends', async () => {
  const g = await open(4);
  g.click('[data-ag-open]', 0);
  g.key('ArrowLeft');
  assert.equal(g.at(), '1', 'the first has nothing before it');
  for (let i = 0; i < 6; i++) g.key('ArrowRight');
  assert.equal(g.at(), '4', 'and the last nothing after it');
});

test('with the loop, after the last comes the first', async () => {
  const g = await open(4, true);
  g.click('[data-ag-open]', 3);
  assert.equal(g.at(), '4');
  g.key('ArrowRight');
  // The crossing borrows a position that does not exist and normalises
  // afterwards, so the counter arrives with the animation.
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(g.at(), '1', 'round it goes');
  g.key('ArrowLeft');
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(g.at(), '4', 'and back the other way');
});

test('a crossing cannot be interrupted halfway', async () => {
  // Two steps inside the 330 ms would leave the track between two places.
  const g = await open(4, true);
  g.click('[data-ag-open]', 3);
  g.key('ArrowRight');
  g.key('ArrowRight');
  g.key('ArrowRight');
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(g.at(), '1', 'one crossing, not three');
});

test('the loop fetches the picture that is coming round', async () => {
  const g = await open(4, true);
  g.click('[data-ag-open]', 3);
  // Standing on the last one, the neighbours are the third and the FIRST.
  assert.deepEqual(g.srcs().map((s) => s !== null), [true, false, true, true]);
});

test('a single picture has nowhere to loop to', async () => {
  const g = await open(1, true);
  g.click('[data-ag-open]', 0);
  g.key('ArrowRight');
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(g.at(), '1');
});

test('a second gallery on the same page opens on its own pictures', async () => {
  const g = await open();
  // The script binds nothing per instance; it finds the root from the click.
  const second = g.doc.querySelector('[data-ag]')!.cloneNode(true) as HTMLElement;
  second.querySelectorAll('.ag-photo').forEach((im, i) => im.setAttribute('data-src', `other-${i}.webp`));
  g.doc.body.append(second);

  g.doc.querySelectorAll('[data-ag]')[1]!
    .querySelectorAll('[data-ag-open]')[1]!
    .dispatchEvent(new g.window.MouseEvent('click', { bubbles: true }));

  assert.equal(second.querySelector('[data-ag-at]')!.textContent, '2');
  assert.ok(second.querySelector('[data-ag-big]')!.classList.contains('is-open'));
  assert.equal(g.big.classList.contains('is-open'), false, 'the first one stays shut');
  assert.equal(second.querySelectorAll('.ag-photo')[1]!.getAttribute('src'), 'other-1.webp');
});

test('nothing is bound before the markup exists', async () => {
  // The gallery may be inside a `server:defer` island, which arrives after
  // this script has run. It must survive finding an empty page.
  const js = (await transform(source, { loader: 'ts' })).code;
  const dom = new JSDOM('<!doctype html><html><body></body></html>',
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://example.test/' });
  assert.doesNotThrow(() => dom.window.eval(js));
  dom.window.document.body.dispatchEvent(
    new dom.window.MouseEvent('click', { bubbles: true }));
  dom.window.document.dispatchEvent(
    new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
});

test('where nothing can fly, `fly` opens and closes as before', async () => {
  // jsdom has no layout and no animations — the same as a browser asked to
  // reduce motion, or a thumbnail that is out of sight: the picture has to
  // open and shut without a stand-in being left behind.
  const g = await open(4, false, true);
  g.click('[data-ag-open]', 2);
  assert.ok(g.big.classList.contains('is-open'));
  assert.equal(g.at(), '3');
  assert.equal(g.doc.querySelectorAll('.ag-ghost').length, 0);
  g.window.dispatchEvent(new g.window.PopStateEvent('popstate'));
  assert.ok(!g.big.classList.contains('is-open'));
  assert.equal(g.doc.querySelectorAll('.ag-ghost').length, 0);
  assert.equal(g.doc.querySelector<HTMLElement>('.ag-photo')!.style.visibility, '');
});

// ── Soft arrival and settling in ───────────────────────────────────────────

const tick = (window: { setTimeout: typeof setTimeout }) => new Promise((r) => window.setTimeout(r, 20));

test('`reveal` is a prop, on by default, and reaches the root as a hook', () => {
  assert.match(component, /reveal = true/);
  assert.match(template, /data-ag-reveal=\{reveal \? '' : undefined\}/);
});

test('the settle-in is scroll-bound, guarded and off for reduced motion', () => {
  const at = styles.indexOf('ag-settle');
  assert.ok(at > 0, 'the keyframes exist');
  const guards = styles.slice(0, styles.indexOf('@keyframes ag-settle'));
  assert.match(guards, /@media \(prefers-reduced-motion: no-preference\)\s*{\s*@supports \(animation-timeline: view\(\)\)/);
  assert.match(styles, /\.ag\[data-ag-reveal\] \.ag-strip \{ view-timeline: --ag-in block; \}/);
  assert.match(styles, /timeline-scope: --ag-in/);
  // Only opacity and transform move; the keyframes have no `to`.
  const frames = styles.slice(styles.indexOf('@keyframes ag-settle'), styles.indexOf('@keyframes ag-settle') + 200);
  assert.doesNotMatch(frames, /\bto\b\s*{/);
  assert.doesNotMatch(frames, /(width|height|margin|top|left)\s*:/);
});

test('the fade-in only holds back what is not there yet, only through script, never for reduced motion', () => {
  // Without script no attribute is ever set, so the hold has to hang off one.
  assert.match(styles, /\.ag-open img\[data-ag-wait\], \.ag-photo\[data-ag-wait\] \{ opacity: 0; \}/);
  assert.doesNotMatch(styles, /\.ag-open img \{[^}]*opacity: 0/);
  // The hold and the fade sit inside the no-preference query: with reduced
  // motion the hold would only be a delayed pop.
  const hold = styles.indexOf('[data-ag-wait], .ag-photo[data-ag-wait]');
  const query = styles.lastIndexOf('@media', hold);
  assert.match(styles.slice(query, hold), /^@media \(prefers-reduced-motion: no-preference\)/);
});

test('a strip picture still loading is held back, then fades in when it has loaded', async () => {
  const g = await open();
  await tick(g.window);
  const img = g.doc.querySelectorAll<HTMLImageElement>('.ag-open img')[0]!;
  assert.ok(img.hasAttribute('data-ag-wait'), 'held back while loading');
  img.dispatchEvent(new g.window.Event('load'));
  assert.ok(!img.hasAttribute('data-ag-wait'));
  assert.ok(img.hasAttribute('data-ag-in'), 'the fade plays');
});

test('a picture that is already complete is left alone', async () => {
  const g = await open();
  const img = g.doc.querySelectorAll<HTMLImageElement>('.ag-open img')[1]!;
  Object.defineProperty(img, 'complete', { value: true });
  await tick(g.window);
  const other = g.doc.querySelectorAll<HTMLImageElement>('.ag-open img')[0]!;
  assert.ok(other.hasAttribute('data-ag-wait'));
  // Re-scan through the same path an island arrival takes.
  const late = g.doc.createElement('div');
  late.innerHTML = '<div class="ag" data-ag><ul><li><button class="ag-open"><img id="late" src="x.webp"></button></li></ul></div>';
  const lateImg = late.querySelector<HTMLImageElement>('#late')!;
  Object.defineProperty(lateImg, 'complete', { value: true });
  g.doc.body.append(late);
  await tick(g.window);
  assert.ok(!lateImg.hasAttribute('data-ag-wait'));
  assert.ok(!lateImg.hasAttribute('data-ag-in'));
});

test('an error lifts the hold without a fade, so the alt text shows', async () => {
  const g = await open();
  await tick(g.window);
  const img = g.doc.querySelectorAll<HTMLImageElement>('.ag-open img')[2]!;
  img.dispatchEvent(new g.window.Event('error'));
  assert.ok(!img.hasAttribute('data-ag-wait'));
  assert.ok(!img.hasAttribute('data-ag-in'));
});

test('pictures of a gallery that arrives later are picked up too', async () => {
  const js = (await transform(source, { loader: 'ts' })).code;
  const dom = new JSDOM('<!doctype html><html><body></body></html>',
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://example.test/' });
  dom.window.eval(js);
  await tick(dom.window);
  const island = dom.window.document.createElement('div');
  island.innerHTML = '<div class="ag" data-ag><ul data-ag-strip><li class="ag-frame"><button class="ag-open"><img src="a.webp"></button></li></ul></div>';
  dom.window.document.body.append(island);
  await tick(dom.window);
  assert.ok(island.querySelector('img')!.hasAttribute('data-ag-wait'));
});

test('the large picture is held back and fades in once its file is set and loaded', async () => {
  const g = await open();
  g.click('[data-ag-open]', 1);
  const photo = g.doc.querySelectorAll<HTMLImageElement>('.ag-photo')[1]!;
  assert.equal(photo.getAttribute('src'), 'big-1.webp');
  assert.ok(photo.hasAttribute('data-ag-wait'));
  photo.dispatchEvent(new g.window.Event('load'));
  assert.ok(!photo.hasAttribute('data-ag-wait'));
  assert.ok(photo.hasAttribute('data-ag-in'));
  // The slide that has no file yet is not held back: there is nothing to wait for.
  assert.ok(!g.doc.querySelectorAll('.ag-photo')[3]!.hasAttribute('data-ag-wait'));
});

test('the flight stand-in is never faded, and a picture it still covers lands without one', async () => {
  const g = await open();
  g.click('[data-ag-open]', 0);
  const photo = g.doc.querySelectorAll<HTMLImageElement>('.ag-photo')[0]!;
  const ghost = g.doc.createElement('img');
  ghost.className = 'ag-ghost';
  ghost.src = 'thumb-0.webp';
  g.doc.querySelector('.ag-slide')!.append(ghost);
  await tick(g.window);
  assert.ok(!ghost.hasAttribute('data-ag-wait'), 'the stand-in is not touched');
  photo.dispatchEvent(new g.window.Event('load'));
  assert.ok(!photo.hasAttribute('data-ag-in'), 'swapped at once, no fade underneath');
});
