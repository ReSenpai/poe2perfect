import { describe, expect, it } from 'vitest';
import { extractApiDocument, extractBuildDocument } from './preloaded-state';

const DOC = {
  id: '00e278a1',
  data: { name: '[0.5.5] ED Contagion Lich', buildVariants: { values: [] } },
  content: [],
  tags: { data: [] },
};

function stateWith(queries: unknown[]) {
  return { api: { lang: 'en_us' }, poe2State: { apollo: { graphqlV2: { mutations: [], queries } } } };
}

function documentQuery(doc: unknown) {
  return {
    queryKey: ['ngf-ug-featured-document-page', 'builds', 'slug', 'en_us'],
    state: { data: [{ game: { documents: { userGeneratedDocumentBySlug: { error: null, data: doc } } } }, null] },
  };
}

const BANNER_QUERY = { queryKey: ['ngf-banner-takeover'], state: { data: [{ game: {} }, null] } };

function pageHtml(stateScript: string) {
  return `<!doctype html><html><head>
    <script>window.__APP_ENV__={"A":1};</script>
    <script>${stateScript}</script>
  </head><body><div id="root"></div></body></html>`;
}

/** Same escaping the site uses for "/" inside the inline script. */
function serialize(state: unknown) {
  return `window.__PRELOADED_STATE__=${JSON.stringify(state).replaceAll('/', '\\u002F')};`;
}

describe('extractBuildDocument', () => {
  it('finds the build document in page HTML', () => {
    const html = pageHtml(serialize(stateWith([BANNER_QUERY, documentQuery(DOC)])));

    const result = extractBuildDocument(html);

    expect(result).toEqual({ ok: true, doc: DOC });
  });

  it('accepts a parsed Document', () => {
    const html = pageHtml(serialize(stateWith([documentQuery(DOC)])));
    const document = new DOMParser().parseFromString(html, 'text/html');

    expect(extractBuildDocument(document)).toEqual({ ok: true, doc: DOC });
  });

  it('finds a profile build, which the site keeps under another query', () => {
    const profileQuery = {
      queryKey: ['ngf-ug-normal-document-page', 'gl1tch3d-s-blacial-golt', 'gl1tch3d', []],
      state: { data: [{ game: { documents: { userGeneratedDocumentBySlugifiedName: { error: null, data: DOC } } } }, null] },
    };
    const html = pageHtml(serialize(stateWith([BANNER_QUERY, profileQuery])));

    expect(extractBuildDocument(html)).toEqual({ ok: true, doc: DOC });
  });

  it('decodes \\u002F escapes in strings', () => {
    const doc = { ...DOC, data: { ...DOC.data, name: 'Chaos/Spell' } };
    const html = pageHtml(serialize(stateWith([documentQuery(doc)])));

    const result = extractBuildDocument(html);

    expect(result.ok && result.doc.data.name).toBe('Chaos/Spell');
  });

  it('keeps a "</" sequence inside JSON strings intact', () => {
    const doc = { ...DOC, data: { ...DOC.data, name: 'a \\u003C/b' } };
    const html = pageHtml(serialize(stateWith([documentQuery(doc)])));

    expect(extractBuildDocument(html).ok).toBe(true);
  });

  it('reports a missing state script', () => {
    const result = extractBuildDocument(pageHtml('window.__APP_I18N__={};'));

    expect(result).toMatchObject({ ok: false, error: { code: 'no-state-script' } });
  });

  it('reports broken JSON', () => {
    const result = extractBuildDocument(pageHtml('window.__PRELOADED_STATE__={"api":'));

    expect(result).toMatchObject({ ok: false, error: { code: 'invalid-json' } });
  });

  it('reports a state without the build document query', () => {
    const html = pageHtml(serialize(stateWith([BANNER_QUERY])));

    expect(extractBuildDocument(html)).toMatchObject({ ok: false, error: { code: 'no-build-document' } });
  });

  it('reports a query whose document is null', () => {
    const html = pageHtml(serialize(stateWith([documentQuery(null)])));

    expect(extractBuildDocument(html)).toMatchObject({ ok: false, error: { code: 'no-build-document' } });
  });

  it('reports a state of unexpected shape', () => {
    const html = pageHtml(serialize({ api: {} }));

    expect(extractBuildDocument(html)).toMatchObject({ ok: false, error: { code: 'no-build-document' } });
  });
});

describe('extractApiDocument', () => {
  const response = (doc: unknown) => ({
    data: { game: { documents: { userGeneratedDocumentById: { error: null, data: doc }, userGeneratedDocumentTypes: { data: [] } } } },
  });

  it('finds the build in the answer to the site query for a profile build by id', () => {
    expect(extractApiDocument(response(DOC))).toEqual(DOC);
  });

  it.each([
    ['no document', response(null)],
    ['a document of unexpected shape', response({ id: 'x' })],
    ['another query', { data: { game: { documents: { userGeneratedDocumentTypes: { data: [] } } } } }],
    ['an error answer', { errors: [{ message: 'nope' }] }],
    ['not an object', 'nope'],
  ])('is null for %s', (_name, value) => {
    expect(extractApiDocument(value)).toBeNull();
  });
});
