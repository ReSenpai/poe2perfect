import { render } from 'preact';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import type { PageController } from '@/lib/page/controller';
import type { RememberedVariant, TabId } from '@/lib/ui/route';
import { BASE_CSS } from '@/ui/styles';
import { registerFonts } from '@/ui/theme/fonts';
import { INTER_SOURCES } from '@/ui/theme/inter-sources';
import appCss from './app.css?inline';
import { ConnectedApp } from './App';

/** Mounts the extension UI in an isolated shadow root at the end of the page body; returns the shadow host. */
export async function mountApp(
  ctx: ContentScriptContext,
  controller: PageController,
  preferences: {
    headerCollapsed: boolean;
    onHeaderCollapsedChange: (collapsed: boolean) => void;
    lastTab: TabId;
    onLastTabChange: (tab: TabId) => void;
    glanceCollapsed: boolean;
    onGlanceCollapsedChange: (collapsed: boolean) => void;
    lastVariants: Record<string, RememberedVariant>;
    onVariantChange: (buildSlug: string, variant: RememberedVariant) => void;
  },
): Promise<HTMLElement> {
  registerFonts({ fontSet: document.fonts, FontFace, sources: INTER_SOURCES });
  const ui = await createShadowRootUi(ctx, {
    name: 'poe2-build-guide',
    css: `${BASE_CSS}\n${appCss}`,
    position: 'inline',
    anchor: 'body',
    // Keep typing inside the UI from triggering the site's keyboard shortcuts.
    isolateEvents: true,
    onMount: (container) => {
      render(
        <ConnectedApp
          controller={controller}
          initialHeaderCollapsed={preferences.headerCollapsed}
          onHeaderCollapsedChange={preferences.onHeaderCollapsedChange}
          initialLastTab={preferences.lastTab}
          onLastTabChange={preferences.onLastTabChange}
          initialGlanceCollapsed={preferences.glanceCollapsed}
          onGlanceCollapsedChange={preferences.onGlanceCollapsedChange}
          initialLastVariants={preferences.lastVariants}
          onVariantChange={preferences.onVariantChange}
        />,
        container,
      );
      return container;
    },
    onRemove: (container) => {
      if (container) render(null, container);
    },
  });
  ui.mount();
  return ui.shadowHost;
}
