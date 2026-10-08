import { isBuildPageUrl } from '@/lib/build-url';
import { indexedDbCandidates } from '@/lib/data/page-idb';
import { readStaticData } from '@/lib/data/static-data';
import { createCommentsController } from '@/lib/comments/controller';
import { createCommentsSource } from '@/lib/comments/source';
import { summarizeBuild } from '@/lib/dev/build-summary';
import { probeComments } from '@/lib/dev/comments-probe';
import { listenForCapture } from '@/lib/dev/capture-messaging';
import { captureFixture } from '@/lib/dev/fixture';
import { listenForPageCapture } from '@/lib/dev/page-capture';
import { listenForPageReport } from '@/lib/dev/page-report';
import { createBuildLoader } from '@/lib/page/build-loader';
import { createDocumentInbox } from '@/lib/page/document-relay';
import { createHtmlFetcher } from '@/lib/page/fetch-html';
import { pageFetch } from '@/lib/page/page-fetch';
import { createPageController, isOverlayVisible } from '@/lib/page/controller';
import { glanceCollapsedItem, headerCollapsedItem, lastTabsItem, lastVariantsItem, pageModeItem, rememberPerBuild } from '@/lib/page/preferences';
import { guardFocus } from '@/lib/page/focus-guard';
import { setPageLocked } from '@/lib/page/page-lock';
import { mountApp } from '@/ui/app/mount';
import { revealOriginalComments } from '@/lib/page/original-comments';

const MARKER_ATTRIBUTE = 'data-poe2-build-guide';
/** How long a profile build addressed by id may take to arrive from the site's own request. */
const BUILD_BY_ID_TIMEOUT_MS = 15_000;

// Build pages are asked for as the page itself: in Firefox a content script's own fetch goes as the extension.
const fetchHtml = createHtmlFetcher(pageFetch());

export default defineContentScript({
  // The whole site: build pages are often reached by in-app navigation, which doesn't inject scripts.
  matches: ['https://mobalytics.gg/*', 'https://www.mobalytics.gg/*'],
  runAt: 'document_idle',
  async main(ctx) {
    const commentsSource = createCommentsSource({ fetch: pageFetch(), origin: location.origin, pageUrl: () => location.origin + location.pathname });
    // Profile builds addressed by id come from the site's own answer, caught by the page-world relay.
    const inbox = createDocumentInbox(document);
    ctx.onInvalidated(() => inbox.dispose());
    const load = createBuildLoader({
      initialUrl: location.href,
      initialDocument: document,
      fetchHtml,
      readStaticData: () => readStaticData({ idb: indexedDbCandidates(), timeoutMs: 10_000 }),
      waitForDocument: (id) => inbox.waitFor(id, BUILD_BY_ID_TIMEOUT_MS),
    });
    const controller = createPageController({
      load,
      initialMode: await pageModeItem.getValue(),
      onModeChange: (mode) => void pageModeItem.setValue(mode),
      createComments: (seed) => createCommentsController({ seed, source: commentsSource }),
    });

    controller.subscribe((state) => {
      setPageLocked(document, isOverlayVisible(state));
      if (state.active) document.documentElement.setAttribute(MARKER_ATTRIBUTE, 'active');
      else document.documentElement.removeAttribute(MARKER_ATTRIBUTE);
    });
    ctx.onInvalidated(() => {
      setPageLocked(document, false);
      document.documentElement.removeAttribute(MARKER_ATTRIBUTE);
    });

    let mounting: Promise<void> | null = null;
    const handleUrl = async (url: string) => {
      if (isBuildPageUrl(url)) {
        mounting ??= Promise.all([
          headerCollapsedItem.getValue(),
          lastTabsItem.getValue(),
          glanceCollapsedItem.getValue(),
          lastVariantsItem.getValue(),
        ]).then(([headerCollapsed, lastTabs, glanceCollapsed, lastVariants]) =>
          mountApp(ctx, controller, {
            headerCollapsed,
            onHeaderCollapsedChange: (collapsed) => void headerCollapsedItem.setValue(collapsed),
            lastTabs,
            onLastTabChange: (buildKey, tab) =>
              void lastTabsItem.getValue().then((remembered) => lastTabsItem.setValue(rememberPerBuild(remembered, buildKey, tab))),
            glanceCollapsed,
            onGlanceCollapsedChange: (collapsed) => void glanceCollapsedItem.setValue(collapsed),
            lastVariants,
            onVariantChange: (buildKey, variant) =>
              void lastVariantsItem.getValue().then((remembered) => lastVariantsItem.setValue(rememberPerBuild(remembered, buildKey, variant))),
            onOriginalComments: () => void revealOriginalComments(document),
          }).then((host) => {
            ctx.onInvalidated(guardFocus({ doc: document, host, isActive: () => isOverlayVisible(controller.getState()) }));
          }),
        );
        await mounting;
      }
      controller.handleUrl(url);
    };
    ctx.addEventListener(window, 'wxt:locationchange', (event) => void handleUrl(event.newUrl.href));
    await handleUrl(location.href);

    if (import.meta.env.DEV) {
      const loadStaticData = () => readStaticData({ idb: indexedDbCandidates(), timeoutMs: 5_000 });
      const capture = () =>
        captureFixture({
          url: location.href,
          loadPage: () => fetchHtml(location.href),
          readStaticData: loadStaticData,
          waitForDocument: (id) => inbox.waitFor(id, BUILD_BY_ID_TIMEOUT_MS),
        });
      ctx.onInvalidated(listenForCapture(browser.runtime.onMessage as never, capture));
      ctx.onInvalidated(listenForPageCapture(document, capture));

      const loadBuild = async () => {
        const result = await load(location.href);
        if (!result.ok) throw new Error(result.message);
        return result.build;
      };
      ctx.onInvalidated(
        listenForPageReport(document, { event: 'poe2-build-guide:parse', attribute: 'data-poe2-build-guide-parse' }, async () =>
          summarizeBuild(await loadBuild()),
        ),
      );
      ctx.onInvalidated(
        listenForPageReport(document, { event: 'poe2-build-guide:comments', attribute: 'data-poe2-build-guide-comments' }, async () => {
          const result = await load(location.href);
          if (!result.ok) throw new Error(result.message);
          return probeComments(result.comments, commentsSource);
        }),
      );
      ctx.onInvalidated(
        listenForPageReport(document, { event: 'poe2-build-guide:preview', attribute: 'data-poe2-build-guide-preview' }, async () => {
          // Dynamic import keeps the preview's CSS out of the production bundle.
          const { togglePreview } = await import('@/ui/dev/mount-preview');
          return { shown: await togglePreview(ctx, loadBuild) };
        }),
      );
      // The file is named by `data-poe2-build-guide-screenshot-name` on <html>, set before the event.
      ctx.onInvalidated(
        listenForPageReport(document, { event: 'poe2-build-guide:screenshot', attribute: 'data-poe2-build-guide-screenshot' }, async () => {
          const { saveScreenshot } = await import('@/lib/dev/screenshot');
          const name = document.documentElement.getAttribute('data-poe2-build-guide-screenshot-name') ?? 'screenshot';
          return saveScreenshot(name, (message) => browser.runtime.sendMessage(message));
        }),
      );
    }
  },
});
