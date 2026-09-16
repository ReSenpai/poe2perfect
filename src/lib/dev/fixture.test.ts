import { describe, expect, it, vi } from 'vitest';
import type { StaticDataResult } from '@/lib/data/static-data';
import { captureFixture } from './fixture';

const URL_ = 'https://mobalytics.gg/poe-2/builds/chaos-dot-lich?weaponSet=set1#equipment';
const NOW = new Date('2026-09-15T10:00:00Z');

const DOC = {
  id: 'doc-1',
  data: { name: 'Chaos Lich', buildVariants: { values: [{ skillGems: { gems: [{ activeSkill: { gemSlug: 'contagionplayer' } }] } }] } },
  content: [],
};

function pageHtml(doc: unknown) {
  const state = {
    poe2State: {
      apollo: {
        graphqlV2: {
          queries: [
            {
              queryKey: ['ngf-ug-featured-document-page'],
              state: { data: [{ game: { documents: { userGeneratedDocumentBySlug: { data: doc } } } }] },
            },
          ],
        },
      },
    },
  };
  return `<html><head><script>window.__PRELOADED_STATE__=${JSON.stringify(state)};</script></head></html>`;
}

const STATIC_OK: StaticDataResult = {
  ok: true,
  snapshot: {
    staticData: { poe2Gems: { data: [{ slug: 'contagionplayer' }, { slug: 'fireballplayer' }] } },
    cacheVersion: 'v0.0.340',
    timestamp: 1,
  },
};

describe('captureFixture', () => {
  it('bundles the build document with the static data it references', async () => {
    const result = await captureFixture({
      url: URL_,
      loadPage: async () => pageHtml(DOC),
      readStaticData: async () => STATIC_OK,
      now: () => NOW,
    });

    expect(result).toEqual({
      ok: true,
      fileName: 'chaos-dot-lich.json',
      warnings: [],
      fixture: {
        meta: { slug: 'chaos-dot-lich', url: URL_, capturedAt: '2026-09-15T10:00:00.000Z', staticCacheVersion: 'v0.0.340' },
        build: DOC,
        staticData: { poe2Gems: { data: [{ slug: 'contagionplayer' }] } },
      },
    });
  });

  it("leaves other people's comments and the guide's wording out of the fixture", async () => {
    const withComments = {
      ...DOC,
      content: [
        { __typename: 'NgfDocumentCmWidgetCommentsV1', id: 'comments', data: { payload: { comments: [{ plainTextContent: 'Great build!' }] } } },
        {
          __typename: 'NgfDocumentCmWidgetRichTextSimplifiedV2',
          id: 'text',
          data: { title: 'Overview', simplifiedContent: { value: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'My secret tech' }] }] } } } },
        },
      ],
    };

    const result = await captureFixture({ url: URL_, loadPage: async () => pageHtml(withComments), readStaticData: async () => STATIC_OK, now: () => NOW });

    const json = JSON.stringify(result.ok && result.fixture.build);
    expect(json).not.toContain('Great build!');
    expect(json).not.toContain('My secret tech');
    expect(json).toContain('"title":"Overview"');
  });

  it('still exports the build when static data is unavailable, with a warning', async () => {
    const result = await captureFixture({
      url: URL_,
      loadPage: async () => pageHtml(DOC),
      readStaticData: async () => ({ ok: false, reason: 'unavailable', message: 'nope' }),
      now: () => NOW,
    });

    expect(result).toMatchObject({
      ok: true,
      warnings: ['Справочник сайта недоступен — фикстура без staticData'],
      fixture: { staticData: null, meta: { staticCacheVersion: null } },
    });
  });

  it('fails on a non-build URL without loading the page', async () => {
    const loadPage = vi.fn();

    const result = await captureFixture({
      url: 'https://mobalytics.gg/poe-2/builds',
      loadPage,
      readStaticData: async () => STATIC_OK,
    });

    expect(result).toEqual({ ok: false, message: 'Это не страница билда' });
    expect(loadPage).not.toHaveBeenCalled();
  });

  it('fails when the build document cannot be extracted', async () => {
    const result = await captureFixture({
      url: URL_,
      loadPage: async () => '<html></html>',
      readStaticData: async () => STATIC_OK,
    });

    expect(result).toMatchObject({ ok: false, message: expect.stringContaining('no-state-script') });
  });

  it('fails when the page cannot be loaded', async () => {
    const result = await captureFixture({
      url: URL_,
      loadPage: async () => {
        throw new Error('HTTP 403');
      },
      readStaticData: async () => STATIC_OK,
    });

    expect(result).toEqual({ ok: false, message: 'Не удалось загрузить страницу: HTTP 403' });
  });
});
