/**
 * Raw shapes of mobalytics data, typed only as deep as the extension reads them.
 * Field-by-field models are added by the parser step; everything else stays `unknown`.
 */

export interface RawWidget {
  __typename: string;
  id: string;
  data: Record<string, unknown>;
}

export interface RawBuildDocument {
  id: string;
  data: { name: string; buildVariants?: { values: unknown[] }; [key: string]: unknown };
  content: RawWidget[];
  [key: string]: unknown;
}

/** One category of the site's static data, e.g. `poe2Gems`. */
export interface RawStaticCategory {
  data: unknown[];
  [key: string]: unknown;
}

/** `staticData.game.staticData` from the site's IndexedDB cache. */
export type RawStaticData = Record<string, RawStaticCategory | Record<string, unknown> | null>;
