# @ms/astro-gallery

Film strip and lightbox for Astro sites. **One** version for every project,
instead of three that drift apart.

Clicking an image opens it large; you page with the arrows, the arrow keys or
by swiping, zoom with two fingers or a double tap, and close with Escape, the
cross, a tap beside the image or the browser's back button. The page behind
stays still and afterwards comes back exactly where it was.

## Installation

```
npm i git+https://github.com/m-s-1-3/astro-gallery.git#v1.0.0
```

```astro
---
import Gallery from '@ms/astro-gallery/Gallery.astro';
import type { GalleryImage } from '@ms/astro-gallery/types';

const images: GalleryImage[] = photos.map((p) => ({
  thumb: small(p), full: large(p), alt: p.alt, srcset: srcsetOf(p),
}));
---
<Gallery images={images} loop labels={{
  open: t('gallery.open'), prev: t('gallery.prev'),
  next: t('gallery.next'), close: t('gallery.close'),
}} />
```

| Prop | Default | Purpose |
|---|---|---|
| `images` | — | the images, `{thumb, full, alt, srcset?, width?, height?}` |
| `labels` | — | `open`, `prev`, `next`, `close` |
| `sizes` | `22rem` | `sizes` of the images in the strip |
| `loop` | `false` | endless: after the last image comes the first again |
| `class` | — | extra class on `.ag` |

**Over HTTPS, not SSH, and the repository public** — otherwise `npm ci` in a
Docker build cannot reach it. The containers build without SSH keys and
without tokens; a private repository would need one in every place, CI
included. Nothing about a gallery is secret.

The version is pinned to a tag, not a branch: `#v1.0.0` stays until someone
raises it on purpose. A `#main` would fetch something different on every
`npm ci`, and a Docker build that worked yesterday might not work tomorrow.

**Each project fetches its own data** — from the build, from a bucket, from a
CMS. The package only receives finished URLs.

## Styling

Everything hangs on CSS variables on `.ag`:

| Variable | Default | Purpose |
|---|---|---|
| `--ag-accent` | `#ff4d0d` | border of the large image, counter, button on hover |
| `--ag-backdrop` | `rgb(12 12 13 / .96)` | background behind the large image |
| `--ag-radius` | `0` | corners |
| `--ag-border` | `4px` | border width of the large image |
| `--ag-thumb` | `clamp(15rem, 32vw, 22rem)` | height of the images in the strip |
| `--ag-thumb-border` | `0` | border around the images in the strip |
| `--ag-on-dark` | `#fff` | text and borders on the dark background |

```css
.my-gallery { --ag-accent: #17a184; --ag-radius: 12px; }
```

The buttons inherit `font` and `color` from the page — the package sets no
typeface.

## Endless paging

`loop` turns the row into a ring: after the last image comes the first again,
before the first the last. For good reason **not** the default — with twenty
images it is convenient, with two it is a carousel, and without an end nobody
knows any more that they have seen everything.

Wrapping around looks like any other step. The image coming round is placed
temporarily in the neighbouring slot, the track glides to that **borrowed**
position, and is then normalised to the real one without any visible change.
A jump back across all images would read as rewinding, not as one step. While
that runs (330 ms) no further step is accepted — two wraps on top of each
other would leave the track stuck between two positions.

When dragging past the end, the wrapped image is already in the preview,
otherwise you would pull against a gap. And the resistance at the ends goes:
where there is no end, there is nothing to feel.

## Three things that are deliberate

**The slides are in the template, not in the script.** Astro scopes component
CSS by adding a `data-astro-…` attribute to the elements **of the template**.
An earlier version built its slides at runtime — border, arrows and counter
looked right, the images were a pile of broken icons. Hence
`<style is:global>` and slides in the template.

**The script binds nothing in advance.** Astro hoists it into the page bundle;
if the gallery sits in a `server:defer` island, the script runs long before
its markup exists. It listens on `document` and sets up each gallery on first
touch. That is also why several galleries on one page work.

**The arrows depend on the pointer type, not the width.** `pointer: coarse`
instead of `max-width`. A width can be reported wrongly: in Chrome's device
emulation the page was laid out at desktop width inside a phone window, the
media query did not match, and full-size arrow buttons appeared on the phone.

## Scroll lock

`overflow: hidden` is not enough — it removes the scrollbars, not the
scrolling, and on iOS not even that. The body is fixed and held at its offset
(`html.ag-held`, offset in `body.style.top`).

**`history.scrollRestoration` is deliberately left alone.** Setting it to
`manual` while an image is open looked like the fix for the browser putting
the page at the top on going back — and was an expensive mistake: the setting
belongs to the **history entry** and survives a reload. Anyone who reloaded
with an image open left that entry on `manual` for good, and from then on
every further reload of that page jumped to the very top.

What is right instead is the **order**: the history entry is pushed **before**
the body is fixed. Then the entry stores the real scroll position; a fixed
body reads as zero, and that is exactly what the browser had learned.

For the same reason the page is released on `pagehide`: whoever reloads with
an image open should come back where they were, not at the position the fixed
body pretended.

## Testing

```
npm test                                  # the script in jsdom
SITE=http://127.0.0.1:4321/de/ npm run check:browser   # in a real Chrome
```

`npm test` settles **what the code does**. `check:browser` settles **how the
page looks** — whether the image is really laid out and loaded, whether the
mouse wheel moves nothing, whether the page is back at the same spot
afterwards. It needs a running site that uses `<Gallery>` (`SITE=`) and a
local Chrome (`CHROME=`).

## Used by

- `piscinaidro` — images from PocketBase, in a `server:defer` island, `loop`
- `bibioneseafun` — images from the build *(still to be switched)*
- `fewovogelschar-astro` — *(still to be switched)*
