import { isBuildDocument } from '@/lib/data/preloaded-state';
import type { RawBuildDocument } from '@/lib/data/types';

/**
 * A build published from a profile without a slug is in no page's HTML: the site loads it after the page opens.
 * A small script in the page's world catches that answer of the site's own request and hands the build to the guide,
 * so the guide reads exactly what the site shows, sending no request of its own.
 */
export const DOCUMENT_EVENT = 'poe2-build-guide:document';
/** The guide's script starts after the page's: it asks for what was caught before it listened. */
export const REPLAY_EVENT = 'poe2-build-guide:documents-replay';

const GRAPHQL_PATH = '/api/poe-2/v1/graphql/query';
const DOCUMENT_FIELD = 'userGeneratedDocumentById';
/** Builds kept for a guide that asks later, e.g. after moves inside the site, which serves them from its cache. */
const KEEP = 5;

export type RelayWindow = { fetch: typeof fetch; document: Document; CustomEvent: typeof CustomEvent };

/** Runs in the page's world: wraps its `fetch`, hands every answer back untouched, and passes builds on. */
export function installDocumentRelay(win: RelayWindow): void {
  const kept: string[] = [];
  const pass = (json: string) => win.document.dispatchEvent(new win.CustomEvent(DOCUMENT_EVENT, { detail: json }));
  const siteFetch = win.fetch;

  win.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    const answer = siteFetch.call(win, input, init);
    if (asksForBuild(input, init)) {
      answer
        .then((response) => response.clone().json())
        .then((body: unknown) => {
          const build = get(body, 'data', 'game', 'documents', DOCUMENT_FIELD, 'data');
          if (!isBuildDocument(build)) return;
          const json = JSON.stringify(build);
          kept.push(json);
          if (kept.length > KEEP) kept.shift();
          pass(json);
        })
        .catch(() => {});
    }
    return answer;
  } as typeof fetch;

  win.document.addEventListener(REPLAY_EVENT, () => kept.forEach(pass));
}

function asksForBuild(input: RequestInfo | URL, init?: RequestInit): boolean {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return url.includes(GRAPHQL_PATH) && typeof init?.body === 'string' && init.body.includes(DOCUMENT_FIELD);
}

export interface DocumentInbox {
  /** The build with this id, once the page hands it over; null when it hasn't within `timeoutMs`. */
  waitFor(id: string, timeoutMs: number): Promise<RawBuildDocument | null>;
  dispose(): void;
}

/** Runs in the guide's script: keeps the builds the page hands over and waits for the one a page needs. */
export function createDocumentInbox(doc: Document): DocumentInbox {
  const received = new Map<string, RawBuildDocument>();
  const waiting = new Map<string, Set<(build: RawBuildDocument) => void>>();

  const onDocument = (event: Event) => {
    const detail: unknown = (event as CustomEvent).detail;
    if (typeof detail !== 'string') return;
    let build: unknown;
    try {
      build = JSON.parse(detail);
    } catch {
      return;
    }
    if (!isBuildDocument(build)) return;
    const id = build.id.toLowerCase();
    received.delete(id);
    received.set(id, build);
    if (received.size > KEEP) received.delete(received.keys().next().value!);
    waiting.get(id)?.forEach((resolve) => resolve(build));
    waiting.delete(id);
  };
  doc.addEventListener(DOCUMENT_EVENT, onDocument);
  doc.dispatchEvent(new CustomEvent(REPLAY_EVENT));

  return {
    waitFor(id, timeoutMs) {
      const key = id.toLowerCase();
      const known = received.get(key);
      if (known) return Promise.resolve(known);
      return new Promise((resolve) => {
        const done = (build: RawBuildDocument | null) => {
          clearTimeout(timer);
          waiting.get(key)?.delete(done);
          resolve(build);
        };
        const timer = setTimeout(() => done(null), timeoutMs);
        if (!waiting.has(key)) waiting.set(key, new Set());
        waiting.get(key)!.add(done);
      });
    },
    dispose() {
      doc.removeEventListener(DOCUMENT_EVENT, onDocument);
      waiting.clear();
    },
  };
}

function get(value: unknown, ...path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
