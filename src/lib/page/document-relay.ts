import { extractApiDocument } from '@/lib/data/preloaded-state';
import type { RawBuildDocument } from '@/lib/data/types';

const DOCUMENT_EVENT = 'poe2-build-guide:document';
const REQUEST_EVENT = 'poe2-build-guide:document-request';
const API_PATH = '/api/poe-2/v1/graphql/query';
const DOCUMENT_FIELD = 'userGeneratedDocumentById(';
const KEPT = 5;

export interface RelayScope {
  fetch: typeof fetch;
  document: Document;
}

/** Page world: passes on the site's API answers for builds by id, which only the page's own fetch sees. */
export function relayApiDocuments(scope: RelayScope): void {
  const kept = new Map<string, string>();
  // Only strings cross between the page and the content script in both browsers.
  const send = (answer: string) => scope.document.dispatchEvent(new CustomEvent(DOCUMENT_EVENT, { detail: answer }));

  const keep = (id: string, answer: string) => {
    kept.delete(id);
    kept.set(id, answer);
    if (kept.size > KEPT) kept.delete(kept.keys().next().value!);
    send(answer);
  };

  const siteFetch = scope.fetch;
  scope.fetch = (input, init) => {
    const response = Reflect.apply(siteFetch, globalThis, [input, init]) as Promise<Response>;
    const id = documentIdAskedFor(input, init);
    if (id) {
      void response.then((r) => (r.ok ? r.clone().text() : null)).then((answer) => answer && keep(id, answer), () => {});
    }
    return response;
  };

  scope.document.addEventListener(REQUEST_EVENT, (event) => {
    const id: unknown = (event as CustomEvent).detail;
    const answer = typeof id === 'string' ? kept.get(id) : undefined;
    if (answer) send(answer);
  });
}

function documentIdAskedFor(input: RequestInfo | URL, init: RequestInit | undefined): string | null {
  if (typeof init?.body !== 'string' || !init.body.includes(DOCUMENT_FIELD)) return null;
  try {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    if (url.pathname !== API_PATH) return null;
    const id: unknown = JSON.parse(init.body)?.variables?.input?.id;
    return typeof id === 'string' ? id : null;
  } catch {
    return null;
  }
}

/** Content script side: the build the site fetched by id, or null when it doesn't come in time. */
export function createDocumentReceiver(doc: Document, { timeoutMs }: { timeoutMs: number }): (id: string) => Promise<RawBuildDocument | null> {
  return (id) =>
    new Promise((resolve) => {
      const finish = (found: RawBuildDocument | null) => {
        clearTimeout(timer);
        doc.removeEventListener(DOCUMENT_EVENT, onDocument);
        resolve(found);
      };
      const onDocument = (event: Event) => {
        const found = readAnswer((event as CustomEvent).detail);
        if (found?.id === id) finish(found);
      };
      const timer = setTimeout(() => finish(null), timeoutMs);
      doc.addEventListener(DOCUMENT_EVENT, onDocument);
      doc.dispatchEvent(new CustomEvent(REQUEST_EVENT, { detail: id }));
    });
}

function readAnswer(detail: unknown): RawBuildDocument | null {
  if (typeof detail !== 'string') return null;
  try {
    return extractApiDocument(JSON.parse(detail));
  } catch {
    return null;
  }
}
