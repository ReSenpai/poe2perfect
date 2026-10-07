import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDocumentReceiver, relayApiDocuments } from './document-relay';

const API = 'https://mobalytics.gg/api/poe-2/v1/graphql/query';
const ID = 'e4321b1e-aa41-4c49-855d-97ffba18f5f5';

const doc = (id: string, name = 'Whirling Assault') => ({ id, data: { name, buildVariants: { values: [] } }, content: [] });
const answer = (id: string, name?: string) => JSON.stringify({ data: { game: { documents: { userGeneratedDocumentById: { error: null, data: doc(id, name) } } } } });
const askById = (id: string) => ({
  method: 'POST',
  body: JSON.stringify({
    query: 'query Poe2UgNormalDocumentByIdQuery($input: X!) { game: poe2 { documents { userGeneratedDocumentById(input: $input) { data { id } } } } }',
    variables: { input: { id, widgetsOverride: [] } },
  }),
});
const idAskedFor = (init?: RequestInit): string | undefined => {
  try {
    return JSON.parse(String(init?.body)).variables.input.id;
  } catch {
    return undefined;
  }
};

function setup() {
  const page = document.implementation.createHTMLDocument();
  const site = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const id = idAskedFor(init);
    return new Response(id ? answer(id) : '{"data":{}}');
  });
  const scope = { fetch: site as typeof fetch, document: page };
  relayApiDocuments(scope);
  const sent: string[] = [];
  page.addEventListener('poe2-build-guide:document', (event) => sent.push((event as CustomEvent<string>).detail));
  const ask = (id: string) => page.dispatchEvent(new CustomEvent('poe2-build-guide:document-request', { detail: id }));
  return { page, fetch: scope.fetch, site, sent, ask };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('relayApiDocuments', () => {
  it('passes on the answer when the site asks for a build by id, and leaves the site its own answer', async () => {
    const t = setup();

    const response = await t.fetch(API, askById(ID));

    expect(await response.text()).toBe(answer(ID));
    await vi.waitFor(() => expect(t.sent).toEqual([answer(ID)]));
    expect(t.site).toHaveBeenCalledWith(API, askById(ID));
  });

  it('ignores other requests', async () => {
    const t = setup();

    await t.fetch(API, { method: 'POST', body: JSON.stringify({ query: 'query Banner { game: poe2 { banner } }', variables: {} }) });
    await t.fetch('https://mobalytics.gg/api/accounts/v2/graphql/query', askById(ID));
    await t.fetch(API, { method: 'POST', body: 'userGeneratedDocumentById( but not json' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(t.sent).toEqual([]);
  });

  it('sends a build it already passed on again when asked for its id', async () => {
    const t = setup();
    await t.fetch(API, askById(ID));
    await vi.waitFor(() => expect(t.sent).toHaveLength(1));

    t.ask(ID);
    t.ask('another-id');

    expect(t.sent).toEqual([answer(ID), answer(ID)]);
  });

  it('keeps only the latest few builds', async () => {
    const t = setup();
    for (const n of [1, 2, 3, 4, 5, 6]) await t.fetch(API, askById(`id-${n}`));
    await vi.waitFor(() => expect(t.sent).toHaveLength(6));

    t.ask('id-1');
    t.ask('id-2');

    expect(t.sent.slice(6)).toEqual([answer('id-2')]);
  });
});

describe('createDocumentReceiver', () => {
  it('waits for the site to fetch the build', async () => {
    const t = setup();
    const received = createDocumentReceiver(t.page, { timeoutMs: 5_000 })(ID);

    await t.fetch(API, askById('another-id'));
    await t.fetch(API, askById(ID));

    await expect(received).resolves.toEqual(doc(ID));
  });

  it('gets a build the site fetched before anyone asked', async () => {
    const t = setup();
    await t.fetch(API, askById(ID));
    await vi.waitFor(() => expect(t.sent).toHaveLength(1));

    await expect(createDocumentReceiver(t.page, { timeoutMs: 5_000 })(ID)).resolves.toEqual(doc(ID));
  });

  it('skips a message that holds no build', async () => {
    const page = document.implementation.createHTMLDocument();
    const received = createDocumentReceiver(page, { timeoutMs: 5_000 })(ID);
    const send = (detail: unknown) => page.dispatchEvent(new CustomEvent('poe2-build-guide:document', { detail }));

    send('not json');
    send(JSON.stringify({ data: {} }));
    send({ id: ID });
    send(answer(ID, 'The one'));

    await expect(received).resolves.toEqual(doc(ID, 'The one'));
  });

  it('gives up with null when the build never comes', async () => {
    vi.useFakeTimers();
    const received = createDocumentReceiver(document.implementation.createHTMLDocument(), { timeoutMs: 5_000 })(ID);

    await vi.advanceTimersByTimeAsync(5_000);

    await expect(received).resolves.toBeNull();
  });
});
