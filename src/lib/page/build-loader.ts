import { getBuildSlug } from '@/lib/build-url';
import type { Build } from '@/lib/build/model';
import { parseBuild } from '@/lib/build/parse-build';
import { extractBuildDocument } from '@/lib/data/preloaded-state';
import type { StaticDataResult } from '@/lib/data/static-data';
import type { RawStaticData } from '@/lib/data/types';

export type LoadResult = { ok: true; build: Build } | { ok: false; message: string };

export interface BuildLoaderDeps {
  initialUrl: string;
  initialDocument: Document;
  fetchHtml: (url: string) => Promise<string>;
  readStaticData: () => Promise<StaticDataResult>;
}

/**
 * Loads and parses the build for a URL. The page's own document only holds the state of the build
 * it was opened with (and only for signed-out visitors); other builds are fetched as fresh HTML.
 */
export function createBuildLoader({ initialUrl, initialDocument, fetchHtml, readStaticData }: BuildLoaderDeps): (url: string) => Promise<LoadResult> {
  const initialSlug = getBuildSlug(initialUrl);
  let staticData: Promise<RawStaticData | null> | null = null;

  const loadStaticData = () => {
    staticData ??= readStaticData().then((result) => {
      if (result.ok) return result.snapshot.staticData;
      staticData = null; // The site may not have cached it yet: try again next time.
      return null;
    });
    return staticData;
  };

  return async (url) => {
    const slug = getBuildSlug(url);
    if (!slug) return { ok: false, message: 'Not a build page' };

    // The page's own document only has the build for signed-out visitors; otherwise fetch the page.
    let extracted = slug === initialSlug ? extractBuildDocument(initialDocument) : null;
    if (!extracted?.ok) {
      try {
        extracted = extractBuildDocument(await fetchHtml(url));
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return { ok: false, message: `Couldn't load the build page (${reason}). Check your connection and try again.` };
      }
    }

    if (!extracted.ok) {
      if (extracted.error.code === 'no-build-document') {
        return { ok: false, message: 'This page has no build guide. It may have been removed or made private.' };
      }
      return { ok: false, message: `The site's page has changed in a way the guide can't read yet. (${extracted.error.code})` };
    }

    return { ok: true, build: parseBuild(extracted.doc, await loadStaticData()) };
  };
}
