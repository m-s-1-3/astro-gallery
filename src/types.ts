/** One picture in the gallery.
 *
 *  Plain addresses, not framework objects: every site gets them from
 *  somewhere else — a build-time import, a bucket, a CMS — and the gallery
 *  has no business knowing which.
 */
export interface GalleryImage {
  /** Small. What the strip shows. */
  thumb: string;
  /** Large. What the enlarged view loads, and only when it is reached. */
  full: string;
  /** What the picture shows, for a screen reader and for a broken image.
   *  Empty is allowed; the gallery then numbers it from `labels.open`. */
  alt: string;
  /** Optional `srcset` for the thumbnail. */
  srcset?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
}

/** The words. The gallery has no language of its own. */
export interface GalleryLabels {
  /** Announced on a thumbnail: "Enlarge the photo". */
  open: string;
  prev: string;
  next: string;
  close: string;
}
