import { isBuildPageUrl } from '@/lib/build-url';
import { readStaticData } from '@/lib/data/static-data';
import { summarizeBuild } from '@/lib/dev/build-summary';
import { listenForCapture } from '@/lib/dev/capture-messaging';
import { captureFixture } from '@/lib/dev/fixture';
import { listenForPageCapture } from '@/lib/dev/page-capture';
import { listenForPageReport } from '@/lib/dev/page-report';
import { createBuildLoader } from '@/lib/page/build-loader';
import { createHtmlFetcher } from '@/lib/page/fetch-html';
import { createPageController, isOverlayVisible } from '@/lib/page/controller';
import { glanceCollapsedItem, headerCollapsedItem, lastTabItem, lastVariantsItem, pageModeItem, rememberVariant } from '@/lib/page/preferences';
import { guardFocus } from '@/lib/page/focus-guard';
import { setPageLocked } from '@/lib/page/page-lock';
import { mountApp } from '@/ui/app/mount';

const MARKER_ATTRIBUTE = 'data-poe2-build-guide';

const fetchHtml = createHtmlFetcher();

export default defineContentScript({
  // The whole site: build pages are often reached by in-app navigation, which doesn't inject scripts.
  matches: ['https://mobalytics.gg/*', 'https://www.mobalytics.gg/*'],
  runAt: 'document_idle',
  async main(ctx) {
    const load = createBuildLoader({
      initialUrl: location.href,
      initialDocument: document,
      fetchHtml,
      readStaticData: () => readStaticData({ timeoutMs: 10_000 }),
    });
    const controller = createPageController({
      load,
      initialMode: await pageModeItem.getValue(),
      onModeChange: (mode) => void pageModeItem.setValue(mode),
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
          lastTabItem.getValue(),
          glanceCollapsedItem.getValue(),
          lastVariantsItem.getValue(),
        ]).then(([headerCollapsed, lastTab, glanceCollapsed, lastVariants]) =>
          mountApp(ctx, controller, {
            headerCollapsed,
            onHeaderCollapsedChange: (collapsed) => void headerCollapsedItem.setValue(collapsed),
            lastTab,
            onLastTabChange: (tab) => void lastTabItem.setValue(tab),
            glanceCollapsed,
            onGlanceCollapsedChange: (collapsed) => void glanceCollapsedItem.setValue(collapsed),
            lastVariants,
            onVariantChange: (buildSlug, variant) =>
              void lastVariantsItem.getValue().then((remembered) => lastVariantsItem.setValue(rememberVariant(remembered, buildSlug, variant))),
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
      const loadStaticData = () => readStaticData({ timeoutMs: 5_000 });
      const capture = () => captureFixture({ url: location.href, loadPage: () => fetchHtml(location.href), readStaticData: loadStaticData });
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
        listenForPageReport(document, { event: 'poe2-build-guide:preview', attribute: 'data-poe2-build-guide-preview' }, async () => {
          // Dynamic import keeps the preview's CSS out of the production bundle.
          const { togglePreview } = await import('@/ui/dev/mount-preview');
          return { shown: await togglePreview(ctx, loadBuild) };
        }),
      );
    }
  },
});
