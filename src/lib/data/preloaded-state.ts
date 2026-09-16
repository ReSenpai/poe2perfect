import type { RawBuildDocument } from './types';

export type ExtractErrorCode = 'no-state-script' | 'invalid-json' | 'no-build-document';

export type ExtractResult =
  | { ok: true; doc: RawBuildDocument }
  | { ok: false; error: { code: ExtractErrorCode; message: string } };

const STATE_PREFIX = 'window.__PRELOADED_STATE__=';
const DOCUMENT_QUERY_KEY = 'ngf-ug-featured-document-page';

/**
 * Reads the build guide document from the site's server-rendered state script.
 * Content scripts can't see page globals, so the script text is parsed instead.
 */
export function extractBuildDocument(page: Document | string): ExtractResult {
  const document = typeof page === 'string' ? new DOMParser().parseFromString(page, 'text/html') : page;

  const scriptText = findStateScript(document);
  if (scriptText === null) {
    return failure('no-state-script', 'Page has no __PRELOADED_STATE__ script');
  }

  let state: unknown;
  try {
    state = JSON.parse(scriptText.slice(STATE_PREFIX.length).replace(/;\s*$/, ''));
  } catch (error) {
    return failure('invalid-json', `__PRELOADED_STATE__ is not valid JSON: ${String(error)}`);
  }

  const doc = findBuildDocument(state);
  if (!doc) {
    return failure('no-build-document', 'State has no build guide document');
  }
  return { ok: true, doc };
}

function findStateScript(document: Document): string | null {
  for (const script of document.querySelectorAll('script:not([src])')) {
    const text = script.textContent?.trimStart() ?? '';
    if (text.startsWith(STATE_PREFIX)) return text;
  }
  return null;
}

function findBuildDocument(state: unknown): RawBuildDocument | null {
  const queries = get(state, 'poe2State', 'apollo', 'graphqlV2', 'queries');
  if (!Array.isArray(queries)) return null;

  const query = queries.find((q) => Array.isArray(get(q, 'queryKey')) && get(q, 'queryKey', 0) === DOCUMENT_QUERY_KEY);
  const results = get(query, 'state', 'data');
  if (!Array.isArray(results)) return null;

  for (const result of results) {
    const doc = get(result, 'game', 'documents', 'userGeneratedDocumentBySlug', 'data');
    if (isBuildDocument(doc)) return doc;
  }
  return null;
}

function isBuildDocument(value: unknown): value is RawBuildDocument {
  return (
    typeof get(value, 'id') === 'string' &&
    typeof get(value, 'data', 'name') === 'string' &&
    Array.isArray(get(value, 'content'))
  );
}

function get(value: unknown, ...path: (string | number)[]): unknown {
  let current = value;
  for (const key of path) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}

function failure(code: ExtractErrorCode, message: string): ExtractResult {
  return { ok: false, error: { code, message } };
}
