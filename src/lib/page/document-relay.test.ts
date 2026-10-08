import { describe, expect, it, vi } from 'vitest';
import { createDocumentInbox, installDocumentRelay, type RelayWindow } from './document-relay';

const ID = 'e4321b1e-aa41-4c49-855d-97ffba18f5f5';
const GRAPHQL = 'https://mobalytics.gg/api/poe-2/v1/graphql/query';
const doc = (id = ID) => ({ id, data: { name: 'Whirling Assault', buildVariants: { values: [] } }, content: [] });
const byIdAnswer = (document: unknown) => ({ data: { game: { documents: { userGeneratedDocumentById: { error: null, data: document } } } } });
const byIdRequest = (id = ID) => ({
  method: 'POST',
  body: JSON.stringify({ operationName: 'Poe2UgNormalDocumentByIdQuery', query: 'query { userGeneratedDocumentById(input: $input) { data { id } } }', variables: { input: { id } } }),
});
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

/** The page world as the relay sees it: its own fetch, its own document and its event constructor. */
function pageWindow(answer: (url: string) => Response | Promise<Response>) {
  const siteFetch = vi.fn(async (input: RequestInfo | URL) => answer(String(input instanceof Request ? input.url : input)));
  const page = document.implementation.createHTMLDocument();
  const received: { id: string }[] = [];
  page.addEventListener('poe2-build-guide:document', (event) => received.push(JSON.parse((event as CustomEvent<string>).detail)));
  const win: RelayWindow = { fetch: siteFetch as unknown as typeof fetch, document: page, CustomEvent };
  installDocumentRelay(win);
  return { win, siteFetch, page, received };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('installDocumentRelay', () => {
  it("hands the site's answer back to the site untouched, and the build in it to the guide", async () => {
    const answer = json(byIdAnswer(doc()));
    const { win, siteFetch, received } = pageWindow(() => answer);

    const response = await win.fetch(GRAPHQL, byIdRequest());
    await settle();

    expect(response).toBe(answer);
    expect(await response.json()).toEqual(byIdAnswer(doc()));
    expect(siteFetch).toHaveBeenCalledWith(GRAPHQL, byIdRequest());
    expect(received).toEqual([doc()]);
  });

  it('leaves every other request alone', async () => {
    const { win, received } = pageWindow(() => json(byIdAnswer(doc())));

    await win.fetch(GRAPHQL, { method: 'POST', body: JSON.stringify({ operationName: 'NgfCommentsQuery', query: 'query { comments }' }) });
    await win.fetch('https://mobalytics.gg/api/lol/v1/graphql/query', byIdRequest());
    await win.fetch('https://cdn.mobalytics.gg/assets/icon.png');
    await settle();

    expect(received).toEqual([]);
  });

  it('passes on nothing from an answer without a build, and never breaks the request', async () => {
    const broken = pageWindow(() => new Response('not json'));
    const empty = pageWindow(() => json(byIdAnswer(null)));

    await expect(broken.win.fetch(GRAPHQL, byIdRequest())).resolves.toBeInstanceOf(Response);
    await empty.win.fetch(GRAPHQL, byIdRequest());
    await settle();

    expect([...broken.received, ...empty.received]).toEqual([]);
  });

  it("lets the site's own failures through as they are", async () => {
    const { win } = pageWindow(() => Promise.reject(new TypeError('Failed to fetch')));

    await expect(win.fetch(GRAPHQL, byIdRequest())).rejects.toThrow('Failed to fetch');
  });

  it('keeps the last five builds and hands them over again when the guide asks, as it may start later', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'].map((letter) => `${letter.repeat(8)}-0000-0000-0000-000000000000`);
    const { win, page, received } = pageWindow((url) => json(byIdAnswer(doc(url.split('#')[1]))));
    for (const id of ids) await win.fetch(`${GRAPHQL}#${id}`, byIdRequest(id));
    await settle();
    received.length = 0;

    page.dispatchEvent(new CustomEvent('poe2-build-guide:documents-replay'));

    expect(received.map((d) => d.id)).toEqual(ids.slice(1));
  });
});

describe('createDocumentInbox', () => {
  const send = (document: unknown) =>
    window.document.dispatchEvent(new CustomEvent('poe2-build-guide:document', { detail: JSON.stringify(document) }));

  it('waits for the build the site loads after the page opens', async () => {
    const inbox = createDocumentInbox(document);
    const waiting = inbox.waitFor(ID, 1000);

    send(doc());

    await expect(waiting).resolves.toEqual(doc());
    inbox.dispose();
  });

  it('has the build at once when the site loaded it before the guide asked', async () => {
    const inbox = createDocumentInbox(document);
    send(doc());

    await expect(inbox.waitFor(ID.toUpperCase(), 1000)).resolves.toEqual(doc());
    inbox.dispose();
  });

  it("asks the page to hand over again what it caught before the guide's script started", () => {
    const asked = vi.fn();
    document.addEventListener('poe2-build-guide:documents-replay', asked);

    const inbox = createDocumentInbox(document);

    expect(asked).toHaveBeenCalledOnce();
    document.removeEventListener('poe2-build-guide:documents-replay', asked);
    inbox.dispose();
  });

  it('gives up after the time limit, ignoring other builds and anything that is not a build', async () => {
    vi.useFakeTimers();
    const inbox = createDocumentInbox(document);
    const waiting = inbox.waitFor(ID, 15_000);

    send(doc('ffffffff-0000-0000-0000-000000000000'));
    send({ id: ID });
    window.document.dispatchEvent(new CustomEvent('poe2-build-guide:document', { detail: '{broken' }));
    window.document.dispatchEvent(new CustomEvent('poe2-build-guide:document', { detail: { id: ID } }));
    await vi.advanceTimersByTimeAsync(15_000);

    await expect(waiting).resolves.toBeNull();
    inbox.dispose();
    vi.useRealTimers();
  });
});
