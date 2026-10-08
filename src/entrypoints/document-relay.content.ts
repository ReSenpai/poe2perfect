import { installDocumentRelay } from '@/lib/page/document-relay';

/**
 * Runs in the page's own world before the site's scripts, so it sees the site's request for a profile build that no
 * HTML holds, and hands that build to the guide's content script. It sends nothing itself and changes no answer.
 */
export default defineContentScript({
  // The whole site, like the guide's script: build pages are often reached by in-app navigation.
  matches: ['https://mobalytics.gg/*', 'https://www.mobalytics.gg/*'],
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    installDocumentRelay(window);
  },
});
