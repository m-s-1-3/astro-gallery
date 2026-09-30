# @ms/astro-gallery

Filmstreifen und Lightbox für Astro-Seiten. **Eine** Fassung für alle
Projekte, statt drei, die auseinanderlaufen.

Ein Klick auf ein Bild öffnet es groß; geblättert wird mit den Pfeilen, den
Pfeiltasten oder per Wischen, gezoomt mit zwei Fingern oder Doppeltipp,
geschlossen mit Escape, dem Kreuz, einem Tipp neben das Bild oder dem
Zurück-Knopf des Browsers. Die Seite dahinter steht still und kommt
hinterher genau dort wieder, wo sie war.

## Einbinden

```
npm i git+https://gitlab.com/zc-dev/astro-gallery.git#v1.0.0
```

```astro
---
import Gallery from '@ms/astro-gallery/Gallery.astro';
import type { GalleryImage } from '@ms/astro-gallery/types';

const images: GalleryImage[] = fotos.map((f) => ({
  thumb: klein(f), full: gross(f), alt: f.alt, srcset: satz(f),
}));
---
<Gallery images={images} labels={{
  open: t('gallery.open'), prev: t('gallery.prev'),
  next: t('gallery.next'), close: t('gallery.close'),
}} />
```

**Über HTTPS, nicht über SSH, und das Repo öffentlich** — sonst kommt
`npm ci` im Docker-Build nicht daran. Die Container bauen ohne SSH-Schlüssel
und ohne Token; ein privates Repo bräuchte an jeder Stelle eines, auch in
der CI. Geheim ist an einer Galerie nichts.

Die Daten holt **jedes Projekt selbst** — aus dem Build, aus einem Bucket,
aus einem CMS. Das Paket bekommt nur fertige Adressen.

## Aussehen

Alles hängt an CSS-Variablen auf `.ag`:

| Variable | Vorgabe | wofür |
|---|---|---|
| `--ag-accent` | `#ff4d0d` | Rahmen des großen Bildes, Zähler, Knopf beim Überfahren |
| `--ag-backdrop` | `rgb(12 12 13 / .96)` | Grund hinter dem großen Bild |
| `--ag-radius` | `0` | Ecken |
| `--ag-border` | `4px` | Rahmenstärke des großen Bildes |
| `--ag-thumb` | `clamp(15rem, 32vw, 22rem)` | Höhe der Bilder im Streifen |
| `--ag-on-dark` | `#fff` | Schrift und Rahmen auf dunklem Grund |

```css
.meine-galerie { --ag-accent: #17a184; --ag-radius: 12px; }
```

Die Knöpfe erben `font` und `color` von der Seite — Schrift stellt das Paket
nicht ein.

## Drei Dinge, die hier absichtlich so sind

**Die Slides stehen im Template, nicht im Skript.** Astro macht
Komponenten-CSS eng, indem es den Elementen **des Templates** ein
`data-astro-…` anhängt. Eine Vorfassung baute ihre Slides zur Laufzeit —
Rahmen, Pfeile und Zähler sahen richtig aus, die Bilder waren ein Haufen
kaputter Symbole. Deshalb `<style is:global>` und Slides im Template.

**Das Skript bindet nichts im Voraus.** Astro hebt es ins Seiten-Bündel;
steckt die Galerie in einer `server:defer`-Insel, läuft es lange bevor es
ihr Markup gibt. Es hört am `document` und richtet jede Galerie beim ersten
Anfassen ein. Mehrere Galerien auf einer Seite gehen deshalb auch.

**Die Pfeile hängen am Zeigertyp, nicht an der Breite.** `pointer: coarse`
statt `max-width`. Eine Breite kann falsch gemeldet werden: in Chromes
Geräte-Emulation wurde die Seite in Schreibtisch-Breite in ein Handy-Fenster
gelegt, die Medienabfrage griff nicht, und auf dem Telefon standen
Pfeilknöpfe in voller Größe.

## Scroll-Sperre

`overflow: hidden` reicht nicht — das nimmt die Balken, nicht das Scrollen,
auf iOS nicht einmal das. Der Body wird festgesetzt und auf seinem Versatz
gehalten (`html.ag-held`, Versatz in `body.style.top`). Dazu
`history.scrollRestoration = 'manual'`, solange ein Bild offen ist: sonst
stellt der Browser beim `popstate` seine eigene Position wieder her — und
die ist null, weil der Body beim Setzen des History-Eintrags schon
festgesetzt war.

## Prüfen

```
npm test                                  # das Skript in jsdom
SITE=http://127.0.0.1:4321/de/ npm run check:browser   # in echtem Chrome
```

`npm test` klärt, **was der Code tut**. `check:browser` klärt, **wie die
Seite aussieht** — ob das Bild wirklich gelegt und geladen ist, ob das
Mausrad nichts bewegt, ob die Seite hinterher an derselben Stelle steht. Es
braucht eine laufende Seite, die `<Gallery>` benutzt (`SITE=`), und ein
lokales Chrome (`CHROME=`).

## Benutzt von

- `piscinaidro` — Bilder aus PocketBase, in einer `server:defer`-Insel
- `bibioneseafun` — Bilder aus dem Build *(noch umzustellen)*
- `fewovogelschar-astro` — *(noch umzustellen)*
