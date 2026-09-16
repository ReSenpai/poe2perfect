import { render } from 'preact';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import type { Build } from '@/lib/build/model';
import { BASE_CSS } from '@/ui/styles';
import previewCss from './preview.css?inline';
import { RichTextPreview } from './RichTextPreview';

let current: { remove(): void } | null = null;

/** Shows the dev rich text preview, or removes it when it is already shown. Returns whether it is shown. */
export async function togglePreview(ctx: ContentScriptContext, loadBuild: () => Promise<Build>): Promise<boolean> {
  if (current) {
    current.remove();
    current = null;
    return false;
  }
  const build = await loadBuild();
  const ui = await createShadowRootUi(ctx, {
    name: 'poe2-build-guide-preview',
    css: `${BASE_CSS}
${previewCss}`,
    position: 'inline',
    anchor: 'body',
    onMount: (container) => {
      Object.assign(container.style, { position: 'fixed', top: '72px', right: '16px', zIndex: '2147483000' });
      render(<RichTextPreview build={build} />, container);
      return container;
    },
    onRemove: (container) => {
      if (container) render(null, container);
    },
  });
  ui.mount();
  current = ui;
  return true;
}
