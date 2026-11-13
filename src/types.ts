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
  /** Shown under the picture in the enlarged view: "Wartebereich". Unlike
   *  `alt` it is for everyone, and a picture without one simply has none. */
  caption?: string | undefined;
  /** Optional `srcset` for the thumbnail. */
  srcset?: string | undefined;
  /** The size of the picture in pixels: put on the thumbnail so the strip
   *  keeps its place while loading, and with `fly` the shape and the upper
   *  limit of the enlarged view before the large file has loaded. Give the
   *  size of the LARGE file, or the original's; a picture is never drawn
   *  larger than it is. */
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
