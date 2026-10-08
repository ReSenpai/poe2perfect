import { getBuildRef } from '@/lib/build-url';
import { extractBuildDocument } from '@/lib/data/preloaded-state';
import type { StaticDataResult } from '@/lib/data/static-data';
import { pickStaticSubset } from '@/lib/data/static-subset';
import type { RawBuildDocument, RawStaticData } from '@/lib/data/types';
import { scrubBuildDocument } from './scrub';

export interface BuildFixture {
  meta: { slug: string; url: string; capturedAt: string; staticCacheVersion: string | null };
  build: RawBuildDocument;
  staticData: RawStaticData | null;
}

export type CaptureResult =
  | { ok: true; fileName: string; fixture: BuildFixture; warnings: string[] }
  | { ok: false; message: string };

export interface CaptureOptions {
  url: string;
  loadPage: () => Promise<Document | string>;
  readStaticData: () => Promise<StaticDataResult>;
  /** A profile build addressed by id, which no page's HTML holds: as the site loaded it (see `document-relay`). */
  waitForDocument?: (id: string) => Promise<RawBuildDocument | null>;
  now?: () => Date;
}

/** Dev tool: snapshot of a build page's data for use as a test fixture. */
export async function captureFixture({
  url,
  loadPage,
  readStaticData,
  waitForDocument = async () => null,
  now = () => new Date(),
}: CaptureOptions): Promise<CaptureResult> {
  const ref = getBuildRef(url);
  if (!ref) return { ok: false, message: 'Это не страница билда' };
  const slug = ref.key;

  let doc: RawBuildDocument;
  if (ref.kind === 'profile' && ref.id) {
    const received = await waitForDocument(ref.id);
    if (!received) return { ok: false, message: 'Сайт не передал этот билд — перезагрузите страницу и попробуйте снова' };
    doc = received;
  } else {
    let page: Document | string;
    try {
      page = await loadPage();
    } catch (error) {
      return { ok: false, message: `Не удалось загрузить страницу: ${error instanceof Error ? error.message : String(error)}` };
    }
    const extracted = extractBuildDocument(page);
    if (!extracted.ok) {
      return { ok: false, message: `Не удалось прочитать билд (${extracted.error.code}): ${extracted.error.message}` };
    }
    doc = extracted.doc;
  }

  // Fixtures live in a public repository: no guide wording or other people's comments.
  const build = scrubBuildDocument(doc);
  const warnings: string[] = [];
  const staticResult = await readStaticData();
  if (!staticResult.ok) warnings.push('Справочник сайта недоступен — фикстура без staticData');

  return {
    ok: true,
    // A profile build's key holds a slash; the file stays one file.
    fileName: `${slug.replaceAll('/', '--')}.json`,
    warnings,
    fixture: {
      meta: {
        slug,
        url,
        capturedAt: now().toISOString(),
        staticCacheVersion: staticResult.ok ? staticResult.snapshot.cacheVersion : null,
      },
      build,
      staticData: staticResult.ok ? pickStaticSubset(staticResult.snapshot.staticData, build) : null,
    },
  };
}

export function summarizeFixture({ build, staticData }: BuildFixture): string {
  const variants = build.data.buildVariants?.values.length ?? 0;
  const entries = Object.values(staticData ?? {}).reduce(
    (sum, category) => sum + (category && Array.isArray(category.data) ? category.data.length : 0),
    0,
  );
  return `${build.data.name} · вариантов: ${variants} · записей справочника: ${entries}`;
}
