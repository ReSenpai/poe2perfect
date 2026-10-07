import { relayApiDocuments } from '@/lib/page/document-relay';

export default defineContentScript({
  matches: ['https://mobalytics.gg/*', 'https://www.mobalytics.gg/*'],
  // Before the site's own scripts, so the fetch they call is already the relaying one.
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    relayApiDocuments(window);
  },
});
